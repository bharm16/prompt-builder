import type { PromptMode } from '../types';

/**
 * Maps prompt mode to human-readable label.
 */
export function getModeLabel(mode?: string): string {
  const modes: Record<PromptMode, string> = {
    optimize: 'Standard Prompt',
    reasoning: 'Reasoning Prompt',
    research: 'Deep Research',
    socratic: 'Socratic Learning',
    video: 'Video Prompt',
  };
  return mode && mode in modes ? modes[mode as PromptMode] : mode || 'Unknown';
}
