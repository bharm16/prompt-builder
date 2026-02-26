import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ContinuityShot } from '@/features/continuity/types';
import { PreviousShotContext } from '../PreviousShotContext';

const useResolvedMediaUrlMock = vi.fn();

vi.mock('@/hooks/useResolvedMediaUrl', () => ({
  useResolvedMediaUrl: (...args: unknown[]) => useResolvedMediaUrlMock(...args),
}));

const baseShot = (overrides: Partial<ContinuityShot>): ContinuityShot => ({
  id: 'shot-1',
  sessionId: 'session-1',
  sequenceIndex: 0,
  userPrompt: 'Prompt',
  continuityMode: 'frame-bridge',
  styleStrength: 0.6,
  styleReferenceId: null,
  modelId: 'model-1',
  status: 'completed',
  createdAt: '2026-02-12T00:00:00.000Z',
  ...overrides,
});

describe('PreviousShotContext', () => {
  beforeEach(() => {
    useResolvedMediaUrlMock.mockReset();
    useResolvedMediaUrlMock.mockReturnValue({
      url: null,
      expiresAt: null,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
  });

  it('prefers frame bridge image when available', () => {
    render(
      <PreviousShotContext
        previousShot={baseShot({
          frameBridge: {
            id: 'fb-1',
            sourceVideoId: 'video-1',
            sourceShotId: 'shot-1',
            frameUrl: 'https://img/frame-bridge.png',
            framePosition: 'last',
            frameTimestamp: 1,
            resolution: { width: 1280, height: 720 },
            aspectRatio: '16:9',
            extractedAt: '2026-02-12T00:00:00.000Z',
          },
        })}
        continuityMode="frame-bridge"
      />
    );

    expect(screen.getByAltText('Shot 1 context frame')).toHaveAttribute(
      'src',
      'https://img/frame-bridge.png'
    );
  });

  it('renders resolved previous-shot video when no frame image exists', () => {
    useResolvedMediaUrlMock.mockReturnValue({
      url: 'https://cdn.example.com/shot-1.mp4',
      expiresAt: null,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(
      <PreviousShotContext
        previousShot={baseShot({
          videoAssetId: 'users/user-1/generations/shot-1.mp4',
          frameBridge: undefined,
          styleReference: undefined,
          generatedKeyframeUrl: undefined,
        })}
        continuityMode="frame-bridge"
      />
    );

    expect(screen.getByTestId('previous-shot-video')).toHaveAttribute(
      'src',
      'https://cdn.example.com/shot-1.mp4'
    );
    expect(useResolvedMediaUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'video',
        storagePath: 'users/user-1/generations/shot-1.mp4',
        assetId: null,
        enabled: true,
      })
    );
  });
});
