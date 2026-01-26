import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useKeyframeWorkflow } from '@features/prompt-optimizer/GenerationsPanel/hooks/useKeyframeWorkflow';
import type { Asset } from '@shared/types/asset';
import type { KeyframeTile } from '@components/ToolSidebar/types';

const character = { id: 'char-1', trigger: '@hero' } as Asset;

const createKeyframe = (overrides: Partial<KeyframeTile> = {}): KeyframeTile => ({
  id: 'kf-1',
  url: 'https://cdn/frame.png',
  source: 'generation',
  ...overrides,
});

describe('useKeyframeWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('does nothing when prompt is empty', () => {
      const generateRender = vi.fn();
      const { result } = renderHook(() =>
        useKeyframeWorkflow({
          prompt: '   ',
          keyframes: [],
          assetReferenceImages: [],
          detectedCharacter: character,
          onCreateVersionIfNeeded: vi.fn().mockReturnValue('v1'),
          generateRender,
        })
      );

      act(() => {
        result.current.handleRender('sora-2');
      });

      expect(generateRender).not.toHaveBeenCalled();
      expect(result.current.keyframeStep.isActive).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('stores a pending model when already in keyframe step', () => {
      const generateRender = vi.fn();
      const { result } = renderHook(() =>
        useKeyframeWorkflow({
          prompt: 'Prompt',
          keyframes: [],
          assetReferenceImages: [],
          detectedCharacter: character,
          onCreateVersionIfNeeded: vi.fn().mockReturnValue('v1'),
          generateRender,
        })
      );

      act(() => {
        result.current.handleRender('sora-2');
      });

      expect(result.current.keyframeStep.isActive).toBe(true);
      expect(result.current.keyframeStep.pendingModel).toBe('sora-2');

      act(() => {
        result.current.handleRender('kling');
      });

      expect(result.current.keyframeStep.pendingModel).toBe('kling');
    });

    it('selects and clears keyframes manually', () => {
      const generateRender = vi.fn();
      const { result } = renderHook(() =>
        useKeyframeWorkflow({
          prompt: 'Prompt',
          keyframes: [],
          assetReferenceImages: [],
          detectedCharacter: null,
          onCreateVersionIfNeeded: vi.fn().mockReturnValue('v1'),
          generateRender,
        })
      );

      act(() => {
        result.current.handleSelectFrame('https://cdn/frame.png', 2, 'gen-1');
      });

      expect(result.current.selectedKeyframe?.url).toBe('https://cdn/frame.png');

      act(() => {
        result.current.handleClearSelectedFrame();
      });

      expect(result.current.selectedKeyframe).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('uses the primary keyframe when available', () => {
      const generateRender = vi.fn();
      const keyframes = [createKeyframe({ url: 'https://cdn/primary.png', assetId: 'asset-1' })];

      const { result } = renderHook(() =>
        useKeyframeWorkflow({
          prompt: 'Prompt',
          keyframes,
          assetReferenceImages: [],
          detectedCharacter: null,
          onCreateVersionIfNeeded: vi.fn().mockReturnValue('v1'),
          generateRender,
        })
      );

      act(() => {
        result.current.handleRender('sora-2');
      });

      expect(generateRender).toHaveBeenCalledWith('sora-2', 'Prompt', {
        promptVersionId: 'v1',
        startImage: {
          url: 'https://cdn/primary.png',
          source: 'generation',
          assetId: 'asset-1',
        },
      });
      expect(result.current.selectedKeyframe).toBeNull();
    });
  });
});
