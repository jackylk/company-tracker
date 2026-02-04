import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import type { Article } from '@/types';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

// 生成参考文章列表章节
function generateReferencesSection(articles: Article[]): string {
  if (articles.length === 0) {
    return '';
  }

  const references = articles
    .map((a, i) => `${i + 1}. [${a.title}](${a.url})`)
    .join('\n');

  return `\n\n## 参考文章\n\n${references}\n`;
}

// 流式生成报告
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

        // 获取任务信息
        const task = await prisma.researchTask.findFirst({
          where: { id: taskId, userId: payload.userId },
        });

        if (!task) {
          send('error', { message: '任务不存在' });
          controller.close();
          return;
        }

        const body = await request.json();
        const { template } = body;

        if (!template) {
          send('error', { message: '请提供报告模板' });
          controller.close();
          return;
        }

        // 获取选中的文章
        const selectedArticles = await prisma.article.findMany({
          where: { taskId, selected: true },
        });

        if (selectedArticles.length === 0) {
          send('error', { message: '没有相关文章可用于生成报告' });
          controller.close();
          return;
        }

        send('stage', { stage: 'prepare', message: '正在准备文章数据...' });
        send('log', { message: `共有 ${selectedArticles.length} 篇相关文章` });

        // 构建 prompt
        const systemPrompt = `你是一个专业的调研报告撰写助手。用户会提供一些关于某个公司的文章内容，你需要根据这些内容和用户的关注点生成一份调研报告。

请使用Markdown格式输出报告，遵循用户提供的模板结构。报告应该：
1. 结构清晰，逻辑严谨
2. 引用来源文章的信息
3. 突出用户关注的方面
4. 提供有价值的分析和见解

注意：不要在报告末尾添加参考文章列表，系统会自动添加。`;

        const articlesContent = selectedArticles
          .map(
            (a, i) => `
【文章${i + 1}】
标题：${a.title}
来源：${a.url}
内容摘要：${a.summary || a.content?.substring(0, 500)}
`
          )
          .join('\n---\n');

        const userPrompt = `公司名称：${task.companyName}
关注点：${task.focusPoints}

报告模板：
${template}

参考文章：
${articlesContent}

请根据以上信息生成调研报告。`;

        send('stage', { stage: 'generate', message: '正在生成报告...' });
        send('log', { message: '正在调用 AI 生成报告内容...' });

        // 调用 Deepseek 流式 API
        const apiKey = process.env.DEEPSEEK_API_KEY || '';
        const baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

        if (!apiKey) {
          send('error', { message: 'Deepseek API Key 未配置' });
          controller.close();
          return;
        }

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
            max_tokens: 8192,
            stream: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`API 请求失败: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        if (!reader) {
          throw new Error('无响应数据');
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter((line) => line.trim() !== '');

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

        send('log', { message: '报告内容生成完成，正在保存...' });

        // 添加参考文章列表
        const referencesSection = generateReferencesSection(selectedArticles);
        const finalContent = fullContent + referencesSection;

        // 保存报告
        const report = await prisma.report.create({
          data: {
            taskId,
            template,
            content: finalContent,
          },
        });

        // 更新任务状态
        await prisma.researchTask.update({
          where: { id: taskId },
          data: {
            currentStep: 4,
            status: 'completed',
          },
        });

        send('complete', {
          message: '报告生成完成',
          report,
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
