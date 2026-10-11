import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'neutral' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      iconLeft,
      iconRight,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-50 disabled:pointer-events-none select-none active:scale-[0.98]';

    const variantStyles = {
      primary:
        'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-sm border border-emerald-600/30',
      secondary:
        'bg-white hover:bg-stone-50 text-zinc-800 border border-stone-200/90 shadow-2xs hover:border-stone-300',
      neutral:
        'bg-stone-100 hover:bg-stone-200 text-zinc-700 border border-stone-200/70',
      outline:
        'bg-transparent hover:bg-stone-100/70 text-zinc-700 border border-stone-200/90',
      ghost:
        'bg-transparent hover:bg-stone-100 text-zinc-600 hover:text-zinc-900',
      danger:
        'bg-rose-600 hover:bg-rose-700 text-white shadow-xs border border-rose-600/30',
    };

    const sizeStyles = {
      sm: 'text-xs py-1.5 px-3 rounded-lg gap-1.5 min-h-[34px]',
      md: 'text-xs py-2 px-3.5 sm:px-4 rounded-xl gap-2 min-h-[38px]',
      lg: 'text-sm py-2.5 px-5 rounded-xl gap-2.5 min-h-[44px]',
      icon: 'p-2 rounded-xl h-9 w-9 min-h-[36px]',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          iconLeft && <span className="shrink-0">{iconLeft}</span>
        )}
        {children}
        {!loading && iconRight && <span className="shrink-0">{iconRight}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
