/**
 * Types for SpanBentoGrid components
 */

import type { LucideIcon } from 'lucide-react';

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
  color: string;
  borderColor: string;
  icon: LucideIcon;
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
}

