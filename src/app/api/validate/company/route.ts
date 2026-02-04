import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/utils';
import { companyValidationService } from '@/services/validation/CompanyValidationService';

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) {
      return apiError('未登录', 401);
    }

    const body = await request.json();
    const { companyName } = body;

    if (!companyName || typeof companyName !== 'string') {
      return apiError('请输入公司名称', 400);
    }

    const result = await companyValidationService.validateCompany(companyName);

    if (!result.isValid) {
      return apiError(result.message, 400);
    }

    return apiSuccess({
      valid: result.isValid,
      confidence: result.confidence,
      message: result.message,
      details: result.details,
    });
  } catch (error) {
    console.error('公司验证失败:', error);
    return apiError('公司验证失败，请稍后重试', 500);
  }
}
