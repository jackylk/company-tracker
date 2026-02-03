import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

// 获取任务的所有报告
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

    const reports = await prisma.report.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });

    return apiSuccess(reports);
  } catch (error) {
    console.error('获取报告列表失败:', error);
    return apiError('获取报告列表失败', 500);
  }
}
