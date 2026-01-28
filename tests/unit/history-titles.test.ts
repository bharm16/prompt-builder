import { describe, it, expect } from 'vitest';

import {
  normalizeTitle,
  resolveEntryTitle,
  extractDisambiguator,
} from '@features/history/utils/historyTitles';
import type { PromptHistoryEntry } from '@hooks/types';

const createEntry = (overrides: Partial<PromptHistoryEntry> = {}): PromptHistoryEntry => ({
  input: 'default input',
  output: 'output',
  ...overrides,
});

describe('historyTitles', () => {
  describe('error handling', () => {
    it('normalizes whitespace-only titles to empty strings', () => {
      expect(normalizeTitle('   ')).toBe('');
    });

    it('returns "Untitled" when only stop words are present', () => {
      const entry = createEntry({ title: null, input: 'the the' });

      expect(resolveEntryTitle(entry)).toBe('Untitled');
    });
  });

  describe('edge cases', () => {
    it('chooses the first disambiguator by priority', () => {
      expect(extractDisambiguator('A night handheld wide shot')).toBe('night');
    });

    it('returns null when no disambiguator is found', () => {
      expect(extractDisambiguator('Bright afternoon portrait')).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('uses the normalized explicit title when provided', () => {
      const entry = createEntry({ title: '  My   Title  ' });

      expect(resolveEntryTitle(entry)).toBe('My Title');
    });

    it('derives a short title with token casing rules', () => {
      const entry = createEntry({ title: null, input: 'a tv NASA launch' });

      expect(resolveEntryTitle(entry)).toBe('TV NASA');
    });
  });
});
