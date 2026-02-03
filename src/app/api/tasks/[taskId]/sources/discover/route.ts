import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { apiSuccess, apiError, isValidUrl, normalizeUrl, getDomain } from '@/lib/utils';
import { searxngService } from '@/services/search/SearXNGService';
import { deepseekService } from '@/services/ai/DeepseekService';
import type { DiscoverSourcesRequest, SourceType, SourceOrigin } from '@/types';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

// 从URL推断信息源类型
function inferSourceType(url: string): SourceType {
  const lowerUrl = url.toLowerCase();
  if (
    lowerUrl.includes('/rss') ||
    lowerUrl.includes('.rss') ||
    lowerUrl.includes('/feed') ||
    lowerUrl.endsWith('.xml') ||
    lowerUrl.includes('atom')
  ) {
    return 'rss';
  }
  if (
    lowerUrl.includes('blog') ||
    lowerUrl.includes('medium.com') ||
    lowerUrl.includes('substack.com')
  ) {
    return 'blog';
  }
  if (
    lowerUrl.includes('news') ||
    lowerUrl.includes('36kr') ||
    lowerUrl.includes('techcrunch') ||
    lowerUrl.includes('theverge')
  ) {
    return 'news';
  }
  return 'website';
}

// 将类型字符串转换为SourceType枚举
function toSourceType(type: string): SourceType {
  const typeMap: Record<string, SourceType> = {
    rss: 'rss',
    atom: 'atom',
    feed: 'feed',
    blog: 'blog',
    news: 'news',
    website: 'website',
  };
  return typeMap[type.toLowerCase()] || 'website';
}

// 发现信息源
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const payload = await getCurrentUser(request);
    if (!payload) {
      return apiError('未登录', 401);
    }

    // 验证任务归属并获取任务信息
    const task = await prisma.researchTask.findFirst({
      where: { id: taskId, userId: payload.userId },
    });

    if (!task) {
      return apiError('任务不存在', 404);
    }

    const body: DiscoverSourcesRequest = await request.json();
    const methods = body.methods || ['builtin', 'search', 'deepseek'];

    const discoveredSources: Array<{
      name: string;
      url: string;
      type: SourceType;
      origin: SourceOrigin;
      category?: string;
      description?: string;
    }> = [];

    const seenUrls = new Set<string>();

    // 获取已有的信息源URL
    const existingSources = await prisma.dataSource.findMany({
      where: { taskId },
      select: { url: true },
    });
    existingSources.forEach((s) => seenUrls.add(normalizeUrl(s.url)));

    // 1. 从内置信息源过滤
    if (methods.includes('builtin')) {
      const curatedSources = await prisma.curatedSource.findMany();

      // 简单的关键词匹配
      const keywords = [
        task.companyName.toLowerCase(),
        ...task.focusPoints.toLowerCase().split(/[,，、\s]+/),
      ].filter((k) => k.length > 1);

      for (const source of curatedSources) {
        const searchText =
          `${source.name} ${source.description || ''} ${source.category}`.toLowerCase();
        const isMatch = keywords.some((k) => searchText.includes(k));

        if (isMatch) {
          const normalizedUrl = normalizeUrl(source.url);
          if (!seenUrls.has(normalizedUrl)) {
            seenUrls.add(normalizedUrl);
            discoveredSources.push({
              name: source.name,
              url: source.url,
              type: toSourceType(source.type),
              origin: 'builtin',
              category: source.category,
              description: source.description || undefined,
            });
          }
        }
      }
    }

    // 2. 通过搜索引擎发现
    if (methods.includes('search')) {
      const searchResults = await searxngService.searchSources(task.companyName, task.focusPoints);

      for (const result of searchResults) {
        if (isValidUrl(result.url)) {
          const normalizedUrl = normalizeUrl(result.url);
          if (!seenUrls.has(normalizedUrl)) {
            seenUrls.add(normalizedUrl);
            discoveredSources.push({
              name: result.title || getDomain(result.url),
              url: result.url,
              type: inferSourceType(result.url),
              origin: 'search',
              description: result.content?.substring(0, 200),
            });
          }
        }
      }
    }

    // 3. 通过Deepseek推荐
    if (methods.includes('deepseek')) {
      try {
        const recommended = await deepseekService.recommendSources(
          task.companyName,
          task.focusPoints
        );

        for (const source of recommended) {
          if (isValidUrl(source.url)) {
            const normalizedUrl = normalizeUrl(source.url);
            if (!seenUrls.has(normalizedUrl)) {
              seenUrls.add(normalizedUrl);
              discoveredSources.push({
                name: source.name,
                url: source.url,
                type: toSourceType(source.type),
                origin: 'deepseek',
                description: source.description,
              });
            }
          }
        }
      } catch (error) {
        console.error('Deepseek推荐失败:', error);
        // 继续执行，不中断流程
      }
    }

    // 批量创建信息源
    if (discoveredSources.length > 0) {
      await prisma.dataSource.createMany({
        data: discoveredSources.map((s) => ({
          taskId,
          name: s.name,
          url: s.url,
          type: s.type,
          origin: s.origin,
          category: s.category,
          description: s.description,
          selected: false,
        })),
      });
    }

    // 返回所有信息源
    const allSources = await prisma.dataSource.findMany({
      where: { taskId },
      orderBy: [{ selected: 'desc' }, { createdAt: 'desc' }],
    });

    return apiSuccess({
      discovered: discoveredSources.length,
      total: allSources.length,
      sources: allSources,
    });
  } catch (error) {
    console.error('发现信息源失败:', error);
    return apiError('发现信息源失败', 500);
  }
}
