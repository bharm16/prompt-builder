import { describe, it, expect } from 'vitest';
import { promptDebugger } from '../promptDebugger';

describe('promptDebugger (stub)', () => {
  it('captures minimal prompt data and returns a promise', async () => {
    const result = await promptDebugger.captureFullPromptData({
      inputPrompt: 'in',
      optimizedPrompt: 'out',
      displayedPrompt: 'display',
      selectedMode: 'video',
    });

    expect(result).toEqual(
      expect.objectContaining({
        inputPrompt: 'in',
        optimizedPrompt: 'out',
        displayedPrompt: 'display',
        selectedMode: 'video',
        highlights: [],
        suggestions: [],
      })
    );
    expect(typeof result.timestamp).toBe('string');
  });

  it('no-op helpers do not throw', () => {
    expect(() => promptDebugger.printReport()).not.toThrow();
    expect(() => promptDebugger.exportToFile()).not.toThrow();
    expect(() => promptDebugger.exportAllCaptures()).not.toThrow();
  });
});

