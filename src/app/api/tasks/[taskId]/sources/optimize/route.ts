import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { apiSuccess, apiError, isValidUrl, normalizeUrl } from '@/lib/utils';
import { deepseekService } from '@/services/ai/DeepseekService';
import type { OptimizeSourcesRequest, SourceType } from '@/types';

interface RouteParams {
  params: Promise<{ taskId: string }>;
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

// 优化信息源
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
    });

    if (!task) {
      return apiError('任务不存在', 404);
    }

    const body: OptimizeSourcesRequest = await request.json();
    const { userInput } = body;

    if (!userInput || userInput.trim().length === 0) {
      return apiError('请输入优化需求', 400);
    }

    // 验证用户输入是否与应用相关
    const validation = await deepseekService.validateInput(userInput);
    if (!validation.valid) {
      return apiError(
        validation.message || '请输入与信息源优化相关的内容，例如"添加更多科技媒体"或"移除国外源"',
        400
      );
    }

    // 获取当前信息源
    const currentSources = await prisma.dataSource.findMany({
      where: { taskId },
    });

    // 调用Deepseek优化
    const result = await deepseekService.optimizeSources(
      currentSources,
      userInput,
      task.companyName,
      task.focusPoints
    );

    // 处理优化结果
    const seenUrls = new Set<string>();
    currentSources.forEach((s) => seenUrls.add(normalizeUrl(s.url)));

    const newSources = result.sources.filter((s) => {
      if (!isValidUrl(s.url)) return false;
      const normalizedUrl = normalizeUrl(s.url);
      if (seenUrls.has(normalizedUrl)) return false;
      seenUrls.add(normalizedUrl);
      return true;
    });

    // 添加新信息源
    if (newSources.length > 0) {
      await prisma.dataSource.createMany({
        data: newSources.map((s) => ({
          taskId,
          name: s.name,
          url: s.url,
          type: toSourceType(s.type),
          origin: 'deepseek' as const,
          description: s.description,
          selected: false,
        })),
      });
    }

    // 返回更新后的信息源列表
    const allSources = await prisma.dataSource.findMany({
      where: { taskId },
      orderBy: [{ selected: 'desc' }, { createdAt: 'desc' }],
    });

    return apiSuccess({
      message: result.message,
      added: newSources.length,
      sources: allSources,
    });
  } catch (error) {
    console.error('优化信息源失败:', error);
    return apiError('优化信息源失败', 500);
  }
}
