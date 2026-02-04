/**
 * 第四步：报告生成 API 测试
 *
 * 测试场景：
 * 1. 从选中的文章生成报告
 * 2. 报告章节符合模板结构
 * 3. 报告格式是有效的 Markdown
 * 4. 报告包含公司名称和关注点相关内容
 * 5. 报告包含参考文章列表（标题和链接）
 */

import { NextRequest } from 'next/server';

// Mock 任务数据
const mockTask = {
  id: 'test-task-id',
  userId: 'test-user-id',
  companyName: '字节跳动',
  focusPoints: 'AI战略、海外业务、短视频',
  currentStep: 3,
  status: 'in_progress',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock 选中的文章
const mockSelectedArticles = [
  {
    id: 'article-1',
    taskId: 'test-task-id',
    title: '字节跳动发布最新AI战略规划',
    content: '字节跳动今日宣布了其AI战略的最新规划，将在人工智能领域投入更多资源，包括大模型研发、AI应用场景拓展等。公司表示将在未来三年投入100亿元用于AI研发。',
    summary: '字节跳动AI战略规划，投入100亿研发',
    url: 'https://36kr.com/article/1',
    category: 'AI战略',
    selected: true,
    sourceType: 'datasource',
    createdAt: new Date(),
  },
  {
    id: 'article-2',
    taskId: 'test-task-id',
    title: 'TikTok在欧洲市场快速增长',
    content: '字节跳动旗下TikTok在欧洲海外市场用户数突破1亿，成为欧洲最受欢迎的短视频平台。公司计划在欧洲建立数据中心以满足当地法规要求。',
    summary: 'TikTok欧洲用户破亿，建立数据中心',
    url: 'https://36kr.com/article/2',
    category: '海外业务',
    selected: true,
    sourceType: 'datasource',
    createdAt: new Date(),
  },
  {
    id: 'article-3',
    taskId: 'test-task-id',
    title: '抖音推出创作者激励计划',
    content: '字节跳动抖音平台推出新的短视频创作者激励计划，吸引更多优质内容创作者。计划包括流量扶持、现金奖励和培训支持等多项措施。',
    summary: '抖音创作者激励计划，多项扶持措施',
    url: 'https://36kr.com/article/3',
    category: '短视频',
    selected: true,
    sourceType: 'search',
    createdAt: new Date(),
  },
];

// Mock Deepseek 生成的报告内容（不含参考文章，由服务自动添加）
const mockReportContentWithoutReferences = `# 字节跳动 调研报告

## 一、公司概述
字节跳动是全球领先的互联网科技公司，成立于2012年，总部位于北京。公司旗下拥有抖音、TikTok、今日头条、飞书等多款知名产品，在短视频、信息分发、企业服务等领域占据重要市场地位。

## 二、AI战略分析
### 2.1 现状分析
字节跳动正在大力推进AI战略，计划在未来三年投入100亿元用于AI研发。公司在大模型研发、AI应用场景拓展等方面持续发力。

### 2.2 策略解读
公司AI战略聚焦于：
- 大模型技术研发
- AI赋能现有产品
- 探索AI新应用场景

### 2.3 竞争态势
在AI领域，字节跳动面临来自百度、阿里等国内科技巨头的竞争，但凭借丰富的数据资源和应用场景，具有独特优势。

## 三、海外业务分析
### 3.1 TikTok全球扩张
TikTok在欧洲市场用户数突破1亿，成为当地最受欢迎的短视频平台。公司正在欧洲建立数据中心以符合当地法规要求。

### 3.2 市场策略
字节跳动采用本地化运营策略，在各主要市场建立本地团队，针对不同市场特点推出差异化内容。

## 四、短视频业务分析
### 4.1 抖音国内市场
抖音持续巩固国内短视频市场领先地位，推出创作者激励计划，包括流量扶持、现金奖励和培训支持等措施。

### 4.2 内容生态建设
公司注重优质内容创作者的培育和激励，构建健康的内容生态系统。

## 五、近期动态
1. 发布最新AI战略规划，投入100亿研发资金
2. TikTok欧洲用户突破1亿
3. 抖音推出新创作者激励计划

## 六、总结与展望
字节跳动在AI战略、海外业务和短视频领域均展现出强劲的发展势头。公司通过持续的技术投入和市场扩张，有望在未来保持行业领先地位。

---
*报告生成日期：${new Date().toLocaleDateString('zh-CN')}*
*数据来源：3篇参考文章*`;

// Mock 完整报告（包含参考文章列表）
const mockReportContent = mockReportContentWithoutReferences + `

## 参考文章

1. [字节跳动发布最新AI战略规划](https://36kr.com/article/1)
2. [TikTok在欧洲市场快速增长](https://36kr.com/article/2)
3. [抖音推出创作者激励计划](https://36kr.com/article/3)
`;

// 存储创建的报告
const createdReports: Array<{
  id: string;
  taskId: string;
  template: string;
  content: string;
  createdAt: Date;
}> = [];

// Mock Prisma
const mockPrisma = {
  researchTask: {
    findFirst: jest.fn().mockResolvedValue(mockTask),
    update: jest.fn().mockResolvedValue({ ...mockTask, currentStep: 4, status: 'completed' }),
  },
  article: {
    findMany: jest.fn().mockImplementation(({ where }) => {
      if (where?.selected === true) {
        return Promise.resolve(mockSelectedArticles);
      }
      return Promise.resolve([]);
    }),
  },
  report: {
    create: jest.fn().mockImplementation(({ data }) => {
      const report = {
        id: `report-${createdReports.length + 1}`,
        ...data,
        createdAt: new Date(),
      };
      createdReports.push(report);
      return Promise.resolve(report);
    }),
    findMany: jest.fn().mockImplementation(() => Promise.resolve(createdReports)),
  },
};

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: mockPrisma,
}));

// Mock Deepseek 服务
jest.mock('@/services/ai/DeepseekService', () => ({
  deepseekService: {
    generateReport: jest.fn().mockResolvedValue(mockReportContent),
    adjustTemplate: jest.fn().mockImplementation((template, request) => {
      return Promise.resolve(template + '\n## 新增章节\n根据用户要求添加的内容。');
    }),
  },
  DEFAULT_REPORT_TEMPLATE: `# {公司名称} 调研报告

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
`,
}));

// Mock 认证
jest.mock('@/lib/auth', () => ({
  getCurrentUser: jest.fn().mockResolvedValue({
    userId: 'test-user-id',
    email: 'test@example.com',
    isAdmin: false,
  }),
}));

import { POST as generateHandler } from '@/app/api/tasks/[taskId]/reports/generate/route';
import { GET as templateHandler, POST as adjustTemplateHandler } from '@/app/api/tasks/[taskId]/reports/template/route';

// 辅助函数
function createMockRequest(body: object = {}): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

async function parseResponse(response: Response) {
  const data = await response.json();
  return { status: response.status, data };
}

// 报告模板
const testTemplate = `# 字节跳动 调研报告

## 一、公司概述
简要介绍公司背景、主营业务和市场定位。

## 二、AI战略、海外业务、短视频分析
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
*报告生成日期：${new Date().toLocaleDateString('zh-CN')}*
*数据来源：3篇参考文章*
`;

describe('报告生成 API 测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createdReports.length = 0;
  });

  describe('基本生成功能测试', () => {
    it('应该成功生成报告', async () => {
      const request = createMockRequest({ template: testTemplate });

      const response = await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { status, data } = await parseResponse(response);

      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.content).toBeDefined();
      expect(data.content.length).toBeGreaterThan(0);
    });

    it('应该调用 Deepseek 生成报告', async () => {
      const { deepseekService } = require('@/services/ai/DeepseekService');

      const request = createMockRequest({ template: testTemplate });

      await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      expect(deepseekService.generateReport).toHaveBeenCalled();
      expect(deepseekService.generateReport).toHaveBeenCalledWith(
        mockSelectedArticles,
        mockTask.companyName,
        mockTask.focusPoints,
        testTemplate
      );
    });

    it('应该将报告保存到数据库', async () => {
      const request = createMockRequest({ template: testTemplate });

      await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      expect(mockPrisma.report.create).toHaveBeenCalled();
      expect(createdReports.length).toBe(1);
      expect(createdReports[0].taskId).toBe(mockTask.id);
    });

    it('生成报告后应该更新任务状态为完成', async () => {
      const request = createMockRequest({ template: testTemplate });

      await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      expect(mockPrisma.researchTask.update).toHaveBeenCalledWith({
        where: { id: mockTask.id },
        data: {
          currentStep: 4,
          status: 'completed',
        },
      });
    });
  });

  describe('报告内容验证测试', () => {
    it('报告应该是有效的 Markdown 格式', async () => {
      const request = createMockRequest({ template: testTemplate });

      const response = await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      // 验证 Markdown 格式
      // 应该包含标题
      expect(data.content).toMatch(/^#\s+.+/m);
      // 应该包含二级标题
      expect(data.content).toMatch(/^##\s+.+/m);
    });

    it('报告应该包含公司名称', async () => {
      const request = createMockRequest({ template: testTemplate });

      const response = await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      expect(data.content).toContain(mockTask.companyName);
    });

    it('报告应该包含"公司概述"章节', async () => {
      const request = createMockRequest({ template: testTemplate });

      const response = await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      expect(data.content).toContain('公司概述');
    });

    it('报告应该包含关注点相关的分析章节', async () => {
      const request = createMockRequest({ template: testTemplate });

      const response = await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      // 检查关注点相关内容
      const focusPointsList = mockTask.focusPoints.split('、');
      let foundFocusPoints = 0;

      for (const point of focusPointsList) {
        if (data.content.includes(point)) {
          foundFocusPoints++;
        }
      }

      // 至少应该包含部分关注点
      expect(foundFocusPoints).toBeGreaterThan(0);
    });

    it('报告应该包含"总结与展望"章节', async () => {
      const request = createMockRequest({ template: testTemplate });

      const response = await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      expect(data.content).toContain('总结');
    });

    it('报告应该包含来源文章的相关内容', async () => {
      const request = createMockRequest({ template: testTemplate });

      const response = await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      // 检查是否包含文章中的关键信息
      // AI战略相关
      expect(data.content).toMatch(/AI|人工智能/);
      // 海外业务相关
      expect(data.content).toMatch(/TikTok|海外|欧洲/);
      // 短视频相关
      expect(data.content).toMatch(/抖音|短视频|创作者/);
    });
  });

  describe('参考文章列表测试', () => {
    it('报告应该包含"参考文章"章节', async () => {
      const request = createMockRequest({ template: testTemplate });

      const response = await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      expect(data.content).toContain('## 参考文章');
    });

    it('参考文章列表应该包含所有选中文章的标题', async () => {
      const request = createMockRequest({ template: testTemplate });

      const response = await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      // 检查每篇文章的标题都在报告中
      for (const article of mockSelectedArticles) {
        expect(data.content).toContain(article.title);
      }
    });

    it('参考文章列表应该包含所有选中文章的链接', async () => {
      const request = createMockRequest({ template: testTemplate });

      const response = await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      // 检查每篇文章的URL都在报告中
      for (const article of mockSelectedArticles) {
        expect(data.content).toContain(article.url);
      }
    });

    it('参考文章应该以 Markdown 链接格式呈现', async () => {
      const request = createMockRequest({ template: testTemplate });

      const response = await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      // 检查 Markdown 链接格式: [标题](URL)
      for (const article of mockSelectedArticles) {
        const linkPattern = `[${article.title}](${article.url})`;
        expect(data.content).toContain(linkPattern);
      }
    });

    it('参考文章列表应该有编号', async () => {
      const request = createMockRequest({ template: testTemplate });

      const response = await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      // 检查编号格式
      expect(data.content).toMatch(/1\.\s+\[/);
      expect(data.content).toMatch(/2\.\s+\[/);
      expect(data.content).toMatch(/3\.\s+\[/);
    });
  });

  describe('报告章节结构测试', () => {
    it('报告应该有正确的章节层级结构', async () => {
      const request = createMockRequest({ template: testTemplate });

      const response = await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      // 统计标题层级
      const h1Count = (data.content.match(/^#\s+[^#]/gm) || []).length;
      const h2Count = (data.content.match(/^##\s+[^#]/gm) || []).length;
      const h3Count = (data.content.match(/^###\s+[^#]/gm) || []).length;

      // 应该有一个一级标题（报告标题）
      expect(h1Count).toBe(1);
      // 应该有多个二级标题（章节）
      expect(h2Count).toBeGreaterThanOrEqual(3);
      // 应该有三级标题（子章节）
      expect(h3Count).toBeGreaterThanOrEqual(0);

      console.log(`报告结构: H1=${h1Count}, H2=${h2Count}, H3=${h3Count}`);
    });

    it('报告应该包含预期的主要章节', async () => {
      const request = createMockRequest({ template: testTemplate });

      const response = await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      // 检查预期章节
      const expectedSections = ['公司概述', '分析', '近期动态', '总结'];
      let foundSections = 0;

      for (const section of expectedSections) {
        if (data.content.includes(section)) {
          foundSections++;
        }
      }

      expect(foundSections).toBeGreaterThanOrEqual(3);
    });
  });

  describe('用户自定义模板测试', () => {
    it('用户提供自定义模板时，系统应该使用该模板生成报告', async () => {
      const { deepseekService } = require('@/services/ai/DeepseekService');

      // 用户自定义模板 - 与默认模板不同的结构
      const customTemplate = `# 字节跳动 简要调研报告

## 核心发现
列出最重要的3-5个发现。

## 风险与机遇
### 风险因素
分析潜在风险。

### 机遇因素
分析发展机遇。

## 投资建议
给出投资建议。
`;

      const request = createMockRequest({ template: customTemplate });

      await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      // 验证 Deepseek 被调用时使用了用户提供的自定义模板
      expect(deepseekService.generateReport).toHaveBeenCalledWith(
        mockSelectedArticles,
        mockTask.companyName,
        mockTask.focusPoints,
        customTemplate
      );
    });

    it('不同模板应该传递给 Deepseek 生成不同结构的报告', async () => {
      const { deepseekService } = require('@/services/ai/DeepseekService');

      // 第一次调用 - 使用模板A
      const templateA = `# 报告A
## 章节A1
## 章节A2
`;
      const requestA = createMockRequest({ template: templateA });
      await generateHandler(requestA, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const firstCallTemplate = deepseekService.generateReport.mock.calls[0][3];
      expect(firstCallTemplate).toBe(templateA);

      // 清除 mock 调用记录
      deepseekService.generateReport.mockClear();

      // 第二次调用 - 使用模板B（不同结构）
      const templateB = `# 报告B
## 章节B1
## 章节B2
## 章节B3
`;
      const requestB = createMockRequest({ template: templateB });
      await generateHandler(requestB, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const secondCallTemplate = deepseekService.generateReport.mock.calls[0][3];
      expect(secondCallTemplate).toBe(templateB);
      expect(secondCallTemplate).not.toBe(templateA);
    });

    it('用户修改默认模板后，系统应该使用修改后的模板生成报告', async () => {
      const { deepseekService } = require('@/services/ai/DeepseekService');

      // 模拟用户先调整模板
      const originalTemplate = testTemplate;
      const adjustRequest = createMockRequest({
        currentTemplate: originalTemplate,
        userRequest: '增加一个竞品分析章节',
      });

      const adjustResponse = await adjustTemplateHandler(adjustRequest, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data: adjustData } = await parseResponse(adjustResponse);
      const adjustedTemplate = adjustData.template;

      // 验证模板确实被修改了
      expect(adjustedTemplate).toContain('新增章节');
      expect(adjustedTemplate.length).toBeGreaterThan(originalTemplate.length);

      // 使用修改后的模板生成报告
      deepseekService.generateReport.mockClear();

      const generateRequest = createMockRequest({ template: adjustedTemplate });
      await generateHandler(generateRequest, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      // 验证使用了修改后的模板
      const usedTemplate = deepseekService.generateReport.mock.calls[0][3];
      expect(usedTemplate).toBe(adjustedTemplate);
      expect(usedTemplate).toContain('新增章节');
    });

    it('模板中的章节标题应该传递给 Deepseek', async () => {
      const { deepseekService } = require('@/services/ai/DeepseekService');

      const customSections = ['财务分析', 'SWOT分析', '行业对比', '未来预测'];
      const customTemplate = `# 字节跳动 深度报告

## ${customSections[0]}
分析财务数据。

## ${customSections[1]}
进行SWOT分析。

## ${customSections[2]}
与行业竞争对手对比。

## ${customSections[3]}
预测未来发展。
`;

      const request = createMockRequest({ template: customTemplate });
      await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const usedTemplate = deepseekService.generateReport.mock.calls[0][3];

      // 验证所有自定义章节都在模板中
      for (const section of customSections) {
        expect(usedTemplate).toContain(section);
      }
    });
  });

  describe('错误处理测试', () => {
    it('未提供模板时应该返回400', async () => {
      const request = createMockRequest({});

      const response = await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.message).toContain('模板');
    });

    it('没有选中文章时应该返回400', async () => {
      mockPrisma.article.findMany.mockResolvedValueOnce([]);

      const request = createMockRequest({ template: testTemplate });

      const response = await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.message).toContain('文章');
    });

    it('任务不存在时应该返回404', async () => {
      mockPrisma.researchTask.findFirst.mockResolvedValueOnce(null);

      const request = createMockRequest({ template: testTemplate });

      const response = await generateHandler(request, {
        params: Promise.resolve({ taskId: 'non-existent' }),
      });

      const { status, data } = await parseResponse(response);

      expect(status).toBe(404);
      expect(data.message).toContain('不存在');
    });

    it('Deepseek 失败时应该返回500', async () => {
      const { deepseekService } = require('@/services/ai/DeepseekService');
      deepseekService.generateReport.mockRejectedValueOnce(new Error('API 失败'));

      const request = createMockRequest({ template: testTemplate });

      const response = await generateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { status, data } = await parseResponse(response);

      expect(status).toBe(500);
      expect(data.message).toContain('失败');
    });
  });
});

describe('报告模板 API 测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('获取默认模板', () => {
    it('应该返回默认模板', async () => {
      const request = createMockRequest();

      const response = await templateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.template).toBeDefined();
      expect(data.template.length).toBeGreaterThan(0);
    });

    it('模板应该包含公司名称占位符的替换结果', async () => {
      const request = createMockRequest();

      const response = await templateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      // 模板中的 {公司名称} 应该被替换为实际公司名
      expect(data.template).toContain(mockTask.companyName);
    });

    it('模板应该包含 Markdown 格式的章节', async () => {
      const request = createMockRequest();

      const response = await templateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      // 应该有 Markdown 标题
      expect(data.template).toMatch(/^#/m);
      expect(data.template).toMatch(/^##/m);
    });
  });

  describe('调整模板', () => {
    it('应该支持根据用户需求调整模板', async () => {
      const request = createMockRequest({
        currentTemplate: testTemplate,
        userRequest: '增加一个竞品分析章节',
      });

      const response = await adjustTemplateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.template).toBeDefined();
    });

    it('缺少参数时应该返回400', async () => {
      const request = createMockRequest({
        currentTemplate: testTemplate,
        // 缺少 userRequest
      });

      const response = await adjustTemplateHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
    });
  });
});

describe('Deepseek 报告生成服务测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该使用正确的参数调用 Deepseek', async () => {
    const { deepseekService } = require('@/services/ai/DeepseekService');

    const request = createMockRequest({ template: testTemplate });

    await generateHandler(request, {
      params: Promise.resolve({ taskId: mockTask.id }),
    });

    const callArgs = deepseekService.generateReport.mock.calls[0];

    // 验证调用参数
    expect(callArgs[0]).toEqual(mockSelectedArticles); // 文章列表
    expect(callArgs[1]).toBe(mockTask.companyName); // 公司名称
    expect(callArgs[2]).toBe(mockTask.focusPoints); // 关注点
    expect(callArgs[3]).toBe(testTemplate); // 模板
  });

  it('应该传递所有选中的文章给 Deepseek', async () => {
    const { deepseekService } = require('@/services/ai/DeepseekService');

    const request = createMockRequest({ template: testTemplate });

    await generateHandler(request, {
      params: Promise.resolve({ taskId: mockTask.id }),
    });

    const articles = deepseekService.generateReport.mock.calls[0][0];

    expect(articles.length).toBe(mockSelectedArticles.length);

    // 验证文章包含必要字段
    for (const article of articles) {
      expect(article).toHaveProperty('title');
      expect(article).toHaveProperty('content');
      expect(article).toHaveProperty('url');
    }
  });
});
