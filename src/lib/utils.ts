import { NextResponse } from 'next/server';
import type { ApiError } from '@/types';

// API成功响应
export function apiSuccess<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status });
}

// API错误响应
export function apiError(message: string, status = 400): NextResponse<ApiError> {
  return NextResponse.json(
    {
      error: getErrorCode(status),
      message,
    },
    { status }
  );
}

// 获取错误代码
function getErrorCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 429:
      return 'TOO_MANY_REQUESTS';
    case 500:
      return 'INTERNAL_ERROR';
    default:
      return 'ERROR';
  }
}

// 日期格式化
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// 相对时间
export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}天前`;
  return formatDate(d);
}

// 截断文本
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// 生成随机ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// 延迟函数
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 清理HTML标签
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

// 提取摘要
export function extractSummary(content: string, maxLength = 200): string {
  const text = stripHtml(content);
  return truncate(text, maxLength);
}

// 验证URL
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// 规范化URL
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.href;
  } catch {
    // 尝试添加协议
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return normalizeUrl('https://' + url);
    }
    return url;
  }
}

// 从URL提取域名
export function getDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return url;
  }
}

// 步骤名称映射
export const STEP_NAMES: Record<number, string> = {
  1: '添加公司',
  2: '确认信息源',
  3: '采集信息',
  4: '生成报告',
};

// 获取步骤名称
export function getStepName(step: number): string {
  return STEP_NAMES[step] || `步骤${step}`;
}
