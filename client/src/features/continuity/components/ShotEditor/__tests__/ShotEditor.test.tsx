import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ShotEditor } from '../ShotEditor';
import type { ContinuitySession } from '../../../types';

vi.mock('@/hooks/useModelRegistry', () => ({
  useModelRegistry: () => ({
    models: [{ id: 'model-1', label: 'Model 1', provider: 'replicate' }],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/services', async () => {
  const actual = await vi.importActual<typeof import('@/services')>('@/services');
  return {
    ...actual,
    capabilitiesApi: {
      getRegistry: vi.fn().mockResolvedValue({}),
      getVideoAvailability: vi.fn().mockResolvedValue({ availableModels: [], availableCapabilityModels: [] }),
      getCapabilities: vi.fn(),
      listProviders: vi.fn(),
      listModels: vi.fn(),
    },
  };
});

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

describe('ShotEditor', () => {
  it('shows standard mode controls when generationMode is standard', async () => {
    const session = buildSession();
    await act(async () => {
      render(<ShotEditor session={session} generationMode="standard" onAddShot={vi.fn()} />);
    });
    expect(
      screen.getByText('Use previous shot as reference (best effort)')
    ).toBeInTheDocument();
  });

  it('shows continuity mode controls when generationMode is continuity', async () => {
    const session = buildSession();
    await act(async () => {
      render(<ShotEditor session={session} generationMode="continuity" onAddShot={vi.fn()} />);
    });
    expect(screen.getAllByText('Continuity mode').length).toBeGreaterThan(0);
    expect(screen.getByText('Style source')).toBeInTheDocument();
  });
});
