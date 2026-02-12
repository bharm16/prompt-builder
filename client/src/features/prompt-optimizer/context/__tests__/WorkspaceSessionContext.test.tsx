import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { SessionDto } from '@shared/types/session';
import type { ContinuitySession, ContinuityShot } from '@/features/continuity/types';
import { WorkspaceSessionProvider, useWorkspaceSession } from '../WorkspaceSessionContext';

const mockApiGet = vi.hoisted(() => vi.fn());
const mockCreateSession = vi.hoisted(() => vi.fn());
const mockAddShot = vi.hoisted(() => vi.fn());

vi.mock('@/services/ApiClient', () => ({
  apiClient: {
    get: mockApiGet,
  },
}));

vi.mock('@/features/continuity/api/continuityApi', () => ({
  continuityApi: {
    createSession: mockCreateSession,
    addShot: mockAddShot,
    updateShot: vi.fn(),
    updateShotStyleReference: vi.fn(),
    generateShot: vi.fn(),
  },
}));

const buildSession = (overrides: Partial<SessionDto> = {}): SessionDto => ({
  id: 'session-1',
  userId: 'user-1',
  name: 'Session',
  status: 'active',
  createdAt: '2026-02-12T00:00:00.000Z',
  updatedAt: '2026-02-12T00:00:00.000Z',
  prompt: {
    input: 'Keep this prompt',
    output: 'Generated output',
  },
  ...overrides,
});

const buildContinuitySession = (): ContinuitySession => ({
  id: 'session-1',
  userId: 'user-1',
  name: 'Continuity Session',
  primaryStyleReference: null,
  shots: [],
  defaultSettings: {
    generationMode: 'continuity',
    defaultContinuityMode: 'frame-bridge',
    defaultStyleStrength: 0.6,
    defaultModel: 'model-1',
    autoExtractFrameBridge: false,
    useCharacterConsistency: false,
  },
  status: 'active',
  createdAt: '2026-02-12T00:00:00.000Z',
  updatedAt: '2026-02-12T00:00:00.000Z',
});

const buildShot = (): ContinuityShot => ({
  id: 'shot-1',
  sessionId: 'session-1',
  sequenceIndex: 0,
  userPrompt: 'Keep this prompt',
  continuityMode: 'frame-bridge',
  styleStrength: 0.6,
  styleReferenceId: null,
  modelId: 'model-1',
  status: 'completed',
  createdAt: '2026-02-12T00:00:01.000Z',
  generatedAt: '2026-02-12T00:00:02.000Z',
  videoAssetId: 'users/user-1/generations/video.mp4',
});

const wrapper =
  ({ children }: { children: ReactNode }) => (
    <WorkspaceSessionProvider sessionId="session-1">{children}</WorkspaceSessionProvider>
  );

describe('WorkspaceSessionContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({ data: buildSession() });
    mockCreateSession.mockResolvedValue(buildContinuitySession());
    mockAddShot.mockResolvedValue(buildShot());
  });

  it('uses the existing project prompt when starting sequence without an explicit prompt', async () => {
    const { result } = renderHook(() => useWorkspaceSession(), { wrapper });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/v2/sessions/session-1');
    });

    await act(async () => {
      await result.current.startSequence({
        sourceVideoId: 'users/user-1/generations/video.mp4',
      });
    });

    expect(mockCreateSession).toHaveBeenCalledWith({
      sessionId: 'session-1',
      name: 'Session',
      sourceVideoId: 'users/user-1/generations/video.mp4',
    });
    expect(mockAddShot).toHaveBeenCalledWith('session-1', {
      prompt: 'Keep this prompt',
      sourceVideoId: 'users/user-1/generations/video.mp4',
    });
  });
});
