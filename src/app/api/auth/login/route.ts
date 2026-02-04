import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import {
  verifyPassword,
  generateToken,
} from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import type { LoginRequest, AuthResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { username, password } = body;

    // 验证输入
    if (!username || username.length < 3) {
      return apiError('请输入有效的用户名', 400);
    }

    if (!password) {
      return apiError('请输入密码', 400);
    }

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });

    if (!user) {
      return apiError('用户名或密码错误', 401);
    }

    // 验证密码
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return apiError('用户名或密码错误', 401);
    }

    // 生成Token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
    });

    const response: AuthResponse = {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
    };

    return apiSuccess(response);
  } catch (error) {
    console.error('登录失败:', error);

    // 返回更详细的错误信息用于调试
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'UnknownError';

    // 检查是否是数据库连接错误
    if (errorMessage.includes('connect') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('timeout')) {
      return apiError(`数据库连接失败: ${errorMessage}`, 500);
    }

    // 检查是否是表不存在错误（需要运行迁移）
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation') || errorMessage.includes('table')) {
      return apiError(`数据库表不存在，请运行数据库迁移: ${errorMessage}`, 500);
    }

    return apiError(`登录失败 [${errorName}]: ${errorMessage}`, 500);
  }
}
