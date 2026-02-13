import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { SessionDto } from '@shared/types/session';
import type { ContinuitySession, ContinuityShot } from '@/features/continuity/types';
import { WorkspaceSessionProvider, useWorkspaceSession } from '../WorkspaceSessionContext';

const mockApiGet = vi.hoisted(() => vi.fn());
const mockCreateSession = vi.hoisted(() => vi.fn());
const mockCreateSceneProxy = vi.hoisted(() => vi.fn());
const mockPreviewSceneProxy = vi.hoisted(() => vi.fn());
const mockAddShot = vi.hoisted(() => vi.fn());

vi.mock('@/services/ApiClient', () => ({
  apiClient: {
    get: mockApiGet,
  },
}));

vi.mock('@/features/continuity/api/continuityApi', () => ({
  continuityApi: {
    createSession: mockCreateSession,
    createSceneProxy: mockCreateSceneProxy,
    previewSceneProxy: mockPreviewSceneProxy,
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
  id: 'continuity-1',
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

const buildContinuitySessionWithProxy = (): ContinuitySession => ({
  ...buildContinuitySession(),
  sceneProxy: {
    id: 'scene-proxy-1',
    proxyType: 'depth-and-style',
    referenceFrameUrl: 'https://example.com/proxy-reference.png',
    status: 'ready',
    createdAt: '2026-02-12T00:00:00.000Z',
  },
  defaultSettings: {
    ...buildContinuitySession().defaultSettings,
    useSceneProxy: true,
  },
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

const wrapperWithoutSession =
  ({ children }: { children: ReactNode }) => <WorkspaceSessionProvider>{children}</WorkspaceSessionProvider>;

describe('WorkspaceSessionContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({ data: buildSession() });
    mockCreateSession.mockResolvedValue(buildContinuitySession());
    mockCreateSceneProxy.mockResolvedValue(buildContinuitySessionWithProxy());
    mockPreviewSceneProxy.mockResolvedValue({
      ...buildShot(),
      sceneProxyRenderUrl: 'https://example.com/preview.png',
      continuityMechanismUsed: 'scene-proxy',
    });
    mockAddShot.mockResolvedValue(buildShot());
  });

  it('uses the existing project prompt when starting sequence without an explicit prompt', async () => {
    const { result } = renderHook(() => useWorkspaceSession(), { wrapper });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/v2/sessions/session-1');
    });
    await waitFor(() => {
      expect(result.current.session?.id).toBe('session-1');
    });

    let sequenceResult: Awaited<ReturnType<typeof result.current.startSequence>> | null = null;
    await act(async () => {
      sequenceResult = await result.current.startSequence({
        sourceVideoId: 'users/user-1/generations/video.mp4',
      });
    });

    expect(mockCreateSession).toHaveBeenCalledWith({
      name: 'Session',
      sourceVideoId: 'users/user-1/generations/video.mp4',
    });
    expect(mockCreateSceneProxy).toHaveBeenCalledWith('continuity-1', {
      sourceVideoId: 'users/user-1/generations/video.mp4',
    });
    expect(mockAddShot).toHaveBeenCalledWith('continuity-1', {
      prompt: 'Keep this prompt',
      sourceVideoId: 'users/user-1/generations/video.mp4',
    });
    expect(sequenceResult).toMatchObject({ sessionId: 'continuity-1' });
  });

  it('forwards source image URL when starting a sequence', async () => {
    const { result } = renderHook(() => useWorkspaceSession(), { wrapper });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/v2/sessions/session-1');
    });
    await waitFor(() => {
      expect(result.current.session?.id).toBe('session-1');
    });

    await act(async () => {
      await result.current.startSequence({
        sourceVideoId: 'users/user-1/generations/video.mp4',
        sourceImageUrl: 'https://example.com/thumb.png',
      });
    });

    expect(mockCreateSession).toHaveBeenCalledWith({
      name: 'Session',
      sourceVideoId: 'users/user-1/generations/video.mp4',
      sourceImageUrl: 'https://example.com/thumb.png',
    });
    expect(mockCreateSceneProxy).toHaveBeenCalledWith('continuity-1', {
      sourceVideoId: 'users/user-1/generations/video.mp4',
    });
  });

  it('starts sequence from originSessionId when route has no active session', async () => {
    const { result } = renderHook(() => useWorkspaceSession(), { wrapper: wrapperWithoutSession });

    let sequenceResult: Awaited<ReturnType<typeof result.current.startSequence>> | null = null;
    await act(async () => {
      sequenceResult = await result.current.startSequence({
        sourceVideoId: 'users/user-1/generations/video.mp4',
        prompt: 'Continue the scene',
        originSessionId: 'source-session-1',
      });
    });

    expect(mockApiGet).not.toHaveBeenCalled();
    expect(mockCreateSession).toHaveBeenCalledWith({
      name: 'Continuity Session',
      sourceVideoId: 'users/user-1/generations/video.mp4',
    });
    expect(mockCreateSceneProxy).toHaveBeenCalledWith('continuity-1', {
      sourceVideoId: 'users/user-1/generations/video.mp4',
    });
    expect(mockAddShot).toHaveBeenCalledWith('continuity-1', {
      prompt: 'Continue the scene',
      sourceVideoId: 'users/user-1/generations/video.mp4',
    });
    expect(sequenceResult).toMatchObject({ sessionId: 'continuity-1' });
  });

  it('starts sequence without route session by creating a new continuity session', async () => {
    const { result } = renderHook(() => useWorkspaceSession(), { wrapper: wrapperWithoutSession });

    let sequenceResult: Awaited<ReturnType<typeof result.current.startSequence>> | null = null;
    await act(async () => {
      sequenceResult = await result.current.startSequence({
        sourceVideoId: 'users/user-1/generations/video.mp4',
        prompt: 'Continue from this clip',
      });
    });

    expect(mockApiGet).not.toHaveBeenCalled();
    expect(mockCreateSession).toHaveBeenCalledWith({
      name: 'Continuity Session',
      sourceVideoId: 'users/user-1/generations/video.mp4',
    });
    expect(mockCreateSceneProxy).toHaveBeenCalledWith('continuity-1', {
      sourceVideoId: 'users/user-1/generations/video.mp4',
    });
    expect(mockAddShot).toHaveBeenCalledWith('continuity-1', {
      prompt: 'Continue from this clip',
      sourceVideoId: 'users/user-1/generations/video.mp4',
    });
    expect(sequenceResult).toMatchObject({ sessionId: 'continuity-1' });
  });

  it('does not force sequence mode or reuse continuity on mixed prompt+continuity sessions', async () => {
    const mixedShot = buildShot();
    mockApiGet.mockResolvedValue({
      data: buildSession({
        continuity: {
          shots: [mixedShot],
          primaryStyleReference: null,
          sceneProxy: null,
          settings: {
            generationMode: 'continuity',
            defaultContinuityMode: 'frame-bridge',
            defaultStyleStrength: 0.6,
            defaultModel: 'model-1',
            autoExtractFrameBridge: false,
            useCharacterConsistency: false,
          },
        },
      }),
    });

    const { result } = renderHook(() => useWorkspaceSession(), { wrapper });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/v2/sessions/session-1');
    });
    await waitFor(() => {
      expect(result.current.session?.id).toBe('session-1');
    });
    expect(result.current.isSequenceMode).toBe(false);

    let sequenceResult: Awaited<ReturnType<typeof result.current.startSequence>> | null = null;
    await act(async () => {
      sequenceResult = await result.current.startSequence({
        sourceVideoId: 'users/user-1/generations/video.mp4',
      });
    });

    expect(mockCreateSession).toHaveBeenCalledWith({
      name: 'Session',
      sourceVideoId: 'users/user-1/generations/video.mp4',
    });
    expect(mockCreateSceneProxy).toHaveBeenCalledWith('continuity-1', {
      sourceVideoId: 'users/user-1/generations/video.mp4',
    });
    expect(mockAddShot).toHaveBeenCalledWith('continuity-1', {
      prompt: 'Keep this prompt',
      sourceVideoId: 'users/user-1/generations/video.mp4',
    });
    expect(sequenceResult).toMatchObject({ sessionId: 'continuity-1' });
  });

  it('ignores stale session responses when route session id changes', async () => {
    let resolveSession1: ((value: unknown) => void) | null = null;
    let resolveSession2: ((value: unknown) => void) | null = null;
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/v2/sessions/session-1') {
        return new Promise((resolve) => {
          resolveSession1 = resolve;
        });
      }
      if (url === '/v2/sessions/session-2') {
        return new Promise((resolve) => {
          resolveSession2 = resolve;
        });
      }
      return Promise.resolve({ data: null });
    });

    let activeSessionId = 'session-1';
    const dynamicWrapper = ({ children }: { children: ReactNode }) => (
      <WorkspaceSessionProvider sessionId={activeSessionId}>{children}</WorkspaceSessionProvider>
    );

    const { result, rerender } = renderHook(() => useWorkspaceSession(), {
      wrapper: dynamicWrapper,
    });

    activeSessionId = 'session-2';
    rerender();

    await act(async () => {
      resolveSession2?.({
        data: buildSession({
          id: 'session-2',
          name: 'Second Session',
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.session?.id).toBe('session-2');
    });

    await act(async () => {
      resolveSession1?.({
        data: buildSession({
          id: 'session-1',
          name: 'First Session',
          prompt: undefined,
          continuity: {
            shots: [buildShot()],
            primaryStyleReference: null,
            sceneProxy: null,
            settings: {
              generationMode: 'continuity',
              defaultContinuityMode: 'frame-bridge',
              defaultStyleStrength: 0.6,
              defaultModel: 'model-1',
              autoExtractFrameBridge: false,
              useCharacterConsistency: false,
            },
          },
        }),
      });
    });

    await waitFor(() => {
      expect(result.current.session?.id).toBe('session-2');
      expect(result.current.isSequenceMode).toBe(false);
    });
  });

  it('allows manual scene proxy creation in active continuity session', async () => {
    const shot = buildShot();
    mockApiGet.mockResolvedValue({
      data: buildSession({
        prompt: undefined,
        continuity: {
          shots: [shot],
          primaryStyleReference: null,
          sceneProxy: null,
          settings: {
            generationMode: 'continuity',
            defaultContinuityMode: 'frame-bridge',
            defaultStyleStrength: 0.6,
            defaultModel: 'model-1',
            autoExtractFrameBridge: false,
            useCharacterConsistency: false,
          },
        },
      }),
    });

    const { result } = renderHook(() => useWorkspaceSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.session?.id).toBe('session-1');
    });

    await act(async () => {
      await result.current.createSceneProxy();
    });

    expect(mockCreateSceneProxy).toHaveBeenCalledWith('session-1', {
      sourceShotId: 'shot-1',
      sourceVideoId: 'users/user-1/generations/video.mp4',
    });
  });

  it('previews scene proxy and updates shot state', async () => {
    const shot = buildShot();
    mockApiGet.mockResolvedValue({
      data: buildSession({
        prompt: undefined,
        continuity: {
          shots: [shot],
          primaryStyleReference: null,
          sceneProxy: {
            id: 'proxy-1',
            proxyType: 'depth-and-style',
            referenceFrameUrl: 'https://example.com/proxy-reference.png',
            status: 'ready',
            createdAt: '2026-02-12T00:00:00.000Z',
          },
          settings: {
            generationMode: 'continuity',
            defaultContinuityMode: 'style-match',
            defaultStyleStrength: 0.6,
            defaultModel: 'model-1',
            autoExtractFrameBridge: false,
            useCharacterConsistency: false,
            useSceneProxy: true,
          },
        },
      }),
    });

    const { result } = renderHook(() => useWorkspaceSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.session?.id).toBe('session-1');
    });

    await act(async () => {
      await result.current.previewSceneProxy('shot-1', { yaw: 0.15, pitch: -0.2, roll: 0, dolly: -1 });
    });

    expect(mockPreviewSceneProxy).toHaveBeenCalledWith('session-1', 'shot-1', {
      camera: { yaw: 0.15, pitch: -0.2, roll: 0, dolly: -1 },
    });
    await waitFor(() => {
      expect(result.current.shots[0]?.sceneProxyRenderUrl).toBe('https://example.com/preview.png');
      expect(result.current.shots[0]?.continuityMechanismUsed).toBe('scene-proxy');
    });
  });
});
