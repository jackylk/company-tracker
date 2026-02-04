import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { apiSuccess, apiError, extractSummary } from '@/lib/utils';
import { CrawlerFactory } from '@/services/crawlers';
import { searxngService } from '@/services/search/SearXNGService';
import { deepseekService } from '@/services/ai/DeepseekService';
import type { SourceType } from '@/types';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

interface ArticleForAnalysis {
  index: number;
  title: string;
  summary: string;
}

interface AnalysisResult {
  index: number;
  isRelevant: boolean;
  category: string | null;
  reason?: string;
}

// 使用 Deepseek 批量分析文章相关性和分类
async function analyzeArticlesWithAI(
  articles: ArticleForAnalysis[],
  companyName: string,
  focusPoints: string
): Promise<AnalysisResult[]> {
  if (articles.length === 0) {
    return [];
  }

  // 构建文章列表文本
  const articlesText = articles
    .map((a) => `[${a.index}] 标题: ${a.title}\n摘要: ${a.summary}`)
    .join('\n\n');

  const result = await deepseekService.analyzeArticles(
    companyName,
    focusPoints,
    articlesText
  );

  return result;
}

// 开始采集文章
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const payload = await getCurrentUser(request);
    if (!payload) {
      return apiError('未登录', 401);
    }

    // 验证任务归属
    const task = await prisma.researchTask.findFirst({
      where: { id: taskId, userId: payload.userId },
      include: {
        dataSources: {
          where: { selected: true },
        },
      },
    });

    if (!task) {
      return apiError('任务不存在', 404);
    }

    // 清空现有文章
    await prisma.article.deleteMany({ where: { taskId } });

    // 收集所有待分析的文章
    const rawArticles: Array<{
      taskId: string;
      sourceId: string | null;
      title: string;
      content: string;
      summary: string;
      url: string;
      imageUrl: string | null;
      publishDate: Date | null;
      sourceType: 'datasource' | 'search';
    }> = [];
    const seenUrls = new Set<string>();

    // 1. 从选中的信息源采集
    for (const source of task.dataSources) {
      try {
        const articles = await CrawlerFactory.crawl(source.type as SourceType, source.url);

        for (const article of articles) {
          if (seenUrls.has(article.url)) continue;
          seenUrls.add(article.url);

          rawArticles.push({
            taskId,
            sourceId: source.id,
            title: article.title,
            content: article.content.substring(0, 50000),
            summary: article.summary || extractSummary(article.content),
            url: article.url,
            imageUrl: article.imageUrl || null,
            publishDate: article.publishDate || null,
            sourceType: 'datasource',
          });
        }
      } catch (error) {
        console.error(`采集信息源失败 (${source.url}):`, error);
      }
    }

    // 2. 从搜索引擎采集
    try {
      const searchResults = await searxngService.searchArticles(
        task.companyName,
        task.focusPoints
      );

      for (const result of searchResults) {
        if (seenUrls.has(result.url)) continue;
        seenUrls.add(result.url);

        rawArticles.push({
          taskId,
          sourceId: null,
          title: result.title,
          content: result.content,
          summary: extractSummary(result.content),
          url: result.url,
          imageUrl: null,
          publishDate: null,
          sourceType: 'search',
        });
      }
    } catch (error) {
      console.error('搜索引擎采集失败:', error);
    }

    // 3. 使用 Deepseek 批量分析文章
    const articlesForAnalysis: ArticleForAnalysis[] = rawArticles.map((a, i) => ({
      index: i,
      title: a.title,
      summary: a.summary.substring(0, 200), // 限制长度以节省 token
    }));

    let analysisResults: AnalysisResult[] = [];

    if (articlesForAnalysis.length > 0) {
      try {
        analysisResults = await analyzeArticlesWithAI(
          articlesForAnalysis,
          task.companyName,
          task.focusPoints
        );
      } catch (error) {
        console.error('AI分析失败，使用简单关键词匹配作为后备:', error);
        // 后备方案：简单关键词匹配
        analysisResults = articlesForAnalysis.map((a) => {
          const text = `${a.title} ${a.summary}`.toLowerCase();
          const hasCompany = text.includes(task.companyName.toLowerCase());
          return {
            index: a.index,
            isRelevant: hasCompany,
            category: hasCompany ? '通用' : null,
          };
        });
      }
    }

    // 4. 根据分析结果过滤和分类文章
    const collectedArticles: Array<{
      taskId: string;
      sourceId: string | null;
      title: string;
      content: string;
      summary: string;
      url: string;
      imageUrl: string | null;
      publishDate: Date | null;
      sourceType: 'datasource' | 'search';
      category: string | null;
    }> = [];

    const analysisMap = new Map(analysisResults.map((r) => [r.index, r]));
    let filteredCount = 0;

    for (let i = 0; i < rawArticles.length; i++) {
      const analysis = analysisMap.get(i);

      if (analysis && analysis.isRelevant) {
        collectedArticles.push({
          ...rawArticles[i],
          category: analysis.category,
        });
      } else {
        filteredCount++;
      }
    }

    // 5. 批量保存文章
    if (collectedArticles.length > 0) {
      await prisma.article.createMany({
        data: collectedArticles,
      });
    }

    // 6. 更新任务步骤
    await prisma.researchTask.update({
      where: { id: taskId },
      data: { currentStep: 3 },
    });

    // 7. 统计结果
    const categoryStats: Record<string, number> = {};
    for (const article of collectedArticles) {
      const cat = article.category || '未分类';
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
    }

    const stats = {
      total: collectedArticles.length,
      fromSources: collectedArticles.filter((a) => a.sourceType === 'datasource').length,
      fromSearch: collectedArticles.filter((a) => a.sourceType === 'search').length,
      filtered: filteredCount,
      rawCount: rawArticles.length,
      byCategory: categoryStats,
    };

    return apiSuccess({
      message: `采集完成，共获取 ${stats.total} 篇文章，过滤了 ${stats.filtered} 篇不相关文章`,
      stats,
    });
  } catch (error) {
    console.error('文章采集失败:', error);
    return apiError('文章采集失败', 500);
  }
}
