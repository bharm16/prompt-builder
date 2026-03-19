import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import { useKeyframeWorkflow } from '../useKeyframeWorkflow';

const buildStartFrame = (overrides: Partial<KeyframeTile> = {}): KeyframeTile => ({
  id: 'start-frame',
  url: 'https://example.com/start.png',
  source: 'upload',
  ...overrides,
});

describe('useKeyframeWorkflow', () => {
  it('uses startFrame during render when no explicit override is provided', () => {
    const generateRender = vi.fn();

    const { result } = renderHook(() =>
      useKeyframeWorkflow({
        prompt: 'A prompt',
        startFrame: buildStartFrame(),
        setStartFrame: vi.fn(),
        clearStartFrame: vi.fn(),
        detectedCharacter: null,
        onCreateVersionIfNeeded: () => 'version-1',
        generateRender,
      })
    );

    act(() => {
      result.current.handleRender('sora-2');
    });

    expect(generateRender).toHaveBeenCalledWith(
      'sora-2',
      'A prompt',
      expect.objectContaining({
        promptVersionId: 'version-1',
        startImage: expect.objectContaining({
          url: 'https://example.com/start.png',
          source: 'upload',
        }),
      })
    );
  });

  it('does not use an implicit start image fallback when startFrame is missing', () => {
    const generateRender = vi.fn();

    const { result } = renderHook(() =>
      useKeyframeWorkflow({
        prompt: 'A prompt',
        startFrame: null,
        setStartFrame: vi.fn(),
        clearStartFrame: vi.fn(),
        detectedCharacter: null,
        onCreateVersionIfNeeded: () => 'version-1',
        generateRender,
      })
    );

    act(() => {
      result.current.handleRender('sora-2');
    });

    expect(generateRender).toHaveBeenCalledWith(
      'sora-2',
      'A prompt',
      expect.objectContaining({
        startImage: null,
      })
    );
  });

  it('writes selected gallery frame to startFrame', () => {
    const setStartFrame = vi.fn();

    const { result } = renderHook(() =>
      useKeyframeWorkflow({
        prompt: 'A prompt',
        startFrame: null,
        setStartFrame,
        clearStartFrame: vi.fn(),
        detectedCharacter: null,
        onCreateVersionIfNeeded: () => 'version-1',
        generateRender: vi.fn(),
      })
    );

    act(() => {
      result.current.handleSelectFrame(
        'https://example.com/frame-2.png',
        2,
        'generation-1',
        'generated/frame-2.png',
        'frame prompt'
      );
    });

    expect(setStartFrame).toHaveBeenCalledWith({
      id: 'frame-generation-1-2',
      url: 'https://example.com/frame-2.png',
      source: 'generation',
      sourcePrompt: 'frame prompt',
      storagePath: 'generated/frame-2.png',
    });
  });

  it('clears selected frame via clearStartFrame', () => {
    const clearStartFrame = vi.fn();

    const { result } = renderHook(() =>
      useKeyframeWorkflow({
        prompt: 'A prompt',
        startFrame: null,
        setStartFrame: vi.fn(),
        clearStartFrame,
        detectedCharacter: null,
        onCreateVersionIfNeeded: () => 'version-1',
        generateRender: vi.fn(),
      })
    );

    act(() => {
      result.current.handleClearSelectedFrame();
    });

    expect(clearStartFrame).toHaveBeenCalledTimes(1);
  });
});
