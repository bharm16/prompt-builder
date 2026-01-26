import { describe, it, expect } from 'vitest';

import {
  resolveEntryStage,
  formatModelLabel,
  normalizeProcessingLabel,
} from '@features/history/utils/historyStages';
import type { PromptHistoryEntry } from '@hooks/types';

const createEntry = (overrides: Partial<PromptHistoryEntry> = {}): PromptHistoryEntry => ({
  input: 'input',
  output: 'output',
  ...overrides,
});

describe('historyStages', () => {
  describe('error handling', () => {
    it('returns null for empty model labels', () => {
      expect(formatModelLabel(null)).toBeNull();
      expect(formatModelLabel('   ')).toBeNull();
    });

    it('returns null for empty processing labels', () => {
      expect(normalizeProcessingLabel('')).toBeNull();
      expect(normalizeProcessingLabel('   ')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('extracts the Veo version and normalizes the label', () => {
      expect(formatModelLabel('Veo 2.1')).toBe('veo-2.1');
      expect(formatModelLabel('veo-3')).toBe('veo-3');
    });

    it('preserves labels that already include an ellipsis', () => {
      expect(normalizeProcessingLabel('Processing...')).toBe('Processing...');
    });
  });

  describe('core behavior', () => {
    it('resolves entry stages based on output and highlight state', () => {
      expect(resolveEntryStage(createEntry({ output: '' }))).toBe('draft');
      expect(resolveEntryStage(createEntry({ highlightCache: { id: 1 } }))).toBe('generated');
      expect(resolveEntryStage(createEntry())).toBe('optimized');
    });
  });
});
