import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import type { UpdateTaskRequest, TaskWithCounts } from '@/types';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

// 获取任务详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const payload = await getCurrentUser(request);
    if (!payload) {
      return apiError('未登录', 401);
    }

    const task = await prisma.researchTask.findFirst({
      where: {
        id: taskId,
        userId: payload.userId,
      },
      include: {
        _count: {
          select: {
            dataSources: true,
            articles: true,
            reports: true,
          },
        },
      },
    });

    if (!task) {
      return apiError('任务不存在', 404);
    }

    return apiSuccess(task as TaskWithCounts);
  } catch (error) {
    console.error('获取任务详情失败:', error);
    return apiError('获取任务详情失败', 500);
  }
}

// 更新任务
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const payload = await getCurrentUser(request);
    if (!payload) {
      return apiError('未登录', 401);
    }

    // 检查任务是否存在且属于当前用户
    const existingTask = await prisma.researchTask.findFirst({
      where: {
        id: taskId,
        userId: payload.userId,
      },
    });

    if (!existingTask) {
      return apiError('任务不存在', 404);
    }

    const body: UpdateTaskRequest = await request.json();
    const { companyName, focusPoints, currentStep, status } = body;

    // 构建更新数据
    const updateData: {
      companyName?: string;
      focusPoints?: string;
      currentStep?: number;
      status?: 'in_progress' | 'completed';
    } = {};

    if (companyName !== undefined) {
      if (companyName.trim().length === 0) {
        return apiError('公司名称不能为空', 400);
      }
      updateData.companyName = companyName.trim();
    }

    if (focusPoints !== undefined) {
      if (focusPoints.trim().length === 0) {
        return apiError('关注点不能为空', 400);
      }
      updateData.focusPoints = focusPoints.trim();
    }

    if (currentStep !== undefined) {
      if (currentStep < 1 || currentStep > 4) {
        return apiError('步骤值无效', 400);
      }
      updateData.currentStep = currentStep;
    }

    if (status !== undefined) {
      if (!['in_progress', 'completed'].includes(status)) {
        return apiError('状态值无效', 400);
      }
      updateData.status = status;
    }

    // 更新任务
    const task = await prisma.researchTask.update({
      where: { id: taskId },
      data: updateData,
      include: {
        _count: {
          select: {
            dataSources: true,
            articles: true,
            reports: true,
          },
        },
      },
    });

    return apiSuccess(task as TaskWithCounts);
  } catch (error) {
    console.error('更新任务失败:', error);
    return apiError('更新任务失败', 500);
  }
}

// 删除任务
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const payload = await getCurrentUser(request);
    if (!payload) {
      return apiError('未登录', 401);
    }

    // 检查任务是否存在且属于当前用户
    const existingTask = await prisma.researchTask.findFirst({
      where: {
        id: taskId,
        userId: payload.userId,
      },
    });

    if (!existingTask) {
      return apiError('任务不存在', 404);
    }

    // 删除任务（关联数据会因为 onDelete: Cascade 自动删除）
    await prisma.researchTask.delete({
      where: { id: taskId },
    });

    return apiSuccess({ message: '任务已删除' });
  } catch (error) {
    console.error('删除任务失败:', error);
    return apiError('删除任务失败', 500);
  }
}
