/**
 * Types for SpanBentoGrid components
 */

import type React from 'react';

export interface Span {
  id: string;
  quote: string;
  confidence?: number;
  start: number;
  end: number;
  category?: string;
  [key: string]: unknown;
}

export interface CategoryConfig {
  label: string;
  backgroundColor: string;
  borderColor: string;
  icon: React.ComponentType<{ size?: number; color?: string; className?: string; style?: React.CSSProperties }>;
  order: number;
  description: string;
}

export interface BentoBoxProps {
  category: string;
  spans: Span[];
  config: CategoryConfig;
  onSpanClick: (span: Span) => void;
  defaultExpanded?: boolean;
  onSpanHoverChange?: (spanId: string | null) => void;
}

export interface SpanItemProps {
  span: Span;
  onClick?: (span: Span) => void;
  onHoverChange?: (spanId: string | null) => void;
  backgroundColor?: string;
  borderColor?: string;
}
