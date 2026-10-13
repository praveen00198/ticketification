import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'emerald' | 'neutral' | 'amber' | 'rose' | 'sky' | 'indigo' | 'outline';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) => {
  const variantStyles = {
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
    neutral: 'bg-stone-100 text-zinc-700 border-stone-200/90',
    amber: 'bg-amber-50 text-amber-800 border-amber-200/80',
    rose: 'bg-rose-50 text-rose-800 border-rose-200/80',
    sky: 'bg-sky-50 text-sky-800 border-sky-200/80',
    indigo: 'bg-indigo-50 text-indigo-800 border-indigo-200/80',
    outline: 'bg-transparent text-zinc-700 border-stone-300',
  };

  const dotColors = {
    emerald: 'bg-emerald-500',
    neutral: 'bg-stone-400',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    sky: 'bg-sky-500',
    indigo: 'bg-indigo-500',
    outline: 'bg-zinc-500',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider',
    md: 'text-xs px-2.5 py-0.5 rounded-full font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 border shadow-2xs select-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]} animate-pulse`}
        />
      )}
      {children}
    </span>
  );
};
