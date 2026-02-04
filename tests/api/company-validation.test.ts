/**
 * 公司验证服务测试
 */
import { CompanyValidationService } from '@/services/validation/CompanyValidationService';

// Mock SearXNG 服务
const mockSearchResults = {
  // 正例：知名公司，有多个相关结果
  bytedance: [
    { title: '字节跳动 - 官方网站', url: 'https://bytedance.com', content: '字节跳动是一家全球化的科技公司' },
    { title: '字节跳动公司介绍 - 百度百科', url: 'https://baike.baidu.com', content: '字节跳动是一家互联网科技公司，创始人张一鸣' },
    { title: '字节跳动集团最新融资消息', url: 'https://news.com', content: '字节跳动集团获得新一轮投资' },
    { title: '字节跳动CEO张一鸣演讲', url: 'https://video.com', content: '字节跳动创始人张一鸣分享创业经历' },
  ],
  alibaba: [
    { title: '阿里巴巴集团官网', url: 'https://alibaba.com', content: '阿里巴巴集团是全球领先的电子商务公司' },
    { title: '阿里巴巴股票行情', url: 'https://stock.com', content: '阿里巴巴集团上市公司股票信息' },
    { title: '阿里巴巴CEO谈未来发展', url: 'https://news.com', content: '阿里巴巴公司发展战略' },
  ],
  tencent: [
    { title: '腾讯 - 官方网站', url: 'https://tencent.com', content: '腾讯是中国领先的互联网增值服务提供商' },
    { title: '腾讯公司简介', url: 'https://baike.com', content: '腾讯科技有限公司，创始人马化腾' },
    { title: '腾讯最新财报', url: 'https://finance.com', content: '腾讯公司发布季度财报' },
  ],
  apple: [
    { title: 'Apple - Official Site', url: 'https://apple.com', content: 'Apple Inc. is an American multinational technology company' },
    { title: 'Apple Inc. Stock Price', url: 'https://stock.com', content: 'Apple company stock information' },
    { title: 'Apple CEO Tim Cook', url: 'https://news.com', content: 'Apple company CEO discusses new products' },
  ],
  // 英文公司 Databricks
  databricks: [
    { title: 'Databricks - Official Site', url: 'https://databricks.com', content: 'Databricks is a unified analytics platform company' },
    { title: 'Databricks Inc. - Wikipedia', url: 'https://wikipedia.org', content: 'Databricks is an American enterprise software company founded by Apache Spark creators' },
    { title: 'Databricks funding news', url: 'https://techcrunch.com', content: 'Databricks company raises $1 billion in funding' },
    { title: 'Databricks CEO Ali Ghodsi', url: 'https://forbes.com', content: 'Databricks company CEO discusses AI and data platform' },
  ],
  // 英文公司 OpenAI
  openai: [
    { title: 'OpenAI - Official Site', url: 'https://openai.com', content: 'OpenAI is an AI research company' },
    { title: 'OpenAI Inc. - Wikipedia', url: 'https://wikipedia.org', content: 'OpenAI is an American AI company' },
    { title: 'OpenAI CEO Sam Altman', url: 'https://news.com', content: 'OpenAI company CEO on ChatGPT' },
  ],
  // 反例：不存在的公司
  fakeCompany: [
    { title: '假公司名称相关搜索', url: 'https://random.com', content: '一些随机内容' },
    { title: '其他无关结果', url: 'https://other.com', content: '其他无关内容' },
  ],
  // 反例：完全没有结果
  nonexistent: [],
  // 边界情况：只有一个弱匹配
  weakMatch: [
    { title: '某某公司介绍', url: 'https://example.com', content: '一个小型公司的介绍' },
  ],
};

jest.mock('@/services/search/SearXNGService', () => ({
  searxngService: {
    search: jest.fn((query: string) => {
      const lowerQuery = query.toLowerCase();
      if (lowerQuery.includes('字节跳动')) {
        return Promise.resolve(mockSearchResults.bytedance);
      }
      if (lowerQuery.includes('阿里巴巴')) {
        return Promise.resolve(mockSearchResults.alibaba);
      }
      if (lowerQuery.includes('腾讯')) {
        return Promise.resolve(mockSearchResults.tencent);
      }
      if (lowerQuery.includes('apple') || lowerQuery.includes('苹果')) {
        return Promise.resolve(mockSearchResults.apple);
      }
      if (lowerQuery.includes('databricks')) {
        return Promise.resolve(mockSearchResults.databricks);
      }
      if (lowerQuery.includes('openai')) {
        return Promise.resolve(mockSearchResults.openai);
      }
      if (lowerQuery.includes('xyz不存在的公司')) {
        return Promise.resolve(mockSearchResults.fakeCompany);
      }
      if (lowerQuery.includes('完全不存在')) {
        return Promise.resolve(mockSearchResults.nonexistent);
      }
      if (lowerQuery.includes('某某小公司')) {
        return Promise.resolve(mockSearchResults.weakMatch);
      }
      return Promise.resolve([]);
    }),
  },
}));

describe('CompanyValidationService', () => {
  let service: CompanyValidationService;

  beforeEach(() => {
    service = new CompanyValidationService();
  });

  describe('正例测试 - 真实存在的公司', () => {
    it('应该验证"字节跳动"是有效公司 (高置信度)', async () => {
      const result = await service.validateCompany('字节跳动');

      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.message).toContain('字节跳动');
      expect(result.details?.searchResultCount).toBeGreaterThan(0);
      expect(result.details?.matchedResults.length).toBeGreaterThan(0);
    });

    it('应该验证"阿里巴巴"是有效公司', async () => {
      const result = await service.validateCompany('阿里巴巴');

      expect(result.isValid).toBe(true);
      expect(['high', 'medium']).toContain(result.confidence);
      expect(result.message).toContain('阿里巴巴');
    });

    it('应该验证"腾讯"是有效公司', async () => {
      const result = await service.validateCompany('腾讯');

      expect(result.isValid).toBe(true);
      expect(['high', 'medium']).toContain(result.confidence);
    });

    it('应该验证"Apple"是有效公司 (英文公司名)', async () => {
      const result = await service.validateCompany('Apple');

      expect(result.isValid).toBe(true);
      expect(['high', 'medium']).toContain(result.confidence);
    });

    it('应该验证"Databricks"是有效公司 (英文公司名)', async () => {
      const result = await service.validateCompany('Databricks');

      expect(result.isValid).toBe(true);
      expect(['high', 'medium']).toContain(result.confidence);
      expect(result.message).toContain('Databricks');
    });

    it('应该验证"databricks"是有效公司 (小写英文)', async () => {
      const result = await service.validateCompany('databricks');

      expect(result.isValid).toBe(true);
      expect(['high', 'medium']).toContain(result.confidence);
    });

    it('应该验证"OpenAI"是有效公司', async () => {
      const result = await service.validateCompany('OpenAI');

      expect(result.isValid).toBe(true);
      expect(['high', 'medium']).toContain(result.confidence);
    });
  });

  describe('反例测试 - 不存在或无效的公司', () => {
    it('应该拒绝空字符串', async () => {
      const result = await service.validateCompany('');

      expect(result.isValid).toBe(false);
      expect(result.confidence).toBe('none');
      expect(result.message).toContain('不能为空');
    });

    it('应该拒绝只有空格的输入', async () => {
      const result = await service.validateCompany('   ');

      expect(result.isValid).toBe(false);
      expect(result.confidence).toBe('none');
    });

    it('应该拒绝太短的公司名', async () => {
      const result = await service.validateCompany('A');

      expect(result.isValid).toBe(false);
      expect(result.confidence).toBe('none');
      expect(result.message).toContain('太短');
    });

    it('搜索无结果时应该允许继续但标记为低置信度', async () => {
      const result = await service.validateCompany('完全不存在');

      // 修改：现在搜索无结果也允许继续，只是低置信度
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe('low');
      expect(result.message).toContain('无法在线验证');
    });

    it('有搜索结果但无公司关键词匹配时应该允许继续', async () => {
      const result = await service.validateCompany('xyz不存在的公司');

      // 修改：现在更宽松，允许用户继续
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe('low');
    });
  });

  describe('边界情况测试', () => {
    it('应该处理带有前后空格的公司名', async () => {
      const result = await service.validateCompany('  字节跳动  ');

      expect(result.isValid).toBe(true);
    });

    it('应该处理只有一个弱匹配的情况', async () => {
      const result = await service.validateCompany('某某小公司');

      // 只有一个弱匹配，但仍允许继续
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe('low');
    });
  });

  describe('英文公司名搜索策略测试', () => {
    it('英文公司名应该使用"company"而不是"公司"进行搜索', async () => {
      const { searxngService } = require('@/services/search/SearXNGService');

      await service.validateCompany('Databricks');

      // 验证搜索词包含 "company"
      const searchCall = searxngService.search.mock.calls.find(
        (call: string[]) => call[0].toLowerCase().includes('databricks')
      );
      expect(searchCall[0]).toContain('company');
    });

    it('中文公司名应该使用"公司"进行搜索', async () => {
      const { searxngService } = require('@/services/search/SearXNGService');
      searxngService.search.mockClear();

      await service.validateCompany('字节跳动');

      // 验证搜索词包含 "公司"
      const searchCall = searxngService.search.mock.calls.find(
        (call: string[]) => call[0].includes('字节跳动')
      );
      expect(searchCall[0]).toContain('公司');
    });
  });
});

describe('公司验证 API 集成测试', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    isAdmin: false,
  };

  const mockTask = {
    id: 'test-task-id',
    userId: mockUser.id,
    companyName: '字节跳动',
    focusPoints: 'AI战略',
    currentStep: 1,
    status: 'in_progress',
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: {
      dataSources: 0,
      articles: 0,
      reports: 0,
    },
  };

  // Mock Prisma
  const mockPrisma = {
    researchTask: {
      count: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  jest.mock('@/lib/db', () => ({
    __esModule: true,
    default: mockPrisma,
  }));

  describe('创建任务时的公司验证', () => {
    it('应该允许创建有效公司的任务', async () => {
      // 这个测试验证整体流程
      const service = new CompanyValidationService();
      const result = await service.validateCompany('字节跳动');

      expect(result.isValid).toBe(true);
    });

    it('应该允许创建英文公司名的任务（如 Databricks）', async () => {
      const service = new CompanyValidationService();
      const result = await service.validateCompany('Databricks');

      expect(result.isValid).toBe(true);
      expect(['high', 'medium']).toContain(result.confidence);
    });

    it('搜索无结果时仍应该允许创建任务', async () => {
      const service = new CompanyValidationService();
      const result = await service.validateCompany('xyz不存在的公司');

      // 现在更宽松，允许用户继续
      expect(result.isValid).toBe(true);
    });
  });
});
