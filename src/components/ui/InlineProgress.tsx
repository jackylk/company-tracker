'use client';

import { useEffect, useRef } from 'react';
import { useProgressStore } from '@/store/useProgressStore';

interface InlineProgressProps {
  className?: string;
  streamContent?: string;
  prompt?: string;
}

export function InlineProgress({ className = '', streamContent, prompt }: InlineProgressProps) {
  const { isVisible, message, progress, details, stage } = useProgressStore();
  const contentRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [streamContent, details]);

  if (!isVisible) return null;

  return (
    <div className={`bg-slate-800/50 border border-slate-700 rounded-lg p-6 ${className}`}>
      {/* 标题 */}
      {stage && (
        <div className="text-sm text-blue-400 font-medium mb-2">{stage}</div>
      )}

      {/* 主消息 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <span className="text-slate-200">{message}</span>
      </div>

      {/* 进度条 */}
      {progress > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-slate-400 mb-1">
            <span>进度</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Prompt 显示 */}
      {prompt && (
        <div className="mb-4 p-3 bg-slate-900/50 rounded border border-slate-600">
          <div className="text-xs text-purple-400 mb-1 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            发送给 Deepseek 的提示词
          </div>
          <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono">{prompt}</pre>
        </div>
      )}

      {/* AI 流式输出 */}
      {streamContent && (
        <div className="mb-4">
          <div className="text-xs text-green-400 mb-1 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Deepseek 输出
          </div>
          <div
            ref={contentRef}
            className="p-3 bg-slate-900/50 rounded border border-slate-600 max-h-48 overflow-y-auto"
          >
            <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">{streamContent}<span className="animate-pulse">▌</span></pre>
          </div>
        </div>
      )}

      {/* 详细信息 */}
      {details.length > 0 && (
        <div className="border-t border-slate-700 pt-4 mt-4">
          <div className="text-xs text-slate-500 mb-2">系统日志</div>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {details.map((detail, index) => (
              <div
                key={index}
                className={`text-sm flex items-start gap-2 ${
                  index === details.length - 1 ? 'text-slate-200' : 'text-slate-400'
                }`}
              >
                <span className="text-slate-500 select-none">›</span>
                <span className="break-words">{detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
