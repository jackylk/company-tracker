import { ReactNode, useState } from 'react';

interface TabsProps {
  tabs: Array<{ id: string; label: string; count?: number }>;
  defaultTab?: string;
  children: (activeTab: string) => ReactNode;
}

export function Tabs({ tabs, defaultTab, children }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  return (
    <div>
      {/* 标签栏 */}
      <div className="flex border-b border-slate-700 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-3 text-sm font-medium whitespace-nowrap transition-all duration-200
              border-b-2 -mb-px
              ${activeTab === tab.id
                ? 'text-blue-400 border-blue-400'
                : 'text-slate-400 border-transparent hover:text-slate-300 hover:border-slate-600'
              }
            `}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`
                  ml-2 px-2 py-0.5 text-xs rounded-full
                  ${activeTab === tab.id ? 'bg-blue-600/20 text-blue-400' : 'bg-slate-700 text-slate-400'}
                `}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 内容区域 */}
      <div className="pt-4">{children(activeTab)}</div>
    </div>
  );
}
