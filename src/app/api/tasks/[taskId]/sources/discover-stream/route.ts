import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { isValidUrl, normalizeUrl } from '@/lib/utils';
import { initCuratedSources } from '@/lib/init-curated-sources';
import type { SourceType, SourceOrigin } from '@/types';

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

interface RecommendedSource {
  name: string;
  url: string;
  type: string;
  description: string;
}

// 流式发现信息源
export async function POST(request: NextRequest, { params }: RouteParams) {
  const encoder = new TextEncoder();

  // 先解析请求体
  let requestBody: { companyName?: string; focusPoints?: string; useAI?: boolean } = {};
  try {
    requestBody = await request.json();
  } catch {
    // 忽略解析错误，使用默认值
  }

  // 是否使用AI推荐（默认只用内置源，更快）
  const useAI = requestBody.useAI === true;

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

        // 验证任务归属并获取任务信息
        const task = await prisma.researchTask.findFirst({
          where: { id: taskId, userId: payload.userId },
        });

        if (!task) {
          send('error', { message: '任务不存在' });
          controller.close();
          return;
        }

        // 优先使用请求体中的参数，否则使用数据库中的值
        const companyName = requestBody.companyName || task.companyName;
        const focusPoints = requestBody.focusPoints || task.focusPoints;

        // 如果请求体中有参数，同步更新到数据库
        if (requestBody.companyName || requestBody.focusPoints) {
          await prisma.researchTask.update({
            where: { id: taskId },
            data: { companyName, focusPoints },
          });
        }

        const discoveredSources: Array<{
          name: string;
          url: string;
          type: SourceType;
          origin: SourceOrigin;
          category?: string;
          description?: string;
        }> = [];

        const seenUrls = new Set<string>();

        // ===== AI 推荐模式：保留已有信息源，只追加新的 =====
        if (useAI) {
          // 获取已有的信息源URL，避免重复
          const existingSources = await prisma.dataSource.findMany({
            where: { taskId },
            select: { url: true },
          });
          existingSources.forEach((s) => seenUrls.add(normalizeUrl(s.url)));

          send('stage', { stage: 'deepseek', message: '正在获取AI推荐...' });

          const systemPrompt = `你是一个专业的信息源推荐助手。用户会告诉你一个公司名称和关注点，你需要推荐与该公司相关的信息源。

【重要】优先推荐以下类型的信息源（按优先级排序）：
1. RSS/Atom Feed 订阅源（最容易采集，优先推荐）
2. 官方博客、技术博客（通常有 RSS）
3. 新闻中心、公告页面
4. 普通网站页面（最后考虑）

【内容优先级】：
1. 该公司的官方信息源（官方博客RSS、技术博客、新闻中心RSS等）
2. 该公司创始人/高管的个人博客
3. 专门报道该公司的科技媒体RSS或专栏
4. 相关行业资讯网站

请以JSON数组格式返回推荐的信息源，每个信息源包含以下字段：
- name: 信息源名称
- url: 信息源URL（必须是真实可访问的URL，优先给出RSS/Feed链接）
- type: 类型（rss/atom/feed/blog/news/website，优先使用rss/atom/feed/blog）
- description: 简短描述

只返回JSON数组，不要包含其他文字说明。确保URL真实有效。`;

          const userPrompt = `公司名称：${companyName}
关注点：${focusPoints}

请推荐8-15个与"${companyName}"相关的高质量信息源。

【优先推荐】（必须尽量包含）：
1. ${companyName}的官方博客RSS或Atom订阅链接
2. ${companyName}的技术博客RSS（如有）
3. ${companyName}的官方新闻RSS
4. 报道${companyName}的科技媒体RSS（如36氪、虎嗅等的RSS）

【次要推荐】：
5. ${companyName}的官方网站
6. 相关行业网站

注意：优先给出 /rss、/feed、/atom.xml、.rss、.xml 结尾的订阅链接，这类链接更容易被程序采集。`;

          send('prompt', { prompt: userPrompt });

          try {
            const apiKey = process.env.DEEPSEEK_API_KEY || '';
            const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

            if (!apiKey) {
              send('log', { message: 'Deepseek API Key 未配置，跳过AI推荐' });
            } else {
              const response = await fetch(`${baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                  model: 'deepseek-chat',
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                  ],
                  temperature: 0.7,
                  max_tokens: 4096,
                  stream: true,
                }),
              });

              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }

              const reader = response.body?.getReader();
              const decoder = new TextDecoder();
              let fullContent = '';

              if (reader) {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  const chunk = decoder.decode(value, { stream: true });
                  const lines = chunk.split('\n').filter(line => line.trim() !== '');

                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      const data = line.slice(6);
                      if (data === '[DONE]') continue;

                      try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) {
                          fullContent += content;
                          send('token', { token: content });
                        }
                      } catch {
                        // 忽略解析错误
                      }
                    }
                  }
                }
              }

              // 解析推荐结果
              const jsonMatch = fullContent.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const recommended: RecommendedSource[] = JSON.parse(jsonMatch[0]);
                let aiCount = 0;
                for (const source of recommended) {
                  if (isValidUrl(source.url)) {
                    const normalizedUrl = normalizeUrl(source.url);
                    if (!seenUrls.has(normalizedUrl)) {
                      seenUrls.add(normalizedUrl);
                      const newSource = {
                        name: source.name,
                        url: source.url,
                        type: toSourceType(source.type),
                        origin: 'deepseek' as SourceOrigin,
                        description: source.description,
                      };
                      discoveredSources.push(newSource);
                      aiCount++;

                      // 立即创建并发送这个信息源
                      const created = await prisma.dataSource.create({
                        data: {
                          taskId,
                          name: newSource.name,
                          url: newSource.url,
                          type: newSource.type,
                          origin: newSource.origin,
                          description: newSource.description,
                          selected: false,
                        },
                      });
                      send('source', { source: created });
                    }
                  }
                }
                send('log', { message: `AI推荐了 ${aiCount} 个新信息源` });
              }
            }
          } catch (error) {
            send('log', { message: `AI推荐失败: ${(error as Error).message}` });
          }

          // 返回所有信息源（包括之前的和新增的）
          const allSources = await prisma.dataSource.findMany({
            where: { taskId },
            orderBy: { createdAt: 'desc' },
          });

          send('progress', { progress: 100 });
          send('complete', {
            discovered: discoveredSources.length,
            total: allSources.length,
            sources: allSources,
          });

          controller.close();
          return;
        }

        // ===== 内置源模式：清空并重新发现 =====
        await prisma.dataSource.deleteMany({
          where: { taskId },
        });

        send('stage', { stage: 'builtin', message: '正在从内置信息源中筛选...' });

        // 确保内置信息源数据已初始化
        await initCuratedSources();

        const curatedSources = await prisma.curatedSource.findMany();
        send('log', { message: `内置信息源库共 ${curatedSources.length} 条记录` });

        const keywords = [
          companyName.toLowerCase(),
          ...focusPoints.toLowerCase().split(/[,，、\s]+/),
        ].filter((k) => k.length > 1);

        send('log', { message: `搜索关键词: ${keywords.join(', ')}` });

        let builtinCount = 0;
        for (const source of curatedSources) {
          const searchText =
            `${source.name} ${source.description || ''} ${source.category}`.toLowerCase();
          const isMatch = keywords.some((k) => searchText.includes(k));

          if (isMatch) {
            const normalizedUrl = normalizeUrl(source.url);
            if (!seenUrls.has(normalizedUrl)) {
              seenUrls.add(normalizedUrl);
              const newSource = {
                name: source.name,
                url: source.url,
                type: toSourceType(source.type),
                origin: 'builtin' as SourceOrigin,
                category: source.category,
                description: source.description || undefined,
              };
              discoveredSources.push(newSource);
              builtinCount++;

              // 立即创建并发送这个信息源
              const created = await prisma.dataSource.create({
                data: {
                  taskId,
                  name: newSource.name,
                  url: newSource.url,
                  type: newSource.type,
                  origin: newSource.origin,
                  category: newSource.category,
                  description: newSource.description,
                  selected: false,
                },
              });
              send('source', { source: created });
            }
          }
        }

        send('log', { message: `从内置库中找到 ${builtinCount} 个匹配的信息源` });

        // 如果内置源没有找到任何信息源，自动调用 AI 推荐
        if (builtinCount === 0) {
          send('log', { message: '内置库中未找到匹配的信息源，自动使用 AI 推荐...' });
          send('stage', { stage: 'deepseek', message: '正在获取AI推荐...' });

          const systemPrompt = `你是一个专业的信息源推荐助手。用户会告诉你一个公司名称和关注点，你需要推荐与该公司相关的信息源。

【重要】优先推荐以下类型的信息源（按优先级排序）：
1. RSS/Atom Feed 订阅源（最容易采集，优先推荐）
2. 官方博客、技术博客（通常有 RSS）
3. 新闻中心、公告页面
4. 普通网站页面（最后考虑）

【内容优先级】：
1. 该公司的官方信息源（官方博客RSS、技术博客、新闻中心RSS等）
2. 该公司创始人/高管的个人博客
3. 专门报道该公司的科技媒体RSS或专栏
4. 相关行业资讯网站

【特别注意】：
- 如果你不确定这家公司是否存在，或者找不到任何相关信息源，请在返回的JSON中添加一个特殊对象：{"error": "无法找到该公司的相关信息源，请检查公司名称是否正确"}
- 确保所有推荐的URL都是真实可访问的

请以JSON数组格式返回推荐的信息源，每个信息源包含以下字段：
- name: 信息源名称
- url: 信息源URL（必须是真实可访问的URL，优先给出RSS/Feed链接）
- type: 类型（rss/atom/feed/blog/news/website，优先使用rss/atom/feed/blog）
- description: 简短描述

只返回JSON数组，不要包含其他文字说明。`;

          const userPrompt = `公司名称：${companyName}
关注点：${focusPoints}

请推荐8-15个与"${companyName}"相关的高质量信息源。

【优先推荐】（必须尽量包含）：
1. ${companyName}的官方博客RSS或Atom订阅链接
2. ${companyName}的技术博客RSS（如有）
3. ${companyName}的官方新闻RSS
4. 报道${companyName}的科技媒体RSS（如36氪、虎嗅等的RSS）

【次要推荐】：
5. ${companyName}的官方网站
6. 相关行业网站

注意：优先给出 /rss、/feed、/atom.xml、.rss、.xml 结尾的订阅链接，这类链接更容易被程序采集。

如果你不确定"${companyName}"是否是一个真实存在的公司，或者无法找到任何相关信息源，请返回包含error字段的JSON数组。`;

          send('prompt', { prompt: userPrompt });

          try {
            const apiKey = process.env.DEEPSEEK_API_KEY || '';
            const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

            if (!apiKey) {
              send('log', { message: 'Deepseek API Key 未配置，无法使用AI推荐' });
              send('validation_warning', {
                message: '内置库中未找到相关信息源，且AI推荐未配置',
              });
            } else {
              const response = await fetch(`${baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                  model: 'deepseek-chat',
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                  ],
                  temperature: 0.7,
                  max_tokens: 4096,
                  stream: true,
                }),
              });

              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }

              const reader = response.body?.getReader();
              const decoder = new TextDecoder();
              let fullContent = '';

              if (reader) {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;

                  const chunk = decoder.decode(value, { stream: true });
                  const lines = chunk.split('\n').filter(line => line.trim() !== '');

                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      const data = line.slice(6);
                      if (data === '[DONE]') continue;

                      try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) {
                          fullContent += content;
                          send('token', { token: content });
                        }
                      } catch {
                        // 忽略解析错误
                      }
                    }
                  }
                }
              }

              // 解析推荐结果
              const jsonMatch = fullContent.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const recommended = JSON.parse(jsonMatch[0]) as Array<RecommendedSource | { error: string }>;

                // 检查是否有错误信息
                const errorItem = recommended.find((item): item is { error: string } => 'error' in item);
                if (errorItem) {
                  send('validation_failed', {
                    message: errorItem.error,
                  });
                  send('log', { message: `AI提示: ${errorItem.error}` });
                } else {
                  let aiCount = 0;
                  for (const item of recommended) {
                    if (!('url' in item)) continue; // 跳过错误项
                    const source = item as RecommendedSource;
                    if (isValidUrl(source.url)) {
                      const normalizedUrl = normalizeUrl(source.url);
                      if (!seenUrls.has(normalizedUrl)) {
                        seenUrls.add(normalizedUrl);
                        const newSource = {
                          name: source.name,
                          url: source.url,
                          type: toSourceType(source.type),
                          origin: 'deepseek' as SourceOrigin,
                          description: source.description,
                        };
                        discoveredSources.push(newSource);
                        aiCount++;

                        // 立即创建并发送这个信息源
                        const created = await prisma.dataSource.create({
                          data: {
                            taskId,
                            name: newSource.name,
                            url: newSource.url,
                            type: newSource.type,
                            origin: newSource.origin,
                            description: newSource.description,
                            selected: false,
                          },
                        });
                        send('source', { source: created });
                      }
                    }
                  }
                  send('log', { message: `AI推荐了 ${aiCount} 个信息源` });
                }
              }
            }
          } catch (error) {
            send('log', { message: `AI推荐失败: ${(error as Error).message}` });
          }
        }

        const allSources = await prisma.dataSource.findMany({
          where: { taskId },
          orderBy: { createdAt: 'desc' },
        });

        send('progress', { progress: 100 });
        send('complete', {
          discovered: discoveredSources.length,
          total: allSources.length,
          sources: allSources,
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
