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
4. 提供有价值的分析和见解`;

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

      return response;
    } catch (error) {
      console.error('生成报告失败:', error);
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
}

export const deepseekService = new DeepseekService();

// 默认报告模板
export const DEFAULT_REPORT_TEMPLATE = `# {公司名称} 调研报告

## 一、公司概述
简要介绍公司背景、主营业务和市场定位。

## 二、{关注点}分析
### 2.1 现状分析
分析公司在该领域的当前状态和主要动态。

### 2.2 策略解读
解读公司在该领域的战略布局和发展方向。

### 2.3 竞争态势
分析公司在该领域的竞争优势和挑战。

## 三、近期动态
汇总近期重要新闻和公告。

## 四、总结与展望
对公司在关注领域的发展进行总结和展望。

---
*报告生成日期：{日期}*
*数据来源：{来源数量}篇参考文章*
`;
