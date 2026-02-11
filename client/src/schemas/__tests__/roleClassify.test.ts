import { describe, expect, it } from 'vitest';
import { RoleClassifyResponseSchema } from '../roleClassify';

describe('schemas/roleClassify', () => {
  it('defaults spans to empty array when omitted', () => {
    const parsed = RoleClassifyResponseSchema.parse({});
    expect(parsed).toEqual({ spans: [] });
  });

  it('accepts valid labeled spans', () => {
    const parsed = RoleClassifyResponseSchema.parse({
      spans: [
        {
          text: 'slow pan',
          start: 10,
          end: 18,
          role: 'camera.movement',
          confidence: 0.92,
        },
      ],
    });

    expect(parsed.spans).toHaveLength(1);
    expect(parsed.spans[0]).toEqual({
      text: 'slow pan',
      start: 10,
      end: 18,
      role: 'camera.movement',
      confidence: 0.92,
    });
  });

  it('rejects spans missing required fields', () => {
    expect(() =>
      RoleClassifyResponseSchema.parse({
        spans: [
          {
            text: 'missing role',
            start: 0,
            end: 12,
            confidence: 0.5,
          },
        ],
      })
    ).toThrow();

    expect(() =>
      RoleClassifyResponseSchema.parse({
        spans: [
          {
            text: 'bad confidence',
            start: 0,
            end: 12,
            role: 'subject',
            confidence: 'high',
          },
        ],
      })
    ).toThrow();
  });
});
