import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
  secondaryActionText?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  actionIcon,
  secondaryActionText,
  onSecondaryAction,
  className = '',
}) => {
  return (
    <div
      className={`border border-stone-200/90 rounded-2xl bg-white p-8 sm:p-12 text-center max-w-xl mx-auto shadow-xs ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-900 flex items-center justify-center mx-auto mb-4 border border-stone-200/80 shadow-2xs">
        {icon}
      </div>
      <h3 className="text-base sm:text-lg font-bold text-zinc-900 tracking-tight">
        {title}
      </h3>
      <p className="text-xs text-stone-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
        {description}
      </p>
      {(actionText || secondaryActionText) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-6">
          {secondaryActionText && onSecondaryAction && (
            <Button variant="secondary" onClick={onSecondaryAction}>
              {secondaryActionText}
            </Button>
          )}
          {actionText && onAction && (
            <Button variant="primary" onClick={onAction} iconRight={actionIcon}>
              {actionText}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
