'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { api } from '@/lib/api';
import { getDomain } from '@/lib/utils';
import type { DataSource, SourceOrigin, CollectionStatus, TaskWithCounts } from '@/types';

interface Step2Props {
  taskId: string;
  task: TaskWithCounts;
  onNext: () => void;
  onBack: () => void;
}

// 分类配置
const ORIGIN_CONFIG: Record<SourceOrigin, { label: string; color: string; bgColor: string }> = {
  builtin: { label: '内置信息源', color: 'text-green-400', bgColor: 'bg-green-600/20' },
  search: { label: '搜索发现', color: 'text-blue-400', bgColor: 'bg-blue-600/20' },
  deepseek: { label: 'AI推荐', color: 'text-purple-400', bgColor: 'bg-purple-600/20' },
  manual: { label: '手动添加', color: 'text-slate-400', bgColor: 'bg-slate-600/20' },
};

// 采集状态配置
const COLLECTION_STATUS_CONFIG: Record<CollectionStatus, { label: string; color: string; icon: string } | null> = {
  unknown: null,
  success: null,
  failed: { label: '采集失败', color: 'text-red-400', icon: '!' },
  slow: { label: '采集较慢', color: 'text-yellow-400', icon: '⏱' },
};

// 分类排序
const ORIGIN_ORDER: SourceOrigin[] = ['builtin', 'search', 'deepseek', 'manual'];

// 任务项类型
interface TaskItem {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
}

export default function Step2Sources({ taskId, task, onNext, onBack }: Step2Props) {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [aiRecommending, setAiRecommending] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [message, setMessage] = useState('');
  const [validationWarning, setValidationWarning] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<SourceOrigin>>(new Set(ORIGIN_ORDER));
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [hasUsedAI, setHasUsedAI] = useState(false);
  const hasAutoDiscovered = useRef(false);

  const selectedCount = sources.filter((s) => s.selected).length;

  // 按来源分组
  const groupedSources = useMemo(() => {
    const groups: Record<SourceOrigin, DataSource[]> = {
      builtin: [],
      search: [],
      deepseek: [],
      manual: [],
    };

    sources.forEach((source) => {
      const origin = source.origin as SourceOrigin;
      if (groups[origin]) {
        groups[origin].push(source);
      }
    });

    return groups;
  }, [sources]);

  useEffect(() => {
    loadSourcesAndAutoDiscover();
  }, [taskId]);

  const loadSourcesAndAutoDiscover = async () => {
    try {
      const data = await api.getSources(taskId);
      setSources(data);

      // 如果没有信息源，自动发现
      if (data.length === 0 && !hasAutoDiscovered.current) {
        hasAutoDiscovered.current = true;
        setLoading(false);
        await handleDiscover();
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error('加载信息源失败:', err);
      setLoading(false);
    }
  };

  // 更新任务状态
  const updateTask = (id: string, updates: Partial<TaskItem>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  // 从内置源发现（快速，不使用AI）
  const handleDiscover = async (useAI = false) => {
    if (useAI) {
      setAiRecommending(true);
    } else {
      setDiscovering(true);
    }
    setMessage('');
    setValidationWarning('');

    // 初始化任务列表
    const initialTasks: TaskItem[] = useAI
      ? [{ id: 'deepseek', label: '获取 AI 推荐', status: 'running' }]
      : [{ id: 'builtin', label: '从内置信息源库筛选', status: 'running' }];
    setTasks(initialTasks);

    try {
      const response = await fetch(`/api/tasks/${taskId}/sources/discover-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // 传递公司名称和关注点，确保使用最新的值
        body: JSON.stringify({
          companyName: task.companyName,
          focusPoints: task.focusPoints,
          useAI,
        }),
      });

      if (!response.ok) {
        throw new Error('请求失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('无响应数据');
      }

      let builtinCount = 0;
      let aiCount = 0;

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
                // 更新当前任务状态
                if (data.stage === 'builtin') {
                  updateTask('builtin', { status: 'running' });
                } else if (data.stage === 'deepseek') {
                  // 标记内置源任务完成
                  updateTask('builtin', { status: 'completed', result: `找到 ${builtinCount} 个` });
                  // 如果是非AI模式但进入了deepseek阶段，说明内置源为空，自动触发了AI推荐
                  if (!useAI) {
                    // 动态添加AI任务
                    setTasks((prev) => {
                      const hasDeepseek = prev.some((t) => t.id === 'deepseek');
                      if (!hasDeepseek) {
                        return [...prev, { id: 'deepseek', label: '获取 AI 推荐（自动）', status: 'running' }];
                      }
                      return prev.map((t) => (t.id === 'deepseek' ? { ...t, status: 'running' } : t));
                    });
                    setHasUsedAI(true); // 标记已使用AI
                  } else {
                    updateTask('deepseek', { status: 'running' });
                  }
                } else if (data.stage === 'validate') {
                  updateTask('builtin', { status: 'completed', result: `找到 ${builtinCount} 个` });
                  updateTask('deepseek', { status: 'completed', result: `推荐 ${aiCount} 个` });
                  setTasks((prev) => [
                    ...prev,
                    { id: 'validate', label: '验证公司信息', status: 'running' },
                  ]);
                }
                break;
              case 'log':
                // 从日志中提取计数
                const builtinMatch = data.message.match(/从内置库中找到 (\d+)/);
                if (builtinMatch) builtinCount = parseInt(builtinMatch[1]);
                const aiMatch = data.message.match(/AI推荐了 (\d+)/);
                if (aiMatch) aiCount = parseInt(aiMatch[1]);
                break;
              case 'source':
                // 流式添加单个信息源（AI模式下追加，非AI模式下也添加）
                setSources((prev) => {
                  const exists = prev.some(
                    (s) => s.id === data.source.id || s.url === data.source.url
                  );
                  if (exists) return prev;
                  return [...prev, data.source];
                });
                break;
              case 'complete':
                // 最终同步所有信息源
                if (useAI) {
                  // AI模式：追加新信息源到现有列表
                  setSources((prev) => {
                    const existingUrls = new Set(prev.map((s) => s.url));
                    const newSources = data.sources.filter(
                      (s: DataSource) => !existingUrls.has(s.url)
                    );
                    return [...prev, ...newSources];
                  });
                  setHasUsedAI(true);
                } else {
                  // 非AI模式：替换信息源
                  setSources(data.sources);
                }
                setMessage(`发现了 ${data.discovered} 个信息源`);
                // 完成所有任务
                setTasks((prev) =>
                  prev.map((t) => {
                    if (t.status === 'running') {
                      if (t.id === 'builtin') return { ...t, status: 'completed', result: `找到 ${builtinCount} 个` };
                      if (t.id === 'deepseek') return { ...t, status: 'completed', result: `推荐 ${aiCount} 个` };
                    }
                    return t;
                  })
                );
                break;
              case 'validation_failed':
              case 'validation_warning':
                setValidationWarning(data.message);
                updateTask('validate', { status: 'failed', result: '验证失败' });
                break;
              case 'error':
                setMessage(data.message || '发现失败');
                // 标记当前运行中的任务为失败
                setTasks((prev) =>
                  prev.map((t) => (t.status === 'running' ? { ...t, status: 'failed' } : t))
                );
                break;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      setMessage(error.message || '发现失败');
      setTasks((prev) =>
        prev.map((t) => (t.status === 'running' ? { ...t, status: 'failed' } : t))
      );
    } finally {
      setDiscovering(false);
      setAiRecommending(false);
    }
  };

  // AI 推荐更多信息源
  const handleAIRecommend = async () => {
    await handleDiscover(true);
  };

  // 重新发现（如果有用户输入，先用AI优化再发现）
  const handleRediscover = async () => {
    if (userInput.trim()) {
      // 有用户输入，先调用AI优化
      setAiRecommending(true);
      setMessage('');
      setValidationWarning('');

      // 显示优化任务
      setTasks([{ id: 'optimize', label: '根据您的建议优化信息源', status: 'running' }]);

      try {
        const result = await api.optimizeSources(taskId, userInput);
        setSources(result.sources);
        setMessage(result.message);
        setUserInput('');
        setTasks([{ id: 'optimize', label: '根据您的建议优化信息源', status: 'completed', result: '优化完成' }]);
        setHasUsedAI(true);
      } catch (err: unknown) {
        const error = err as { response?: { data?: { message?: string } } };
        setMessage(error.response?.data?.message || '优化失败');
        setTasks([{ id: 'optimize', label: '根据您的建议优化信息源', status: 'failed' }]);
      } finally {
        setAiRecommending(false);
      }
    } else {
      // 没有用户输入，执行普通发现（不使用AI）
      await handleDiscover(false);
    }
  };

  // 只更新本地状态，不替换整个列表
  const toggleSource = async (id: string, selected: boolean) => {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, selected } : s)));

    try {
      await api.batchSelectSources(taskId, [id], selected);
    } catch (err) {
      console.error('更新失败:', err);
      setSources((prev) => prev.map((s) => (s.id === id ? { ...s, selected: !selected } : s)));
    }
  };

  const selectAll = async (selected: boolean) => {
    setSources((prev) => prev.map((s) => ({ ...s, selected })));

    try {
      const ids = sources.map((s) => s.id);
      await api.batchSelectSources(taskId, ids, selected);
    } catch (err) {
      console.error('更新失败:', err);
      setSources((prev) => prev.map((s) => ({ ...s, selected: !selected })));
    }
  };

  // 分组全选/取消
  const selectGroup = async (origin: SourceOrigin, selected: boolean) => {
    const groupIds = groupedSources[origin].map((s) => s.id);
    if (groupIds.length === 0) return;

    setSources((prev) => prev.map((s) => (s.origin === origin ? { ...s, selected } : s)));

    try {
      await api.batchSelectSources(taskId, groupIds, selected);
    } catch (err) {
      console.error('更新失败:', err);
      setSources((prev) => prev.map((s) => (s.origin === origin ? { ...s, selected: !selected } : s)));
    }
  };

  const toggleGroup = (origin: SourceOrigin) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(origin)) {
        next.delete(origin);
      } else {
        next.add(origin);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 渲染任务状态图标
  const renderTaskIcon = (status: TaskItem['status']) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'running':
        return (
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        );
      case 'failed':
        return (
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return (
          <div className="w-5 h-5 border-2 border-slate-600 rounded-full" />
        );
    }
  };

  const renderSourceGroup = (origin: SourceOrigin) => {
    const group = groupedSources[origin];
    if (group.length === 0) return null;

    const config = ORIGIN_CONFIG[origin];
    const isExpanded = expandedGroups.has(origin);
    const selectedInGroup = group.filter((s) => s.selected).length;

    return (
      <div key={origin} className="border border-slate-700 rounded-lg overflow-hidden">
        {/* 分组头部 */}
        <div
          className={`flex items-center justify-between px-4 py-3 ${config.bgColor} cursor-pointer hover:opacity-90 transition-opacity`}
          onClick={() => toggleGroup(origin)}
        >
          <div className="flex items-center gap-3">
            <svg
              className={`w-4 h-4 ${config.color} transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className={`font-medium ${config.color}`}>{config.label}</span>
            <span className="text-sm text-slate-400">
              ({selectedInGroup}/{group.length} 已选)
            </span>
          </div>
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={() => selectGroup(origin, true)} className="text-xs">
              全选
            </Button>
            <Button variant="ghost" size="sm" onClick={() => selectGroup(origin, false)} className="text-xs">
              取消
            </Button>
          </div>
        </div>

        {/* 分组内容 */}
        {isExpanded && (
          <div className="divide-y divide-slate-700/50">
            {group.map((source) => {
              const statusConfig = COLLECTION_STATUS_CONFIG[source.collectionStatus];
              return (
                <div key={source.id} className="p-4 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <Checkbox checked={source.selected} onChange={(checked) => toggleSource(source.id, checked)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-100 break-words">{source.name}</span>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-600/50 text-slate-400">
                          {source.type}
                        </span>
                        {statusConfig && (
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full ${
                              source.collectionStatus === 'failed'
                                ? 'bg-red-600/20 text-red-400'
                                : 'bg-yellow-600/20 text-yellow-400'
                            }`}
                            title={source.lastCollectionError || statusConfig.label}
                          >
                            {statusConfig.icon} {statusConfig.label}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-400 break-all">{getDomain(source.url)}</p>
                      {source.description && (
                        <p className="mt-1 text-sm text-slate-500 line-clamp-2">{source.description}</p>
                      )}
                      {source.lastCollectionError && source.collectionStatus === 'failed' && (
                        <p className="mt-1 text-xs text-red-400/70">上次错误: {source.lastCollectionError}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

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
            系统已自动为您发现相关信息源，按来源分类展示。点击分类标题可展开/折叠，勾选要采集的信息源。
          </p>
        </div>
      </div>

      {/* 任务清单 - 发现过程中显示 */}
      {(discovering || aiRecommending) && tasks.length > 0 && (
        <div className="border border-slate-700 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700">
            <span className="text-sm font-medium text-slate-300">发现进度</span>
          </div>
          <div className="divide-y divide-slate-700/50">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  task.status === 'running' ? 'bg-blue-500/5' : ''
                }`}
              >
                {renderTaskIcon(task.status)}
                <span
                  className={`flex-1 text-sm ${
                    task.status === 'completed'
                      ? 'text-slate-400'
                      : task.status === 'running'
                      ? 'text-slate-200'
                      : task.status === 'failed'
                      ? 'text-red-400'
                      : 'text-slate-500'
                  }`}
                >
                  {task.label}
                </span>
                {task.result && (
                  <span className="text-xs text-slate-500">{task.result}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 消息提示 */}
      {message && !discovering && !aiRecommending && (
        <div className="p-3 bg-slate-800 rounded-lg text-sm text-slate-300">{message}</div>
      )}

      {/* 验证警告 */}
      {validationWarning && !discovering && !aiRecommending && (
        <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-sm text-yellow-200">
            <p className="font-medium mb-1">未找到相关信息源</p>
            <p className="text-yellow-300/80">{validationWarning}</p>
            <p className="text-yellow-300/80 mt-2">建议返回上一步检查公司名称是否正确。</p>
          </div>
        </div>
      )}

      {/* 信息源列表 */}
      {sources.length > 0 ? (
        <div className="space-y-4">
          {/* 全局操作 */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">
              已选择 {selectedCount}/{sources.length} 个信息源
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => selectAll(true)}>
                全部选择
              </Button>
              <Button variant="ghost" size="sm" onClick={() => selectAll(false)}>
                全部取消
              </Button>
            </div>
          </div>

          {/* 分组列表 */}
          <div className="space-y-3">{ORIGIN_ORDER.map((origin) => renderSourceGroup(origin))}</div>

          {/* AI 推荐更多按钮 - 仅在未使用过AI时显示 */}
          {!hasUsedAI && !aiRecommending && (
            <div className="flex items-center gap-3 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <svg className="w-5 h-5 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm text-purple-200">
                  {sources.length > 0 ? '想要更多信息源？' : '内置库中未找到匹配的信息源'}
                </p>
                <p className="text-xs text-purple-300/70 mt-0.5">
                  让 AI 根据公司名称和关注点推荐更多相关信息源
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAIRecommend}
                className="whitespace-nowrap border-purple-500/50 text-purple-300 hover:bg-purple-500/20"
              >
                AI 推荐更多
              </Button>
            </div>
          )}

          {/* 优化输入框 - 已使用AI后显示 */}
          {hasUsedAI && (
            <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-slate-700 sm:items-center">
              <Input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="不满意？告诉AI如何调整，例如：添加更多科技媒体、移除国外源"
                className="flex-1"
                disabled={discovering || aiRecommending}
              />
              <Button
                variant="outline"
                onClick={handleRediscover}
                disabled={discovering || aiRecommending}
                className="whitespace-nowrap py-2.5"
              >
                {userInput.trim() ? 'AI 调整' : '重新发现'}
              </Button>
            </div>
          )}
        </div>
      ) : discovering || aiRecommending ? (
        <div className="py-4 text-center text-slate-400">正在发现信息源...</div>
      ) : (
        <div className="text-center py-12">
          <p className="text-slate-400 mb-4">未能发现信息源，请重试</p>
          <Button onClick={() => handleDiscover(false)} loading={discovering}>
            重新发现
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
