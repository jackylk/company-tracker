'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { api } from '@/lib/api';
import type { TaskWithCounts } from '@/types';

interface Step1Props {
  task: TaskWithCounts;
  onUpdate: (updates: Partial<TaskWithCounts>) => void;
  onNext: () => void;
}

// 判断是否是草稿任务
const isDraftTask = (task: TaskWithCounts) => {
  return task.companyName === '新建调研' && task.focusPoints === '待填写';
};

export default function Step1Company({ task, onUpdate, onNext }: Step1Props) {
  const isDraft = isDraftTask(task);
  const [companyName, setCompanyName] = useState(isDraft ? '' : task.companyName);
  const [focusPoints, setFocusPoints] = useState(isDraft ? '' : task.focusPoints);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');

    if (!companyName.trim()) {
      setError('请输入公司名称');
      return false;
    }

    setSaving(true);
    try {
      // 如果没有输入关注点，使用默认值
      const finalFocusPoints = focusPoints.trim() || '全面关注';
      const updated = await api.updateTask(task.id, { companyName, focusPoints: finalFocusPoints });
      onUpdate(updated);
      return true;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || '保存失败，请重试');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    setError('');

    // 验证输入
    if (!companyName.trim()) {
      setError('请输入公司名称');
      return;
    }

    // 如果没有输入关注点，使用默认值
    const finalFocusPoints = focusPoints.trim() || '全面关注';

    // 先更新本地状态
    onUpdate({ companyName, focusPoints: finalFocusPoints });

    // 立即跳转到下一步
    onNext();

    // 后台异步保存数据（如果有变化）
    if (isDraft || companyName !== task.companyName || finalFocusPoints !== task.focusPoints) {
      try {
        await api.updateTask(task.id, { companyName, focusPoints: finalFocusPoints });
      } catch (err) {
        console.error('保存失败:', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* 提示信息 */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-sm text-blue-200">
          <p className="font-medium mb-1">第一步：确认调研对象</p>
          <p className="text-blue-300/80">
            请输入您要调研的公司名称和关注点。这些信息将用于搜索和筛选相关的信息源。
          </p>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* 表单 */}
      <div className="space-y-5">
        <Input
          label="公司名称"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="例如：字节跳动、阿里巴巴、Databricks"
          disabled={saving}
        />

        <Textarea
          label="关注点（可选）"
          value={focusPoints}
          onChange={(e) => setFocusPoints(e.target.value)}
          placeholder="您想了解这个公司的哪些方面？留空则关注所有方面。例如：AI战略布局、海外市场拓展、最新产品动态"
          rows={4}
          disabled={saving}
        />
      </div>

      {/* 操作按钮 */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-slate-700">
        {!isDraft && (
          <Button variant="secondary" onClick={handleSave} loading={saving} className="w-full sm:w-auto">
            保存修改
          </Button>
        )}
        <Button onClick={handleNext} className="w-full sm:w-auto">
          下一步：发现信息源
          <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
