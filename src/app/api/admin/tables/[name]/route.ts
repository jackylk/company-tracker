import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';

interface RouteParams {
  params: Promise<{ name: string }>;
}

type PrismaModelName = 'user' | 'researchTask' | 'dataSource' | 'article' | 'report' | 'curatedSource';

const TABLE_MAP: Record<string, PrismaModelName> = {
  users: 'user',
  research_tasks: 'researchTask',
  data_sources: 'dataSource',
  articles: 'article',
  reports: 'report',
  curated_sources: 'curatedSource',
};

// 获取表数据
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { name } = await params;
    const payload = await getCurrentUser(request);
    if (!payload) {
      return apiError('未登录', 401);
    }

    if (!payload.isAdmin) {
      return apiError('无权限', 403);
    }

    const modelName = TABLE_MAP[name];
    if (!modelName) {
      return apiError('表不存在', 404);
    }

    // 动态查询
    const model = prisma[modelName] as {
      findMany: (args?: { take?: number; orderBy?: Record<string, 'desc' | 'asc'> }) => Promise<unknown[]>;
    };
    const data = await model.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' } as Record<string, 'desc' | 'asc'>,
    });

    return apiSuccess(data);
  } catch (error) {
    console.error('获取表数据失败:', error);
    return apiError('获取失败', 500);
  }
}

// 清空表
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { name } = await params;
    const payload = await getCurrentUser(request);
    if (!payload) {
      return apiError('未登录', 401);
    }

    if (!payload.isAdmin) {
      return apiError('无权限', 403);
    }

    const modelName = TABLE_MAP[name];
    if (!modelName) {
      return apiError('表不存在', 404);
    }

    // 禁止清空用户表和内置信息源表
    if (name === 'users' || name === 'curated_sources') {
      return apiError('该表不允许清空', 400);
    }

    const model = prisma[modelName] as {
      deleteMany: () => Promise<{ count: number }>;
    };
    const result = await model.deleteMany();

    return apiSuccess({ message: `已删除 ${result.count} 条记录` });
  } catch (error) {
    console.error('清空表失败:', error);
    return apiError('清空失败', 500);
  }
}
