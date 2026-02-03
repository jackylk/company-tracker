import { BaseCrawler, CrawledArticle } from './BaseCrawler';
import { RSSCrawler } from './RSSCrawler';
import { WebCrawler } from './WebCrawler';
import type { SourceType } from '@/types';

export class CrawlerFactory {
  private static rssCrawler = new RSSCrawler();
  private static webCrawler = new WebCrawler();

  static getCrawler(sourceType: SourceType, url: string): BaseCrawler {
    const lowerUrl = url.toLowerCase();

    // RSS/Atom/Feed 类型
    if (
      sourceType === 'rss' ||
      sourceType === 'atom' ||
      sourceType === 'feed' ||
      lowerUrl.includes('/rss') ||
      lowerUrl.includes('/feed') ||
      lowerUrl.includes('.xml') ||
      lowerUrl.includes('atom')
    ) {
      return this.rssCrawler;
    }

    // 其他类型使用Web爬虫
    return this.webCrawler;
  }

  static async crawl(sourceType: SourceType, url: string): Promise<CrawledArticle[]> {
    const crawler = this.getCrawler(sourceType, url);
    return crawler.crawl(url);
  }
}

export { BaseCrawler } from './BaseCrawler';
export type { CrawledArticle } from './BaseCrawler';
export { RSSCrawler } from './RSSCrawler';
export { WebCrawler } from './WebCrawler';
