'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import type { TaskWithCounts, Report } from '@/types';

interface Step4Props {
  taskId: string;
  task: TaskWithCounts;
  onBack: () => void;
  onReportGenerated?: () => void;
}

export default function Step4Report({ taskId, task, onBack, onReportGenerated }: Step4Props) {
  const router = useRouter();
  const [template, setTemplate] = useState('');
  const [adjustRequest, setAdjustRequest] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  const [showTemplate, setShowTemplate] = useState(true);
  const [streamContent, setStreamContent] = useState('');
  const [currentStage, setCurrentStage] = useState('');
  const [articleInfo, setArticleInfo] = useState<{ count: number; dateRange: string } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);

  useEffect(() => {
    loadData();
  }, [taskId]);

  // 自动滚动到内容底部（仅当用户没有手动滚动时，且只在容器内滚动）
  useEffect(() => {
    if (generating && !userScrolledRef.current && contentContainerRef.current) {
      // 只在容器内部滚动到底部，不影响页面滚动
      contentContainerRef.current.scrollTop = contentContainerRef.current.scrollHeight;
    }
  }, [streamContent, generating]);

  // 监听滚动事件，检测用户是否手动滚动
  const handleScroll = () => {
    if (!contentContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = contentContainerRef.current;
    // 如果用户滚动离开底部超过 50px，标记为手动滚动
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    userScrolledRef.current = !isAtBottom;
  };

  const loadData = async (useAI = false) => {
    try {
      const [templateData, reportsData] = await Promise.all([
        api.getReportTemplate(taskId, useAI),
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
      setGeneratingTemplate(false);
    }
  };

  // AI智能生成模板
  const handleGenerateAITemplate = async () => {
    setGeneratingTemplate(true);
    try {
      const templateData = await api.getReportTemplate(taskId, true);
      setTemplate(templateData.template);
    } catch (err) {
      console.error('AI生成模板失败:', err);
    } finally {
      setGeneratingTemplate(false);
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
    setStreamContent('');
    setLogs([]);
    setCurrentStage('');
    setArticleInfo(null);
    userScrolledRef.current = false; // 重置滚动状态

    try {
      const response = await fetch(`/api/tasks/${taskId}/reports/generate-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ template }),
      });

      if (!response.ok) {
        throw new Error('请求失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无响应数据');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.startsWith('data: '));

        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6));
            const { type, data } = json;

            switch (type) {
              case 'stage':
                setCurrentStage(data.message);
                // 保存文章信息
                if (data.articleCount !== undefined) {
                  setArticleInfo({
                    count: data.articleCount,
                    dateRange: data.dateRange || '日期未知',
                  });
                }
                break;
              case 'log':
                setLogs((prev) => [...prev, data.message]);
                break;
              case 'token':
                setStreamContent((prev) => prev + data.token);
                break;
              case 'complete':
                setReports((prev) => [data.report, ...prev]);
                setShowTemplate(false);
                setLogs((prev) => [...prev, data.message]);
                // 通知父组件报告已生成
                onReportGenerated?.();
                break;
              case 'error':
                setLogs((prev) => [...prev, `错误: ${data.message}`]);
                break;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      setLogs((prev) => [...prev, `生成失败: ${error.message}`]);
    } finally {
      setGenerating(false);
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
        <svg
          className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="text-sm text-blue-200">
          <p className="font-medium mb-1">第四步：生成调研报告</p>
          <p className="text-blue-300/80">
            您可以查看和修改报告模板，或者告诉AI您想要的报告章节。确认后点击生成报告。
          </p>
        </div>
      </div>

      {/* 生成中状态 */}
      {generating && (
        <div className="space-y-4">
          {/* 进度提示 */}
          <div className="flex items-start gap-3 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />
            <div className="text-sm text-purple-200">
              <p className="font-medium">{currentStage || '正在生成报告...'}</p>
              {articleInfo && (
                <div className="mt-1 text-purple-300/80 space-y-0.5">
                  <p>正在基于 <span className="text-purple-200 font-medium">{articleInfo.count}</span> 篇相关文章生成报告</p>
                  <p>文章发布日期范围：<span className="text-purple-200">{articleInfo.dateRange}</span></p>
                </div>
              )}
            </div>
          </div>

          {/* 实时输出内容 */}
          {streamContent && (
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700 flex items-center justify-between">
                <span className="text-sm text-slate-400">报告内容（实时生成中...）</span>
                <span className="text-xs text-slate-500">可滚动查看</span>
              </div>
              <div
                ref={contentContainerRef}
                onScroll={handleScroll}
                className="p-4 max-h-96 overflow-y-auto bg-slate-900/50"
              >
                <div className="markdown-content text-sm">
                  <ReactMarkdown>{streamContent}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* 日志 */}
          {logs.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-400">生成日志</h3>
              <div className="h-24 overflow-y-auto bg-slate-900 rounded-lg p-3 text-xs font-mono text-slate-400 space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="break-words">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 非生成状态 */}
      {!generating && (
        <>
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
              {/* AI生成模板提示 */}
              {generatingTemplate && (
                <div className="flex items-center gap-3 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  <div className="text-sm text-purple-200">
                    <p className="font-medium">正在根据「{task.companyName}」和「{task.focusPoints}」智能生成报告模板...</p>
                    <p className="text-purple-300/70 text-xs mt-1">AI正在分析公司特点和关注点，生成定制化模板</p>
                  </div>
                </div>
              )}

              {/* AI生成按钮 */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={handleGenerateAITemplate}
                  loading={generatingTemplate}
                  disabled={generatingTemplate}
                  className="w-full sm:w-auto"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI智能生成模板
                </Button>
                <span className="text-xs text-slate-500 self-center">
                  根据公司名和关注点定制专属模板
                </span>
              </div>

              <Textarea
                label="报告模板"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={12}
                className="font-mono text-sm"
                disabled={generatingTemplate}
              />

              {/* AI调整 */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={adjustRequest}
                  onChange={(e) => setAdjustRequest(e.target.value)}
                  placeholder="告诉AI如何调整模板"
                  className="flex-1"
                />
                <Button
                  variant="secondary"
                  onClick={handleAdjustTemplate}
                  loading={adjusting}
                  disabled={!adjustRequest.trim()}
                  className="whitespace-nowrap w-full sm:w-auto"
                >
                  调整模板
                </Button>
              </div>

              {/* 生成按钮 */}
              <div className="pt-4">
                <Button
                  onClick={handleGenerate}
                  loading={generating}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
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
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => viewReport(report.id)}
                      >
                        查看
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(report.id)}
                      >
                        下载
                      </Button>
                    </div>
                  </div>

                  {/* 预览 */}
                  <div className="mt-4 p-4 bg-slate-800/50 rounded-lg max-h-40 overflow-hidden relative">
                    <div className="markdown-content text-sm">
                      <ReactMarkdown>
                        {report.content.substring(0, 500) + '...'}
                      </ReactMarkdown>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-800/90 to-transparent" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* 操作按钮 */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-4 border-t border-slate-700">
        <Button variant="secondary" onClick={onBack} disabled={generating} className="w-full sm:w-auto">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          上一步
        </Button>
        <Button variant="secondary" onClick={() => router.push('/tasks')} disabled={generating} className="w-full sm:w-auto">
          返回任务列表
        </Button>
      </div>
    </div>
  );
}
