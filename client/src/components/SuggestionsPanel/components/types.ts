/**
 * Type definitions for SuggestionsPanel components
 */

import type { LucideIcon } from 'lucide-react';

export interface EmptyStateConfig {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface ErrorStateConfig {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface TipItem {
  text: string;
  icon?: LucideIcon;
}

export interface InactiveStateConfig {
  icon: LucideIcon;
  title: string;
  description: string;
  tips?: TipItem[];
}
