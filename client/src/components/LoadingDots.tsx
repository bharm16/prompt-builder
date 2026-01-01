/**
 * LoadingDots Component
 * 
 * Simple three-dot loading indicator matching Geist design system
 */

import React from 'react';

interface LoadingDotsProps {
  size?: number;
  color?: string;
}

export const LoadingDots: React.FC<LoadingDotsProps> = ({ 
  size = 4,
  color = 'currentColor'
}) => {
  const dotSize = `${size}px`;
  
  return (
    <div className="flex items-center gap-1">
      <div
        className="rounded-full animate-bounce"
        style={{
          width: dotSize,
          height: dotSize,
          backgroundColor: color,
          animationDelay: '0ms',
          animationDuration: '1.4s',
        }}
      />
      <div
        className="rounded-full animate-bounce"
        style={{
          width: dotSize,
          height: dotSize,
          backgroundColor: color,
          animationDelay: '160ms',
          animationDuration: '1.4s',
        }}
      />
      <div
        className="rounded-full animate-bounce"
        style={{
          width: dotSize,
          height: dotSize,
          backgroundColor: color,
          animationDelay: '320ms',
          animationDuration: '1.4s',
        }}
      />
    </div>
  );
};

