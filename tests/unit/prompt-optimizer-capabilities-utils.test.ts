import { describe, expect, it } from 'vitest';

import {
  areCapabilityValuesEqual,
  sanitizeCapabilityValues,
} from '@features/prompt-optimizer/utils/capabilities';
import type { CapabilitiesSchema } from '@shared/capabilities';

describe('capabilities utils', () => {
  it('compares capability values for equality', () => {
    expect(areCapabilityValuesEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(areCapabilityValuesEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(areCapabilityValuesEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('normalizes values using defaults and allowed values', () => {
    const schema: CapabilitiesSchema = {
      provider: 'test',
      model: 'model',
      version: '1',
      fields: {
        quality: {
          type: 'enum',
          values: ['fast', 'quality'],
          default: 'fast',
          constraints: {
            available_values_if: [
              {
                if: { field: 'mode', eq: 'pro' },
                values: ['quality'],
              },
            ],
          },
        },
        mode: {
          type: 'string',
          default: 'basic',
        },
        retries: {
          type: 'int',
          constraints: { min: 1 },
        },
        enabled: {
          type: 'bool',
          default: false,
          constraints: {
            disabled_if: [{ field: 'mode', eq: 'disabled' }],
          },
        },
      },
    };

    const sanitized = sanitizeCapabilityValues(schema, {
      quality: 'fast',
      mode: 'pro',
      retries: Number.NaN,
    });

    expect(sanitized.mode).toBe('pro');
    expect(sanitized.retries).toBe(1);
    expect(sanitized.enabled).toBe(false);
    expect(sanitized.quality).toBe('quality');
  });

  it('removes fields that are unavailable or disabled', () => {
    const schema: CapabilitiesSchema = {
      provider: 'test',
      model: 'model',
      version: '1',
      fields: {
        mode: {
          type: 'string',
          default: 'disabled',
        },
        enabled: {
          type: 'bool',
          default: true,
          constraints: {
            disabled_if: [{ field: 'mode', eq: 'disabled' }],
          },
        },
        gated: {
          type: 'string',
          default: 'hidden',
          constraints: {
            available_if: [{ field: 'mode', eq: 'pro' }],
          },
        },
      },
    };

    const sanitized = sanitizeCapabilityValues(schema, {
      mode: 'disabled',
      enabled: true,
      gated: 'hidden',
    });

    expect(sanitized.mode).toBe('disabled');
    expect(sanitized.enabled).toBeUndefined();
    expect(sanitized.gated).toBeUndefined();
  });
});
