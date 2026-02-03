import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';

interface RouteParams {
  params: Promise<{ taskId: string; articleId: string }>;
}

// 获取文章详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId, articleId } = await params;
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

    const article = await prisma.article.findFirst({
      where: { id: articleId, taskId },
      include: {
        dataSource: {
          select: { name: true, url: true },
        },
      },
    });

    if (!article) {
      return apiError('文章不存在', 404);
    }

    return apiSuccess(article);
  } catch (error) {
    console.error('获取文章详情失败:', error);
    return apiError('获取文章详情失败', 500);
  }
}

// 更新文章选中状态
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId, articleId } = await params;
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

    const body = await request.json();
    const { selected } = body;

    const article = await prisma.article.update({
      where: { id: articleId },
      data: { selected: !!selected },
    });

    return apiSuccess(article);
  } catch (error) {
    console.error('更新文章失败:', error);
    return apiError('更新文章失败', 500);
  }
}
