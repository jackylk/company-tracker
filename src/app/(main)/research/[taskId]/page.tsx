'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Stepper';
import { api } from '@/lib/api';
import { useProgressStore } from '@/store/useProgressStore';
import type { TaskWithCounts } from '@/types';

// 步骤组件
import Step1Company from './Step1Company';
import Step2Sources from './Step2Sources';
import Step3Articles from './Step3Articles';
import Step4Report from './Step4Report';

const STEPS = ['添加公司', '确认信息源', '采集信息', '生成报告'];
const TOTAL_STEPS = STEPS.length;

export default function ResearchPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = use(params);
  const router = useRouter();
  const [task, setTask] = useState<TaskWithCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasReports, setHasReports] = useState(false);
  const { hide: hideProgress } = useProgressStore();

  useEffect(() => {
    loadTask();
    return () => hideProgress();
  }, [taskId]);

  const loadTask = async () => {
    try {
      const [taskData, reportsData] = await Promise.all([
        api.getTask(taskId),
        api.getReports(taskId),
      ]);
      setTask(taskData);
      setHasReports(reportsData.length > 0);
    } catch (err) {
      console.error('加载任务失败:', err);
      router.push('/tasks');
    } finally {
      setLoading(false);
    }
  };

  const updateTask = (updates: Partial<TaskWithCounts>) => {
    setTask((prev) => (prev ? { ...prev, ...updates } : null));
  };

  // 当报告生成完成时调用
  const onReportGenerated = () => {
    setHasReports(true);
  };

  const goToStep = async (step: number) => {
    if (!task) return;
    // 立即更新本地状态，让界面先切换
    setTask((prev) => (prev ? { ...prev, currentStep: step } : null));
    try {
      // 后台同步到服务器
      await api.updateTask(taskId, { currentStep: step });
    } catch (err) {
      console.error('更新步骤失败:', err);
    }
  };

  // 计算已完成的步骤数
  // 如果有报告，则所有步骤都已完成
  const completedSteps = hasReports ? TOTAL_STEPS : task?.currentStep ? task.currentStep - 1 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-slate-400">任务不存在</p>
        <Button className="mt-4" onClick={() => router.push('/tasks')}>
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* 顶部导航 */}
      <div className="flex items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
        <Link
          href="/tasks"
          className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">返回列表</span>
        </Link>
        <div className="h-4 w-px bg-slate-700 flex-shrink-0" />
        <h1 className="text-base sm:text-lg font-semibold text-slate-100 truncate min-w-0">
          {task.companyName || '新建调研'}
          {task.focusPoints && task.focusPoints !== '待填写' && (
            <span className="hidden sm:inline text-slate-400"> - {task.focusPoints}</span>
          )}
        </h1>
      </div>

      {/* 步骤条 */}
      <div className="bg-slate-800/30 rounded-xl p-3 sm:p-6 mb-4 sm:mb-6">
        <Stepper
          steps={STEPS}
          currentStep={task.currentStep}
          completedSteps={completedSteps}
          onStepClick={goToStep}
        />
      </div>

      {/* 步骤内容 */}
      <div className="bg-slate-800/30 rounded-xl p-3 sm:p-6">
        {task.currentStep === 1 && (
          <Step1Company task={task} onUpdate={updateTask} onNext={() => goToStep(2)} />
        )}
        {task.currentStep === 2 && (
          <Step2Sources taskId={taskId} task={task} onNext={() => goToStep(3)} onBack={() => goToStep(1)} />
        )}
        {task.currentStep === 3 && (
          <Step3Articles taskId={taskId} task={task} onNext={() => goToStep(4)} onBack={() => goToStep(2)} />
        )}
        {task.currentStep === 4 && (
          <Step4Report taskId={taskId} task={task} onBack={() => goToStep(3)} onReportGenerated={onReportGenerated} />
        )}
      </div>
    </div>
  );
}
