import { describe, expect, it } from 'vitest';
import type { CapabilitiesSchema } from '@shared/capabilities';
import { MODEL_CATALOG } from '@scripts/lib/modelCatalog';
import { sortRegistryForOutput } from '@scripts/sync-capabilities';

type Registry = Record<string, Record<string, CapabilitiesSchema>>;

const baseField = {
  type: 'enum' as const,
  values: ['x'],
  default: 'x',
  ui: {
    label: 'X',
    control: 'select' as const,
    group: 'Test',
    order: 1,
  },
};

const schema = (provider: string, model: string, fieldOrder: string[]): CapabilitiesSchema => ({
  provider,
  model,
  version: '1',
  fields: Object.fromEntries(
    fieldOrder.map((field) => [field, { ...baseField, ui: { ...baseField.ui, label: field } }])
  ),
});

describe('sync-capabilities regression', () => {
  it('keeps catalog explicit and excludes discovery noise', () => {
    const ids = MODEL_CATALOG.map((entry) => `${entry.provider}/${entry.id}`);

    expect(ids).toContain('wan/wan-2.5');
    expect(ids).toContain('openai/sora-2');
    expect(ids).toContain('openai/sora-2-pro');

    expect(ids).not.toContain('openai/sora-2-2025-10-06');
    expect(ids).not.toContain('luma/luma-ray-2');
    expect(ids).not.toContain('google/veo-3.1-generate-preview');
  });

  it('sorts providers, models, and fields deterministically', () => {
    const registry: Registry = {
      wan: {
        'wan-2.5': schema('wan', 'wan-2.5', ['z_field', 'a_field']),
        'wan-2.2': schema('wan', 'wan-2.2', ['k_field', 'b_field']),
      },
      generic: {
        auto: schema('generic', 'auto', ['q_field', 'a_field']),
      },
      openai: {
        'sora-2-pro': schema('openai', 'sora-2-pro', ['c_field', 'a_field']),
        'sora-2': schema('openai', 'sora-2', ['b_field', 'a_field']),
      },
    };

    const sorted = sortRegistryForOutput(registry);

    expect(Object.keys(sorted)).toEqual(['generic', 'openai', 'wan']);
    expect(Object.keys(sorted.openai || {})).toEqual(['sora-2', 'sora-2-pro']);
    expect(Object.keys(sorted.wan || {})).toEqual(['wan-2.2', 'wan-2.5']);
    expect(Object.keys(sorted.wan?.['wan-2.2']?.fields || {})).toEqual(['b_field', 'k_field']);
    expect(Object.keys(sorted.wan?.['wan-2.5']?.fields || {})).toEqual(['a_field', 'z_field']);
  });
});
