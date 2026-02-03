import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';

interface RouteParams {
  params: Promise<{ taskId: string; reportId: string }>;
}

// 获取报告详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId, reportId } = await params;
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

    // 检查是否是下载请求
    const { searchParams } = new URL(request.url);
    const download = searchParams.get('download') === 'true';

    const report = await prisma.report.findFirst({
      where: { id: reportId, taskId },
    });

    if (!report) {
      return apiError('报告不存在', 404);
    }

    // 如果是下载请求，返回文件
    if (download) {
      const filename = `${task.companyName}_调研报告_${new Date(report.createdAt).toLocaleDateString('zh-CN').replace(/\//g, '-')}.md`;

      return new NextResponse(report.content, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        },
      });
    }

    return apiSuccess(report);
  } catch (error) {
    console.error('获取报告失败:', error);
    return apiError('获取报告失败', 500);
  }
}

// 删除报告
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { taskId, reportId } = await params;
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

    await prisma.report.delete({
      where: { id: reportId },
    });

    return apiSuccess({ message: '报告已删除' });
  } catch (error) {
    console.error('删除报告失败:', error);
    return apiError('删除报告失败', 500);
  }
}
