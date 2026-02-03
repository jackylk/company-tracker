'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Card, CardContent } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { api } from '@/lib/api';
import { useProgressStore } from '@/store/useProgressStore';
import { formatDate, getDomain } from '@/lib/utils';
import type { TaskWithCounts, Article, PaginatedResponse } from '@/types';

interface Step3Props {
  taskId: string;
  task: TaskWithCounts;
  onNext: () => void;
  onBack: () => void;
}

export default function Step3Articles({ taskId, task, onNext, onBack }: Step3Props) {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [sourceType, setSourceType] = useState<'all' | 'datasource' | 'search'>('all');
  const { show, update, addDetail, hide } = useProgressStore();

  const selectedCount = articles.filter((a) => a.selected).length;
  const datasourceCount = articles.filter((a) => a.sourceType === 'datasource').length;
  const searchCount = articles.filter((a) => a.sourceType === 'search').length;

  useEffect(() => {
    loadArticles();
  }, [taskId, sourceType]);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const params: { sourceType?: string; page?: number; pageSize?: number } = { pageSize: 50 };
      if (sourceType !== 'all') {
        params.sourceType = sourceType;
      }
      const result: PaginatedResponse<Article> = await api.getArticles(taskId, params);
      setArticles(result.data);
      setPagination(result.pagination);
    } catch (err) {
      console.error('加载文章失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCollect = async () => {
    setCollecting(true);
    show('正在采集文章...', '文章采集');

    try {
      addDetail('正在从信息源采集文章...');
      update(30);

      addDetail('正在从搜索引擎采集...');
      update(60);

      addDetail('正在过滤相关内容...');
      update(90);

      const result = await api.collectArticles(taskId);
      update(100, result.message);
      await loadArticles();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      update(0, error.response?.data?.message || '采集失败');
    } finally {
      setCollecting(false);
      setTimeout(hide, 2000);
    }
  };

  const toggleArticle = async (id: string, selected: boolean) => {
    try {
      await api.updateArticle(taskId, id, selected);
      setArticles((prev) =>
        prev.map((a) => (a.id === id ? { ...a, selected } : a))
      );
    } catch (err) {
      console.error('更新失败:', err);
    }
  };

  const selectAll = async (selected: boolean) => {
    try {
      await api.selectAllArticles(taskId, selected);
      setArticles((prev) => prev.map((a) => ({ ...a, selected })));
    } catch (err) {
      console.error('更新失败:', err);
    }
  };

  const viewArticle = (articleId: string) => {
    router.push(`/research/${taskId}/article/${articleId}`);
  };

  const tabs = [
    { id: 'all', label: '全部', count: pagination.total },
    { id: 'datasource', label: '信息源', count: datasourceCount },
    { id: 'search', label: '搜索引擎', count: searchCount },
  ];

  return (
    <div className="space-y-6">
      {/* 提示信息 */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-sm text-blue-200">
          <p className="font-medium mb-1">第三步：采集和筛选文章</p>
          <p className="text-blue-300/80">
            系统将从选定的信息源采集最近2个月的文章，并通过搜索引擎补充相关内容。您可以点击文章查看详情，并勾选要用于生成报告的文章。
          </p>
        </div>
      </div>

      {/* 采集按钮 */}
      <div className="flex items-center gap-4">
        <Button onClick={handleCollect} loading={collecting}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          开始采集
        </Button>
        {pagination.total > 0 && (
          <span className="text-sm text-slate-400">
            共采集到 {pagination.total} 篇文章
          </span>
        )}
      </div>

      {/* 文章列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : articles.length > 0 ? (
        <div className="space-y-4">
          {/* 选择操作 */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">
              已选择 {selectedCount}/{articles.length} 篇文章
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => selectAll(true)}>
                全选
              </Button>
              <Button variant="ghost" size="sm" onClick={() => selectAll(false)}>
                全不选
              </Button>
            </div>
          </div>

          {/* 分页签 */}
          <Tabs
            tabs={tabs}
            defaultTab={sourceType}
          >
            {(activeTab) => {
              if (activeTab !== sourceType) {
                setSourceType(activeTab as 'all' | 'datasource' | 'search');
              }
              return (
                <div className="space-y-3">
                  {articles.map((article) => (
                    <Card key={article.id} className="p-4" hover onClick={() => viewArticle(article.id)}>
                      <div className="flex items-start gap-3">
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={article.selected}
                            onChange={(checked) => toggleArticle(article.id, checked)}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-100 line-clamp-2 break-words">
                            {article.title}
                          </h4>
                          <p className="mt-1 text-sm text-slate-400 line-clamp-2 break-words">
                            {article.summary}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="px-2 py-0.5 rounded-full bg-slate-700">
                              {article.sourceType === 'datasource' ? '信息源' : '搜索'}
                            </span>
                            <span>{getDomain(article.url)}</span>
                            {article.publishDate && (
                              <span>{formatDate(article.publishDate)}</span>
                            )}
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Card>
                  ))}
                </div>
              );
            }}
          </Tabs>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-400 mb-4">还没有采集文章</p>
          <Button onClick={handleCollect} loading={collecting}>
            开始采集
          </Button>
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
        <Button onClick={onNext} disabled={selectedCount === 0}>
          下一步：生成报告 ({selectedCount} 篇)
          <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
