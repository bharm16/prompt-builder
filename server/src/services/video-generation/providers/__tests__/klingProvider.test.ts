import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateKlingVideo } from '../klingProvider';

const makeJsonResponse = (payload: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(payload),
});

describe('generateKlingVideo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends image without image_tail when only startImage is provided', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          code: 0,
          data: { task_id: 'task-1', task_status: 'submitted' },
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          code: 0,
          data: {
            task_id: 'task-1',
            task_status: 'succeed',
            task_result: { videos: [{ id: 'video-1', url: 'https://example.com/out.mp4' }] },
          },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const log = { info: vi.fn(), warn: vi.fn() };
    const result = await generateKlingVideo(
      'api-key',
      'https://api.klingai.com',
      'prompt',
      'kling-v2-1-master',
      { startImage: 'https://images.example.com/start.png' },
      log
    );

    expect(result.url).toBe('https://example.com/out.mp4');
    const postInit = fetchMock.mock.calls[0]?.[1] as { body?: string };
    const body = JSON.parse(postInit.body || '{}') as Record<string, unknown>;
    expect(body.image).toBe('https://images.example.com/start.png');
    expect(body.image_tail).toBeUndefined();
  });

  it('sends both image and image_tail when startImage and endImage are provided', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          code: 0,
          data: { task_id: 'task-2', task_status: 'submitted' },
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          code: 0,
          data: {
            task_id: 'task-2',
            task_status: 'succeed',
            task_result: { videos: [{ id: 'video-2', url: 'https://example.com/out-2.mp4' }] },
          },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const log = { info: vi.fn(), warn: vi.fn() };
    const result = await generateKlingVideo(
      'api-key',
      'https://api.klingai.com',
      'prompt',
      'kling-v2-1-master',
      {
        startImage: 'https://images.example.com/start.png',
        endImage: 'https://images.example.com/end.png',
      },
      log
    );

    expect(result.url).toBe('https://example.com/out-2.mp4');
    const postInit = fetchMock.mock.calls[0]?.[1] as { body?: string };
    const body = JSON.parse(postInit.body || '{}') as Record<string, unknown>;
    expect(body.image).toBe('https://images.example.com/start.png');
    expect(body.image_tail).toBe('https://images.example.com/end.png');
  });

  it('routes endImage-without-startImage through text2video path and ignores endImage', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          code: 0,
          data: {
            task_id: 'task-3',
            task_status: 'submitted',
            task_info: { external_task_id: 'ext-1' },
          },
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          code: 0,
          data: {
            task_id: 'task-3',
            task_status: 'succeed',
            task_result: { videos: [{ id: 'video-3', url: 'https://example.com/out-3.mp4' }] },
          },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const log = { info: vi.fn(), warn: vi.fn() };
    const result = await generateKlingVideo(
      'api-key',
      'https://api.klingai.com',
      'prompt',
      'kling-v2-1-master',
      {
        endImage: 'https://images.example.com/end.png',
      },
      log
    );

    expect(result.url).toBe('https://example.com/out-3.mp4');
    const firstRequestUrl = String(fetchMock.mock.calls[0]?.[0] || '');
    expect(firstRequestUrl).toContain('/v1/videos/text2video');

    const postInit = fetchMock.mock.calls[0]?.[1] as { body?: string };
    const body = JSON.parse(postInit.body || '{}') as Record<string, unknown>;
    expect(body.image).toBeUndefined();
    expect(body.image_tail).toBeUndefined();
  });

  // ── Aspect Ratio Transparency Tests ──────────────────────────────

  it('regression: kling 21:9 fallback returns resolvedAspectRatio 16:9', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          code: 0,
          data: {
            task_id: 'task-ar',
            task_status: 'submitted',
            task_info: { external_task_id: 'ext-ar' },
          },
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          code: 0,
          data: {
            task_id: 'task-ar',
            task_status: 'succeed',
            task_result: { videos: [{ id: 'v-ar', url: 'https://example.com/ar.mp4' }] },
          },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const log = { info: vi.fn(), warn: vi.fn() };
    const result = await generateKlingVideo(
      'api-key',
      'https://api.klingai.com',
      'cinematic sunset',
      'kling-v2-1-master',
      { aspectRatio: '21:9' },
      log
    );

    expect(result.url).toBe('https://example.com/ar.mp4');
    expect(result.resolvedAspectRatio).toBe('16:9');
    expect(log.warn).toHaveBeenCalledWith(
      'Kling does not support 21:9; using 16:9 instead',
      expect.objectContaining({ aspectRatio: '21:9' })
    );
  });

  it('returns resolvedAspectRatio matching requested when no fallback needed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          code: 0,
          data: {
            task_id: 'task-169',
            task_status: 'submitted',
            task_info: { external_task_id: 'ext-169' },
          },
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          code: 0,
          data: {
            task_id: 'task-169',
            task_status: 'succeed',
            task_result: { videos: [{ id: 'v-169', url: 'https://example.com/169.mp4' }] },
          },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const log = { info: vi.fn(), warn: vi.fn() };
    const result = await generateKlingVideo(
      'api-key',
      'https://api.klingai.com',
      'cinematic sunset',
      'kling-v2-1-master',
      { aspectRatio: '16:9' },
      log
    );

    expect(result.url).toBe('https://example.com/169.mp4');
    expect(result.resolvedAspectRatio).toBe('16:9');
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('omits resolvedAspectRatio when no aspect ratio is requested', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          code: 0,
          data: {
            task_id: 'task-none',
            task_status: 'submitted',
            task_info: { external_task_id: 'ext-none' },
          },
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          code: 0,
          data: {
            task_id: 'task-none',
            task_status: 'succeed',
            task_result: { videos: [{ id: 'v-none', url: 'https://example.com/none.mp4' }] },
          },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const log = { info: vi.fn(), warn: vi.fn() };
    const result = await generateKlingVideo(
      'api-key',
      'https://api.klingai.com',
      'cinematic sunset',
      'kling-v2-1-master',
      {},
      log
    );

    expect(result.url).toBe('https://example.com/none.mp4');
    expect(result.resolvedAspectRatio).toBeUndefined();
  });
});
