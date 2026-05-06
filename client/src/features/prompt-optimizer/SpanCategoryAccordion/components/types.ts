/**
 * Types for SpanCategoryAccordion components
 */

import type React from "react";
import type { IconType } from "@promptstudio/system/components/ui";

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
  icon: IconType;
  order: number;
  description: string;
}

export interface CategorySectionProps {
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
