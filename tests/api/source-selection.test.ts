/**
 * 信息源选择测试
 *
 * 测试场景：
 * 1. 勾选信息源时列表不重新排列
 * 2. 乐观更新 - 勾选后立即反映在 UI 上
 * 3. 分组选择功能
 */

import { NextRequest } from 'next/server';

// Mock 数据
const mockTask = {
  id: 'test-task-id',
  userId: 'test-user-id',
  companyName: '字节跳动',
  focusPoints: 'AI战略',
  currentStep: 2,
  status: 'in_progress',
};

// 模拟信息源列表 - 固定顺序
const mockSources = [
  { id: 'src-1', taskId: 'test-task-id', name: '36氪', url: 'https://36kr.com', type: 'news', origin: 'builtin', selected: false, createdAt: new Date('2024-01-01T10:00:00') },
  { id: 'src-2', taskId: 'test-task-id', name: '虎嗅', url: 'https://huxiu.com', type: 'news', origin: 'builtin', selected: true, createdAt: new Date('2024-01-01T09:00:00') },
  { id: 'src-3', taskId: 'test-task-id', name: '字节跳动官博', url: 'https://blog.bytedance.com', type: 'blog', origin: 'search', selected: false, createdAt: new Date('2024-01-01T08:00:00') },
  { id: 'src-4', taskId: 'test-task-id', name: 'TechCrunch', url: 'https://techcrunch.com', type: 'news', origin: 'search', selected: true, createdAt: new Date('2024-01-01T07:00:00') },
  { id: 'src-5', taskId: 'test-task-id', name: 'AI推荐源1', url: 'https://ai-source1.com', type: 'website', origin: 'deepseek', selected: false, createdAt: new Date('2024-01-01T06:00:00') },
  { id: 'src-6', taskId: 'test-task-id', name: 'AI推荐源2', url: 'https://ai-source2.com', type: 'website', origin: 'deepseek', selected: false, createdAt: new Date('2024-01-01T05:00:00') },
];

// 记录更新操作
let updateCalls: Array<{ ids: string[]; selected: boolean }> = [];

// Mock Prisma
const mockPrisma = {
  researchTask: {
    findFirst: jest.fn().mockResolvedValue(mockTask),
  },
  dataSource: {
    findMany: jest.fn().mockImplementation(() => {
      // 始终返回按 createdAt desc 排序的列表，不按 selected 排序
      return Promise.resolve([...mockSources].sort((a, b) =>
        b.createdAt.getTime() - a.createdAt.getTime()
      ));
    }),
    updateMany: jest.fn().mockImplementation(({ where, data }) => {
      updateCalls.push({ ids: where.id.in, selected: data.selected });
      // 更新 mock 数据
      for (const source of mockSources) {
        if (where.id.in.includes(source.id)) {
          source.selected = data.selected;
        }
      }
      return Promise.resolve({ count: where.id.in.length });
    }),
  },
};

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('@/lib/auth', () => ({
  getCurrentUser: jest.fn().mockResolvedValue({
    userId: 'test-user-id',
    email: 'test@example.com',
    isAdmin: false,
  }),
}));

import { GET as getSourcesHandler, PATCH as updateSourcesHandler } from '@/app/api/tasks/[taskId]/sources/route';

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

describe('信息源选择测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateCalls = [];
    // 重置 mock 数据的选中状态
    mockSources[0].selected = false;
    mockSources[1].selected = true;
    mockSources[2].selected = false;
    mockSources[3].selected = true;
    mockSources[4].selected = false;
    mockSources[5].selected = false;
  });

  describe('列表顺序稳定性测试', () => {
    it('获取信息源时应该按 createdAt 降序排列', async () => {
      const request = createMockRequest();

      const response = await getSourcesHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.length).toBe(mockSources.length);

      // 验证顺序是按 createdAt 降序
      for (let i = 1; i < data.length; i++) {
        const prev = new Date(data[i - 1].createdAt).getTime();
        const curr = new Date(data[i].createdAt).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    it('勾选信息源后列表顺序不应该改变', async () => {
      // 先获取原始顺序
      const getRequest1 = createMockRequest();
      const response1 = await getSourcesHandler(getRequest1, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });
      const { data: originalOrder } = await parseResponse(response1);
      const originalIds = originalOrder.map((s: { id: string }) => s.id);

      // 勾选一个未选中的信息源
      const updateRequest = createMockRequest({
        ids: ['src-1'],
        selected: true,
      });
      await updateSourcesHandler(updateRequest, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      // 再次获取列表
      const getRequest2 = createMockRequest();
      const response2 = await getSourcesHandler(getRequest2, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });
      const { data: newOrder } = await parseResponse(response2);
      const newIds = newOrder.map((s: { id: string }) => s.id);

      // 顺序应该完全相同
      expect(newIds).toEqual(originalIds);
    });

    it('取消勾选后列表顺序不应该改变', async () => {
      // 先获取原始顺序
      const getRequest1 = createMockRequest();
      const response1 = await getSourcesHandler(getRequest1, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });
      const { data: originalOrder } = await parseResponse(response1);
      const originalIds = originalOrder.map((s: { id: string }) => s.id);

      // 取消勾选一个已选中的信息源
      const updateRequest = createMockRequest({
        ids: ['src-2'],
        selected: false,
      });
      await updateSourcesHandler(updateRequest, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      // 再次获取列表
      const getRequest2 = createMockRequest();
      const response2 = await getSourcesHandler(getRequest2, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });
      const { data: newOrder } = await parseResponse(response2);
      const newIds = newOrder.map((s: { id: string }) => s.id);

      // 顺序应该完全相同
      expect(newIds).toEqual(originalIds);
    });

    it('批量选择后列表顺序不应该改变', async () => {
      // 先获取原始顺序
      const getRequest1 = createMockRequest();
      const response1 = await getSourcesHandler(getRequest1, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });
      const { data: originalOrder } = await parseResponse(response1);
      const originalIds = originalOrder.map((s: { id: string }) => s.id);

      // 批量选择多个信息源
      const updateRequest = createMockRequest({
        ids: ['src-1', 'src-3', 'src-5'],
        selected: true,
      });
      await updateSourcesHandler(updateRequest, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      // 再次获取列表
      const getRequest2 = createMockRequest();
      const response2 = await getSourcesHandler(getRequest2, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });
      const { data: newOrder } = await parseResponse(response2);
      const newIds = newOrder.map((s: { id: string }) => s.id);

      // 顺序应该完全相同
      expect(newIds).toEqual(originalIds);
    });
  });

  describe('更新功能测试', () => {
    it('应该正确更新单个信息源的选中状态', async () => {
      const request = createMockRequest({
        ids: ['src-1'],
        selected: true,
      });

      const response = await updateSourcesHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(mockPrisma.dataSource.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['src-1'] },
          taskId: mockTask.id,
        },
        data: { selected: true },
      });
    });

    it('应该正确批量更新多个信息源的选中状态', async () => {
      const request = createMockRequest({
        ids: ['src-1', 'src-3', 'src-5'],
        selected: true,
      });

      const response = await updateSourcesHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { status } = await parseResponse(response);

      expect(status).toBe(200);
      expect(mockPrisma.dataSource.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['src-1', 'src-3', 'src-5'] },
          taskId: mockTask.id,
        },
        data: { selected: true },
      });
    });

    it('返回的列表应该反映更新后的选中状态', async () => {
      const request = createMockRequest({
        ids: ['src-1'],
        selected: true,
      });

      const response = await updateSourcesHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      const updatedSource = data.find((s: { id: string }) => s.id === 'src-1');
      expect(updatedSource.selected).toBe(true);
    });
  });

  describe('分组功能测试', () => {
    it('信息源应该能按 origin 分组', async () => {
      const request = createMockRequest();

      const response = await getSourcesHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      // 按 origin 分组
      const groups: Record<string, unknown[]> = {};
      for (const source of data) {
        const origin = source.origin;
        if (!groups[origin]) groups[origin] = [];
        groups[origin].push(source);
      }

      // 应该有三个分组
      expect(Object.keys(groups)).toContain('builtin');
      expect(Object.keys(groups)).toContain('search');
      expect(Object.keys(groups)).toContain('deepseek');

      // 每个分组应该有正确数量的信息源
      expect(groups['builtin'].length).toBe(2);
      expect(groups['search'].length).toBe(2);
      expect(groups['deepseek'].length).toBe(2);
    });

    it('每个信息源都应该有 origin 字段', async () => {
      const request = createMockRequest();

      const response = await getSourcesHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { data } = await parseResponse(response);

      for (const source of data) {
        expect(source.origin).toBeDefined();
        expect(['builtin', 'search', 'deepseek', 'manual']).toContain(source.origin);
      }
    });
  });

  describe('错误处理测试', () => {
    it('任务不存在时应该返回 404', async () => {
      mockPrisma.researchTask.findFirst.mockResolvedValueOnce(null);

      const request = createMockRequest({
        ids: ['src-1'],
        selected: true,
      });

      const response = await updateSourcesHandler(request, {
        params: Promise.resolve({ taskId: 'non-existent' }),
      });

      const { status, data } = await parseResponse(response);

      expect(status).toBe(404);
      expect(data.message).toContain('不存在');
    });

    it('参数错误时应该返回 400', async () => {
      const request = createMockRequest({
        ids: 'not-an-array', // 错误的参数类型
        selected: true,
      });

      const response = await updateSourcesHandler(request, {
        params: Promise.resolve({ taskId: mockTask.id }),
      });

      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.message).toContain('参数');
    });
  });
});
