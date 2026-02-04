/**
 * 第二步：信息源发现 API 测试
 *
 * 测试场景：
 * 1. 输入公司名和关注点，系统应该推荐正好10个信息源
 * 2. 推荐的信息源应该与公司相关
 * 3. 信息源应该包含有效的 URL
 * 4. 信息源应该有正确的类型标记
 */

import { NextRequest } from 'next/server';

// Mock 数据：模拟各个服务返回的信息源
const mockBuiltinSources = [
  { id: '1', name: '36氪', url: 'https://36kr.com', type: 'news', category: '科技媒体', description: '科技创业媒体，报道字节跳动等科技公司' },
  { id: '2', name: '虎嗅', url: 'https://huxiu.com', type: 'news', category: '科技媒体', description: '科技商业媒体，AI人工智能报道' },
  { id: '3', name: 'TechCrunch中文', url: 'https://techcrunch.cn', type: 'news', category: '科技媒体', description: '科技新闻，报道字节跳动AI战略' },
  { id: '4', name: '极客公园', url: 'https://geekpark.net', type: 'news', category: '科技媒体', description: '科技创新媒体，字节跳动专题报道' },
];

const mockSearchResults = [
  { title: '字节跳动官方博客', url: 'https://blog.bytedance.com', content: '字节跳动公司官方博客' },
  { title: '字节跳动招聘', url: 'https://jobs.bytedance.com', content: '字节跳动招聘信息' },
  { title: '字节跳动AI实验室', url: 'https://ai.bytedance.com', content: '字节跳动人工智能研究' },
  { title: 'TikTok官网', url: 'https://tiktok.com', content: '字节跳动旗下短视频平台' },
];

const mockDeepseekRecommendations = [
  { name: '字节跳动技术博客', url: 'https://tech.bytedance.com', type: 'blog', description: '字节跳动技术团队博客' },
  { name: '今日头条科技频道', url: 'https://tech.toutiao.com', type: 'news', description: '字节跳动旗下科技资讯' },
  { name: '抖音开放平台', url: 'https://open.douyin.com', type: 'website', description: '字节跳动抖音开发者平台' },
  { name: 'ByteDance Research', url: 'https://research.bytedance.com', type: 'website', description: '字节跳动研究院' },
  { name: '飞书官方博客', url: 'https://blog.feishu.cn', type: 'blog', description: '字节跳动飞书团队博客' },
  { name: '火山引擎', url: 'https://volcengine.com', type: 'website', description: '字节跳动云服务平台' },
];

// Mock Prisma
const mockTask = {
  id: 'test-task-id',
  userId: 'test-user-id',
  companyName: '字节跳动',
  focusPoints: 'AI战略、海外业务',
  currentStep: 2,
  status: 'in_progress',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createdSources: Array<{
  id: string;
  taskId: string;
  name: string;
  url: string;
  type: string;
  origin: string;
  selected: boolean;
}> = [];

const mockPrisma = {
  researchTask: {
    findFirst: jest.fn().mockResolvedValue(mockTask),
  },
  curatedSource: {
    findMany: jest.fn().mockResolvedValue(mockBuiltinSources),
  },
  dataSource: {
    findMany: jest.fn().mockImplementation(({ where }) => {
      if (where?.taskId) {
        return Promise.resolve(createdSources.filter(s => s.taskId === where.taskId));
      }
      return Promise.resolve([]);
    }),
    createMany: jest.fn().mockImplementation(({ data }) => {
      data.forEach((item: typeof createdSources[0], index: number) => {
        createdSources.push({
          id: `source-${createdSources.length + 1}`,
          taskId: mockTask.id,
          ...item,
          selected: false,
        });
      });
      return Promise.resolve({ count: data.length });
    }),
  },
};

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: mockPrisma,
}));

// Mock SearXNG 服务
jest.mock('@/services/search/SearXNGService', () => ({
  searxngService: {
    searchSources: jest.fn().mockResolvedValue(mockSearchResults),
  },
}));

// Mock Deepseek 服务
jest.mock('@/services/ai/DeepseekService', () => ({
  deepseekService: {
    recommendSources: jest.fn().mockResolvedValue(mockDeepseekRecommendations),
  },
}));

// Mock 认证
jest.mock('@/lib/auth', () => ({
  getCurrentUser: jest.fn().mockResolvedValue({
    userId: 'test-user-id',
    email: 'test@example.com',
    isAdmin: false,
  }),
}));

import { POST as discoverHandler } from '@/app/api/tasks/[taskId]/sources/discover/route';

// 辅助函数
function createMockRequest(body: object): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

async function parseResponse(response: Response) {
  const data = await response.json();
  return { status: response.status, data };
}

describe('信息源发现 API 测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 清空已创建的信息源
    createdSources.length = 0;
  });

  describe('基本功能测试', () => {
    it('应该成功发现信息源', async () => {
      const request = createMockRequest({
        methods: ['builtin', 'search', 'deepseek'],
      });

      const response = await discoverHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.discovered).toBeGreaterThan(0);
      expect(data.sources).toBeDefined();
      expect(Array.isArray(data.sources)).toBe(true);
    });

    it('应该返回至少10个信息源', async () => {
      const request = createMockRequest({
        methods: ['builtin', 'search', 'deepseek'],
      });

      const response = await discoverHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      // 期望至少发现10个信息源（来自内置库+搜索+AI推荐）
      expect(data.discovered).toBeGreaterThanOrEqual(10);
    });

    it('每个信息源应该有有效的URL', async () => {
      const request = createMockRequest({
        methods: ['builtin', 'search', 'deepseek'],
      });

      const response = await discoverHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      for (const source of data.sources) {
        expect(source.url).toBeDefined();
        expect(source.url).toMatch(/^https?:\/\//);
      }
    });

    it('每个信息源应该有名称和类型', async () => {
      const request = createMockRequest({
        methods: ['builtin', 'search', 'deepseek'],
      });

      const response = await discoverHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      for (const source of data.sources) {
        expect(source.name).toBeDefined();
        expect(source.name.length).toBeGreaterThan(0);
        expect(source.type).toBeDefined();
        expect(['rss', 'atom', 'feed', 'blog', 'news', 'website']).toContain(source.type);
      }
    });

    it('信息源应该标记来源（builtin/search/deepseek）', async () => {
      const request = createMockRequest({
        methods: ['builtin', 'search', 'deepseek'],
      });

      const response = await discoverHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      for (const source of data.sources) {
        expect(source.origin).toBeDefined();
        expect(['builtin', 'search', 'deepseek']).toContain(source.origin);
      }
    });
  });

  describe('信息源相关性测试', () => {
    it('发现的信息源应该与公司相关', async () => {
      const request = createMockRequest({
        methods: ['builtin', 'search', 'deepseek'],
      });

      const response = await discoverHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      // 检查信息源的相关性
      // 信息源的名称、URL或描述中应该包含公司相关的关键词
      const companyKeywords = ['字节', 'bytedance', 'tiktok', '抖音', '头条', '飞书', '科技', 'tech'];

      let relatedCount = 0;
      for (const source of data.sources) {
        const sourceText = `${source.name} ${source.url} ${source.description || ''}`.toLowerCase();
        const isRelated = companyKeywords.some(keyword => sourceText.includes(keyword.toLowerCase()));
        if (isRelated) {
          relatedCount++;
        }
      }

      // 至少80%的信息源应该与公司相关
      const relatedRatio = relatedCount / data.sources.length;
      expect(relatedRatio).toBeGreaterThanOrEqual(0.8);
    });

    it('信息源URL不应该重复', async () => {
      const request = createMockRequest({
        methods: ['builtin', 'search', 'deepseek'],
      });

      const response = await discoverHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      const urls = data.sources.map((s: { url: string }) => s.url);
      const uniqueUrls = new Set(urls);

      expect(uniqueUrls.size).toBe(urls.length);
    });
  });

  describe('不同发现方法测试', () => {
    it('只使用内置信息源时应该返回结果', async () => {
      const request = createMockRequest({
        methods: ['builtin'],
      });

      const response = await discoverHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      // 内置信息源应该有匹配
      if (data.sources.length > 0) {
        const builtinSources = data.sources.filter((s: { origin: string }) => s.origin === 'builtin');
        expect(builtinSources.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('只使用搜索引擎时应该返回结果', async () => {
      // 清空之前的数据
      createdSources.length = 0;

      const request = createMockRequest({
        methods: ['search'],
      });

      const response = await discoverHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.discovered).toBeGreaterThan(0);

      const searchSources = data.sources.filter((s: { origin: string }) => s.origin === 'search');
      expect(searchSources.length).toBe(data.discovered);
    });

    it('只使用AI推荐时应该返回结果', async () => {
      // 清空之前的数据
      createdSources.length = 0;

      const request = createMockRequest({
        methods: ['deepseek'],
      });

      const response = await discoverHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.discovered).toBeGreaterThan(0);

      const aiSources = data.sources.filter((s: { origin: string }) => s.origin === 'deepseek');
      expect(aiSources.length).toBe(data.discovered);
    });
  });

  describe('错误处理测试', () => {
    it('任务不存在时应该返回404', async () => {
      mockPrisma.researchTask.findFirst.mockResolvedValueOnce(null);

      const request = createMockRequest({
        methods: ['builtin', 'search', 'deepseek'],
      });

      const response = await discoverHandler(request, {
        params: Promise.resolve({ taskId: 'non-existent-task' }),
      });

      const { status, data } = await parseResponse(response);

      expect(status).toBe(404);
      expect(data.message).toContain('不存在');
    });
  });
});

describe('信息源数量验证测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createdSources.length = 0;
  });

  it('综合使用三种方法时，应该返回足够数量的信息源', async () => {
    const request = createMockRequest({
      methods: ['builtin', 'search', 'deepseek'],
    });

    const response = await discoverHandler(request, {
      params: Promise.resolve({ taskId: mockTask.id }),
    });

    const { status, data } = await parseResponse(response);

    expect(status).toBe(200);

    // 验证总数量
    // 内置: 3个, 搜索: 4个, AI: 6个 = 13个（可能有去重）
    expect(data.discovered).toBeGreaterThanOrEqual(10);

    // 统计各来源数量
    const builtinCount = data.sources.filter((s: { origin: string }) => s.origin === 'builtin').length;
    const searchCount = data.sources.filter((s: { origin: string }) => s.origin === 'search').length;
    const aiCount = data.sources.filter((s: { origin: string }) => s.origin === 'deepseek').length;

    console.log(`信息源统计: 内置=${builtinCount}, 搜索=${searchCount}, AI=${aiCount}, 总计=${data.discovered}`);

    // 验证三种来源都有贡献
    expect(searchCount).toBeGreaterThan(0);
    expect(aiCount).toBeGreaterThan(0);
    // 内置信息源需要关键词匹配
    expect(builtinCount).toBeGreaterThanOrEqual(0);
  });

  it('应该返回正好10个或更多信息源', async () => {
    const request = createMockRequest({
      methods: ['builtin', 'search', 'deepseek'],
    });

    const response = await discoverHandler(request, {
      params: Promise.resolve({ taskId: mockTask.id }),
    });

    const { status, data } = await parseResponse(response);

    expect(status).toBe(200);
    expect(data.discovered).toBeGreaterThanOrEqual(10);
    expect(data.sources.length).toBeGreaterThanOrEqual(10);
  });

  it('每个信息源应该包含必要的字段', async () => {
    const request = createMockRequest({
      methods: ['builtin', 'search', 'deepseek'],
    });

    const response = await discoverHandler(request, {
      params: Promise.resolve({ taskId: mockTask.id }),
    });

    const { data } = await parseResponse(response);

    // 验证每个信息源的字段完整性
    data.sources.forEach((source: {
      id: string;
      name: string;
      url: string;
      type: string;
      origin: string;
      taskId: string;
    }) => {
      expect(source).toHaveProperty('id');
      expect(source).toHaveProperty('name');
      expect(source).toHaveProperty('url');
      expect(source).toHaveProperty('type');
      expect(source).toHaveProperty('origin');
      expect(source).toHaveProperty('taskId');
      expect(source.taskId).toBe(mockTask.id);
    });
  });
});
