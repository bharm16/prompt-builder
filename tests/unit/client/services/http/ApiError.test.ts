import { describe, it, expect } from 'vitest';
import { ApiError } from '../../../../../client/src/services/http/ApiError';
import { ApiErrorFactory } from '../../../../../client/src/services/http/ApiErrorFactory';

describe('ApiError', () => {
  it('classifies status ranges', () => {
    const clientErr = new ApiError('Bad request', 400);
    const serverErr = new ApiError('Server error', 500);
    const networkErr = new ApiError('Network');

    expect(clientErr.isClientError()).toBe(true);
    expect(clientErr.isServerError()).toBe(false);
    expect(networkErr.isNetworkError()).toBe(true);
    expect(serverErr.isServerError()).toBe(true);
  });

  it('checks convenience helpers', () => {
    expect(new ApiError('unauth', 401).isUnauthorized()).toBe(true);
    expect(new ApiError('not found', 404).isNotFound()).toBe(true);
    expect(new ApiError('rate limited', 429).isRateLimited()).toBe(true);
  });
});

describe('ApiErrorFactory', () => {
  const factory = new ApiErrorFactory();

  it('creates network/timeouts with undefined status', () => {
    const timeout = factory.createTimeout();
    const network = factory.createNetwork({});

    expect(timeout.status).toBeUndefined();
    expect(timeout.isNetworkError()).toBe(true);
    expect(network.status).toBeUndefined();
    expect(network.isNetworkError()).toBe(true);
  });

  it('preserves provided status and response', () => {
    const error = factory.create({ message: 'Oops', status: 418, response: { a: 1 } });
    expect(error.status).toBe(418);
    expect(error.response).toEqual({ a: 1 });
  });
});
