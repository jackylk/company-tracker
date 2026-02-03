import axios from 'axios';

interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export class SearXNGService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.SEARXNG_BASE_URL || 'https://searx.be';
  }

  async search(query: string, maxResults = 20): Promise<SearchResult[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: {
          q: query,
          format: 'json',
          categories: 'general',
          language: 'zh-CN,en',
          pageno: 1,
        },
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CompanyTracker/1.0)',
        },
      });

      const results: SearchResult[] = response.data.results
        .slice(0, maxResults)
        .map((item: { title: string; url: string; content: string }) => ({
          title: item.title || '',
          url: item.url || '',
          content: item.content || '',
        }));

      return results;
    } catch (error) {
      console.error('SearXNG搜索失败:', error);
      // 返回空数组而不是抛出错误，让流程可以继续
      return [];
    }
  }

  // 搜索信息源（RSS/博客/新闻）
  async searchSources(companyName: string, focusPoints: string): Promise<SearchResult[]> {
    const queries = [
      `${companyName} RSS feed`,
      `${companyName} 官方博客`,
      `${companyName} ${focusPoints} 新闻`,
      `${companyName} official blog`,
    ];

    const allResults: SearchResult[] = [];
    const seenUrls = new Set<string>();

    for (const query of queries) {
      const results = await this.search(query, 10);
      for (const result of results) {
        if (!seenUrls.has(result.url)) {
          seenUrls.add(result.url);
          allResults.push(result);
        }
      }
    }

    return allResults.slice(0, 20);
  }

  // 搜索文章内容
  async searchArticles(companyName: string, focusPoints: string): Promise<SearchResult[]> {
    const query = `${companyName} ${focusPoints}`;
    return this.search(query, 20);
  }
}

export const searxngService = new SearXNGService();
