import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { extractSummary } from '@/lib/utils';
import { CrawlerFactory } from '@/services/crawlers';
import type { SourceType, CollectionStatus, DataSource } from '@/types';
import pLimit from 'p-limit';

// 采集超时时间（毫秒）
const CRAWL_TIMEOUT = 15000; // 15秒
const SLOW_THRESHOLD = 8000; // 超过8秒算慢
const CONCURRENT_CRAWLS = 3; // 并发采集数

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

interface RawArticle {
  taskId: string;
  sourceId: string | null;
  sourceName: string;
  title: string;
  content: string;
  summary: string;
  url: string;
  imageUrl: string | null;
  publishDate: Date | null;
}

interface CrawlResult {
  source: DataSource;
  articles: Awaited<ReturnType<typeof CrawlerFactory.crawl>>;
  duration: number;
  status: CollectionStatus;
  error: string | null;
}

// 带超时的采集
async function crawlWithTimeout(
  type: SourceType,
  url: string,
  timeout: number
): Promise<{ articles: Awaited<ReturnType<typeof CrawlerFactory.crawl>>; duration: number }> {
  const startTime = Date.now();

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('采集超时')), timeout);
  });

  const articles = await Promise.race([
    CrawlerFactory.crawl(type, url),
    timeoutPromise,
  ]);

  return { articles, duration: Date.now() - startTime };
}

// 采集单个信息源
async function crawlSource(source: DataSource): Promise<CrawlResult> {
  try {
    const { articles, duration } = await crawlWithTimeout(
      source.type as SourceType,
      source.url,
      CRAWL_TIMEOUT
    );

    let status: CollectionStatus = 'success';
    if (duration > SLOW_THRESHOLD) {
      status = 'slow';
    }
    if (articles.length === 0) {
      status = 'failed';
    }

    return { source, articles, duration, status, error: null };
  } catch (error) {
    return {
      source,
      articles: [],
      duration: 0,
      status: 'failed',
      error: (error as Error).message,
    };
  }
}

// 流式采集文章
export async function POST(request: NextRequest, { params }: RouteParams) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
      };

      try {
        const { taskId } = await params;
        const payload = await getCurrentUser(request);
        if (!payload) {
          send('error', { message: '未登录' });
          controller.close();
          return;
        }

        // 验证任务归属（只查询必要字段）
        const task = await prisma.researchTask.findFirst({
          where: { id: taskId, userId: payload.userId },
          select: {
            id: true,
            companyName: true,
            focusPoints: true,
            dataSources: {
              where: { selected: true },
              select: {
                id: true,
                name: true,
                url: true,
                type: true,
              },
            },
          },
        });

        if (!task) {
          send('error', { message: '任务不存在' });
          controller.close();
          return;
        }

        send('stage', { stage: 'init', message: '正在初始化采集任务...' });

        // 清空现有文章
        await prisma.article.deleteMany({ where: { taskId } });

        const rawArticles: RawArticle[] = [];
        const seenUrls = new Set<string>();

        // 1. 并发采集所有信息源
        send('stage', { stage: 'datasource', message: '正在从信息源采集文章...' });
        send('log', { message: `共有 ${task.dataSources.length} 个信息源待采集（并发数: ${CONCURRENT_CRAWLS}）` });

        const limit = pLimit(CONCURRENT_CRAWLS);
        let completedCount = 0;
        const totalSources = task.dataSources.length;

        // 创建所有采集任务
        const crawlPromises = task.dataSources.map((source) =>
          limit(async () => {
            const result = await crawlSource(source as DataSource);
            completedCount++;

            // 发送进度
            const progress = Math.round((completedCount / totalSources) * 50);
            send('progress', { progress });

            // 发送日志
            if (result.error) {
              send('log', { message: `[${completedCount}/${totalSources}] ${source.name}: 采集失败 - ${result.error}` });
            } else if (result.articles.length === 0) {
              send('log', { message: `[${completedCount}/${totalSources}] ${source.name}: 未获取到文章` });
            } else {
              const statusNote = result.status === 'slow' ? ' (较慢)' : '';
              send('log', { message: `[${completedCount}/${totalSources}] ${source.name}: 获取了 ${result.articles.length} 篇文章${statusNote}` });
            }

            return result;
          })
        );

        // 等待所有采集完成
        const results = await Promise.all(crawlPromises);

        // 处理采集结果
        const statusUpdates: Array<{
          id: string;
          status: CollectionStatus;
          error: string | null;
        }> = [];

        for (const result of results) {
          statusUpdates.push({
            id: result.source.id,
            status: result.status,
            error: result.error,
          });

          for (const article of result.articles) {
            if (seenUrls.has(article.url)) continue;
            seenUrls.add(article.url);

            const rawArticle: RawArticle = {
              taskId,
              sourceId: result.source.id,
              sourceName: result.source.name,
              title: article.title,
              content: article.content.substring(0, 50000),
              summary: article.summary || extractSummary(article.content),
              url: article.url,
              imageUrl: article.imageUrl || null,
              publishDate: article.publishDate || null,
            };

            rawArticles.push(rawArticle);

            // 发送采集到的文章
            send('article', {
              article: {
                title: rawArticle.title,
                summary: rawArticle.summary.substring(0, 100) + '...',
                url: rawArticle.url,
                sourceName: rawArticle.sourceName,
                publishDate: rawArticle.publishDate,
              },
              count: rawArticles.length,
            });
          }
        }

        send('progress', { progress: 60 });
        send('log', { message: `共采集到 ${rawArticles.length} 篇文章` });

        // 2. 批量更新信息源状态
        send('stage', { stage: 'update', message: '正在更新信息源状态...' });
        await Promise.all(
          statusUpdates.map((update) =>
            prisma.dataSource.update({
              where: { id: update.id },
              data: {
                collectionStatus: update.status,
                lastCollectionError: update.error,
              },
            }).catch((err) => console.error('更新信息源状态失败:', err))
          )
        );

        send('progress', { progress: 80 });

        // 3. 批量保存所有文章
        send('stage', { stage: 'save', message: '正在保存文章...' });

        if (rawArticles.length > 0) {
          await prisma.article.createMany({
            data: rawArticles.map((a) => ({
              taskId: a.taskId,
              sourceId: a.sourceId,
              title: a.title,
              content: a.content,
              summary: a.summary,
              url: a.url,
              imageUrl: a.imageUrl,
              publishDate: a.publishDate,
              sourceType: 'datasource',
              selected: true,
            })),
          });
        }

        // 4. 更新任务步骤
        await prisma.researchTask.update({
          where: { id: taskId },
          data: { currentStep: 3 },
        });

        // 5. 获取保存后的文章（带ID），只查询列表展示需要的字段
        const savedArticles = await prisma.article.findMany({
          where: { taskId },
          select: {
            id: true,
            title: true,
            summary: true,
            url: true,
            publishDate: true,
            sourceType: true,
            selected: true,
            createdAt: true,
          },
          orderBy: [
            { publishDate: 'desc' },
            { createdAt: 'desc' },
          ],
        });

        send('progress', { progress: 100 });

        // 6. 发送完成事件
        send('complete', {
          message: `采集完成，共 ${rawArticles.length} 篇文章`,
          articles: savedArticles,
        });

        controller.close();
      } catch (error) {
        send('error', { message: (error as Error).message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
