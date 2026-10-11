import React, { useRef, useEffect, useState } from 'react';

interface AnimatedBackgroundProps {
  children: React.ReactNode;
  activeId: string;
  className?: string;
  pillClassName?: string;
}

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  children,
  activeId,
  className = '',
  pillClassName = 'bg-white rounded-xl shadow-xs border border-stone-200/80',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ left: number; top: number; width: number; height: number; ready: boolean }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const activeEl = containerRef.current.querySelector(`[data-id="${activeId}"]`) as HTMLElement;

    if (activeEl) {
      setStyle({
        left: activeEl.offsetLeft,
        top: activeEl.offsetTop,
        width: activeEl.offsetWidth,
        height: activeEl.offsetHeight,
        ready: true,
      });
    }
  }, [activeId, children]);

  return (
    <div ref={containerRef} className={`relative isolate ${className}`}>
      {style.ready && (
        <span
          className={`absolute pointer-events-none -z-10 transition-all duration-200 ease-out ${pillClassName}`}
          style={{
            transform: `translate3d(${style.left}px, ${style.top}px, 0)`,
            width: `${style.width}px`,
            height: `${style.height}px`,
          }}
        />
      )}
      {children}
    </div>
  );
};
