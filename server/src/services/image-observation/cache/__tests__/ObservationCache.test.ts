import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageObservation } from '@services/image-observation/types';

const { cacheGetMock, cacheSetMock } = vi.hoisted(() => ({
  cacheGetMock: vi.fn(),
  cacheSetMock: vi.fn(),
}));


import { ObservationCache } from '../ObservationCache';

const buildObservation = (): ImageObservation => ({
  imageHash: 'hash-1',
  observedAt: new Date('2026-02-10T00:00:00.000Z'),
  subject: {
    type: 'person',
    description: 'runner',
    position: 'center',
    confidence: 0.8,
  },
  framing: {
    shotType: 'medium',
    angle: 'eye-level',
    confidence: 0.8,
  },
  lighting: {
    quality: 'natural',
    timeOfDay: 'day',
    confidence: 0.8,
  },
  motion: {
    recommended: ['static'],
    risky: [],
    risks: [],
  },
  confidence: 0.8,
});

describe('ObservationCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns memory hit without calling redis', async () => {
    const cache = new ObservationCache({ get: cacheGetMock, set: cacheSetMock } as never);
    const observation = buildObservation();
    await cache.set('hash-memory', observation);

    const result = await cache.get('hash-memory');

    expect(result).toEqual(observation);
    expect(cacheGetMock).not.toHaveBeenCalled();
  });

  it('returns null on cache miss when redis has no value', async () => {
    cacheGetMock.mockResolvedValueOnce(null);
    const cache = new ObservationCache({ get: cacheGetMock, set: cacheSetMock } as never);

    const result = await cache.get('hash-miss');

    expect(result).toBeNull();
    expect(cacheGetMock).toHaveBeenCalledWith('image-observation:hash-miss');
  });

  it('hydrates memory cache from redis hit', async () => {
    const observation = buildObservation();
    cacheGetMock.mockResolvedValueOnce(observation);
    const cache = new ObservationCache({ get: cacheGetMock, set: cacheSetMock } as never);

    const first = await cache.get('hash-redis-hit');
    const second = await cache.get('hash-redis-hit');

    expect(first).toEqual(observation);
    expect(second).toEqual(observation);
    expect(cacheGetMock).toHaveBeenCalledTimes(1);
    expect(cacheGetMock).toHaveBeenCalledWith('image-observation:hash-redis-hit');
  });

  it('swallows redis errors on get and set', async () => {
    cacheGetMock.mockRejectedValueOnce(new Error('redis unavailable'));
    cacheSetMock.mockRejectedValueOnce(new Error('redis unavailable'));
    const cache = new ObservationCache({ get: cacheGetMock, set: cacheSetMock } as never);
    const observation = buildObservation();

    await expect(cache.get('hash-error')).resolves.toBeNull();
    await expect(cache.set('hash-error', observation)).resolves.toBeUndefined();
  });
});
