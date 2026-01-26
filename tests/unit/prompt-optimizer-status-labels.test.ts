import { describe, it, expect } from 'vitest';

import { resolveActiveStatusLabel as resolveContainerLabel } from '@features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerContainer';
import { resolveActiveStatusLabel as resolveWorkspaceLabel } from '@features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace';

const baseParams = {
  inputPrompt: '',
  displayedPrompt: '',
  isProcessing: false,
  isRefining: false,
  hasHighlights: false,
};

const scenarios = [
  {
    name: 'refining takes priority over processing',
    params: { ...baseParams, isProcessing: true, isRefining: true, displayedPrompt: 'out' },
    expected: 'Refining',
  },
  {
    name: 'processing takes priority over output state',
    params: { ...baseParams, isProcessing: true, displayedPrompt: 'out', hasHighlights: true },
    expected: 'Optimizing',
  },
  {
    name: 'empty prompts resolve to Draft',
    params: { ...baseParams },
    expected: 'Draft',
  },
  {
    name: 'input-only prompts resolve to Draft',
    params: { ...baseParams, inputPrompt: 'input' },
    expected: 'Draft',
  },
  {
    name: 'output with highlights resolves to Generated',
    params: { ...baseParams, displayedPrompt: 'out', hasHighlights: true },
    expected: 'Generated',
  },
  {
    name: 'output without highlights resolves to Optimized',
    params: { ...baseParams, displayedPrompt: 'out', hasHighlights: false },
    expected: 'Optimized',
  },
];

describe('resolveActiveStatusLabel', () => {
  describe('PromptOptimizerContainer', () => {
    describe('error handling', () => {
      it('returns Refining when refining is true', () => {
        expect(resolveContainerLabel(scenarios[0].params)).toBe('Refining');
      });

      it('returns Optimizing when processing is true and not refining', () => {
        expect(resolveContainerLabel(scenarios[1].params)).toBe('Optimizing');
      });
    });

    describe('edge cases', () => {
      it('returns Draft when both prompts are empty', () => {
        expect(resolveContainerLabel(scenarios[2].params)).toBe('Draft');
      });

      it('returns Draft when only input prompt is present', () => {
        expect(resolveContainerLabel(scenarios[3].params)).toBe('Draft');
      });
    });

    describe('core behavior', () => {
      it('distinguishes Generated vs Optimized based on highlights', () => {
        expect(resolveContainerLabel(scenarios[4].params)).toBe('Generated');
        expect(resolveContainerLabel(scenarios[5].params)).toBe('Optimized');
      });
    });
  });

  describe('PromptOptimizerWorkspace', () => {
    describe('error handling', () => {
      it('returns Refining when refining is true', () => {
        expect(resolveWorkspaceLabel(scenarios[0].params)).toBe('Refining');
      });

      it('returns Optimizing when processing is true and not refining', () => {
        expect(resolveWorkspaceLabel(scenarios[1].params)).toBe('Optimizing');
      });
    });

    describe('edge cases', () => {
      it('returns Draft when both prompts are empty', () => {
        expect(resolveWorkspaceLabel(scenarios[2].params)).toBe('Draft');
      });

      it('returns Draft when only input prompt is present', () => {
        expect(resolveWorkspaceLabel(scenarios[3].params)).toBe('Draft');
      });
    });

    describe('core behavior', () => {
      it('distinguishes Generated vs Optimized based on highlights', () => {
        expect(resolveWorkspaceLabel(scenarios[4].params)).toBe('Generated');
        expect(resolveWorkspaceLabel(scenarios[5].params)).toBe('Optimized');
      });
    });
  });
});
