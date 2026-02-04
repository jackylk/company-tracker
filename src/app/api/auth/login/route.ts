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
    return apiError('登录失败，请稍后重试', 500);
  }
}
