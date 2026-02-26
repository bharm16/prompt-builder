import { describe, it, expect, vi, beforeEach } from 'vitest';

import { detectAndApplySceneChange } from '@/utils/sceneChange/sceneChangeDetector';
import type { SceneChangeResponse } from '@/utils/sceneChange/types';
import { extractSceneContext } from '@/utils/sceneChange/sceneContextParser';
import { detectSceneChange } from '@/utils/sceneChange/sceneChangeApi';
import { applySceneChangeUpdates } from '@/utils/sceneChange/sceneChangeUpdates';

const { logSpies } = vi.hoisted(() => ({
  logSpies: {
    error: vi.fn(),
  },
}));

vi.mock('@/utils/sceneChange/sceneContextParser', () => ({
  extractSceneContext: vi.fn(),
}));

vi.mock('@/utils/sceneChange/sceneChangeApi', () => ({
  detectSceneChange: vi.fn(),
}));

vi.mock('@/utils/sceneChange/sceneChangeUpdates', () => ({
  applySceneChangeUpdates: vi.fn(),
}));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => logSpies,
  },
}));

vi.mock('@/utils/logging', () => ({
  sanitizeError: (error: unknown) => ({ message: String(error) }),
}));

const mockExtractSceneContext = vi.mocked(extractSceneContext);
const mockDetectSceneChange = vi.mocked(detectSceneChange);
const mockApplySceneChangeUpdates = vi.mocked(applySceneChangeUpdates);

describe('sceneChangeDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExtractSceneContext.mockReturnValue({
      changedField: 'Location',
      affectedFields: { Location: 'Forest' },
      sectionHeading: 'Environment',
      sectionContext: '- Location: [Forest]',
    });
  });

  describe('error handling', () => {
    it('returns the baseline prompt when the detection API fails', async () => {
      mockDetectSceneChange.mockRejectedValue(new Error('timeout'));

      const result = await detectAndApplySceneChange({
        originalPrompt: 'Original',
        updatedPrompt: 'Updated',
        oldValue: 'Forest',
        newValue: 'Desert',
        confirmSceneChange: () => true,
      });

      expect(result).toBe('Updated');
      expect(logSpies.error).toHaveBeenCalledWith(
        'Error detecting scene change',
        expect.any(Error),
        expect.objectContaining({ operation: 'detectSceneChange' })
      );
    });
  });

  describe('edge cases', () => {
    it('returns the available prompt when input values are missing', async () => {
      const result = await detectAndApplySceneChange({
        originalPrompt: null,
        updatedPrompt: 'Updated',
        oldValue: null,
        newValue: null,
      });

      expect(result).toBe('Updated');
      expect(mockDetectSceneChange).not.toHaveBeenCalled();
    });

    it('returns the baseline prompt when confirmation is not provided', async () => {
      const result = await detectAndApplySceneChange({
        originalPrompt: 'Original',
        updatedPrompt: 'Updated',
        oldValue: 'Forest',
        newValue: 'Desert',
      });

      expect(result).toBe('Updated');
      expect(mockDetectSceneChange).not.toHaveBeenCalled();
    });

    it('returns the baseline prompt when values are unchanged', async () => {
      const result = await detectAndApplySceneChange({
        originalPrompt: 'Original',
        updatedPrompt: 'Updated',
        oldValue: 'Forest',
        newValue: 'Forest',
        confirmSceneChange: () => true,
      });

      expect(result).toBe('Updated');
      expect(mockDetectSceneChange).not.toHaveBeenCalled();
    });
  });

  describe('core behavior', () => {
    it('applies suggested updates when confirmed', async () => {
      const response: SceneChangeResponse = {
        isSceneChange: true,
        confidence: 'high',
        reasoning: 'environment shift',
        suggestedUpdates: { Location: 'Desert' },
      };

      mockDetectSceneChange.mockResolvedValue(response);
      mockApplySceneChangeUpdates.mockReturnValue('Updated prompt with Desert');

      const confirmSceneChange = vi.fn(() => true);

      const result = await detectAndApplySceneChange({
        originalPrompt: 'Original prompt',
        updatedPrompt: 'Updated prompt',
        oldValue: 'Forest',
        newValue: 'Desert',
        confirmSceneChange,
      });

      expect(result).toBe('Updated prompt with Desert');
      expect(confirmSceneChange).toHaveBeenCalledWith(
        expect.stringContaining('Changing from \"Forest\" to \"Desert\"')
      );
      expect(mockApplySceneChangeUpdates).toHaveBeenCalledWith(
        'Updated prompt',
        { Location: 'Desert' },
        { Location: 'Forest' }
      );
    });

    it('returns the baseline prompt when the change is low confidence', async () => {
      mockDetectSceneChange.mockResolvedValue({
        isSceneChange: true,
        confidence: 'low',
      });

      const result = await detectAndApplySceneChange({
        originalPrompt: 'Original',
        updatedPrompt: 'Updated',
        oldValue: 'Forest',
        newValue: 'Desert',
        confirmSceneChange: () => true,
      });

      expect(result).toBe('Updated');
      expect(mockApplySceneChangeUpdates).not.toHaveBeenCalled();
    });

    it('returns baseline prompt when detector reports no scene change', async () => {
      mockDetectSceneChange.mockResolvedValue({
        isSceneChange: false,
        confidence: 'high',
      });

      const result = await detectAndApplySceneChange({
        originalPrompt: 'Original',
        updatedPrompt: 'Updated',
        oldValue: 'Forest',
        newValue: 'Desert',
        confirmSceneChange: () => true,
      });

      expect(result).toBe('Updated');
      expect(mockApplySceneChangeUpdates).not.toHaveBeenCalled();
    });

    it('does not apply updates when user declines confirmation', async () => {
      mockDetectSceneChange.mockResolvedValue({
        isSceneChange: true,
        confidence: 'high',
        suggestedUpdates: { Location: 'Desert' },
      });

      const result = await detectAndApplySceneChange({
        originalPrompt: 'Original',
        updatedPrompt: 'Updated',
        oldValue: 'Forest',
        newValue: 'Desert',
        confirmSceneChange: () => false,
      });

      expect(result).toBe('Updated');
      expect(mockApplySceneChangeUpdates).not.toHaveBeenCalled();
    });

    it('does not apply updates when detector omits suggestedUpdates', async () => {
      mockDetectSceneChange.mockResolvedValue({
        isSceneChange: true,
        confidence: 'high',
      });

      const result = await detectAndApplySceneChange({
        originalPrompt: 'Original',
        updatedPrompt: 'Updated',
        oldValue: 'Forest',
        newValue: 'Desert',
        confirmSceneChange: () => true,
      });

      expect(result).toBe('Updated');
      expect(mockApplySceneChangeUpdates).not.toHaveBeenCalled();
    });
  });
});
