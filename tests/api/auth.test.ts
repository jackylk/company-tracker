/**
 * 注册和登录 API 集成测试
 */
import { NextRequest } from 'next/server';

// Mock Prisma
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  passwordHash: '',
  isAdmin: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: mockPrisma,
}));

// 需要在 mock 之后导入
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { POST as loginHandler } from '@/app/api/auth/login/route';
import { hashPassword } from '@/lib/auth';

// 辅助函数：创建 mock request
function createMockRequest(body: object): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

// 辅助函数：解析响应
async function parseResponse(response: Response) {
  const data = await response.json();
  return { status: response.status, data };
}

describe('Auth API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('应该成功注册新用户', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const request = createMockRequest({
        email: 'newuser@example.com',
        password: 'password123',
      });

      const response = await registerHandler(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(201);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(mockUser.email);
      expect(data.token).toBeDefined();
      expect(typeof data.token).toBe('string');
    });

    it('应该拒绝无效的邮箱格式', async () => {
      const request = createMockRequest({
        email: 'invalid-email',
        password: 'password123',
      });

      const response = await registerHandler(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.error).toBe('BAD_REQUEST');
      expect(data.message).toContain('邮箱');
    });

    it('应该接受简单密码', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const request = createMockRequest({
        email: 'test@example.com',
        password: '123',
      });

      const response = await registerHandler(request);
      const { status } = await parseResponse(response);

      expect(status).toBe(201);
    });

    it('应该拒绝空密码', async () => {
      const request = createMockRequest({
        email: 'test@example.com',
        password: '',
      });

      const response = await registerHandler(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.error).toBe('BAD_REQUEST');
      expect(data.message).toContain('不能为空');
    });

    it('应该拒绝重复注册的邮箱', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const request = createMockRequest({
        email: 'test@example.com',
        password: 'password123',
      });

      const response = await registerHandler(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(409);
      expect(data.error).toBe('CONFLICT');
      expect(data.message).toContain('已被注册');
    });

    it('管理员邮箱应该获得管理员权限', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockImplementation(async (args) => ({
        ...mockUser,
        email: args.data.email,
        isAdmin: args.data.isAdmin,
      }));

      const request = createMockRequest({
        email: 'admin@test.com', // 在 setup.ts 中配置的管理员邮箱
        password: 'password123',
      });

      const response = await registerHandler(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(201);
      expect(data.user.isAdmin).toBe(true);
    });

    it('普通用户不应该获得管理员权限', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockImplementation(async (args) => ({
        ...mockUser,
        email: args.data.email,
        isAdmin: args.data.isAdmin,
      }));

      const request = createMockRequest({
        email: 'user@example.com',
        password: 'password123',
      });

      const response = await registerHandler(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(201);
      expect(data.user.isAdmin).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('应该成功登录已注册用户', async () => {
      const password = 'password123';
      const hash = await hashPassword(password);

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: hash,
      });

      const request = createMockRequest({
        email: 'test@example.com',
        password,
      });

      const response = await loginHandler(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(mockUser.email);
      expect(data.token).toBeDefined();
    });

    it('应该拒绝无效的邮箱格式', async () => {
      const request = createMockRequest({
        email: 'invalid-email',
        password: 'password123',
      });

      const response = await loginHandler(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.error).toBe('BAD_REQUEST');
    });

    it('应该拒绝空密码', async () => {
      const request = createMockRequest({
        email: 'test@example.com',
        password: '',
      });

      const response = await loginHandler(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(400);
      expect(data.error).toBe('BAD_REQUEST');
      expect(data.message).toContain('密码');
    });

    it('应该拒绝不存在的用户', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const request = createMockRequest({
        email: 'nonexistent@example.com',
        password: 'password123',
      });

      const response = await loginHandler(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(401);
      expect(data.error).toBe('UNAUTHORIZED');
      expect(data.message).toContain('错误');
    });

    it('应该拒绝错误的密码', async () => {
      const correctPassword = 'password123';
      const hash = await hashPassword(correctPassword);

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: hash,
      });

      const request = createMockRequest({
        email: 'test@example.com',
        password: 'wrongpassword123',
      });

      const response = await loginHandler(request);
      const { status, data } = await parseResponse(response);

      expect(status).toBe(401);
      expect(data.error).toBe('UNAUTHORIZED');
      expect(data.message).toContain('错误');
    });

    it('登录成功后返回的 token 应该可以验证', async () => {
      const password = 'password123';
      const hash = await hashPassword(password);

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        passwordHash: hash,
      });

      const request = createMockRequest({
        email: 'test@example.com',
        password,
      });

      const response = await loginHandler(request);
      const { data } = await parseResponse(response);

      const { verifyToken } = await import('@/lib/auth');
      const payload = verifyToken(data.token);

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(mockUser.id);
      expect(payload?.email).toBe(mockUser.email);
    });

    it('邮箱应该不区分大小写', async () => {
      const password = 'password123';
      const hash = await hashPassword(password);

      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        email: 'test@example.com',
        passwordHash: hash,
      });

      const request = createMockRequest({
        email: 'TEST@EXAMPLE.COM',
        password,
      });

      const response = await loginHandler(request);
      const { status } = await parseResponse(response);

      expect(status).toBe(200);
      // 验证 findUnique 被调用时使用了小写邮箱
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  describe('注册后登录流程', () => {
    it('注册后应该能够使用相同密码登录', async () => {
      const email = 'newuser@example.com';
      const password = 'password123';
      let savedHash = '';

      // Mock 注册
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockImplementation(async (args) => {
        savedHash = args.data.passwordHash;
        return {
          ...mockUser,
          email: args.data.email,
          passwordHash: savedHash,
        };
      });

      // 注册
      const registerRequest = createMockRequest({ email, password });
      const registerResponse = await registerHandler(registerRequest);
      const registerResult = await parseResponse(registerResponse);

      expect(registerResult.status).toBe(201);

      // Mock 登录
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        ...mockUser,
        email,
        passwordHash: savedHash,
      });

      // 登录
      const loginRequest = createMockRequest({ email, password });
      const loginResponse = await loginHandler(loginRequest);
      const loginResult = await parseResponse(loginResponse);

      expect(loginResult.status).toBe(200);
      expect(loginResult.data.user.email).toBe(email);
    });
  });
});
