import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import {
  hashPassword,
  isValidUsername,
  isValidPassword,
  isAdminUsername,
  generateToken,
} from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import type { RegisterRequest, AuthResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json();
    const { username, password } = body;

    // 验证用户名格式
    if (!username || !isValidUsername(username)) {
      return apiError('用户名必须是3-20个字符，只能包含字母、数字和下划线', 400);
    }

    // 验证密码强度
    const passwordValidation = isValidPassword(password || '');
    if (!passwordValidation.valid) {
      return apiError(passwordValidation.message || '密码不符合要求', 400);
    }

    // 检查用户名是否已注册
    const existingUser = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    });

    if (existingUser) {
      return apiError('该用户名已被使用，请换一个用户名', 409);
    }

    // 加密密码
    const passwordHash = await hashPassword(password);

    // 检查是否为管理员
    const isAdmin = isAdminUsername(username);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        passwordHash,
        isAdmin,
      },
    });

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

    return apiSuccess(response, 201);
  } catch (error) {
    console.error('注册失败:', error);
    return apiError('注册失败，请稍后重试', 500);
  }
}
