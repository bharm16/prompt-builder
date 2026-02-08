import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { promptDebugger } from '@/utils/promptDebugger';

describe('promptDebugger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('error handling', () => {
    it('returns default values when state is empty', async () => {
      const result = await promptDebugger.captureFullPromptData({}, null);

      expect(result.inputPrompt).toBe('');
      expect(result.optimizedPrompt).toBe('');
      expect(result.displayedPrompt).toBe('');
      expect(result.selectedMode).toBe('video');
    });
  });

  describe('edge cases', () => {
    it('exposes no-op debug helpers without throwing', () => {
      expect(() => promptDebugger.printReport({} as never)).not.toThrow();
      expect(() => promptDebugger.exportToFile()).not.toThrow();
      expect(() => promptDebugger.exportAllCaptures()).not.toThrow();
    });
  });

  describe('core behavior', () => {
    it('captures prompt state values and timestamps', async () => {
      const result = await promptDebugger.captureFullPromptData({
        inputPrompt: 'input',
        optimizedPrompt: 'optimized',
        displayedPrompt: 'displayed',
        selectedMode: 'image',
      }, null);

      expect(result.timestamp).toBe('2024-05-10T12:00:00.000Z');
      expect(result.inputPrompt).toBe('input');
      expect(result.optimizedPrompt).toBe('optimized');
      expect(result.displayedPrompt).toBe('displayed');
      expect(result.selectedMode).toBe('image');
      expect(result.highlights).toEqual([]);
      expect(result.suggestions).toEqual([]);
    });
  });
});
