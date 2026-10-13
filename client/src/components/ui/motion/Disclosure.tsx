import React, { useState, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface DisclosureProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  triggerClassName?: string;
}

export const Disclosure: React.FC<DisclosureProps> = ({
  title,
  children,
  defaultOpen = false,
  className = '',
  triggerClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className={`border border-stone-200/90 rounded-2xl bg-white overflow-hidden transition-all duration-200 ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className={`w-full px-5 py-4 flex items-center justify-between text-left text-sm font-semibold text-zinc-900 hover:bg-stone-50/80 transition-colors ${triggerClassName}`}
      >
        <div className="flex-1 min-w-0 pr-4">{title}</div>
        <ChevronDown
          className={`w-4 h-4 text-stone-500 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-zinc-900' : ''
          }`}
        />
      </button>
      <div
        ref={contentRef}
        style={{
          maxHeight: isOpen ? `${contentRef.current?.scrollHeight || 1000}px` : '0px',
        }}
        className={`transition-all duration-250 ease-in-out overflow-hidden ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="px-5 pb-5 pt-1 border-t border-stone-100 text-xs text-stone-600">
          {children}
        </div>
      </div>
    </div>
  );
};
