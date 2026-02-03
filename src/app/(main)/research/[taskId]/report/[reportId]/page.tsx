'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import type { Report } from '@/types';

export default function ReportPage({
  params,
}: {
  params: Promise<{ taskId: string; reportId: string }>;
}) {
  const { taskId, reportId } = use(params);
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [taskId, reportId]);

  const loadReport = async () => {
    try {
      const data = await api.getReport(taskId, reportId);
      setReport(data);
    } catch (err) {
      console.error('加载报告失败:', err);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    window.open(api.getReportDownloadUrl(taskId, reportId), '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-slate-400">报告不存在</p>
        <Button className="mt-4" onClick={() => router.back()}>
          返回
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          返回
        </button>

        <Button variant="outline" onClick={handleDownload}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          下载报告
        </Button>
      </div>

      {/* 报告内容 */}
      <article className="bg-slate-800/30 rounded-xl p-6 sm:p-8">
        <div className="markdown-content">
          <ReactMarkdown>{report.content}</ReactMarkdown>
        </div>

        {/* 底部信息 */}
        <div className="mt-8 pt-6 border-t border-slate-700 text-sm text-slate-500">
          <p>生成时间：{new Date(report.createdAt).toLocaleString('zh-CN')}</p>
        </div>
      </article>
    </div>
  );
}
