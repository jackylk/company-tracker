import * as cheerio from 'cheerio';
import { BaseCrawler, CrawledArticle } from './BaseCrawler';

export class WebCrawler extends BaseCrawler {
  async crawl(url: string): Promise<CrawledArticle[]> {
    try {
      const html = await this.fetchHtml(url);
      const $ = cheerio.load(html);

      // 提取单篇文章
      const article = this.extractArticle($, url);
      if (article.content.length > 200) {
        return [article];
      }

      // 如果是列表页，尝试提取文章链接
      const links = this.extractArticleLinks($, url);
      const articles: CrawledArticle[] = [];

      for (const link of links.slice(0, 10)) {
        // 限制数量
        try {
          const articleHtml = await this.fetchHtml(link);
          const $article = cheerio.load(articleHtml);
          const articleData = this.extractArticle($article, link);
          if (articleData.content.length > 100) {
            articles.push(articleData);
          }
          // 避免请求过快
          await this.delay(500);
        } catch {
          // 忽略单篇文章获取失败
        }
      }

      return articles;
    } catch (error) {
      console.error(`网页爬取失败 (${url}):`, error);
      return [];
    }
  }

  // 提取单篇文章
  private extractArticle($: cheerio.CheerioAPI, url: string): CrawledArticle {
    const title = this.extractTitle($);
    const content = this.extractContent($);
    const publishDate = this.extractDate($);
    const imageUrl = this.extractImage($, url);

    return {
      title,
      content,
      summary: this.generateSummary(content),
      url,
      imageUrl,
      publishDate,
    };
  }

  // 提取文章链接列表
  private extractArticleLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const linkSelectors = [
      'article a[href]',
      '.post a[href]',
      '.entry a[href]',
      'h2 a[href]',
      'h3 a[href]',
      '.post-title a[href]',
      'a[href*="/blog/"]',
      'a[href*="/post/"]',
      'a[href*="/article/"]',
      'a[href*="/news/"]',
    ];

    const links: string[] = [];
    const seenLinks = new Set<string>();
    const baseUrlObj = new URL(baseUrl);

    for (const selector of linkSelectors) {
      $(selector).each((_, el) => {
        let href = $(el).attr('href');
        if (!href) return;

        // 过滤无效链接
        if (
          href.startsWith('#') ||
          href.startsWith('mailto:') ||
          href.startsWith('javascript:')
        ) {
          return;
        }

        // 转换为绝对URL
        if (href.startsWith('/')) {
          href = baseUrlObj.origin + href;
        } else if (!href.startsWith('http')) {
          href = new URL(href, baseUrl).href;
        }

        // 只保留同域名的链接
        try {
          const linkUrl = new URL(href);
          if (linkUrl.hostname !== baseUrlObj.hostname) {
            return;
          }
        } catch {
          return;
        }

        if (!seenLinks.has(href)) {
          seenLinks.add(href);
          links.push(href);
        }
      });
    }

    return links;
  }
}
