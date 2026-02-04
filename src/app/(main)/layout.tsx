'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/Button';

export default function MainLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, token, isLoading, setLoading, clearAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLoading(false);
  }, [setLoading]);

  useEffect(() => {
    if (mounted && !isLoading && !token) {
      router.push('/login');
    }
  }, [mounted, isLoading, token, router]);

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) {
    return null;
  }

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/tasks" className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="font-semibold text-slate-100 hidden sm:block">Company Tracker</span>
            </Link>

            {/* 用户菜单 */}
            <div className="flex items-center gap-4">
              {user?.isAdmin && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm">
                    管理后台
                  </Button>
                </Link>
              )}
              <span className="text-sm text-slate-400 hidden sm:block">{user?.username}</span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                退出
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="flex-1 pb-16">{children}</main>
    </div>
  );
}
