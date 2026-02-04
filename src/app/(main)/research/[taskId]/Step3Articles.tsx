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

export default function Step3Articles({ taskId, task, onNext, onBack }: Step3Props) {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [collectingArticles, setCollectingArticles] = useState<CollectingArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentStage, setCurrentStage] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // 进入第三步时，先检查是否已有文章
    checkExistingArticles();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [taskId]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 检查是否已有文章，如果没有则自动采集
  const checkExistingArticles = async () => {
    try {
      const result: PaginatedResponse<Article> = await api.getArticles(taskId, { pageSize: 100 });
      if (result.data.length > 0) {
        setArticles(result.data);
        setLoading(false);
      } else {
        setLoading(false);
        await handleCollect();
      }
    } catch (err) {
      console.error('检查文章失败:', err);
      setLoading(false);
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

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/tasks/${taskId}/articles/collect-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error('请求失败');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('无响应数据');

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

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
                setCollectingArticles((prev) => [...prev, data.article]);
                break;
              case 'complete':
                setArticles(data.articles);
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
      // 重新加载文章确保数据同步
      const result: PaginatedResponse<Article> = await api.getArticles(taskId, { pageSize: 100 });
      setArticles(result.data);
    }
  };

  const handlePause = () => {
    abortControllerRef.current?.abort();
  };

  const viewArticle = (articleId: string) => {
    router.push(`/research/${taskId}/article/${articleId}`);
  };

  // 正在采集时显示实时进度和表格
  if (collecting || paused) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-200">
            <p className="font-medium mb-1">第三步：采集文章</p>
            <p className="text-blue-300/80">
              {paused
                ? '采集已暂停。如果文章数量足够，可以直接进入下一步生成报告。'
                : '系统正在从选定的信息源采集文章。'}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-300">{paused ? '已暂停' : currentStage || '准备中...'}</span>
            <span className="text-slate-400">{progress}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${paused ? 'bg-yellow-500' : 'bg-blue-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {paused && articles.length > 0 && (
          <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 text-sm text-yellow-200">
              <p className="font-medium">采集已暂停</p>
              <p className="text-yellow-300/80">已采集 {articles.length} 篇文章。可以直接进入下一步生成报告。</p>
            </div>
          </div>
        )}

        {(collectingArticles.length > 0 || (paused && articles.length > 0)) && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-300">
              {paused ? `已采集 ${articles.length} 篇文章` : `已采集 ${collectingArticles.length} 篇文章`}
            </h3>
            <div className="border border-slate-700 rounded-lg overflow-hidden">
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
                    {paused
                      ? articles.slice(0, 20).map((article) => (
                          <tr key={article.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-4 py-3">
                              <span className="text-slate-200 line-clamp-1">{article.title}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                              {article.publishDate ? formatDate(article.publishDate) : '-'}
                            </td>
                            <td className="px-4 py-3 text-slate-400 truncate max-w-[128px]" title={getDomain(article.url)}>
                              {getDomain(article.url)}
                            </td>
                          </tr>
                        ))
                      : collectingArticles.slice(-20).map((article, index) => (
                          <tr key={index} className="hover:bg-slate-800/30 transition-colors animate-fadeIn">
                            <td className="px-4 py-3">
                              <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-slate-200 hover:text-blue-400 line-clamp-1">
                                {article.title}
                              </a>
                            </td>
                            <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                              {article.publishDate ? formatDate(article.publishDate) : '-'}
                            </td>
                            <td className="px-4 py-3 text-slate-400 truncate max-w-[128px]" title={article.sourceName}>
                              {article.sourceName}
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
              <div className="sm:hidden divide-y divide-slate-700/50">
                {paused
                  ? articles.slice(0, 20).map((article) => (
                      <div key={article.id} className="p-4">
                        <span className="text-sm font-medium text-slate-200 block mb-2">{article.title}</span>
                        <div className="text-xs text-slate-400 space-y-1">
                          <div>来源: {getDomain(article.url)}</div>
                          <div>日期: {article.publishDate ? formatDate(article.publishDate) : '-'}</div>
                        </div>
                      </div>
                    ))
                  : collectingArticles.slice(-20).map((article, index) => (
                      <div key={index} className="p-4 animate-fadeIn">
                        <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-200 block mb-2">
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
                  显示 {paused ? '前' : '最新'} 20 条，共 {paused ? articles.length : collectingArticles.length} 条
                </div>
              )}
            </div>
          </div>
        )}

        {!paused && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-400">采集日志</h3>
            <div className="h-40 overflow-y-auto bg-slate-900 rounded-lg p-3 text-xs font-mono text-slate-400 space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="break-words">{log}</div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                暂停采集
              </Button>
            ) : paused ? (
              <>
                <Button variant="outline" onClick={handleCollect}>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  继续采集
                </Button>
                <Button onClick={onNext} disabled={articles.length === 0}>
                  下一步：生成报告 ({articles.length} 篇)
                  <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-sm text-blue-200">
          <p className="font-medium mb-1">第三步：文章采集完成</p>
          <p className="text-blue-300/80">
            {articles.length > 0
              ? `系统已采集到 ${articles.length} 篇文章。点击下一步，AI 将根据这些文章为您生成调研报告。`
              : '未能采集到文章，请返回上一步检查信息源设置。'}
          </p>
        </div>
      </div>

      {articles.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-slate-100">{articles.length}</div>
            <div className="text-sm text-slate-400">已采集文章</div>
          </div>
        </div>
      )}

      {articles.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-300">文章列表</h3>
            <Button variant="outline" size="sm" onClick={handleCollect}>
              重新采集
            </Button>
          </div>

          <div className="border border-slate-700 rounded-lg overflow-hidden">
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
                  {articles.map((article) => (
                    <tr
                      key={article.id}
                      className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => viewArticle(article.id)}
                    >
                      <td className="px-4 py-3">
                        <span className="text-slate-200 hover:text-blue-400 line-clamp-1">{article.title}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {article.publishDate ? formatDate(article.publishDate) : '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 truncate max-w-[128px]" title={getDomain(article.url)}>
                        {getDomain(article.url)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden divide-y divide-slate-700/50">
              {articles.map((article) => (
                <div key={article.id} className="p-4" onClick={() => viewArticle(article.id)}>
                  <span className="text-sm font-medium text-slate-200 block mb-2">{article.title}</span>
                  <div className="text-xs text-slate-400 space-y-1">
                    <div>来源: {getDomain(article.url)}</div>
                    <div>日期: {article.publishDate ? formatDate(article.publishDate) : '-'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-400 mb-4">未能采集到文章，请返回上一步检查信息源设置</p>
          <Button onClick={handleCollect}>重新采集</Button>
        </div>
      )}

      <div className="flex justify-between gap-3 pt-4 border-t border-slate-700">
        <Button variant="secondary" onClick={onBack}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          上一步
        </Button>
        <Button onClick={onNext} disabled={articles.length === 0}>
          下一步：生成报告 ({articles.length} 篇)
          <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
