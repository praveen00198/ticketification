import React from 'react';
import { AnimatedBackground } from './motion/AnimatedBackground';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => {
  return (
    <div className={`p-1 bg-stone-100/80 border border-stone-200/80 rounded-2xl inline-flex flex-wrap items-center gap-1 ${className}`}>
      <AnimatedBackground
        activeId={activeTab}
        className="flex flex-wrap items-center gap-1 w-full"
        pillClassName="bg-white rounded-xl shadow-xs border border-stone-200/70"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              data-id={tab.id}
              onClick={() => onChange(tab.id)}
              type="button"
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors duration-150 relative z-10 ${
                isActive
                  ? 'text-zinc-900'
                  : 'text-stone-500 hover:text-zinc-800'
              }`}
            >
              {Icon && (
                <Icon
                  className={`w-3.5 h-3.5 transition-colors ${
                    isActive ? 'text-emerald-600' : 'text-stone-400'
                  }`}
                />
              )}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </AnimatedBackground>
    </div>
  );
};
