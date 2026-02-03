import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import {
  hashPassword,
  isValidEmail,
  isValidPassword,
  isAdminEmail,
  generateToken,
} from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import type { RegisterRequest, AuthResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json();
    const { email, password } = body;

    // 验证邮箱格式
    if (!email || !isValidEmail(email)) {
      return apiError('请输入有效的邮箱地址', 400);
    }

    // 验证密码强度
    const passwordValidation = isValidPassword(password || '');
    if (!passwordValidation.valid) {
      return apiError(passwordValidation.message || '密码不符合要求', 400);
    }

    // 检查邮箱是否已注册
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return apiError('该邮箱已被注册', 409);
    }

    // 加密密码
    const passwordHash = await hashPassword(password);

    // 检查是否为管理员
    const isAdmin = isAdminEmail(email);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        isAdmin,
      },
    });

    // 生成Token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
    });

    const response: AuthResponse = {
      user: {
        id: user.id,
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
