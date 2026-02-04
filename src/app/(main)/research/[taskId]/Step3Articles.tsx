'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { formatDate, getDomain } from '@/lib/utils';
import type { TaskWithCounts, Article, PaginatedResponse } from '@/types';

interface Step3Props {
  taskId: string;
  task: TaskWithCounts;
  onNext: () => void;
  onBack: () => void;
}

// 采集中的文章（还没有ID）
interface CollectingArticle {
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  publishDate: string | null;
}

// 过滤状态
interface FilterStatus {
  isFiltering: boolean;
  totalCount: number;
  relevantCount: number;
  filteredCount: number;
}

export default function Step3Articles({ taskId, task, onNext, onBack }: Step3Props) {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [collectingArticles, setCollectingArticles] = useState<CollectingArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [syncing, setSyncing] = useState(false); // 正在同步数据状态
  const [paused, setPaused] = useState(false);
  const [currentStage, setCurrentStage] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>({
    isFiltering: false,
    totalCount: 0,
    relevantCount: 0,
    filteredCount: 0,
  });
  const [stats, setStats] = useState<{
    total: number;
    relevant: number;
    filtered: number;
    fromSources: number;
  } | null>(null);
  const hasAutoCollected = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // 每次进入第三步都自动开始采集
    startAutoCollect();
    return () => {
      // 组件卸载时取消请求
      abortControllerRef.current?.abort();
    };
  }, [taskId]);

  // 自动滚动到日志底部
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const startAutoCollect = async () => {
    setLoading(false);
    // 每次进入都重新采集
    if (!hasAutoCollected.current) {
      hasAutoCollected.current = true;
      await handleCollect();
    }
  };

  const handleCollect = async () => {
    setCollecting(true);
    setPaused(false);
    setCollectingArticles([]);
    setLogs([]);
    setProgress(0);
    setCurrentStage('');
    setStats(null);
    setFilterStatus({
      isFiltering: false,
      totalCount: 0,
      relevantCount: 0,
      filteredCount: 0,
    });

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/tasks/${taskId}/articles/collect-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortControllerRef.current.signal,
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
                break;
              case 'progress':
                setProgress(data.progress);
                break;
              case 'log':
                setLogs((prev) => [...prev, data.message]);
                break;
              case 'article':
                // 流式添加采集到的文章
                setCollectingArticles((prev) => [...prev, data.article]);
                break;
              case 'filter_start':
                setFilterStatus({
                  isFiltering: true,
                  totalCount: data.totalCount,
                  relevantCount: 0,
                  filteredCount: 0,
                });
                break;
              case 'filter_complete':
                setFilterStatus({
                  isFiltering: false,
                  totalCount: data.totalCount,
                  relevantCount: data.relevantCount,
                  filteredCount: data.filteredCount,
                });
                break;
              case 'complete':
                // 最终同步所有文章
                setArticles(data.articles);
                setStats(data.stats);
                setLogs((prev) => [...prev, data.message]);
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
      if (error.name === 'AbortError') {
        setLogs((prev) => [...prev, '采集已暂停']);
        setPaused(true);
      } else {
        setLogs((prev) => [...prev, `采集失败: ${error.message}`]);
      }
    } finally {
      setCollecting(false);
      // 显示同步状态，防止短暂显示"无文章"
      setSyncing(true);
      // 无论成功还是失败，都从数据库重新加载文章
      // 这确保了即使流式传输中 complete 事件丢失，也能正确显示已保存的文章
      await reloadArticles();
      setSyncing(false);
    }
  };

  // 暂停采集
  const handlePause = () => {
    abortControllerRef.current?.abort();
  };

  // 重新加载文章
  const reloadArticles = async () => {
    try {
      const params: { pageSize?: number } = { pageSize: 100 };
      const result: PaginatedResponse<Article> = await api.getArticles(taskId, params);
      setArticles(result.data);
      // 计算统计信息
      const relevant = result.data.filter((a) => a.selected).length;
      const filtered = result.data.filter((a) => !a.selected).length;
      // 始终设置统计信息，即使没有文章
      setStats({
        total: result.data.length,
        relevant,
        filtered,
        fromSources: result.data.length,
      });
    } catch (err) {
      console.error('加载文章失败:', err);
    }
  };

  const viewArticle = (articleId: string) => {
    router.push(`/research/${taskId}/article/${articleId}`);
  };

  // 计算已有的相关文章数
  const relevantCount = articles.filter((a) => a.selected).length;

  // 正在采集时显示实时进度和表格
  if (collecting || paused) {
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
            <p className="font-medium mb-1">第三步：采集文章</p>
            <p className="text-blue-300/80">
              {paused
                ? '采集已暂停。如果文章数量足够，可以直接进入下一步生成报告。'
                : '系统正在从选定的信息源采集文章，并通过搜索引擎补充相关内容。'}
            </p>
          </div>
        </div>

        {/* 进度条 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300">
              {paused ? '已暂停' : currentStage || '准备中...'}
            </span>
            <span className="text-slate-400">{progress}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${paused ? 'bg-yellow-500' : 'bg-blue-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 暂停提示 */}
        {paused && articles.length > 0 && (
          <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <svg
              className="w-5 h-5 text-yellow-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-1 text-sm text-yellow-200">
              <p className="font-medium">采集已暂停</p>
              <p className="text-yellow-300/80">
                已采集 {articles.length} 篇文章，其中 {relevantCount} 篇相关。
                {relevantCount > 0 && '可以直接进入下一步生成报告。'}
              </p>
            </div>
          </div>
        )}

        {/* 过滤状态 */}
        {filterStatus.isFiltering && (
          <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            <div className="text-sm text-yellow-200">
              <p className="font-medium">正在过滤无关文章...</p>
              <p className="text-yellow-300/80">共 {filterStatus.totalCount} 篇文章待过滤</p>
            </div>
          </div>
        )}

        {filterStatus.filteredCount > 0 && !filterStatus.isFiltering && !paused && (
          <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <svg
              className="w-5 h-5 text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div className="text-sm text-green-200">
              <p className="font-medium">过滤完成</p>
              <p className="text-green-300/80">
                保留 {filterStatus.relevantCount} 篇相关文章，过滤了{' '}
                {filterStatus.filteredCount} 篇不相关文章
              </p>
            </div>
          </div>
        )}

        {/* 实时文章表格 */}
        {(collectingArticles.length > 0 || (paused && articles.length > 0)) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-300">
                {paused
                  ? `已采集 ${articles.length} 篇文章`
                  : `已采集 ${collectingArticles.length} 篇文章`}
              </h3>
            </div>
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              {/* 桌面端表格视图 */}
              <div className="hidden sm:block overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-slate-400 font-medium">标题</th>
                      <th className="px-4 py-3 text-left text-slate-400 font-medium w-28">日期</th>
                      <th className="px-4 py-3 text-left text-slate-400 font-medium w-32">来源</th>
                      {paused && (
                        <th className="px-4 py-3 text-left text-slate-400 font-medium w-20">状态</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {paused
                      ? articles.slice(0, 20).map((article) => (
                          <tr
                            key={article.id}
                            className={`hover:bg-slate-800/30 transition-colors ${
                              !article.selected ? 'opacity-50' : ''
                            }`}
                          >
                            <td className="px-4 py-3">
                              <span
                                className={`line-clamp-1 ${
                                  article.selected
                                    ? 'text-slate-200'
                                    : 'text-slate-500 line-through'
                                }`}
                              >
                                {article.title}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                              {article.publishDate ? formatDate(article.publishDate) : '-'}
                            </td>
                            <td
                              className="px-4 py-3 text-slate-400 truncate max-w-[128px]"
                              title={getDomain(article.url)}
                            >
                              {getDomain(article.url)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 text-xs rounded-full ${
                                  article.selected
                                    ? 'bg-green-600/20 text-green-400'
                                    : 'bg-slate-600/20 text-slate-500'
                                }`}
                              >
                                {article.selected ? '相关' : '不相关'}
                              </span>
                            </td>
                          </tr>
                        ))
                      : collectingArticles.slice(-20).map((article, index) => (
                          <tr
                            key={index}
                            className="hover:bg-slate-800/30 transition-colors animate-fadeIn"
                          >
                            <td className="px-4 py-3">
                              <a
                                href={article.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-slate-200 hover:text-blue-400 line-clamp-1"
                                title={article.title}
                              >
                                {article.title}
                              </a>
                            </td>
                            <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                              {article.publishDate ? formatDate(article.publishDate) : '-'}
                            </td>
                            <td
                              className="px-4 py-3 text-slate-400 truncate max-w-[128px]"
                              title={article.sourceName}
                            >
                              {article.sourceName}
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>

              {/* 移动端卡片视图 */}
              <div className="sm:hidden divide-y divide-slate-700/50">
                {paused
                  ? articles.slice(0, 20).map((article) => (
                      <div
                        key={article.id}
                        className={`p-4 ${!article.selected ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span
                            className={`text-sm font-medium flex-1 ${
                              article.selected
                                ? 'text-slate-200'
                                : 'text-slate-500 line-through'
                            }`}
                          >
                            {article.title}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${
                              article.selected
                                ? 'bg-green-600/20 text-green-400'
                                : 'bg-slate-600/20 text-slate-500'
                            }`}
                          >
                            {article.selected ? '相关' : '不相关'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 space-y-1">
                          <div>来源: {getDomain(article.url)}</div>
                          <div>日期: {article.publishDate ? formatDate(article.publishDate) : '-'}</div>
                        </div>
                      </div>
                    ))
                  : collectingArticles.slice(-20).map((article, index) => (
                      <div key={index} className="p-4 animate-fadeIn">
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-slate-200 block mb-2"
                        >
                          {article.title}
                        </a>
                        <div className="text-xs text-slate-400 space-y-1">
                          <div>来源: {article.sourceName}</div>
                          <div>日期: {article.publishDate ? formatDate(article.publishDate) : '-'}</div>
                        </div>
                      </div>
                    ))}
              </div>
              {(paused ? articles.length : collectingArticles.length) > 20 && (
                <div className="px-4 py-2 bg-slate-800/30 text-center text-xs text-slate-500">
                  显示 {paused ? '前' : '最新'} 20 条，共{' '}
                  {paused ? articles.length : collectingArticles.length} 条
                </div>
              )}
            </div>
          </div>
        )}

        {/* 日志 */}
        {!paused && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-400">采集日志</h3>
            <div className="h-40 overflow-y-auto bg-slate-900 rounded-lg p-3 text-xs font-mono text-slate-400 space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="break-words">
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex justify-between gap-3 pt-4 border-t border-slate-700">
          <Button variant="secondary" onClick={onBack} disabled={collecting && !paused}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            上一步
          </Button>
          <div className="flex gap-2">
            {collecting && !paused ? (
              <Button variant="outline" onClick={handlePause}>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                暂停采集
              </Button>
            ) : paused ? (
              <>
                <Button variant="outline" onClick={handleCollect}>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  继续采集
                </Button>
                <Button onClick={onNext} disabled={relevantCount === 0}>
                  下一步：生成报告 ({relevantCount} 篇)
                  <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 同步数据中，显示加载状态并保持文章表格
  if (syncing) {
    return (
      <div className="space-y-6">
        {/* 提示信息 */}
        <div className="flex items-start gap-3 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />
          <div className="text-sm text-purple-200">
            <p className="font-medium mb-1">正在同步数据...</p>
            <p className="text-purple-300/80">
              AI正在分析文章相关性，筛选与「{task.companyName}」和「{task.focusPoints}」相关的内容
            </p>
          </div>
        </div>

        {/* 保持显示已采集的文章 */}
        {collectingArticles.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-300">
              已采集 {collectingArticles.length} 篇文章，正在验证相关性...
            </h3>
            <div className="border border-slate-700 rounded-lg overflow-hidden opacity-70">
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-slate-400 font-medium">标题</th>
                      <th className="px-4 py-3 text-left text-slate-400 font-medium w-28">日期</th>
                      <th className="px-4 py-3 text-left text-slate-400 font-medium w-32">来源</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {collectingArticles.slice(-20).map((article, index) => (
                      <tr key={index} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-slate-200 line-clamp-1">{article.title}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                          {article.publishDate ? formatDate(article.publishDate) : '-'}
                        </td>
                        <td className="px-4 py-3 text-slate-400 truncate max-w-[128px]">
                          {article.sourceName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="sm:hidden divide-y divide-slate-700/50">
                {collectingArticles.slice(-20).map((article, index) => (
                  <div key={index} className="p-4">
                    <span className="text-sm font-medium text-slate-200 block mb-2">{article.title}</span>
                    <div className="text-xs text-slate-400 space-y-1">
                      <div>来源: {article.sourceName}</div>
                      <div>日期: {article.publishDate ? formatDate(article.publishDate) : '-'}</div>
                    </div>
                  </div>
                ))}
              </div>
              {collectingArticles.length > 20 && (
                <div className="px-4 py-2 bg-slate-800/30 text-center text-xs text-slate-500">
                  显示最新 20 条，共 {collectingArticles.length} 条
                </div>
              )}
            </div>
          </div>
        )}
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
          <p className="font-medium mb-1">第三步：文章采集完成</p>
          <p className="text-blue-300/80">
            {articles.length > 0 ? (
              <>
                系统已采集到 {articles.length} 篇文章，其中 {relevantCount} 篇与关注点相关。
                {relevantCount > 0 && '点击下一步，AI 将根据相关文章为您生成调研报告。'}
                {relevantCount === 0 && '未找到相关文章，请检查关注点设置或重新采集。'}
              </>
            ) : stats ? (
              `采集完成，共 ${stats.total} 篇文章，但全部被标记为不相关。`
            ) : (
              '未能采集到文章，请返回上一步检查信息源设置。'
            )}
          </p>
        </div>
      </div>

      {/* 统计信息 */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-slate-100">{stats.total}</div>
            <div className="text-sm text-slate-400">采集文章</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{stats.relevant}</div>
            <div className="text-sm text-slate-400">相关文章</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-slate-500">{stats.filtered}</div>
            <div className="text-sm text-slate-400">不相关</div>
          </div>
        </div>
      )}

      {/* 文章列表 */}
      {articles.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-300">文章列表</h3>
            <Button variant="outline" size="sm" onClick={handleCollect}>
              重新采集
            </Button>
          </div>

          <div className="border border-slate-700 rounded-lg overflow-hidden">
            {/* 桌面端表格视图 */}
            <div className="hidden sm:block overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">标题</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium w-28">日期</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium w-32">来源</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium w-20">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {articles.map((article) => (
                    <tr
                      key={article.id}
                      className={`hover:bg-slate-800/30 transition-colors cursor-pointer ${
                        !article.selected ? 'opacity-50' : ''
                      }`}
                      onClick={() => viewArticle(article.id)}
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`line-clamp-1 ${
                            article.selected
                              ? 'text-slate-200 hover:text-blue-400'
                              : 'text-slate-500 line-through'
                          }`}
                        >
                          {article.title}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {article.publishDate ? formatDate(article.publishDate) : '-'}
                      </td>
                      <td
                        className="px-4 py-3 text-slate-400 truncate max-w-[128px]"
                        title={getDomain(article.url)}
                      >
                        {getDomain(article.url)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            article.selected
                              ? 'bg-green-600/20 text-green-400'
                              : 'bg-slate-600/20 text-slate-500'
                          }`}
                        >
                          {article.selected ? '相关' : '不相关'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 移动端卡片视图 */}
            <div className="sm:hidden divide-y divide-slate-700/50">
              {articles.map((article) => (
                <div
                  key={article.id}
                  className={`p-4 ${!article.selected ? 'opacity-50' : ''}`}
                  onClick={() => viewArticle(article.id)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`text-sm font-medium flex-1 ${
                        article.selected
                          ? 'text-slate-200'
                          : 'text-slate-500 line-through'
                      }`}
                    >
                      {article.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${
                        article.selected
                          ? 'bg-green-600/20 text-green-400'
                          : 'bg-slate-600/20 text-slate-500'
                      }`}
                    >
                      {article.selected ? '相关' : '不相关'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 space-y-1">
                    <div>来源: {getDomain(article.url)}</div>
                    <div>日期: {article.publishDate ? formatDate(article.publishDate) : '-'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : stats ? (
        // 有统计信息但没有文章（可能全部被过滤）
        <div className="text-center py-12">
          <div className="text-slate-400 mb-4">
            <p className="mb-2">采集完成，但没有找到符合关注点的相关文章。</p>
            <p className="text-sm">已采集 {stats.total} 篇文章，全部被标记为不相关。</p>
          </div>
          <Button onClick={handleCollect}>重新采集</Button>
        </div>
      ) : (
        // 没有任何数据
        <div className="text-center py-12">
          <p className="text-slate-400 mb-4">未能采集到文章，请返回上一步检查信息源设置</p>
          <Button onClick={handleCollect}>重新采集</Button>
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
        <Button onClick={onNext} disabled={relevantCount === 0}>
          下一步：生成报告 ({relevantCount} 篇)
          <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
