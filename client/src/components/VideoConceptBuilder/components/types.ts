/**
 * Type definitions for VideoConceptBuilder components
 */

import type { LucideIcon } from 'lucide-react';
import type { ElementKey, Elements } from '../hooks/types';

export interface ElementConfig {
  icon: LucideIcon;
  label: string;
  taxonomyId?: string | null;
  placeholder: string;
  color: string;
  examples: string[];
  group: string;
  optional: boolean;
  taxonomyGroup?: string | null;
}

export interface CategoryDetection {
  label: string;
  confidence: number;
  colors: {
    bg: string;
    text: string;
    border: string;
  };
}

export interface GroupProgress {
  key: string;
  label: string;
  filled: number;
  total: number;
}

