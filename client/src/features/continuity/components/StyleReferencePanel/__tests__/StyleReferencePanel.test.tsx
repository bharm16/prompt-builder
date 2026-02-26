import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StyleReferencePanel } from '../StyleReferencePanel';
import type { ContinuitySession, ContinuityShot } from '../../../types';

const buildSession = (): ContinuitySession => ({
  id: 'session-1',
  userId: 'user-1',
  name: 'Test Session',
  primaryStyleReference: {
    id: 'ref-1',
    frameUrl: 'https://example.com/ref.png',
    frameTimestamp: 0,
    resolution: { width: 1920, height: 1080 },
    aspectRatio: '16:9',
    analysisMetadata: {
      dominantColors: ['#111111'],
      lightingDescription: 'Soft light',
      moodDescription: 'Calm',
      confidence: 0.8,
    },
  },
  shots: [],
  defaultSettings: {
    generationMode: 'continuity',
    defaultContinuityMode: 'frame-bridge',
    defaultStyleStrength: 0.6,
    defaultModel: 'model-1',
    autoExtractFrameBridge: true,
    useCharacterConsistency: false,
  },
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const buildShot = (): ContinuityShot => ({
  id: 'shot-1',
  sessionId: 'session-1',
  sequenceIndex: 0,
  userPrompt: 'A test prompt',
  continuityMode: 'frame-bridge',
  styleStrength: 0.6,
  styleReferenceId: null,
  modelId: 'model-1',
  status: 'draft',
  createdAt: new Date().toISOString(),
});

describe('StyleReferencePanel', () => {
  it('renders the primary style reference and metadata', () => {
    const session = buildSession();
    const shot = buildShot();
    render(
      <StyleReferencePanel
        session={{ ...session, shots: [shot] }}
        selectedShot={shot}
        onUpdateShotStyleReference={vi.fn()}
      />
    );

    expect(screen.getByAltText('Style reference')).toBeInTheDocument();
    expect(screen.getByText('Lighting: Soft light')).toBeInTheDocument();
    expect(screen.getByText('Mood: Calm')).toBeInTheDocument();
    expect(screen.getByText('Style source for selected shot')).toBeInTheDocument();
  });
});
