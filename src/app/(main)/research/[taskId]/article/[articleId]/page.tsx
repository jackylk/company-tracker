'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { api } from '@/lib/api';
import { formatDate, getDomain } from '@/lib/utils';
import type { Article } from '@/types';

interface ArticleWithSource extends Article {
  dataSource?: { name: string; url: string } | null;
}

export default function ArticlePage({
  params,
}: {
  params: Promise<{ taskId: string; articleId: string }>;
}) {
  const { taskId, articleId } = use(params);
  const router = useRouter();
  const [article, setArticle] = useState<ArticleWithSource | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArticle();
  }, [taskId, articleId]);

  const loadArticle = async () => {
    try {
      const data = await api.getArticle(taskId, articleId);
      setArticle(data);
    } catch (err) {
      console.error('加载文章失败:', err);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = async () => {
    if (!article) return;
    try {
      const updated = await api.updateArticle(taskId, articleId, !article.selected);
      setArticle({ ...article, selected: updated.selected });
    } catch (err) {
      console.error('更新失败:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-slate-400">文章不存在</p>
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

        <Checkbox
          checked={article.selected}
          onChange={toggleSelect}
          label={article.selected ? '已选中' : '选中用于报告'}
        />
      </div>

      {/* 文章内容 */}
      <article className="bg-slate-800/30 rounded-xl p-6 sm:p-8">
        {/* 标题 */}
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 break-words">
          {article.title}
        </h1>

        {/* 元信息 */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-400">
          <span className="px-2 py-1 rounded-full bg-slate-700">
            {article.sourceType === 'datasource' ? '信息源' : '搜索引擎'}
          </span>
          {article.dataSource && (
            <span>{article.dataSource.name}</span>
          )}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            {getDomain(article.url)}
          </a>
          {article.publishDate && (
            <span>{formatDate(article.publishDate)}</span>
          )}
        </div>

        {/* 封面图 */}
        {article.imageUrl && (
          <div className="mt-6">
            <img
              src={article.imageUrl}
              alt={article.title}
              className="w-full max-h-96 object-cover rounded-lg"
            />
          </div>
        )}

        {/* 正文 */}
        <div
          className="mt-6 prose prose-invert max-w-none break-words"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        {/* 底部操作 */}
        <div className="mt-8 pt-6 border-t border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
          >
            查看原文
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>

          <Button onClick={toggleSelect} variant={article.selected ? 'secondary' : 'primary'}>
            {article.selected ? '取消选中' : '选中用于报告'}
          </Button>
        </div>
      </article>
    </div>
  );
}
