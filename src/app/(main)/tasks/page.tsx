'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { timeAgo, getStepName } from '@/lib/utils';
import type { TaskWithCounts } from '@/types';

const MAX_TASKS = 3;

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const data = await api.getTasks();
      setTasks(data);
    } catch (err) {
      console.error('加载任务失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      // 创建一个空任务，让用户在第一步填写
      const task = await api.createTask('', '');
      router.push(`/research/${task.id}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      alert(error.response?.data?.message || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('确定要删除这个调研任务吗？')) return;

    try {
      await api.deleteTask(taskId);
      setTasks(tasks.filter((t) => t.id !== taskId));
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* 页面标题 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">我的调研</h1>
          <p className="mt-1 text-slate-400">
            管理您的公司调研任务 ({inProgressCount}/{MAX_TASKS} 进行中)
          </p>
        </div>
        <Button
          onClick={handleCreate}
          disabled={inProgressCount >= MAX_TASKS}
          loading={creating}
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建调研
        </Button>
      </div>

      {/* 任务列表 */}
      {tasks.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-slate-300 mb-2">还没有调研任务</h3>
          <p className="text-slate-500 mb-6">点击下方按钮创建您的第一个调研任务</p>
          <Button onClick={handleCreate} loading={creating}>创建调研任务</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <Card
              key={task.id}
              hover
              className="cursor-pointer"
              onClick={() => router.push(`/research/${task.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* 标题行 */}
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                          task.status === 'completed'
                            ? 'bg-green-600/20 text-green-400'
                            : 'bg-blue-600/20 text-blue-400'
                        }`}
                      >
                        {task.status === 'completed' ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-slate-100 truncate">
                          {task.companyName}
                        </h3>
                        <p className="text-sm text-slate-400 truncate">{task.focusPoints}</p>
                      </div>
                    </div>

                    {/* 状态信息 */}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                      <span
                        className={`px-2 py-0.5 rounded-full ${
                          task.status === 'completed'
                            ? 'bg-green-600/20 text-green-400'
                            : 'bg-blue-600/20 text-blue-400'
                        }`}
                      >
                        {task.status === 'completed' ? '已完成' : `步骤 ${task.currentStep}: ${getStepName(task.currentStep)}`}
                      </span>
                      <span className="text-slate-500">
                        {task._count?.articles || 0} 篇文章
                      </span>
                      <span className="text-slate-500">
                        更新于 {timeAgo(task.updatedAt)}
                      </span>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(task.id);
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
