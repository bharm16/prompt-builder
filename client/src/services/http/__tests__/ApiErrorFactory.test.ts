import { describe, expect, it } from 'vitest';
import { ApiError } from '../ApiError';
import { ApiErrorFactory } from '../ApiErrorFactory';

describe('ApiErrorFactory', () => {
  it('create builds ApiError with status and response', () => {
    const factory = new ApiErrorFactory();

    const error = factory.create({
      message: 'Bad Request',
      status: 400,
      response: { reason: 'invalid input' },
    });

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Bad Request');
    expect(error.status).toBe(400);
    expect(error.response).toEqual({ reason: 'invalid input' });
  });

  it('create omits nullable status/response by default', () => {
    const factory = new ApiErrorFactory();

    const error = factory.create({ message: 'Network down' });

    expect(error.status).toBeUndefined();
    expect(error.response).toBeNull();
  });

  it('createTimeout uses default message', () => {
    const factory = new ApiErrorFactory();

    const error = factory.createTimeout();

    expect(error.message).toBe('Request timeout');
    expect(error.status).toBeUndefined();
  });

  it('createTimeout accepts custom message', () => {
    const factory = new ApiErrorFactory();

    const error = factory.createTimeout('Request aborted');

    expect(error.message).toBe('Request aborted');
  });

  it('createNetwork uses error.message when available', () => {
    const factory = new ApiErrorFactory();

    const error = factory.createNetwork(new Error('ECONNRESET'));

    expect(error.message).toBe('ECONNRESET');
  });

  it('createNetwork falls back to generic network message', () => {
    const factory = new ApiErrorFactory();

    const error = factory.createNetwork({ code: 10 });

    expect(error.message).toBe('Network error');
  });
});
