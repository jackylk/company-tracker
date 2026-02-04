import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import type { BatchSelectRequest } from '@/types';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

// 获取任务的所有文章
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

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const sourceType = searchParams.get('sourceType'); // 'datasource' | 'search'
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // 构建查询条件
    const where: {
      taskId: string;
      sourceType?: 'datasource' | 'search';
    } = { taskId };

    if (sourceType === 'datasource' || sourceType === 'search') {
      where.sourceType = sourceType;
    }

    // 获取总数
    const total = await prisma.article.count({ where });

    // 获取文章列表，按日期从近到远排序
    const articles = await prisma.article.findMany({
      where,
      include: {
        dataSource: {
          select: { name: true },
        },
      },
      orderBy: [
        { publishDate: 'desc' },
        { createdAt: 'desc' },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return apiSuccess({
      data: articles,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('获取文章失败:', error);
    return apiError('获取文章失败', 500);
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

    const body: BatchSelectRequest & { selectAll?: boolean } = await request.json();

    if (body.selectAll !== undefined) {
      // 全选/全不选
      await prisma.article.updateMany({
        where: { taskId },
        data: { selected: body.selectAll },
      });
    } else if (body.ids && Array.isArray(body.ids)) {
      // 批量更新指定文章
      await prisma.article.updateMany({
        where: {
          id: { in: body.ids },
          taskId,
        },
        data: { selected: body.selected },
      });
    }

    return apiSuccess({ message: '更新成功' });
  } catch (error) {
    console.error('更新文章失败:', error);
    return apiError('更新文章失败', 500);
  }
}
