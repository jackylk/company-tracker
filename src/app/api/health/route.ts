import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL_SET: !!process.env.DATABASE_URL,
      DATABASE_URL_PREFIX: process.env.DATABASE_URL?.substring(0, 30) + '...',
    },
  };

  try {
    // 测试数据库连接
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'connected',
      responseTime: `${Date.now() - startTime}ms`,
    };

    // 检查表是否存在
    try {
      const userCount = await prisma.user.count();
      checks.tables = {
        users: { exists: true, count: userCount },
      };
    } catch (tableError) {
      checks.tables = {
        users: {
          exists: false,
          error: tableError instanceof Error ? tableError.message : String(tableError),
        },
      };
    }
  } catch (error) {
    checks.database = {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.name : 'UnknownError',
    };
  }

  return NextResponse.json(checks);
}
