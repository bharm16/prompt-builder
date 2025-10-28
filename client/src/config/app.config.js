/**
 * Application Configuration
 *
 * Centralized configuration for app-wide settings
 */

import { MessageSquare, Lightbulb, Search, GraduationCap, Video } from 'lucide-react';

const ENV = import.meta.env.MODE || 'development';
const IS_DEV = ENV === 'development';
const IS_PROD = ENV === 'production';

export const APP_CONFIG = {
  // Environment
  env: ENV,
  isDevelopment: IS_DEV,
  isProduction: IS_PROD,

  // App metadata
  name: 'Prompt Builder',
  version: '1.0.0',

  // UI Configuration
  ui: {
    defaultMode: 'optimize',
    showHistory: true,
    animationDuration: 200,
    toastDuration: 3000,

    // History
    maxHistoryItems: 100,
    historyAutoRefresh: true,

    // Suggestions
    maxSuggestions: 9,  // For keyboard shortcuts 1-9
  },

  // Mode Configuration
  modes: [
    {
      id: 'optimize',
      name: 'Standard Prompt',
      icon: MessageSquare,
      description: 'Optimize any prompt',
    },
    {
      id: 'reasoning',
      name: 'Reasoning Prompt',
      icon: Lightbulb,
      description: 'Deep thinking & verification',
    },
    {
      id: 'research',
      name: 'Deep Research',
      icon: Search,
      description: 'Create research plans',
    },
    {
      id: 'socratic',
      name: 'Socratic Learning',
      icon: GraduationCap,
      description: 'Learning journeys',
    },
    {
      id: 'video',
      name: 'Video Prompt',
      icon: Video,
      description: 'Generate AI video prompts',
    },
  ],

  // AI Names for cycling animation
  aiNames: ['Claude AI', 'ChatGPT', 'Gemini'],
  aiNamesCycleInterval: 3000,  // 3 seconds

  // Undo/Redo
  undoRedoStackSize: 100,

  // Debug
  debug: {
    enabled: IS_DEV || new URLSearchParams(window.location.search).get('debug') === 'true',
    logLevel: IS_DEV ? 'debug' : 'error',
  },

  // Links
  links: {
    privacyPolicy: '/privacy-policy',
    github: 'https://github.com/anthropics/prompt-builder',  // Update with actual repo
  },
};

/**
 * Get mode configuration by ID
 */
export const getModeById = (modeId) => {
  return APP_CONFIG.modes.find(m => m.id === modeId) || APP_CONFIG.modes[0];
};

/**
 * Get default mode
 */
export const getDefaultMode = () => {
  return APP_CONFIG.modes.find(m => m.id === APP_CONFIG.ui.defaultMode) || APP_CONFIG.modes[0];
};
