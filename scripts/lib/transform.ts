import type { CapabilityField, CapabilityFieldUI } from '../../shared/capabilities';

interface OpenApiSchema {
  type?: unknown;
  enum?: unknown;
  default?: unknown;
  minimum?: unknown;
  maximum?: unknown;
  multipleOf?: unknown;
  allOf?: unknown;
  anyOf?: unknown;
  oneOf?: unknown;
  $ref?: unknown;
}

interface FieldMapping {
  canonical: string;
  ui: Required<Pick<CapabilityFieldUI, 'label' | 'control' | 'group' | 'order'>> &
    Pick<CapabilityFieldUI, 'description'>;
}

const FIELD_MAP: Record<string, FieldMapping> = {
  aspect_ratio: {
    canonical: 'aspect_ratio',
    ui: { label: 'Aspect ratio', control: 'segmented', group: 'Format', order: 10 },
  },
  duration: {
    canonical: 'duration_s',
    ui: { label: 'Duration', control: 'select', group: 'Timing', order: 20 },
  },
  duration_s: {
    canonical: 'duration_s',
    ui: { label: 'Duration', control: 'select', group: 'Timing', order: 20 },
  },
  seconds: {
    canonical: 'duration_s',
    ui: { label: 'Duration', control: 'select', group: 'Timing', order: 20 },
  },
  num_frames: {
    canonical: 'num_frames',
    ui: { label: 'Frames', control: 'input', group: 'Timing', order: 22 },
  },
  fps: {
    canonical: 'fps',
    ui: { label: 'Frame rate', control: 'select', group: 'Timing', order: 25 },
  },
  frame_rate: {
    canonical: 'fps',
    ui: { label: 'Frame rate', control: 'select', group: 'Timing', order: 25 },
  },
  frames_per_second: {
    canonical: 'fps',
    ui: { label: 'Frame rate', control: 'select', group: 'Timing', order: 25 },
  },
  resolution: {
    canonical: 'resolution',
    ui: { label: 'Resolution', control: 'select', group: 'Quality', order: 30 },
  },
  size: {
    canonical: 'resolution',
    ui: { label: 'Resolution', control: 'select', group: 'Quality', order: 30 },
  },
  audio: {
    canonical: 'audio',
    ui: { label: 'Audio', control: 'toggle', group: 'Audio', order: 40 },
  },
  enable_audio: {
    canonical: 'audio',
    ui: { label: 'Audio', control: 'toggle', group: 'Audio', order: 40 },
  },
  seed: {
    canonical: 'seed',
    ui: {
      label: 'Seed',
      control: 'input',
      group: 'Advanced',
      order: 90,
      description: 'Use 0 for random seed.',
    },
  },
  guidance: {
    canonical: 'guidance',
    ui: { label: 'Guidance', control: 'input', group: 'Advanced', order: 95 },
  },
  guidance_scale: {
    canonical: 'guidance',
    ui: { label: 'Guidance', control: 'input', group: 'Advanced', order: 95 },
  },
  cfg_scale: {
    canonical: 'guidance',
    ui: { label: 'Guidance', control: 'input', group: 'Advanced', order: 95 },
  },
};

const TEXT_FIELDS = new Set(['prompt', 'text', 'text_prompt']);
const IMAGE_FIELDS = new Set([
  'image',
  'images',
  'image_url',
  'image_end_url',
  'start_image',
  'last_image',
  'tail_image_url',
]);
const STYLE_FIELDS = new Set(['style_reference']);

const SKIP_FIELDS = new Set([
  'prompt',
  'text',
  'text_prompt',
  'negative_prompt',
  'prompt_extend',
  'enable_prompt_expansion',
  'optimize_prompt',
  'go_fast',
  'sample_shift',
  'callback_url',
  'callback',
  'webhook',
  'disable_safety_checker',
  'lora_scale_transformer',
  'lora_scale_transformer_2',
  'lora_weights_transformer',
  'lora_weights_transformer_2',
  'interpolate_output',
]);

export interface TransformResult {
  fields: Record<string, CapabilityField>;
  features: {
    text_to_video: boolean;
    image_to_video: boolean;
    style_reference?: boolean;
  };
  unknownFields: string[];
}

const normalizeKey = (rawKey: string): string =>
  rawKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const toNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const isIntegerSafeNumberField = (definition: OpenApiSchema): boolean => {
  const schemaType = typeof definition.type === 'string' ? definition.type : undefined;
  if (schemaType === 'integer') {
    return true;
  }

  const numericMeta = [
    toNumber(definition.minimum),
    toNumber(definition.maximum),
    toNumber(definition.default),
    toNumber(definition.multipleOf),
  ].filter((value): value is number => value !== undefined);

  if (schemaType !== 'number') {
    return false;
  }

  if (numericMeta.length === 0) {
    return false;
  }

  return numericMeta.every((value) => Number.isInteger(value));
};

const shouldMapGuidanceField = (normalizedKey: string, definition: OpenApiSchema): boolean => {
  const maximum = toNumber(definition.maximum);

  // Explicit guard: normalized cfg_scale (0..1) is not user guidance.
  if (normalizedKey === 'cfg_scale') {
    if (maximum === undefined) {
      return false;
    }
    if (maximum <= 1) {
      return false;
    }
  }

  return isIntegerSafeNumberField(definition);
};

const parseEnumValues = (value: unknown): Array<string | number | boolean> => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry): entry is string | number | boolean =>
      typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean'
  );
};

const getReferencedSchemaName = (ref: unknown): string | null => {
  if (typeof ref !== 'string') {
    return null;
  }

  const prefix = '#/components/schemas/';
  if (!ref.startsWith(prefix)) {
    return null;
  }

  return ref.slice(prefix.length);
};

const extractEnumValues = (
  definition: OpenApiSchema,
  allSchemas?: Record<string, OpenApiSchema>
): Array<string | number | boolean> => {
  const direct = parseEnumValues(definition.enum);
  if (direct.length > 0) {
    return direct;
  }

  const composites = [definition.allOf, definition.anyOf, definition.oneOf]
    .filter(Array.isArray)
    .flat() as OpenApiSchema[];

  for (const item of composites) {
    const nestedDirect = parseEnumValues(item.enum);
    if (nestedDirect.length > 0) {
      return nestedDirect;
    }

    const refName = getReferencedSchemaName(item.$ref);
    if (!refName || !allSchemas) {
      continue;
    }

    const referenced = allSchemas[refName];
    if (!referenced) {
      continue;
    }

    const referencedEnum = parseEnumValues(referenced.enum);
    if (referencedEnum.length > 0) {
      return referencedEnum;
    }
  }

  return [];
};

const inferFieldType = (
  definition: OpenApiSchema,
  enumValues: Array<string | number | boolean>
): 'enum' | 'int' | 'bool' | 'string' => {
  if (enumValues.length > 0) {
    return 'enum';
  }

  if (definition.type === 'boolean') {
    return 'bool';
  }

  if (definition.type === 'integer') {
    return 'int';
  }

  if (definition.type === 'number' && isIntegerSafeNumberField(definition)) {
    return 'int';
  }

  return 'string';
};

const makeCompatibilityField = (
  label: string,
  description: string,
  order: number,
  supported: boolean
): CapabilityField => ({
  type: 'bool',
  default: supported,
  ui: {
    label,
    description,
    control: 'toggle',
    group: 'Capabilities',
    order,
  },
});

const shouldPreferIncoming = (
  existing: CapabilityField,
  incoming: CapabilityField
): boolean => {
  if (existing.type !== 'enum' && incoming.type === 'enum') {
    return true;
  }

  const existingValues = Array.isArray(existing.values) ? existing.values.length : 0;
  const incomingValues = Array.isArray(incoming.values) ? incoming.values.length : 0;
  if (incomingValues > existingValues) {
    return true;
  }

  const existingHasRange =
    typeof existing.constraints?.min === 'number' || typeof existing.constraints?.max === 'number';
  const incomingHasRange =
    typeof incoming.constraints?.min === 'number' || typeof incoming.constraints?.max === 'number';
  if (!existingHasRange && incomingHasRange) {
    return true;
  }

  return false;
};

export function transformOpenApiProperties(
  properties: Record<string, OpenApiSchema>,
  allSchemas?: Record<string, OpenApiSchema>
): TransformResult {
  const fields: Record<string, CapabilityField> = {};
  const unknownFields = new Set<string>();

  let hasText = false;
  let hasImage = false;
  let hasStyleReference = false;

  for (const [rawKey, definition] of Object.entries(properties)) {
    const normalizedKey = normalizeKey(rawKey);

    if (TEXT_FIELDS.has(normalizedKey)) {
      hasText = true;
    }
    if (IMAGE_FIELDS.has(normalizedKey) || normalizedKey.includes('image')) {
      hasImage = true;
    }
    if (STYLE_FIELDS.has(normalizedKey)) {
      hasStyleReference = true;
    }

    if (
      SKIP_FIELDS.has(normalizedKey) ||
      TEXT_FIELDS.has(normalizedKey) ||
      IMAGE_FIELDS.has(normalizedKey) ||
      STYLE_FIELDS.has(normalizedKey)
    ) {
      continue;
    }

    const mapping = FIELD_MAP[normalizedKey];
    if (!mapping) {
      unknownFields.add(rawKey);
      continue;
    }

    if (
      mapping.canonical === 'guidance' &&
      !shouldMapGuidanceField(normalizedKey, definition)
    ) {
      unknownFields.add(rawKey);
      continue;
    }

    const enumValues = extractEnumValues(definition, allSchemas);
    const fieldType = inferFieldType(definition, enumValues);

    const field: CapabilityField = {
      type: fieldType,
      ui: { ...mapping.ui },
    };

    if (fieldType === 'enum') {
      field.values = enumValues;
      const defaultValue =
        definition.default !== undefined
          ? (definition.default as string | number | boolean)
          : enumValues[0];
      if (defaultValue !== undefined) {
        field.default = defaultValue;
      }
    }

    if (fieldType === 'bool') {
      field.default =
        definition.default !== undefined ? Boolean(definition.default) : false;
    }

    if (fieldType === 'int') {
      const min = toNumber(definition.minimum);
      const max = toNumber(definition.maximum);
      const step = toNumber(definition.multipleOf);
      field.constraints = {
        ...(min !== undefined ? { min } : {}),
        ...(max !== undefined ? { max } : {}),
        ...(step !== undefined ? { step } : { step: 1 }),
      };

      const defaultValue = toNumber(definition.default);
      if (defaultValue !== undefined && Number.isInteger(defaultValue)) {
        field.default = defaultValue;
      } else if (min !== undefined && Number.isInteger(min)) {
        field.default = min;
      } else {
        field.default = 0;
      }
    }

    const existing = fields[mapping.canonical];
    if (!existing || shouldPreferIncoming(existing, field)) {
      fields[mapping.canonical] = field;
    }
  }

  fields.image_input = makeCompatibilityField(
    'Image Input',
    'Supports image-to-video generation',
    5,
    hasImage
  );

  fields.style_reference = makeCompatibilityField(
    'Style Reference',
    'Supports native style reference inputs',
    6,
    hasStyleReference
  );

  return {
    fields,
    features: {
      text_to_video: hasText,
      image_to_video: hasImage,
      ...(hasStyleReference ? { style_reference: true } : {}),
    },
    unknownFields: [...unknownFields].sort(),
  };
}
