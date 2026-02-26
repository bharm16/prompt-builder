import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Generation } from '@features/prompt-optimizer/GenerationsPanel/types';
import { usePromptCanvasPanelProps } from '../usePromptCanvasPanelProps';

const makeGeneration = (id: string): Generation => ({
  id,
  tier: 'draft',
  status: 'completed',
  model: 'wan-2.2',
  prompt: 'Prompt',
  promptVersionId: 'v-1',
  createdAt: Date.now(),
  completedAt: Date.now(),
  mediaType: 'video',
  mediaUrls: ['https://example.com/video.mp4'],
});

const buildArgs = (overrides: Partial<Parameters<typeof usePromptCanvasPanelProps>[0]> = {}) => ({
  versionsForPanel: [],
  selectedVersionId: '',
  onSelectVersion: vi.fn(),
  onCreateVersion: vi.fn(),
  showResults: false,
  normalizedDisplayedPrompt: null,
  normalizedInputPrompt: '',
  promptVersionId: '',
  effectiveAspectRatio: '16:9',
  durationSeconds: 5,
  fpsNumber: 24,
  generationParams: {},
  initialGenerations: undefined,
  onGenerationsChange: vi.fn(),
  currentVersions: [],
  onRestoreVersion: vi.fn(),
  onCreateVersionIfNeeded: vi.fn(() => 'v-1'),
  ...overrides,
});

describe('usePromptCanvasPanelProps', () => {
  it('clears generations when no prompt version is selected', () => {
    const { result } = renderHook(() => usePromptCanvasPanelProps(buildArgs()));

    expect(result.current.generationsPanelProps.initialGenerations).toEqual([]);
  });

  it('preserves undefined generations when an existing version is selected', () => {
    const { result } = renderHook(() =>
      usePromptCanvasPanelProps(
        buildArgs({
          promptVersionId: 'v-1',
          initialGenerations: undefined,
        })
      )
    );

    expect(result.current.generationsPanelProps.initialGenerations).toBeUndefined();
  });

  it('passes through explicit generations', () => {
    const initialGenerations = [makeGeneration('gen-1')];
    const { result } = renderHook(() =>
      usePromptCanvasPanelProps(
        buildArgs({
          promptVersionId: 'v-1',
          initialGenerations,
        })
      )
    );

    expect(result.current.generationsPanelProps.initialGenerations).toEqual(initialGenerations);
  });
});
