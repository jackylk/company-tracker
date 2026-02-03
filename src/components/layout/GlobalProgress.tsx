'use client';

import { useProgressStore } from '@/store/useProgressStore';

export function GlobalProgress() {
  const { isVisible, isExpanded, message, progress, details, toggle, hide } = useProgressStore();

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur border-t border-slate-700 shadow-lg transition-all duration-300">
      {/* 收起状态 */}
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-slate-800/50"
        onClick={toggle}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* 加载动画 */}
          <div className="flex-shrink-0">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>

          {/* 消息 */}
          <span className="text-sm text-slate-200 truncate">{message}</span>

          {/* 进度条 */}
          {progress > 0 && (
            <div className="flex-shrink-0 w-32 h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          )}
          {progress > 0 && (
            <span className="flex-shrink-0 text-xs text-slate-400">{Math.round(progress)}%</span>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 ml-4">
          <button
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              toggle();
            }}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              hide();
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 展开状态 - 详细信息 */}
      {isExpanded && details.length > 0 && (
        <div className="px-4 pb-3 max-h-40 overflow-y-auto border-t border-slate-700">
          <ul className="space-y-1 mt-2">
            {details.map((detail, index) => (
              <li key={index} className="text-xs text-slate-400 flex items-start gap-2">
                <span className="text-slate-500">•</span>
                <span>{detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
