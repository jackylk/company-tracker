import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { BaseCrawler, CrawledArticle } from './BaseCrawler';

export class RSSCrawler extends BaseCrawler {
  private parser: Parser;

  constructor() {
    super();
    this.timeout = 90000;
    this.parser = new Parser({
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CompanyTracker/1.0)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      customFields: {
        item: [
          ['content:encoded', 'contentEncoded'],
          ['media:content', 'mediaContent'],
          ['media:thumbnail', 'mediaThumbnail'],
        ],
      },
    });
  }

  async crawl(url: string): Promise<CrawledArticle[]> {
    try {
      const feed = await this.parser.parseURL(url);
      const articles: CrawledArticle[] = [];

      // 只获取最近2个月的文章
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

      for (const item of feed.items) {
        const pubDate = item.pubDate ? new Date(item.pubDate) : undefined;

        // 过滤旧文章
        if (pubDate && pubDate < twoMonthsAgo) {
          continue;
        }

        // 获取内容
        let content =
          (item as Record<string, string>).contentEncoded ||
          item.content ||
          item.contentSnippet ||
          item.summary ||
          '';

        // 如果内容太短，尝试从原文获取
        if (content.length < 200 && item.link) {
          try {
            const fullContent = await this.fetchFullContent(item.link);
            if (fullContent && fullContent.length > content.length) {
              content = fullContent;
            }
          } catch {
            // 忽略错误，使用RSS中的内容
          }
        }

        // 提取图片
        let imageUrl: string | undefined;
        const mediaContent = (item as Record<string, { $?: { url?: string } }>).mediaContent;
        const mediaThumbnail = (item as Record<string, { $?: { url?: string } }>).mediaThumbnail;

        if (mediaContent?.$?.url) {
          imageUrl = mediaContent.$.url;
        } else if (mediaThumbnail?.$?.url) {
          imageUrl = mediaThumbnail.$.url;
        } else if (content) {
          const $ = cheerio.load(content);
          imageUrl = $('img').first().attr('src');
        }

        articles.push({
          title: item.title || '',
          content: content,
          summary: this.generateSummary(content),
          url: item.link || '',
          imageUrl,
          publishDate: pubDate,
        });
      }

      return articles;
    } catch (error) {
      console.error(`RSS解析失败 (${url}):`, error);
      return [];
    }
  }

  // 获取完整文章内容
  private async fetchFullContent(url: string): Promise<string> {
    try {
      const html = await this.fetchHtml(url);
      const $ = cheerio.load(html);
      return this.extractContent($);
    } catch {
      return '';
    }
  }
}
