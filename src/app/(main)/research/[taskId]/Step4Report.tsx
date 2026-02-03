'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';
import { Card, CardContent } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { useProgressStore } from '@/store/useProgressStore';
import type { TaskWithCounts, Report } from '@/types';

interface Step4Props {
  taskId: string;
  task: TaskWithCounts;
  onBack: () => void;
}

export default function Step4Report({ taskId, task, onBack }: Step4Props) {
  const router = useRouter();
  const [template, setTemplate] = useState('');
  const [adjustRequest, setAdjustRequest] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [showTemplate, setShowTemplate] = useState(true);
  const { show, update, hide } = useProgressStore();

  useEffect(() => {
    loadData();
  }, [taskId]);

  const loadData = async () => {
    try {
      const [templateData, reportsData] = await Promise.all([
        api.getReportTemplate(taskId),
        api.getReports(taskId),
      ]);
      setTemplate(templateData.template);
      setReports(reportsData);
      if (reportsData.length > 0) {
        setShowTemplate(false);
      }
    } catch (err) {
      console.error('加载失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustTemplate = async () => {
    if (!adjustRequest.trim()) return;

    setAdjusting(true);
    try {
      const result = await api.adjustTemplate(taskId, template, adjustRequest);
      setTemplate(result.template);
      setAdjustRequest('');
    } catch (err) {
      console.error('调整失败:', err);
    } finally {
      setAdjusting(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    show('正在生成报告...', '报告生成');

    try {
      update(30, '正在分析文章内容...');
      await new Promise((r) => setTimeout(r, 1000));

      update(60, '正在生成报告...');
      const report = await api.generateReport(taskId, template);

      update(100, '报告生成完成');
      setReports([report, ...reports]);
      setShowTemplate(false);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      update(0, error.response?.data?.message || '生成失败');
    } finally {
      setGenerating(false);
      setTimeout(hide, 2000);
    }
  };

  const handleDownload = (reportId: string) => {
    window.open(api.getReportDownloadUrl(taskId, reportId), '_blank');
  };

  const viewReport = (reportId: string) => {
    router.push(`/research/${taskId}/report/${reportId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 提示信息 */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-sm text-blue-200">
          <p className="font-medium mb-1">第四步：生成调研报告</p>
          <p className="text-blue-300/80">
            您可以查看和修改报告模板，或者告诉AI您想要的报告章节。确认后点击生成报告。
          </p>
        </div>
      </div>

      {/* 切换按钮 */}
      <div className="flex gap-2">
        <Button
          variant={showTemplate ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setShowTemplate(true)}
        >
          编辑模板
        </Button>
        <Button
          variant={!showTemplate ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setShowTemplate(false)}
          disabled={reports.length === 0}
        >
          查看报告 ({reports.length})
        </Button>
      </div>

      {showTemplate ? (
        /* 模板编辑区域 */
        <div className="space-y-4">
          <Textarea
            label="报告模板"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={12}
            className="font-mono text-sm"
          />

          {/* AI调整 */}
          <div className="flex gap-2">
            <Input
              value={adjustRequest}
              onChange={(e) => setAdjustRequest(e.target.value)}
              placeholder="告诉AI如何调整模板，例如：增加竞品分析章节"
              className="flex-1"
            />
            <Button
              variant="secondary"
              onClick={handleAdjustTemplate}
              loading={adjusting}
              disabled={!adjustRequest.trim()}
            >
              调整模板
            </Button>
          </div>

          {/* 生成按钮 */}
          <div className="pt-4">
            <Button onClick={handleGenerate} loading={generating} size="lg" className="w-full sm:w-auto">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              生成调研报告
            </Button>
          </div>
        </div>
      ) : (
        /* 报告列表 */
        <div className="space-y-4">
          {reports.map((report) => (
            <Card key={report.id} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h4 className="font-medium text-slate-100">
                    {task.companyName} 调研报告
                  </h4>
                  <p className="text-sm text-slate-400">
                    生成于 {new Date(report.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => viewReport(report.id)}>
                    查看
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDownload(report.id)}>
                    下载
                  </Button>
                </div>
              </div>

              {/* 预览 */}
              <div className="mt-4 p-4 bg-slate-800/50 rounded-lg max-h-40 overflow-hidden relative">
                <div className="markdown-content text-sm">
                  <ReactMarkdown>{report.content.substring(0, 500) + '...'}</ReactMarkdown>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-800/90 to-transparent" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex justify-between gap-3 pt-4 border-t border-slate-700">
        <Button variant="secondary" onClick={onBack}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          上一步
        </Button>
        <Button variant="secondary" onClick={() => router.push('/tasks')}>
          返回任务列表
        </Button>
      </div>
    </div>
  );
}
