import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock(
  '@infrastructure/Logger',
  () => ({
    logger: {
      error: mocks.loggerError,
      warn: mocks.loggerWarn,
    },
  })
);
import {
  VideoContentAccessService,
  createVideoContentAccessService,
} from '../VideoContentAccessService';

describe('VideoContentAccessService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('issues and verifies a valid token payload', () => {
    const service = new VideoContentAccessService({
      secret: 'test-secret',
      ttlMs: 5_000,
    });

    const token = service.issueToken({ assetId: 'asset-1', userId: 'user-1' });
    const payload = service.verifyToken(token, 'asset-1');

    expect(payload).toMatchObject({
      assetId: 'asset-1',
      userId: 'user-1',
    });
    expect((payload?.expiresAtMs ?? 0) > Date.now()).toBe(true);
  });

  it('rejects malformed, tampered, mismatched, and expired tokens', () => {
    const service = new VideoContentAccessService({
      secret: 'test-secret',
      ttlMs: 5_000,
    });
    const token = service.issueToken({ assetId: 'asset-1' });
    const tampered = `${token}x`;
    const expired = service.issueToken({ assetId: 'asset-1', ttlMs: -1 });

    expect(service.verifyToken('invalid-token', 'asset-1')).toBeNull();
    expect(service.verifyToken(tampered, 'asset-1')).toBeNull();
    expect(service.verifyToken(token, 'asset-2')).toBeNull();
    expect(service.verifyToken(expired, 'asset-1')).toBeNull();
  });

  it('appends access token only for local video content URLs', () => {
    const service = new VideoContentAccessService({
      secret: 'test-secret',
      ttlMs: 5_000,
    });

    const localUrl = service.buildAccessUrl('/api/preview/video/content/asset-1', 'asset-1', 'user-1');
    const externalUrl = service.buildAccessUrl('https://cdn.example.com/video.mp4', 'asset-1', 'user-1');

    expect(localUrl).toContain('/api/preview/video/content/asset-1?token=');
    expect(externalUrl).toBe('https://cdn.example.com/video.mp4');
  });

  it('creates service from explicit secret config', () => {
    process.env.VIDEO_CONTENT_TOKEN_SECRET = 'configured-secret';
    process.env.VIDEO_CONTENT_TOKEN_TTL_SECONDS = '120';
    process.env.NODE_ENV = 'production';

    const service = createVideoContentAccessService();

    expect(service).not.toBeNull();
    const token = service?.issueToken({ assetId: 'asset-1' });
    expect(token).toBeTypeOf('string');
  });

  it('returns null in production when no secret is configured', () => {
    delete process.env.VIDEO_CONTENT_TOKEN_SECRET;
    process.env.NODE_ENV = 'production';

    const service = createVideoContentAccessService();
    expect(service).toBeNull();
  });

  it('returns ephemeral service outside production when secret is missing', () => {
    delete process.env.VIDEO_CONTENT_TOKEN_SECRET;
    process.env.NODE_ENV = 'test';

    const service = createVideoContentAccessService();
    expect(service).not.toBeNull();

    const token = service?.issueToken({ assetId: 'asset-1' });
    expect(service?.verifyToken(token as string, 'asset-1')).not.toBeNull();
  });
});
