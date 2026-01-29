import type { CapabilitiesSchema, CapabilityField } from '@shared/capabilities';

export const CAPABILITIES_VERSION = '2026-01-03';
export const DEFAULT_GENERATED_AT = '2026-01-03T00:00:00Z';

export const aspectRatioField = (
  values: string[] = ['16:9', '9:16', '1:1']
): CapabilityField => ({
  type: 'enum',
  values,
  ...(values[0] !== undefined ? { default: values[0] } : {}),
  ui: {
    label: 'Aspect ratio',
    control: 'segmented',
    group: 'Format',
    order: 10,
  },
});

export const durationField = (values: number[] = [4, 8, 12]): CapabilityField => ({
  type: 'enum',
  values,
  ...(values[0] !== undefined ? { default: values[0] } : {}),
  ui: {
    label: 'Duration',
    control: 'select',
    group: 'Timing',
    order: 20,
  },
});

export const fpsField = (values: number[] = [24, 30]): CapabilityField => ({
  type: 'enum',
  values,
  ...(values[0] !== undefined ? { default: values[0] } : {}),
  ui: {
    label: 'Frame rate',
    control: 'select',
    group: 'Timing',
    order: 25,
  },
});

export const resolutionField = (values: string[] = ['720p', '1080p']): CapabilityField => ({
  type: 'enum',
  values,
  ...(values[0] !== undefined ? { default: values[0] } : {}),
  ui: {
    label: 'Resolution',
    control: 'select',
    group: 'Quality',
    order: 30,
  },
  constraints: {
    available_values_if: [
      { if: { field: 'aspect_ratio', eq: '9:16' }, values: ['720p'] },
      { if: { field: 'aspect_ratio', eq: '1:1' }, values: ['720p'] },
    ],
  },
});

export const audioField = (defaultValue = false): CapabilityField => ({
  type: 'bool',
  default: defaultValue,
  ui: {
    label: 'Audio',
    control: 'toggle',
    group: 'Audio',
    order: 40,
  },
  constraints: {
    available_if: [{ field: 'resolution', in: ['720p'] }],
  },
});

export const imageInputField = (supported = false): CapabilityField => ({
  type: 'bool',
  default: supported,
  ui: {
    label: 'Image Input',
    description: 'Supports image-to-video generation',
    control: 'toggle',
    group: 'Capabilities',
    order: 5,
  },
});

export const styleReferenceField = (supported = false): CapabilityField => ({
  type: 'bool',
  default: supported,
  ui: {
    label: 'Style Reference',
    description: 'Supports native style reference inputs',
    control: 'toggle',
    group: 'Capabilities',
    order: 6,
  },
});

export const characterReferenceField = (supported = false): CapabilityField => ({
  type: 'bool',
  default: supported,
  ui: {
    label: 'Character Reference',
    description: 'Supports native character/identity reference inputs',
    control: 'toggle',
    group: 'Capabilities',
    order: 7,
  },
});

export const extendVideoField = (supported = false): CapabilityField => ({
  type: 'bool',
  default: supported,
  ui: {
    label: 'Extend Video',
    description: 'Supports extending an existing video asset',
    control: 'toggle',
    group: 'Capabilities',
    order: 8,
  },
});

export const seedField = (): CapabilityField => ({
  type: 'int',
  default: 0,
  constraints: {
    min: 0,
    max: 2147483647,
    step: 1,
  },
  ui: {
    label: 'Seed',
    control: 'input',
    group: 'Advanced',
    order: 90,
    description: 'Use 0 for random seed.',
  },
});

export const guidanceField = (defaultValue = 7): CapabilityField => ({
  type: 'int',
  default: defaultValue,
  constraints: {
    min: 1,
    max: 20,
    step: 1,
  },
  ui: {
    label: 'Guidance',
    control: 'input',
    group: 'Advanced',
    order: 95,
  },
});

export const buildSchema = (
  provider: string,
  model: string,
  fields: Record<string, CapabilityField>,
  options?: { source?: string; generatedAt?: string }
): CapabilitiesSchema => ({
  provider,
  model,
  version: CAPABILITIES_VERSION,
  source: options?.source ?? 'manual',
  generated_at: options?.generatedAt ?? DEFAULT_GENERATED_AT,
  fields,
});
