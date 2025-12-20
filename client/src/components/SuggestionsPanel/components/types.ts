/**
 * Type definitions for SuggestionsPanel components
 */

import type React from 'react';

export type PanelIcon = React.ComponentType<{ className?: string }>;

export interface EmptyStateConfig {
  icon: PanelIcon;
  title: string;
  description: string;
}

export interface ErrorStateConfig {
  icon: PanelIcon;
  title: string;
  description: string;
}

export interface TipItem {
  text: string;
  icon?: PanelIcon;
}

export interface InactiveStateConfig {
  icon: PanelIcon;
  title: string;
  description: string;
  tips?: TipItem[];
}
