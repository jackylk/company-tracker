/**
 * 测试内置信息源搜索功能
 */

import * as fs from 'fs';
import * as path from 'path';

interface CuratedSource {
  sourceName: string;
  sourceUrl: string;
  sourceType: string;
  category: string;
  description?: string;
  region?: string;
}

describe('内置信息源搜索', () => {
  let sources: CuratedSource[] = [];

  beforeAll(() => {
    // 加载内置信息源数据
    const sourcePath = path.join(__dirname, '../../data/curated-sources.json');
    if (fs.existsSync(sourcePath)) {
      const fileContent = fs.readFileSync(sourcePath, 'utf-8');
      sources = JSON.parse(fileContent);
    }
  });

  it('应该能找到Databricks相关的信息源', () => {
    const companyName = 'Databricks';
    const keywords = [companyName.toLowerCase()];

    const matchedSources = sources.filter((source) => {
      const searchText = `${source.sourceName} ${source.description || ''} ${source.category}`.toLowerCase();
      return keywords.some((k) => searchText.includes(k));
    });

    console.log('匹配到的信息源:', matchedSources.map(s => ({
      name: s.sourceName,
      url: s.sourceUrl,
      category: s.category,
    })));

    expect(matchedSources.length).toBeGreaterThan(0);
    expect(matchedSources.some(s => s.sourceName.toLowerCase().includes('databricks'))).toBe(true);
  });

  it('应该能找到字节跳动相关的信息源', () => {
    const companyName = '字节跳动';
    const keywords = [companyName.toLowerCase(), 'bytedance'];

    const matchedSources = sources.filter((source) => {
      const searchText = `${source.sourceName} ${source.description || ''} ${source.category}`.toLowerCase();
      return keywords.some((k) => searchText.includes(k));
    });

    console.log('匹配到的信息源:', matchedSources.map(s => ({
      name: s.sourceName,
      url: s.sourceUrl,
      category: s.category,
    })));

    expect(matchedSources.length).toBeGreaterThan(0);
  });

  it('应该能找到阿里巴巴相关的信息源', () => {
    const companyName = '阿里巴巴';
    const keywords = [companyName.toLowerCase(), 'alibaba', '阿里'];

    const matchedSources = sources.filter((source) => {
      const searchText = `${source.sourceName} ${source.description || ''} ${source.category}`.toLowerCase();
      return keywords.some((k) => searchText.includes(k));
    });

    console.log('匹配到的信息源:', matchedSources.map(s => ({
      name: s.sourceName,
      url: s.sourceUrl,
      category: s.category,
    })));

    expect(matchedSources.length).toBeGreaterThan(0);
  });

  it('内置数据源文件应该包含足够多的记录', () => {
    console.log(`内置信息源总数: ${sources.length}`);
    expect(sources.length).toBeGreaterThan(100);
  });

  it('搜索关键词应该正确分割', () => {
    const focusPoints = 'AI战略,数据平台、云服务';
    const companyName = 'Databricks';

    const keywords = [
      companyName.toLowerCase(),
      ...focusPoints.toLowerCase().split(/[,，、\s]+/),
    ].filter((k) => k.length > 1);

    console.log('分割后的关键词:', keywords);

    expect(keywords).toContain('databricks');
    expect(keywords).toContain('ai战略');
    expect(keywords).toContain('数据平台');
    expect(keywords).toContain('云服务');
  });
});
