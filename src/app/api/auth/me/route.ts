import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import type { User } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);

    if (!payload) {
      return apiError('未登录', 401);
    }

    // 获取最新用户信息
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return apiError('用户不存在', 404);
    }

    const userData: User = {
      id: user.id,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return apiSuccess(userData);
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return apiError('获取用户信息失败', 500);
  }
}
