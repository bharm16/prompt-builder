/**
 * SuggestionsPanel Configuration
 *
 * Centralized configuration for default states, props, thresholds, and API endpoints.
 * Following VideoConceptBuilder pattern: config/constants.js
 */

import { Sparkles, CheckCircle } from 'lucide-react';

// ===========================
// DEFAULT STATES
// ===========================

export const DEFAULT_INACTIVE_STATE = {
  icon: Sparkles,
  title: 'Ready to enhance',
  description: 'Highlight any part of your prompt to see AI-powered suggestions for improvement.',
};

export const DEFAULT_EMPTY_STATE = {
  icon: Sparkles,
  title: 'No suggestions available',
  description: 'Try selecting a different section or use a custom request above.',
};

// ===========================
// DEFAULT PROPS
// ===========================

export const DEFAULT_PANEL_CONFIG = {
  panelTitle: 'AI Suggestions',
  panelClassName: 'w-80 flex-shrink-0 flex flex-col bg-white border-l border-neutral-200 overflow-hidden pt-20',
  enableCustomRequest: true,
  customRequestPlaceholder: 'Make it more cinematic, brighter, tense, etc.',
  customRequestHelperText: 'Describe the tone, detail, or direction you want to see.',
  customRequestCtaLabel: 'Get Suggestions',
  contextLabel: 'For',
  showContextBadge: false,
  contextBadgeText: 'Context-aware',
  contextBadgeIcon: CheckCircle,
  showCategoryTabs: true,
  showCopyAction: true,
};

// ===========================
// THRESHOLDS & LIMITS
// ===========================

export const COMPATIBILITY_THRESHOLDS = {
  HIGH: 0.8,
  LOW: 0.6,
};

export const MAX_KEYBOARD_SHORTCUTS = 8;
export const MAX_REQUEST_LENGTH = 500;

// ===========================
// API ENDPOINTS
// ===========================

export const API_ENDPOINTS = {
  CUSTOM_SUGGESTIONS: '/api/get-custom-suggestions',
};
