/**
 * Types for SpanBentoGrid components
 */

import type React from 'react';
import type { Icon } from '@geist-ui/icons';

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
}

export interface SpanItemProps {
  span: Span;
  onClick?: (span: Span) => void;
  backgroundColor?: string;
  borderColor?: string;
}

