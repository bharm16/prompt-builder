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

  it('ApiResponseSchema validates success and failure variants', () => {
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
      error: 'Something failed',
      code: 'INVALID_REQUEST',
    });

    expect(failureResult).toMatchObject({
      success: false,
      error: 'Something failed',
      code: 'INVALID_REQUEST',
    });
  });

  it('ApiResponseSchema rejects invalid data payload and missing error on failure', () => {
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
      })
    ).toThrow();
  });
});
