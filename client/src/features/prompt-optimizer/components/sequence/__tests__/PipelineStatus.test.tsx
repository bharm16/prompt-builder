import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { PipelineStatus } from '../PipelineStatus';
import type { ContinuityShot } from '@/features/continuity/types';

const baseShot = (overrides: Partial<ContinuityShot>): ContinuityShot => ({
  id: 'shot-1',
  sessionId: 'session-1',
  sequenceIndex: 0,
  userPrompt: 'Prompt',
  continuityMode: 'frame-bridge',
  styleStrength: 0.6,
  styleReferenceId: null,
  modelId: 'model-1',
  status: 'draft',
  createdAt: '2026-02-12T00:00:00.000Z',
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PipelineStatus', () => {
  it('shows indeterminate generation status with elapsed time', () => {
    vi.useFakeTimers();

    render(<PipelineStatus shot={baseShot({ status: 'generating-video' })} isGenerating />);

    expect(screen.getByText('Generating shot...')).toBeInTheDocument();
    expect(screen.getByText('00:00')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(65_000);
    });

    expect(screen.getByText('01:05')).toBeInTheDocument();
  });

  it('renders completed and failed outcomes from real shot status', () => {
    const { rerender } = render(
      <PipelineStatus
        shot={baseShot({
          status: 'completed',
          continuityMechanismUsed: 'frame-bridge-keyframe',
          styleScore: 84,
        })}
        isGenerating={false}
      />
    );

    expect(screen.getByText('Connected via frame bridge')).toBeInTheDocument();
    expect(screen.getByText('Style: 84%')).toBeInTheDocument();

    rerender(
      <PipelineStatus
        shot={baseShot({
          status: 'failed',
          error: 'Generation failed hard',
          styleDegraded: true,
          styleDegradedReason: 'Style consistency dropped below threshold',
        })}
        isGenerating={false}
      />
    );

    expect(screen.getByText('Generation failed hard')).toBeInTheDocument();
    expect(screen.getByText('Style consistency dropped below threshold')).toBeInTheDocument();
  });

  it('shows scene proxy completion copy when mechanism is scene-proxy', () => {
    render(
      <PipelineStatus
        shot={baseShot({
          status: 'completed',
          continuityMechanismUsed: 'scene-proxy',
        })}
        isGenerating={false}
      />
    );

    expect(screen.getByText('Scene proxy continuity applied')).toBeInTheDocument();
  });

  it('returns null for idle draft state', () => {
    const { container } = render(<PipelineStatus shot={baseShot({ status: 'draft' })} isGenerating={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
