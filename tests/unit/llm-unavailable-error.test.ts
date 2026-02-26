import { describe, it, expect } from 'vitest';
import { LLMUnavailableError } from '@services/ai-model/LLMUnavailableError';
import { isDomainError } from '@server/errors/DomainError';

describe('LLMUnavailableError', () => {
  it('has error code LLM_UNAVAILABLE', () => {
    const error = new LLMUnavailableError('No providers');

    expect(error.code).toBe('LLM_UNAVAILABLE');
  });

  it('returns HTTP 503 status', () => {
    const error = new LLMUnavailableError('No providers');

    expect(error.getHttpStatus()).toBe(503);
  });

  it('returns a user-friendly message', () => {
    const error = new LLMUnavailableError('Internal: no OpenAI key');

    expect(error.getUserMessage()).toBe(
      'AI services are temporarily unavailable. Please try again in a moment.'
    );
  });

  it('is recognized as a DomainError', () => {
    const error = new LLMUnavailableError('test');

    expect(isDomainError(error)).toBe(true);
  });

  it('serializes to structured JSON with code and user-safe message', () => {
    const error = new LLMUnavailableError('raw internal detail');
    const json = error.toJSON();

    expect(json).toEqual({
      name: 'LLMUnavailableError',
      code: 'LLM_UNAVAILABLE',
      message: 'AI services are temporarily unavailable. Please try again in a moment.',
    });
  });

  it('includes details when provided', () => {
    const error = new LLMUnavailableError('test', { providers: ['openai', 'groq'] });
    const json = error.toJSON();

    expect(json.details).toEqual({ providers: ['openai', 'groq'] });
  });
});
