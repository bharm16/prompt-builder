import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { metricsAuthMiddleware } from '../metricsAuth';

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ip: '127.0.0.1',
    path: '/metrics',
    id: 'req-1',
    ...overrides,
  } as Request;
}

function createResponse(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

describe('metricsAuthMiddleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.METRICS_TOKEN;
  });

  it('returns 401 when authorization header is missing', () => {
    const req = createRequest();
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    metricsAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when authorization header is not bearer format', () => {
    const req = createRequest({
      headers: { authorization: 'Token abc' } as Request['headers'],
    });
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    metricsAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when METRICS_TOKEN is not configured', () => {
    const req = createRequest({
      headers: { authorization: 'Bearer token' } as Request['headers'],
    });
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    metricsAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for token length mismatch', () => {
    process.env.METRICS_TOKEN = 'expected-token';
    const req = createRequest({
      headers: { authorization: 'Bearer short' } as Request['headers'],
    });
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    metricsAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 for token value mismatch with same length', () => {
    process.env.METRICS_TOKEN = 'expected-token';
    const req = createRequest({
      headers: { authorization: 'Bearer expected-tokeX' } as Request['headers'],
    });
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    metricsAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when bearer token is valid', () => {
    process.env.METRICS_TOKEN = 'expected-token';
    const req = createRequest({
      headers: { authorization: 'Bearer expected-token' } as Request['headers'],
    });
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    metricsAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
