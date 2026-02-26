import crypto from 'node:crypto';
import { logger } from '@infrastructure/Logger';

const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60;
const CONTENT_PATH_PREFIX = '/api/preview/video/content';

export interface VideoContentTokenPayload {
  assetId: string;
  userId?: string;
  expiresAtMs: number;
}

interface VideoContentAccessOptions {
  secret: string;
  ttlMs: number;
}

interface IssueTokenParams {
  assetId: string;
  userId?: string;
  ttlMs?: number;
}

export class VideoContentAccessService {
  private readonly secret: string;
  private readonly ttlMs: number;

  constructor(options: VideoContentAccessOptions) {
    this.secret = options.secret;
    this.ttlMs = options.ttlMs;
  }

  issueToken({ assetId, userId, ttlMs }: IssueTokenParams): string {
    const payload = {
      assetId,
      userId,
      expiresAtMs: Date.now() + (ttlMs ?? this.ttlMs),
      version: 1,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.sign(encoded);
    return `${encoded}.${signature}`;
  }

  verifyToken(token: string, assetId: string): VideoContentTokenPayload | null {
    const parts = token.split('.');
    if (parts.length !== 2) {
      return null;
    }

    const [encoded, signature] = parts;
    if (!encoded || !signature) {
      return null;
    }
    const expected = this.sign(encoded);
    if (!this.timingSafeEqual(signature, expected)) {
      return null;
    }

    let parsed: VideoContentTokenPayload & { version?: number };
    try {
      parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as VideoContentTokenPayload & {
        version?: number;
      };
    } catch {
      return null;
    }

    if (parsed.assetId !== assetId) {
      return null;
    }

    if (!Number.isFinite(parsed.expiresAtMs) || parsed.expiresAtMs <= Date.now()) {
      return null;
    }

    return {
      assetId: parsed.assetId,
      ...(parsed.userId ? { userId: parsed.userId } : {}),
      expiresAtMs: parsed.expiresAtMs,
    };
  }

  buildAccessUrl(url: string, assetId: string, userId?: string): string {
    if (!this.isLocalContentUrl(url)) {
      return url;
    }

    const token = this.issueToken({
      assetId,
      ...(userId ? { userId } : {}),
    });
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(token)}`;
  }

  private isLocalContentUrl(url: string): boolean {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        const parsed = new URL(url);
        return parsed.pathname.startsWith(CONTENT_PATH_PREFIX);
      } catch {
        return false;
      }
    }

    return url.startsWith(CONTENT_PATH_PREFIX);
  }

  private sign(value: string): string {
    return crypto.createHmac('sha256', this.secret).update(value).digest('base64url');
  }

  private timingSafeEqual(a: string, b: string): boolean {
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);
    if (aBuffer.length !== bBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(aBuffer, bBuffer);
  }
}

interface AccessConfig {
  tokenSecret: string | undefined;
  tokenTtlSeconds: number;
}

export function createVideoContentAccessService(config: AccessConfig): VideoContentAccessService | null {
  const ttlMs = config.tokenTtlSeconds * 1000;

  if (config.tokenSecret && config.tokenSecret.trim().length > 0) {
    return new VideoContentAccessService({ secret: config.tokenSecret, ttlMs });
  }

  if (process.env.NODE_ENV === 'production') {
    logger.error('VIDEO_CONTENT_TOKEN_SECRET is required in production for secure video access');
    return null;
  }

  const ephemeralSecret = crypto.randomBytes(32).toString('hex');
  logger.warn('VIDEO_CONTENT_TOKEN_SECRET not set; using ephemeral key for development');
  return new VideoContentAccessService({ secret: ephemeralSecret, ttlMs });
}
