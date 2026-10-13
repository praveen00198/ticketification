import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, icon, rightElement, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-zinc-700 select-none"
          >
            {label}
            {props.required && <span className="text-stone-900 ml-1 font-bold">*</span>}
          </label>
        )}
        <div className="relative rounded-xl shadow-2xs">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full bg-white border text-xs text-zinc-900 placeholder:text-stone-400 rounded-xl transition-all duration-150 focus:outline-none min-h-[38px] ${
              icon ? 'pl-10' : 'pl-3.5'
            } ${rightElement ? 'pr-10' : 'pr-3.5'} py-2 ${
              error
                ? 'border-rose-300 focus:border-rose-500 focus:ring-3 focus:ring-rose-500/15'
                : 'border-stone-200/90 hover:border-stone-300 focus:border-stone-900 focus:ring-3 focus:ring-stone-400/20'
            } disabled:bg-stone-50 disabled:text-stone-400 disabled:cursor-not-allowed ${className}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-rose-600 mt-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
        {!error && helperText && (
          <p className="text-[11px] text-stone-500 mt-1">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
