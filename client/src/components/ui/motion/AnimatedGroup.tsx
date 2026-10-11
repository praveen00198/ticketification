import React from 'react';
import { InView } from './InView';

interface AnimatedGroupProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number; // ms between items
  initialDelay?: number; // ms before first item
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
}

export const AnimatedGroup: React.FC<AnimatedGroupProps> = ({
  children,
  className = '',
  staggerDelay = 60,
  initialDelay = 0,
  direction = 'up',
}) => {
  const childArray = React.Children.toArray(children);

  return (
    <div className={className}>
      {childArray.map((child, index) => (
        <InView
          key={index}
          delay={initialDelay + index * staggerDelay}
          direction={direction}
          distance={12}
          duration={400}
        >
          {child}
        </InView>
      ))}
    </div>
  );
};
