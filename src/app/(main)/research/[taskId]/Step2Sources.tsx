'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { Card, CardContent } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { useProgressStore } from '@/store/useProgressStore';
import { getDomain } from '@/lib/utils';
import type { DataSource } from '@/types';

interface Step2Props {
  taskId: string;
  onNext: () => void;
  onBack: () => void;
}

export default function Step2Sources({ taskId, onNext, onBack }: Step2Props) {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [message, setMessage] = useState('');
  const { show, update, addDetail, hide } = useProgressStore();

  const selectedCount = sources.filter((s) => s.selected).length;

  useEffect(() => {
    loadSources();
  }, [taskId]);

  const loadSources = async () => {
    try {
      const data = await api.getSources(taskId);
      setSources(data);
    } catch (err) {
      console.error('加载信息源失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    setMessage('');
    show('正在发现信息源...', '信息源发现');

    try {
      addDetail('正在从内置信息源中筛选...');
      update(20);

      addDetail('正在通过搜索引擎发现...');
      update(50);

      addDetail('正在获取AI推荐...');
      update(80);

      const result = await api.discoverSources(taskId);
      setSources(result.sources);
      setMessage(`发现了 ${result.discovered} 个新信息源，共 ${result.total} 个`);
      update(100, '发现完成');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setMessage(error.response?.data?.message || '发现失败');
    } finally {
      setDiscovering(false);
      setTimeout(hide, 1500);
    }
  };

  const handleOptimize = async () => {
    if (!userInput.trim()) return;

    setOptimizing(true);
    setMessage('');
    show('正在优化信息源...', '信息源优化');

    try {
      const result = await api.optimizeSources(taskId, userInput);
      setSources(result.sources);
      setMessage(result.message);
      setUserInput('');
      update(100, '优化完成');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setMessage(error.response?.data?.message || '优化失败');
    } finally {
      setOptimizing(false);
      setTimeout(hide, 1500);
    }
  };

  const toggleSource = async (id: string, selected: boolean) => {
    try {
      const updated = await api.batchSelectSources(taskId, [id], selected);
      setSources(updated);
    } catch (err) {
      console.error('更新失败:', err);
    }
  };

  const selectAll = async (selected: boolean) => {
    try {
      const ids = sources.map((s) => s.id);
      const updated = await api.batchSelectSources(taskId, ids, selected);
      setSources(updated);
    } catch (err) {
      console.error('更新失败:', err);
    }
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
          <p className="font-medium mb-1">第二步：确认信息源</p>
          <p className="text-blue-300/80">
            系统会通过多种方式为您发现相关信息源。您可以与AI交互优化信息源列表，然后勾选要采集的信息源。
          </p>
        </div>
      </div>

      {/* 操作区域 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Button onClick={handleDiscover} loading={discovering} disabled={optimizing}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          发现信息源
        </Button>

        <div className="flex-1 flex gap-2">
          <Input
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="告诉AI如何优化信息源，例如：添加更多科技媒体"
            className="flex-1"
            disabled={optimizing}
          />
          <Button
            variant="secondary"
            onClick={handleOptimize}
            loading={optimizing}
            disabled={!userInput.trim() || discovering}
          >
            优化
          </Button>
        </div>
      </div>

      {/* 消息提示 */}
      {message && (
        <div className="p-3 bg-slate-800 rounded-lg text-sm text-slate-300">{message}</div>
      )}

      {/* 信息源列表 */}
      {sources.length > 0 ? (
        <div className="space-y-4">
          {/* 全选操作 */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">
              已选择 {selectedCount}/{sources.length} 个信息源
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

          {/* 列表 */}
          <div className="grid gap-3">
            {sources.map((source) => (
              <Card key={source.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={source.selected}
                    onChange={(checked) => toggleSource(source.id, checked)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-100 break-words">{source.name}</span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          source.origin === 'builtin'
                            ? 'bg-green-600/20 text-green-400'
                            : source.origin === 'deepseek'
                              ? 'bg-purple-600/20 text-purple-400'
                              : 'bg-slate-600/50 text-slate-400'
                        }`}
                      >
                        {source.origin === 'builtin' ? '内置' : source.origin === 'deepseek' ? 'AI推荐' : '搜索'}
                      </span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-slate-600/50 text-slate-400">
                        {source.type}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400 break-all">{getDomain(source.url)}</p>
                    {source.description && (
                      <p className="mt-1 text-sm text-slate-500 line-clamp-2">{source.description}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-400 mb-4">还没有发现信息源</p>
          <Button onClick={handleDiscover} loading={discovering}>
            开始发现
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
          下一步：采集信息
          <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
