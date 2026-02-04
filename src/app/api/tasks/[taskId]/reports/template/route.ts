import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { DEFAULT_REPORT_TEMPLATE, deepseekService } from '@/services/ai/DeepseekService';

interface RouteParams {
  params: Promise<{ taskId: string }>;
}

// 获取或生成模板
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // 检查URL参数是否请求AI生成
    const url = new URL(request.url);
    const useAI = url.searchParams.get('ai') === 'true';

    let template: string;

    if (useAI) {
      // 使用AI根据公司名和关注点动态生成模板
      try {
        template = await deepseekService.generateTemplate(task.companyName, task.focusPoints);
      } catch (error) {
        console.error('AI生成模板失败，使用默认模板:', error);
        // 降级到默认模板
        template = DEFAULT_REPORT_TEMPLATE
          .replace('{公司名称}', task.companyName)
          .replace('{关注点}', task.focusPoints)
          .replace('{日期}', new Date().toLocaleDateString('zh-CN'))
          .replace('{来源数量}', '0');
      }
    } else {
      // 使用默认静态模板
      template = DEFAULT_REPORT_TEMPLATE
        .replace('{公司名称}', task.companyName)
        .replace('{关注点}', task.focusPoints)
        .replace('{日期}', new Date().toLocaleDateString('zh-CN'))
        .replace('{来源数量}', '0');
    }

    return apiSuccess({ template });
  } catch (error) {
    console.error('获取模板失败:', error);
    return apiError('获取模板失败', 500);
  }
}

// 根据用户描述调整模板
export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json();
    const { currentTemplate, userRequest } = body;

    if (!currentTemplate || !userRequest) {
      return apiError('请提供当前模板和调整需求', 400);
    }

    // 调用Deepseek调整模板
    const newTemplate = await deepseekService.adjustTemplate(currentTemplate, userRequest);

    return apiSuccess({ template: newTemplate });
  } catch (error) {
    console.error('调整模板失败:', error);
    return apiError('调整模板失败', 500);
  }
}
