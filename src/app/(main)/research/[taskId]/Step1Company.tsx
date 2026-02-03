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

export default function Step1Company({ task, onUpdate, onNext }: Step1Props) {
  const [companyName, setCompanyName] = useState(task.companyName);
  const [focusPoints, setFocusPoints] = useState(task.focusPoints);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.updateTask(task.id, { companyName, focusPoints });
      onUpdate(updated);
    } catch (err) {
      console.error('保存失败:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (companyName !== task.companyName || focusPoints !== task.focusPoints) {
      await handleSave();
    }
    onNext();
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
            请确认或修改您要调研的公司名称和关注点。这些信息将用于搜索和筛选相关的信息源。
          </p>
        </div>
      </div>

      {/* 表单 */}
      <div className="space-y-5">
        <Input
          label="公司名称"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="例如：字节跳动、阿里巴巴"
        />

        <Textarea
          label="关注点"
          value={focusPoints}
          onChange={(e) => setFocusPoints(e.target.value)}
          placeholder="您想了解这个公司的哪些方面？例如：AI战略布局、海外市场拓展、最新产品动态"
          rows={4}
        />
      </div>

      {/* 操作按钮 */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
        <Button variant="secondary" onClick={handleSave} loading={saving}>
          保存修改
        </Button>
        <Button onClick={handleNext}>
          下一步：发现信息源
          <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
