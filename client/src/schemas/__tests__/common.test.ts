import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ApiResponseSchema,
  EmailSchema,
  IdSchema,
  TimestampSchema,
} from '../common';

describe('schemas/common', () => {
  it('validates shared primitive schemas', () => {
    expect(IdSchema.parse('123e4567-e89b-12d3-a456-426614174000')).toBe(
      '123e4567-e89b-12d3-a456-426614174000'
    );
    expect(() => IdSchema.parse('not-a-uuid')).toThrow();

    expect(EmailSchema.parse('user@example.com')).toBe('user@example.com');
    expect(() => EmailSchema.parse('invalid-email')).toThrow();

    expect(TimestampSchema.parse('2025-01-01T12:00:00.000Z')).toBe('2025-01-01T12:00:00.000Z');
    expect(() => TimestampSchema.parse('01/01/2025')).toThrow();
  });

  it('ApiResponseSchema validates wrapped data and optional error object', () => {
    const schema = ApiResponseSchema(
      z.object({
        value: z.string(),
        count: z.number(),
      })
    );

    const successResult = schema.parse({
      success: true,
      data: { value: 'ok', count: 2 },
    });

    expect(successResult).toEqual({
      success: true,
      data: { value: 'ok', count: 2 },
    });

    const failureResult = schema.parse({
      success: false,
      data: { value: 'fallback', count: 0 },
      error: {
        code: 'GENERIC_FAILURE',
        message: 'Something failed',
      },
    });

    expect(failureResult.error).toEqual({
      code: 'GENERIC_FAILURE',
      message: 'Something failed',
    });
  });

  it('ApiResponseSchema rejects invalid error shape and invalid data payload', () => {
    const schema = ApiResponseSchema(
      z.object({
        value: z.string(),
      })
    );

    expect(() =>
      schema.parse({
        success: true,
        data: { value: 123 },
      })
    ).toThrow();

    expect(() =>
      schema.parse({
        success: false,
        data: { value: 'ok' },
        error: { code: 'ONLY_CODE' },
      })
    ).toThrow();
  });
});
