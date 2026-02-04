import axios from 'axios';
import type { DataSource, SourceType, Article } from '@/types';

interface DeepseekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepseekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface RecommendedSource {
  name: string;
  url: string;
  type: string;
  description: string;
}

// 文章分析结果
interface ArticleAnalysisResult {
  index: number;
  isRelevant: boolean;
  category: string | null;
  reason?: string;
}

// 流式回调类型
export interface StreamCallbacks {
  onPrompt?: (prompt: string) => void;
  onToken?: (token: string) => void;
  onComplete?: (fullContent: string) => void;
  onError?: (error: Error) => void;
}

export class DeepseekService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    this.baseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  }

  private async chat(messages: DeepseekMessage[], temperature = 0.7): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Deepseek API Key 未配置');
    }

    try {
      const response = await axios.post<DeepseekResponse>(
        `${this.baseUrl}/v1/chat/completions`,
        {
          model: 'deepseek-chat',
          messages,
          temperature,
          max_tokens: 4096,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 60000,
        }
      );

      return response.data.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Deepseek API 调用失败:', error);
      throw error;
    }
  }

  // 流式聊天
  async chatStream(
    messages: DeepseekMessage[],
    callbacks: StreamCallbacks,
    temperature = 0.7
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Deepseek API Key 未配置');
    }

    // 发送 prompt 信息
    if (callbacks.onPrompt) {
      const userMessage = messages.find(m => m.role === 'user');
      if (userMessage) {
        callbacks.onPrompt(userMessage.content);
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages,
          temperature,
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

      if (!reader) {
        throw new Error('No response body');
      }

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
                if (callbacks.onToken) {
                  callbacks.onToken(content);
                }
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      if (callbacks.onComplete) {
        callbacks.onComplete(fullContent);
      }

      return fullContent;
    } catch (error) {
      if (callbacks.onError) {
        callbacks.onError(error as Error);
      }
      throw error;
    }
  }

  // 推荐信息源
  async recommendSources(companyName: string, focusPoints: string): Promise<RecommendedSource[]> {
    const systemPrompt = `你是一个专业的信息源推荐助手。用户会告诉你一个公司名称和关注点，你需要推荐与该公司相关的信息源。

请以JSON数组格式返回推荐的信息源，每个信息源包含以下字段：
- name: 信息源名称
- url: 信息源URL
- type: 类型（rss/blog/news/website）
- description: 简短描述

只返回JSON数组，不要包含其他文字说明。`;

    const userPrompt = `公司名称：${companyName}
关注点：${focusPoints}

请推荐5-10个与该公司相关的高质量信息源，包括但不限于：
1. 该公司的官方网站、博客、RSS
2. 报道该公司的知名科技媒体
3. 与该公司业务相关的行业资讯网站`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      // 尝试解析JSON
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as RecommendedSource[];
      }
      return [];
    } catch (error) {
      console.error('推荐信息源失败:', error);
      return [];
    }
  }

  // 优化信息源列表
  async optimizeSources(
    currentSources: Partial<DataSource>[],
    userInput: string,
    companyName: string,
    focusPoints: string
  ): Promise<{ sources: RecommendedSource[]; message: string }> {
    const systemPrompt = `你是一个专业的信息源优化助手。用户已经有一些信息源列表，现在想要根据自己的需求进行优化。

你需要：
1. 理解用户的优化需求
2. 根据需求调整信息源列表（添加、删除或修改）
3. 返回优化后的信息源列表和简短说明

请以JSON格式返回：
{
  "sources": [
    {"name": "...", "url": "...", "type": "rss/blog/news/website", "description": "..."}
  ],
  "message": "优化说明"
}

只返回JSON，不要包含其他文字。`;

    const userPrompt = `公司：${companyName}
关注点：${focusPoints}

当前信息源列表：
${currentSources.map((s) => `- ${s.name}: ${s.url}`).join('\n')}

用户要求：${userInput}`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { sources: [], message: '优化失败，请重试' };
    } catch (error) {
      console.error('优化信息源失败:', error);
      return { sources: [], message: '优化失败，请重试' };
    }
  }

  // 验证用户输入是否与应用相关
  async validateInput(userInput: string): Promise<{ valid: boolean; message: string }> {
    const systemPrompt = `你是一个输入验证助手。用户正在使用一个公司信息采集和调研报告系统。

你需要判断用户的输入是否与以下内容相关：
1. 公司信息采集
2. 信息源管理（添加、删除、优化信息源）
3. 调研报告生成
4. 关于特定公司的查询

如果输入与上述内容相关，返回：{"valid": true, "message": ""}
如果输入与上述内容无关（如闲聊、问候、与本应用无关的问题），返回：{"valid": false, "message": "提示用户应该如何正确使用"}

只返回JSON，不要包含其他文字。`;

    try {
      const response = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput },
        ],
        0.3
      );

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { valid: true, message: '' };
    } catch {
      // 如果验证失败，默认允许
      return { valid: true, message: '' };
    }
  }

  // 生成调研报告
  async generateReport(
    articles: Partial<Article>[],
    companyName: string,
    focusPoints: string,
    template: string
  ): Promise<string> {
    const systemPrompt = `你是一个专业的调研报告撰写助手。用户会提供一些关于某个公司的文章内容，你需要根据这些内容和用户的关注点生成一份调研报告。

请使用Markdown格式输出报告，遵循用户提供的模板结构。报告应该：
1. 结构清晰，逻辑严谨
2. 引用来源文章的信息
3. 突出用户关注的方面
4. 提供有价值的分析和见解

注意：不要在报告末尾添加参考文章列表，系统会自动添加。`;

    const articlesContent = articles
      .map(
        (a, i) => `
【文章${i + 1}】
标题：${a.title}
来源：${a.url}
内容摘要：${a.summary || a.content?.substring(0, 500)}
`
      )
      .join('\n---\n');

    const userPrompt = `公司名称：${companyName}
关注点：${focusPoints}

报告模板：
${template}

参考文章：
${articlesContent}

请根据以上信息生成调研报告。`;

    try {
      const response = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        0.7
      );

      // 在报告末尾添加参考文章列表
      const referencesSection = this.generateReferencesSection(articles);

      return response + referencesSection;
    } catch (error) {
      console.error('生成报告失败:', error);
      throw error;
    }
  }

  // 生成参考文章列表章节
  private generateReferencesSection(articles: Partial<Article>[]): string {
    if (articles.length === 0) {
      return '';
    }

    const references = articles
      .map((a, i) => `${i + 1}. [${a.title}](${a.url})`)
      .join('\n');

    return `\n\n## 参考文章\n\n${references}\n`;
  }

  // 根据公司名和关注点动态生成报告模板
  async generateTemplate(companyName: string, focusPoints: string): Promise<string> {
    const systemPrompt = `你是一个专业的调研报告模板设计师。用户会告诉你一个公司名称和关注点，你需要为这个公司生成一个定制化的调研报告模板。

模板要求：
1. 使用Markdown格式
2. 结构清晰，层次分明
3. 根据公司特点和行业背景设计合适的章节
4. 根据用户的关注点重点突出相关内容
5. 每个章节下要有具体的内容提示
6. 模板应该专业但易于填充

模板应包含：
- 一级标题使用 #
- 二级标题使用 ##
- 三级标题使用 ###
- 每个章节下的内容提示用列表形式

只返回Markdown格式的模板，不要包含其他说明文字。`;

    const userPrompt = `公司名称：${companyName}
关注点：${focusPoints}

请为这个公司设计一个专业的调研报告模板，要根据公司的业务特点和用户的关注点进行定制化设计。`;

    try {
      const template = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], 0.8);

      // 在模板末尾添加日期和来源信息占位符
      const footer = `\n\n---\n*报告生成日期：${new Date().toLocaleDateString('zh-CN')}*\n*数据来源：{来源数量}篇参考文章*\n`;

      return template + footer;
    } catch (error) {
      console.error('生成模板失败:', error);
      throw error;
    }
  }

  // 根据用户描述调整报告模板
  async adjustTemplate(currentTemplate: string, userRequest: string): Promise<string> {
    const systemPrompt = `你是一个报告模板调整助手。用户会告诉你当前的报告模板和想要的调整，你需要生成调整后的模板。

模板使用Markdown格式，包含章节标题和每个章节应该包含的内容说明。

只返回调整后的模板内容，不要包含其他说明文字。`;

    const userPrompt = `当前模板：
${currentTemplate}

用户要求：${userRequest}`;

    try {
      return await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);
    } catch (error) {
      console.error('调整模板失败:', error);
      return currentTemplate;
    }
  }

  // 批量分析文章相关性和分类
  async analyzeArticles(
    companyName: string,
    focusPoints: string,
    articlesText: string
  ): Promise<ArticleAnalysisResult[]> {
    const systemPrompt = `你是一个专业的文章分析助手。用户正在研究一个公司，有特定的关注点。你需要分析一批文章，判断每篇文章：
1. 是否与该公司相关（语义层面的相关性，不仅仅是关键词匹配）
2. 如果相关，属于哪个关注点分类

判断相关性时要考虑：
- 文章主题是否与该公司直接相关
- 文章是否讨论了该公司的业务、产品、战略等
- 即使没有直接提到公司名，但内容明显是关于该公司的也算相关
- 仅仅提到公司名但主题无关的文章应标记为不相关

分类时要考虑：
- 根据文章的主要内容，归类到最匹配的关注点
- 如果匹配多个关注点，选择最主要的一个
- 如果不匹配任何关注点但与公司相关，分类为"其他"

请以JSON数组格式返回分析结果：
[
  {"index": 0, "isRelevant": true, "category": "关注点名称", "reason": "简短原因"},
  {"index": 1, "isRelevant": false, "category": null, "reason": "简短原因"}
]

只返回JSON数组，不要包含其他文字。`;

    const userPrompt = `公司名称：${companyName}
关注点：${focusPoints}

请分析以下文章：

${articlesText}`;

    try {
      const response = await this.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        0.3 // 低温度以获得更一致的结果
      );

      // 解析JSON
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const results = JSON.parse(jsonMatch[0]) as ArticleAnalysisResult[];
        return results;
      }

      console.error('无法解析文章分析结果:', response);
      return [];
    } catch (error) {
      console.error('文章分析失败:', error);
      throw error;
    }
  }
}

export const deepseekService = new DeepseekService();

// 默认报告模板
export const DEFAULT_REPORT_TEMPLATE = `# {公司名称} 调研报告

## 一、公司概述
简要介绍公司背景、主营业务和市场定位。
- 公司基本信息
- 主营业务领域
- 市场地位和竞争优势

## 二、{关注点}分析
### 2.1 现状分析
分析公司在该领域的当前状态和主要动态。
- 当前发展状况
- 关键业务指标
- 近期重要进展

### 2.2 策略解读
解读公司在该领域的战略布局和发展方向。
- 战略目标与规划
- 资源投入情况
- 合作与并购动态

### 2.3 竞争态势
分析公司在该领域的竞争优势和挑战。
- 主要竞争对手
- 竞争优势分析
- 面临的挑战与风险

## 三、近期动态
汇总近期重要新闻和公告。
- 重大新闻事件
- 官方公告摘要
- 行业影响分析

## 四、总结与展望
对公司在关注领域的发展进行总结和展望。
- 核心发现总结
- 未来发展趋势
- 投资/关注建议

---
*报告生成日期：{日期}*
*数据来源：{来源数量}篇参考文章*
`;
