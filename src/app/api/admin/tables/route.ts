import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';

const TABLES = [
  { name: 'users', label: '用户' },
  { name: 'research_tasks', label: '调研任务' },
  { name: 'data_sources', label: '信息源' },
  { name: 'articles', label: '文章' },
  { name: 'reports', label: '报告' },
  { name: 'curated_sources', label: '内置信息源' },
];

// 获取所有表名
export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) {
      return apiError('未登录', 401);
    }

    if (!payload.isAdmin) {
      return apiError('无权限', 403);
    }

    return apiSuccess(TABLES);
  } catch (error) {
    console.error('获取表列表失败:', error);
    return apiError('获取失败', 500);
  }
}
