import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { extractSummary } from '@/lib/utils';
import { CrawlerFactory } from '@/services/crawlers';
import type { SourceType, CollectionStatus } from '@/types';

// 采集超时时间（毫秒）
const CRAWL_TIMEOUT = 15000; // 15秒
const SLOW_THRESHOLD = 8000; // 超过8秒算慢

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
          send('error', { message: '任务不存在' });
          controller.close();
          return;
        }

        send('stage', { stage: 'init', message: '正在初始化采集任务...' });

        // 清空现有文章
        await prisma.article.deleteMany({ where: { taskId } });

        const rawArticles: RawArticle[] = [];
        const seenUrls = new Set<string>();

        // 1. 从选中的信息源采集
        send('stage', { stage: 'datasource', message: '正在从信息源采集文章...' });
        send('log', { message: `共有 ${task.dataSources.length} 个信息源待采集` });

        let sourceIndex = 0;
        for (const source of task.dataSources) {
          sourceIndex++;
          send('log', { message: `[${sourceIndex}/${task.dataSources.length}] 正在采集: ${source.name}` });

          let collectionStatus: CollectionStatus = 'success';
          let errorMessage: string | null = null;

          try {
            const { articles, duration } = await crawlWithTimeout(
              source.type as SourceType,
              source.url,
              CRAWL_TIMEOUT
            );

            // 判断是否采集太慢
            if (duration > SLOW_THRESHOLD) {
              collectionStatus = 'slow';
            }

            if (articles.length === 0) {
              // 没有采集到文章，标记为失败
              collectionStatus = 'failed';
              errorMessage = '未能获取到文章';
              send('log', { message: `  └─ 从 ${source.name} 未获取到文章` });
            } else {
              for (const article of articles) {
                if (seenUrls.has(article.url)) continue;
                seenUrls.add(article.url);

                const rawArticle: RawArticle = {
                  taskId,
                  sourceId: source.id,
                  sourceName: source.name,
                  title: article.title,
                  content: article.content.substring(0, 50000),
                  summary: article.summary || extractSummary(article.content),
                  url: article.url,
                  imageUrl: article.imageUrl || null,
                  publishDate: article.publishDate || null,
                };

                rawArticles.push(rawArticle);

                // 立即发送采集到的文章
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

              const statusNote = collectionStatus === 'slow' ? ' (较慢)' : '';
              send('log', { message: `  └─ 从 ${source.name} 获取了 ${articles.length} 篇文章${statusNote}` });
            }
          } catch (error) {
            collectionStatus = 'failed';
            errorMessage = (error as Error).message;
            send('log', { message: `  └─ 采集失败: ${errorMessage}` });
          }

          // 更新信息源的采集状态（不中断主流程）
          try {
            await prisma.dataSource.update({
              where: { id: source.id },
              data: {
                collectionStatus,
                lastCollectionError: errorMessage,
              },
            });
          } catch (updateError) {
            console.error('更新信息源状态失败:', updateError);
          }
        }

        send('progress', { progress: 60 });
        send('log', { message: `共采集到 ${rawArticles.length} 篇文章` });

        send('progress', { progress: 80 });

        // 3. 批量保存所有文章（全部标记为选中，让生成报告时AI判断相关性）
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
              selected: true, // 所有文章都标记为选中，由AI在生成报告时判断相关性
            })),
          });
        }

        // 4. 更新任务步骤
        await prisma.researchTask.update({
          where: { id: taskId },
          data: { currentStep: 3 },
        });

        // 5. 获取保存后的文章（带ID），按日期降序排列
        const savedArticles = await prisma.article.findMany({
          where: { taskId },
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
