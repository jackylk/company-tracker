/**
 * 内置信息源匹配逻辑测试
 *
 * 测试场景：
 * 用户指定"字节跳动"公司，系统应该能从内置信息源中匹配到相关源
 */

// 模拟内置信息源数据（与实际数据库中的数据结构一致）
const mockCuratedSources = [
  {
    id: '1',
    name: '字节跳动官网',
    url: 'https://www.bytedance.com/',
    type: 'website',
    category: '字节跳动',
    description: '字节跳动官方网站新闻动态',
    region: '国内',
  },
  {
    id: '2',
    name: 'TikTok Newsroom',
    url: 'https://newsroom.tiktok.com/',
    type: 'news',
    category: '字节跳动',
    description: 'TikTok官方新闻中心（字节旗下）',
    region: '国外',
  },
  {
    id: '3',
    name: '飞书官网',
    url: 'https://www.feishu.cn/',
    type: 'website',
    category: '字节跳动',
    description: '飞书官网新闻博客（字节旗下）',
    region: '国内',
  },
  {
    id: '4',
    name: '火山引擎',
    url: 'https://www.volcengine.com/',
    type: 'website',
    category: '字节跳动',
    description: '火山引擎官网博客（字节旗下云服务）',
    region: '国内',
  },
  {
    id: '5',
    name: '36氪',
    url: 'https://36kr.com',
    type: 'news',
    category: '科技媒体',
    description: '科技创业媒体',
    region: '国内',
  },
  {
    id: '6',
    name: '虎嗅',
    url: 'https://huxiu.com',
    type: 'news',
    category: '科技媒体',
    description: '科技商业媒体',
    region: '国内',
  },
];

// 当前的匹配逻辑（从 discover-stream/route.ts 复制）
function currentMatchLogic(
  curatedSources: typeof mockCuratedSources,
  companyName: string,
  focusPoints: string
): typeof mockCuratedSources {
  const keywords = [
    companyName.toLowerCase(),
    ...focusPoints.toLowerCase().split(/[,，、\s]+/),
  ].filter((k) => k.length > 1);

  return curatedSources.filter((source) => {
    const searchText = `${source.name} ${source.description || ''} ${source.category}`.toLowerCase();
    return keywords.some((k) => searchText.includes(k));
  });
}

// 改进后的匹配逻辑
function improvedMatchLogic(
  curatedSources: typeof mockCuratedSources,
  companyName: string,
  focusPoints: string
): typeof mockCuratedSources {
  // 提取关键词，包括公司名的各个部分
  const companyKeywords = companyName.toLowerCase().split(/[\s]+/).filter((k) => k.length > 1);
  const focusKeywords = focusPoints.toLowerCase().split(/[,，、\s]+/).filter((k) => k.length > 1);
  const keywords = [...companyKeywords, ...focusKeywords];

  return curatedSources.filter((source) => {
    // 搜索范围扩展：name, description, category, url
    const searchText = `${source.name} ${source.description || ''} ${source.category} ${source.url}`.toLowerCase();
    return keywords.some((k) => searchText.includes(k));
  });
}

describe('内置信息源匹配逻辑测试', () => {
  describe('当前匹配逻辑', () => {
    it('搜索"字节跳动"应该能匹配到字节跳动分类的信息源', () => {
      const matched = currentMatchLogic(mockCuratedSources, '字节跳动', 'AI战略');

      console.log('当前逻辑匹配结果:', matched.map(s => s.name));

      // 验证是否匹配到了字节跳动官网
      const bytedanceOfficial = matched.find(s => s.name === '字节跳动官网');
      expect(bytedanceOfficial).toBeDefined();

      // 应该匹配到所有字节跳动分类的信息源
      const bytedanceSources = matched.filter(s => s.category === '字节跳动');
      expect(bytedanceSources.length).toBeGreaterThanOrEqual(4);
    });

    it('分析关键词提取', () => {
      const companyName = '字节跳动';
      const focusPoints = 'AI战略、海外业务';

      const keywords = [
        companyName.toLowerCase(),
        ...focusPoints.toLowerCase().split(/[,，、\s]+/),
      ].filter((k) => k.length > 1);

      console.log('提取的关键词:', keywords);

      // 验证关键词
      expect(keywords).toContain('字节跳动');
      expect(keywords).toContain('ai战略');
      expect(keywords).toContain('海外业务');
    });

    it('验证匹配条件', () => {
      const source = mockCuratedSources[0]; // 字节跳动官网
      const searchText = `${source.name} ${source.description || ''} ${source.category}`.toLowerCase();

      console.log('搜索文本:', searchText);

      // 验证搜索文本包含关键词
      expect(searchText).toContain('字节跳动');
    });
  });

  describe('改进后的匹配逻辑', () => {
    it('搜索"字节跳动"应该能匹配到所有相关信息源', () => {
      const matched = improvedMatchLogic(mockCuratedSources, '字节跳动', 'AI战略');

      console.log('改进逻辑匹配结果:', matched.map(s => s.name));

      // 应该匹配到所有字节跳动分类的信息源
      const bytedanceSources = matched.filter(s => s.category === '字节跳动');
      expect(bytedanceSources.length).toBe(4);
    });

    it('通过URL中的bytedance匹配', () => {
      const matched = improvedMatchLogic(mockCuratedSources, 'ByteDance', 'technology');

      console.log('英文搜索匹配结果:', matched.map(s => s.name));

      // 应该通过URL匹配到字节跳动官网
      const bytedanceOfficial = matched.find(s => s.url.includes('bytedance'));
      expect(bytedanceOfficial).toBeDefined();
    });
  });

  describe('边界情况测试', () => {
    it('空公司名应该不匹配任何信息源', () => {
      const matched = currentMatchLogic(mockCuratedSources, '', '');
      expect(matched.length).toBe(0);
    });

    it('不相关的公司名应该不匹配字节跳动信息源', () => {
      const matched = currentMatchLogic(mockCuratedSources, '阿里巴巴', '电商业务');

      const bytedanceSources = matched.filter(s => s.category === '字节跳动');
      expect(bytedanceSources.length).toBe(0);
    });
  });
});
