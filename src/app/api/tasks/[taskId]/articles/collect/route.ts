import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { apiSuccess, apiError, extractSummary } from '@/lib/utils';
import { CrawlerFactory } from '@/services/crawlers';
import { searxngService } from '@/services/search/SearXNGService';
import type { SourceType } from '@/types';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

// 判断文章是否与公司和关注点相关
function isRelevant(text: string, companyName: string, focusPoints: string): boolean {
  const lowerText = text.toLowerCase();
  const companyKeywords = companyName.toLowerCase().split(/\s+/);
  const focusKeywords = focusPoints.toLowerCase().split(/[,，、\s]+/).filter((k) => k.length > 1);

  // 至少匹配公司名的一个关键词
  const hasCompany = companyKeywords.some((k) => lowerText.includes(k));
  if (!hasCompany) return false;

  // 如果有关注点关键词，至少匹配一个
  if (focusKeywords.length > 0) {
    return focusKeywords.some((k) => lowerText.includes(k));
  }

  return true;
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
    }> = [];
    const seenUrls = new Set<string>();

    // 1. 从选中的信息源采集
    for (const source of task.dataSources) {
      try {
        const articles = await CrawlerFactory.crawl(source.type as SourceType, source.url);

        for (const article of articles) {
          if (seenUrls.has(article.url)) continue;

          // 过滤相关文章
          const fullText = `${article.title} ${article.content}`;
          if (!isRelevant(fullText, task.companyName, task.focusPoints)) {
            continue;
          }

          seenUrls.add(article.url);
          collectedArticles.push({
            taskId,
            sourceId: source.id,
            title: article.title,
            content: article.content.substring(0, 50000), // 限制长度
            summary: article.summary || extractSummary(article.content),
            url: article.url,
            imageUrl: article.imageUrl || null,
            publishDate: article.publishDate || null,
            sourceType: 'datasource',
          });
        }
      } catch (error) {
        console.error(`采集信息源失败 (${source.url}):`, error);
        // 继续处理其他源
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

        collectedArticles.push({
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

    // 批量保存文章
    if (collectedArticles.length > 0) {
      await prisma.article.createMany({
        data: collectedArticles,
      });
    }

    // 更新任务步骤
    await prisma.researchTask.update({
      where: { id: taskId },
      data: { currentStep: 3 },
    });

    // 统计结果
    const stats = {
      total: collectedArticles.length,
      fromSources: collectedArticles.filter((a) => a.sourceType === 'datasource').length,
      fromSearch: collectedArticles.filter((a) => a.sourceType === 'search').length,
    };

    return apiSuccess({
      message: `采集完成，共获取 ${stats.total} 篇文章`,
      stats,
    });
  } catch (error) {
    console.error('文章采集失败:', error);
    return apiError('文章采集失败', 500);
  }
}
