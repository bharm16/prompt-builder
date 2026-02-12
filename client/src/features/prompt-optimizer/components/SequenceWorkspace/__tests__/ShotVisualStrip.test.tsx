import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ContinuityShot } from '@/features/continuity/types';
import { ShotVisualStrip } from '../ShotVisualStrip';

const baseShot = (overrides: Partial<ContinuityShot>): ContinuityShot => ({
  id: 'shot-1',
  sessionId: 'session-1',
  sequenceIndex: 0,
  userPrompt: 'Prompt',
  continuityMode: 'none',
  styleStrength: 0.6,
  styleReferenceId: null,
  modelId: 'model-1',
  status: 'draft',
  createdAt: '2026-02-12T00:00:00.000Z',
  ...overrides,
});

describe('ShotVisualStrip', () => {
  it('uses thumbnail source priority and renders continuity connectors', async () => {
    const onShotSelect = vi.fn();
    const onAddShot = vi.fn();

    const shots: ContinuityShot[] = [
      baseShot({
        id: 'shot-1',
        sequenceIndex: 0,
        continuityMode: 'none',
        frameBridge: {
          id: 'fb-1',
          sourceVideoId: 'video-1',
          sourceShotId: 'shot-0',
          frameUrl: 'https://img/frame-bridge.png',
          framePosition: 'last',
          frameTimestamp: 1,
          resolution: { width: 1280, height: 720 },
          aspectRatio: '16:9',
          extractedAt: '2026-02-12T00:00:00.000Z',
        },
        styleReference: {
          id: 'style-1',
          frameUrl: 'https://img/style-ref.png',
          frameTimestamp: 1,
          resolution: { width: 1280, height: 720 },
          aspectRatio: '16:9',
        },
        generatedKeyframeUrl: 'https://img/keyframe.png',
      }),
      baseShot({
        id: 'shot-2',
        sequenceIndex: 1,
        continuityMode: 'frame-bridge',
        styleReference: {
          id: 'style-2',
          frameUrl: 'https://img/style-ref-2.png',
          frameTimestamp: 1,
          resolution: { width: 1280, height: 720 },
          aspectRatio: '16:9',
        },
      }),
      baseShot({
        id: 'shot-3',
        sequenceIndex: 2,
        continuityMode: 'style-match',
        generatedKeyframeUrl: 'https://img/keyframe-3.png',
      }),
      baseShot({
        id: 'shot-4',
        sequenceIndex: 3,
        continuityMode: 'none',
      }),
    ];

    render(
      <ShotVisualStrip
        shots={shots}
        currentShotId="shot-1"
        onShotSelect={onShotSelect}
        onAddShot={onAddShot}
      />
    );

    expect(screen.getByAltText('Shot 1 thumbnail')).toHaveAttribute('src', 'https://img/frame-bridge.png');
    expect(screen.getByAltText('Shot 2 thumbnail')).toHaveAttribute('src', 'https://img/style-ref-2.png');
    expect(screen.getByAltText('Shot 3 thumbnail')).toHaveAttribute('src', 'https://img/keyframe-3.png');
    expect(screen.getByTestId('shot-placeholder-shot-4')).toBeInTheDocument();

    expect(screen.getByTestId('shot-connector-shot-2')).toBeInTheDocument();
    expect(screen.getByTestId('shot-connector-shot-3')).toBeInTheDocument();
    expect(screen.queryByTestId('shot-connector-shot-4')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('shot-thumb-shot-3'));
    expect(onShotSelect).toHaveBeenCalledWith('shot-3');

    await userEvent.click(screen.getByTestId('add-shot-button'));
    expect(onAddShot).toHaveBeenCalledTimes(1);
  });

  it('renders generating and completed states', () => {
    const shots: ContinuityShot[] = [
      baseShot({ id: 'shot-1', status: 'generating-video' }),
      baseShot({ id: 'shot-2', sequenceIndex: 1, status: 'completed' }),
    ];

    render(
      <ShotVisualStrip
        shots={shots}
        currentShotId="shot-2"
        onShotSelect={vi.fn()}
        onAddShot={vi.fn()}
      />
    );

    expect(screen.getByTestId('shot-thumb-shot-1').className).toContain('animate-pulse');
    expect(screen.getByTestId('completed-badge-shot-2')).toBeInTheDocument();
  });
});
