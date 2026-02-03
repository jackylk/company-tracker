import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { deepseekService } from '@/services/ai/DeepseekService';
import type { GenerateReportRequest } from '@/types';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

// 生成报告
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId } = await params;
    const payload = await getCurrentUser(request);
    if (!payload) {
      return apiError('未登录', 401);
    }

    // 获取任务信息
    const task = await prisma.researchTask.findFirst({
      where: { id: taskId, userId: payload.userId },
    });

    if (!task) {
      return apiError('任务不存在', 404);
    }

    const body: GenerateReportRequest = await request.json();
    const { template } = body;

    if (!template) {
      return apiError('请提供报告模板', 400);
    }

    // 获取选中的文章
    const selectedArticles = await prisma.article.findMany({
      where: { taskId, selected: true },
    });

    if (selectedArticles.length === 0) {
      return apiError('请至少选择一篇文章', 400);
    }

    // 调用Deepseek生成报告
    const reportContent = await deepseekService.generateReport(
      selectedArticles,
      task.companyName,
      task.focusPoints,
      template
    );

    // 保存报告
    const report = await prisma.report.create({
      data: {
        taskId,
        template,
        content: reportContent,
      },
    });

    // 更新任务状态
    await prisma.researchTask.update({
      where: { id: taskId },
      data: {
        currentStep: 4,
        status: 'completed',
      },
    });

    return apiSuccess(report, 201);
  } catch (error) {
    console.error('生成报告失败:', error);
    return apiError('生成报告失败，请稍后重试', 500);
  }
}
