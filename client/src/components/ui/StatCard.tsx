import React from 'react';
import { SlidingNumber } from './motion/SlidingNumber';

interface StatCardProps {
  label: string;
  value: number | string;
  isNumeric?: boolean;
  subtext?: string;
  icon: React.ReactNode;
  iconBg?: string;
  iconColor?: string;
  badge?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  isNumeric = true,
  subtext,
  icon,
  iconBg = 'bg-emerald-50',
  iconColor = 'text-emerald-600',
  badge,
  className = '',
}) => {
  return (
    <div
      className={`bg-white border border-stone-200/90 p-4 sm:p-5 rounded-2xl shadow-xs transition-all duration-150 hover:border-stone-300 ${className}`}
    >
      <div className="flex items-center justify-between text-stone-500 text-xs font-semibold mb-2">
        <span className="truncate pr-2">{label}</span>
        <div
          className={`w-7 h-7 rounded-xl ${iconBg} ${iconColor} flex items-center justify-center shrink-0 border border-black/5`}
        >
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-xl sm:text-2xl font-extrabold text-zinc-900 tracking-tight">
          {isNumeric && typeof value === 'number' ? (
            <SlidingNumber value={value} />
          ) : (
            <span>{value}</span>
          )}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      {subtext && (
        <div className="text-[11px] text-stone-400 mt-1 truncate">{subtext}</div>
      )}
    </div>
  );
};
