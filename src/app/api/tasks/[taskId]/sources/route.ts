import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import type { BatchSelectRequest } from '@/types';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

// 获取任务的所有信息源
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const payload = await getCurrentUser(request);
    if (!payload) {
      return apiError('未登录', 401);
    }

    // 验证任务归属
    const task = await prisma.researchTask.findFirst({
      where: { id: taskId, userId: payload.userId },
    });

    if (!task) {
      return apiError('任务不存在', 404);
    }

    const sources = await prisma.dataSource.findMany({
      where: { taskId },
      orderBy: [{ selected: 'desc' }, { createdAt: 'desc' }],
    });

    return apiSuccess(sources);
  } catch (error) {
    console.error('获取信息源失败:', error);
    return apiError('获取信息源失败', 500);
  }
}

// 批量更新选中状态
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const payload = await getCurrentUser(request);
    if (!payload) {
      return apiError('未登录', 401);
    }

    // 验证任务归属
    const task = await prisma.researchTask.findFirst({
      where: { id: taskId, userId: payload.userId },
    });

    if (!task) {
      return apiError('任务不存在', 404);
    }

    const body: BatchSelectRequest = await request.json();
    const { ids, selected } = body;

    if (!Array.isArray(ids)) {
      return apiError('参数错误', 400);
    }

    // 批量更新
    await prisma.dataSource.updateMany({
      where: {
        id: { in: ids },
        taskId,
      },
      data: { selected },
    });

    // 返回更新后的列表
    const sources = await prisma.dataSource.findMany({
      where: { taskId },
      orderBy: [{ selected: 'desc' }, { createdAt: 'desc' }],
    });

    return apiSuccess(sources);
  } catch (error) {
    console.error('更新信息源失败:', error);
    return apiError('更新信息源失败', 500);
  }
}
