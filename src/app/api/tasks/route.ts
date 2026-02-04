import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { companyValidationService } from '@/services/validation/CompanyValidationService';
import type { CreateTaskRequest, TaskWithCounts } from '@/types';

const MAX_TASKS = 3;

// 获取用户所有任务
export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) {
      return apiError('未登录', 401);
    }

    const tasks = await prisma.researchTask.findMany({
      where: { userId: payload.userId },
      include: {
        _count: {
          select: {
            dataSources: true,
            articles: true,
            reports: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return apiSuccess(tasks as TaskWithCounts[]);
  } catch (error) {
    console.error('获取任务列表失败:', error);
    return apiError('获取任务列表失败', 500);
  }
}

// 创建新任务
export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) {
      return apiError('未登录', 401);
    }

    const body: CreateTaskRequest = await request.json();
    const { companyName, focusPoints } = body;

    // 如果公司名和关注点都为空，创建草稿任务（用于新建流程）
    const isDraft = (!companyName || companyName.trim().length === 0) &&
                    (!focusPoints || focusPoints.trim().length === 0);

    if (!isDraft) {
      // 非草稿任务需要验证输入
      if (!companyName || companyName.trim().length === 0) {
        return apiError('请输入公司名称', 400);
      }

      if (!focusPoints || focusPoints.trim().length === 0) {
        return apiError('请输入关注点', 400);
      }

      // 验证公司名称是否真实存在
      const validationResult = await companyValidationService.validateCompany(companyName);
      if (!validationResult.isValid) {
        return apiError(validationResult.message, 400);
      }
    }

    // 检查任务数量限制
    const taskCount = await prisma.researchTask.count({
      where: {
        userId: payload.userId,
        status: 'in_progress',
      },
    });

    if (taskCount >= MAX_TASKS) {
      return apiError(`您最多可同时进行 ${MAX_TASKS} 个调研任务，请先完成或删除现有任务`, 400);
    }

    // 创建任务
    const task = await prisma.researchTask.create({
      data: {
        userId: payload.userId,
        companyName: (companyName || '').trim() || '新建调研',
        focusPoints: (focusPoints || '').trim() || '待填写',
        currentStep: 1,
        status: 'in_progress',
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

    return apiSuccess(task as TaskWithCounts, 201);
  } catch (error) {
    console.error('创建任务失败:', error);
    return apiError('创建任务失败', 500);
  }
}
