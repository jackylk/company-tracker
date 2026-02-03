import axios from 'axios';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

export interface CrawledArticle {
  title: string;
  content: string;
  summary: string;
  url: string;
  imageUrl?: string;
  publishDate?: Date;
}

export abstract class BaseCrawler {
  protected timeout = 45000;
  protected maxRetries = 3;

  abstract crawl(url: string): Promise<CrawledArticle[]>;

  // 获取HTML内容
  protected async fetchHtml(url: string): Promise<string> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.get(url, {
          timeout: this.timeout,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          },
          maxRedirects: 5,
        });
        return response.data;
      } catch (error) {
        if (attempt === this.maxRetries) {
          console.error(`获取页面失败 (${url}):`, error);
          throw error;
        }
        // 指数退避
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    throw new Error('获取页面失败');
  }

  // 提取标题
  protected extractTitle($: CheerioAPI): string {
    const titleSelectors = [
      'article h1',
      '.post-title',
      '.entry-title',
      '.article-title',
      'h1.title',
      '[role="article"] h1',
      'main h1',
      'h1',
    ];

    for (const selector of titleSelectors) {
      const title = $(selector).first().text().trim();
      if (title && title.length > 0) {
        return title;
      }
    }

    return $('title').text().trim() || '';
  }

  // 提取内容
  protected extractContent($: CheerioAPI): string {
    const contentSelectors = [
      'article',
      '[role="article"]',
      '.post-content',
      '.entry-content',
      '.article-content',
      '.content',
      'main',
    ];

    for (const selector of contentSelectors) {
      const $content = $(selector).first();
      if ($content.length) {
        // 移除不需要的元素
        $content.find('script, style, nav, header, footer, aside, .comments, .share').remove();
        const content = $content.html();
        if (content && content.length > 100) {
          return content;
        }
      }
    }

    // 回退到body
    const $body = $('body').clone();
    $body.find('script, style, nav, header, footer, aside').remove();
    return $body.html() || '';
  }

  // 提取发布日期
  protected extractDate($: CheerioAPI): Date | undefined {
    const dateSelectors = [
      'time[datetime]',
      '[itemprop="datePublished"]',
      '.post-date',
      '.entry-date',
      '.publish-date',
      '.date',
    ];

    for (const selector of dateSelectors) {
      const $el = $(selector).first();
      let dateStr = $el.attr('datetime') || $el.text().trim();

      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    }

    return undefined;
  }

  // 提取图片
  protected extractImage($: CheerioAPI, baseUrl: string): string | undefined {
    const imageSelectors = [
      'article img',
      '.post-content img',
      '.entry-content img',
      'meta[property="og:image"]',
    ];

    for (const selector of imageSelectors) {
      const $el = $(selector).first();
      let imgUrl = $el.attr('src') || $el.attr('content');

      if (imgUrl) {
        // 转换为绝对URL
        if (imgUrl.startsWith('//')) {
          imgUrl = 'https:' + imgUrl;
        } else if (imgUrl.startsWith('/')) {
          const url = new URL(baseUrl);
          imgUrl = url.origin + imgUrl;
        }
        return imgUrl;
      }
    }

    return undefined;
  }

  // 清理HTML为纯文本
  protected cleanHtml(html: string): string {
    const $ = cheerio.load(html);
    return $.text().replace(/\s+/g, ' ').trim();
  }

  // 生成摘要
  protected generateSummary(content: string, maxLength = 300): string {
    const text = this.cleanHtml(content);
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  // 延迟函数
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 判断是否需要JS渲染
  protected needsJSRender(html: string): boolean {
    const indicators = [
      'window.__NUXT__',
      'window.__NEXT_DATA__',
      '__INITIAL_STATE__',
      'react-root',
      'app-root',
      'id="__next"',
    ];
    return indicators.some((i) => html.includes(i)) && html.length < 10000;
  }
}
