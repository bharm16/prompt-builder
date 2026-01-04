#!/usr/bin/env node

import dotenv from 'dotenv';
import fs from 'node:fs';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  CapabilitiesSchema,
  CapabilityField,
  CapabilityValue,
} from '../shared/capabilities';
import { MANUAL_CAPABILITIES_REGISTRY } from '../server/src/services/capabilities/manualRegistry';

type CapabilitiesRegistry = Record<string, Record<string, CapabilitiesSchema>>;
type FieldOverrides = Record<string, Partial<CapabilityField>>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const log = {
  info: (message: string) => console.log(`[capabilities] ${message}`),
  warn: (message: string) => console.warn(`[capabilities] ${message}`),
  error: (message: string) => console.error(`[capabilities] ${message}`),
};

const sanitizeUrlForLog = (url: string): string => {
  try {
    const parsed = new URL(url);
    const redactedKeys = ['key', 'api_key', 'apikey', 'token'];
    for (const key of redactedKeys) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.set(key, '***');
      }
    }
    return parsed.toString();
  } catch {
    return url.replace(/(key|api_key|apikey|token)=([^&]+)/gi, '$1=***');
  }
};

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.cause) {
      return `${error.message} (cause: ${String(error.cause)})`;
    }
    return error.message;
  }
  return String(error);
};

const resolveEnvFile = (): string => {
  const argv = process.argv.slice(2);
  const flag = '--env-file';
  let envPath: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === flag) {
      envPath = argv[i + 1];
      break;
    }
    if (arg.startsWith(`${flag}=`)) {
      envPath = arg.slice(flag.length + 1);
      break;
    }
  }

  if (!envPath) {
    return join(__dirname, '..', '.env');
  }

  return isAbsolute(envPath) ? envPath : resolve(process.cwd(), envPath);
};

const envPath = resolveEnvFile();
const envResult = dotenv.config({ path: envPath });
if (envResult.error) {
  log.warn(`Unable to load env file at ${envPath}. Using existing process.env values.`);
}

const GENERATED_AT = new Date().toISOString();

const OUTPUT_PATH = join(
  process.cwd(),
  'server',
  'src',
  'services',
  'capabilities',
  'registry.generated.json'
);

const cloneRegistry = (input: CapabilitiesRegistry): CapabilitiesRegistry =>
  JSON.parse(JSON.stringify(input)) as CapabilitiesRegistry;

const mergeField = (
  base: CapabilityField | undefined,
  overrides: Partial<CapabilityField>
): CapabilityField => {
  if (!base) {
    return overrides as CapabilityField;
  }
  return {
    ...base,
    ...overrides,
    constraints: {
      ...base.constraints,
      ...overrides.constraints,
    },
    ui: {
      ...base.ui,
      ...overrides.ui,
    },
  };
};

const applySchemaUpdate = (options: {
  registry: CapabilitiesRegistry;
  provider: string;
  model: string;
  source?: string;
  generatedAt?: string;
  fieldOverrides?: FieldOverrides;
  features?: { text_to_video?: boolean; image_to_video?: boolean; video_to_video?: boolean };
  unknownFields?: string[];
}): boolean => {
  const {
    registry,
    provider,
    model,
    source,
    generatedAt,
    fieldOverrides,
    features,
    unknownFields,
  } = options;

  let baseSchema = registry[provider]?.[model];
  let isNew = false;

  // Auto-discovery: If model doesn't exist, try to clone a sibling model from the same provider
  if (!baseSchema && registry[provider]) {
    const siblingKeys = Object.keys(registry[provider]);
    if (siblingKeys.length > 0) {
      // Prefer a sibling that resembles the target name, or just the first one
      const templateKey = siblingKeys.find(k => model.startsWith(k)) || siblingKeys[0];
      baseSchema = JSON.parse(JSON.stringify(registry[provider][templateKey]));
      if (baseSchema) {
        baseSchema.model = model; // Update model ID in the clone
        isNew = true;
      }
    }
  }

  if (!baseSchema) {
    log.warn(`Missing base schema (and no template found) for ${provider}/${model}, skipping update.`);
    return false;
  }

  const fields = { ...baseSchema.fields };
  if (fieldOverrides) {
    for (const [fieldId, overrides] of Object.entries(fieldOverrides)) {
      fields[fieldId] = mergeField(fields[fieldId], overrides);
    }
  }

  const mergedFeatures = {
    ...(baseSchema.features || { text_to_video: true, image_to_video: false }),
    ...features,
  };

  registry[provider][model] = {
    ...baseSchema,
    ...(source ? { source } : {}),
    ...(generatedAt ? { generated_at: generatedAt } : {}),
    fields,
    features: mergedFeatures as any,
    unknown_fields: unknownFields && unknownFields.length > 0 ? unknownFields : undefined,
  };

  if (isNew) {
    log.info(`Discovered and created new model: ${provider}/${model}`);
  }

  return true;
};

const unique = <T>(values: T[]): T[] => Array.from(new Set(values));

const toInt = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? value : null;
  }
  if (typeof value === 'string') {
    const match = value.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
};

const toBool = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'yes' || normalized === 'on') return true;
    if (normalized === 'false' || normalized === 'no' || normalized === 'off') return false;
  }
  return null;
};

const normalizeResolution = (value: string): string | null => {
  const trimmed = value.trim().toLowerCase();
  const directMatch = trimmed.match(/\b\d{3,4}p\b/);
  if (directMatch) {
    return directMatch[0];
  }
  const kMatch = trimmed.match(/\b(\d+)k\b/);
  if (kMatch) {
    return `${kMatch[1]}k`;
  }
  const dimensionMatch = trimmed.match(/(\d{3,4})\s*[x*]\s*(\d{3,4})/i);
  if (dimensionMatch) {
    const height = dimensionMatch[2];
    return `${height}p`;
  }
  return null;
};

const normalizeAspectRatio = (value: string): string | null => {
  const trimmed = value.trim();
  if (/^\d+(?:\.\d+)?:\d+$/.test(trimmed)) {
    return trimmed;
  }
  return null;
};

const parseEnumValues = (schema: Record<string, unknown>): CapabilityValue[] => {
  const raw = schema.enum;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (value) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
  ) as CapabilityValue[];
};

const parseYamlEnumValues = (source: string, schemaName: string): string[] => {
  const lines = source.split(/\r?\n/);
  const values: string[] = [];
  let inSchema = false;
  let inEnum = false;
  let enumIndent = 0;

  const schemaLine = new RegExp(`^\\s{4}${schemaName}:\\s*$`);

  for (const line of lines) {
    if (!inSchema) {
      if (schemaLine.test(line)) {
        inSchema = true;
      }
      continue;
    }

    const indentMatch = line.match(/^\\s*/);
    const indent = indentMatch ? indentMatch[0].length : 0;

    if (indent <= 4 && line.trim().length > 0) {
      break;
    }

    if (!inEnum && line.trim() === 'enum:') {
      inEnum = true;
      enumIndent = indent;
      continue;
    }

    if (inEnum) {
      const itemMatch = line.match(new RegExp(`^\\s{${enumIndent + 2}}-\\s*(.+?)\\s*$`));
      if (itemMatch) {
        const raw = itemMatch[1].trim();
        values.push(raw.replace(/^['"]|['"]$/g, ''));
        continue;
      }

      if (line.trim().length > 0 && indent <= enumIndent) {
        inEnum = false;
      }
    }
  }

  return unique(values);
};

const parseSize = (value: string): { width: number; height: number } | null => {
  const match = value.match(/^(\d{3,4})x(\d{3,4})$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width, height };
};

const decodeHtmlEntities = (value: string): string => {
  const decodedNumeric = value
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#([0-9]+);/g, (_match, num) =>
      String.fromCodePoint(Number.parseInt(num, 10))
    );

  return decodedNumeric
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
};

const extractEnumValuesDeep = (
  schema: Record<string, unknown> | undefined,
  components?: Record<string, unknown>
): CapabilityValue[] => {
  if (!schema) return [];

  const values: CapabilityValue[] = [];
  const visitedRefs = new Set<string>();

  const collect = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    const ref = typeof obj.$ref === 'string' ? obj.$ref : null;

    if (ref && components) {
      if (visitedRefs.has(ref)) return;
      visitedRefs.add(ref);
      const match = ref.match(/^#\/components\/schemas\/(.+)$/);
      if (match) {
        collect(components[match[1]]);
      }
      return;
    }

    const enums = parseEnumValues(obj);
    if (enums.length > 0) {
      values.push(...enums);
    }

    const composites = [obj.anyOf, obj.oneOf, obj.allOf];
    for (const composite of composites) {
      if (Array.isArray(composite)) {
        composite.forEach(collect);
      }
    }
  };

  collect(schema);
  return unique(values);
};

const extractReadmeInitialProps = (html: string): Record<string, unknown> | null => {
  const match =
    html.match(/<script[^>]*id="ssr-props"[^>]*data-initial-props="([^"]+)"/) ||
    html.match(/data-initial-props="([^"]+)"/) ||
    html.match(/data-initial-props='([^']+)'/);

  if (!match?.[1]) return null;

  try {
    return JSON.parse(decodeHtmlEntities(match[1])) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const extractLumaOpenApiSchema = (props: Record<string, unknown>): Record<string, unknown> | null => {
  const document = props.document as Record<string, unknown> | undefined;
  const api = document?.api as Record<string, unknown> | undefined;
  const schema = api?.schema;

  return schema && typeof schema === 'object' ? (schema as Record<string, unknown>) : null;
};

const extractLumaOverridesFromSdk = (source: string): {
  fieldOverrides: FieldOverrides;
  modelIds: string[];
} => {
  const start = source.indexOf('export interface VideoCreateParams');
  if (start === -1) return { fieldOverrides: {}, modelIds: [] };
  const end = source.indexOf('export namespace VideoCreateParams', start);
  // Ensure we capture enough context if namespace is missing or far away
  const blockEnd = end === -1 ? source.indexOf('}', start) + 1 : end;
  const block = source.slice(start, blockEnd);

  const extractField = (field: string): string => {
    // Match field definition, stopping at semicolon, newline, or closing brace
    // Handles: field: 'a' | 'b'; OR field?: 'a' | 'b'
    const regex = new RegExp(`${field}\\??:\\s*([^;}\\n]+)`);
    const match = block.match(regex);
    return match?.[1] ?? '';
  };

  const extractLiterals = (typeText: string): string[] =>
    unique(Array.from(typeText.matchAll(/'([^']+)'/g)).map((match) => match[1]));

  const aspectRatios = extractLiterals(extractField('aspect_ratio'))
    .map((value) => normalizeAspectRatio(value))
    .filter(Boolean) as string[];

  const durations = unique(
    extractLiterals(extractField('duration'))
      .map((value) => toInt(value))
      .filter((value): value is number => value !== null)
  ).sort((a, b) => a - b);

  const resolutions = extractLiterals(extractField('resolution'))
    .map((value) => normalizeResolution(value))
    .filter(Boolean) as string[];

  const modelIds = extractLiterals(extractField('model'));

  const fieldOverrides: FieldOverrides = {};
  if (aspectRatios.length > 0) {
    const defaultRatio = aspectRatios.includes('16:9') ? '16:9' : aspectRatios[0];
    fieldOverrides.aspect_ratio = { values: aspectRatios, default: defaultRatio };
  }
  if (durations.length > 0) {
    fieldOverrides.duration_s = { values: durations, default: durations[0] };
  }
  if (resolutions.length > 0) {
    const defaultResolution = resolutions.includes('720p') ? '720p' : resolutions[0];
    fieldOverrides.resolution = { values: resolutions, default: defaultResolution };
  }

  return { fieldOverrides, modelIds };
};

const getSchemaProperties = (
  schema: Record<string, unknown> | null
): Record<string, unknown> | null => {
  if (!schema) return null;
  const properties = schema.properties;
  return properties && typeof properties === 'object'
    ? (properties as Record<string, unknown>)
    : null;
};

const findLumaRequestSchema = (
  components: Record<string, unknown>
): Record<string, unknown> | null => {
  const direct = components.GenerationRequest;
  if (direct && typeof direct === 'object') {
    return direct as Record<string, unknown>;
  }

  const candidates = Object.entries(components)
    .filter(([, schema]) => schema && typeof schema === 'object')
    .map(([name, schema]) => [name, schema as Record<string, unknown>] as const)
    .filter(([, schema]) => getSchemaProperties(schema));

  const withPrompt = candidates.filter(([, schema]) => {
    const properties = getSchemaProperties(schema);
    return properties && Object.prototype.hasOwnProperty.call(properties, 'prompt');
  });

  const named = withPrompt.find(([name]) => /generationrequest/i.test(name));
  return named?.[1] ?? withPrompt[0]?.[1] ?? null;
};

const extractFalInputSchema = (
  openapi: Record<string, unknown>
): Record<string, unknown> | null => {
  const components = openapi.components as Record<string, unknown> | undefined;
  const schemas = (components?.schemas as Record<string, unknown>) || {};
  const entries = Object.entries(schemas);

  const hasPrompt = (schema: Record<string, unknown>): boolean => {
    const properties = schema.properties as Record<string, unknown> | undefined;
    return !!properties && typeof properties.prompt !== 'undefined';
  };

  const candidates = entries
    .filter(([, schema]) => schema && (schema as Record<string, unknown>).type === 'object')
    .map(([name, schema]) => [name, schema as Record<string, unknown>] as const)
    .filter(([, schema]) => schema.properties);

  const named = candidates.find(([name, schema]) =>
    /input|request/i.test(name) && hasPrompt(schema)
  );
  if (named) return named[1];

  const withPrompt = candidates.find(([, schema]) => hasPrompt(schema));
  if (withPrompt) return withPrompt[1];

  return candidates[0]?.[1] ?? null;
};

const extractFalOverrides = (
  schema: Record<string, unknown>
): {
  fieldOverrides: FieldOverrides;
  features: { text_to_video: boolean; image_to_video: boolean };
  unknownFields: string[];
} => {
  const overrides: FieldOverrides = {};
  const properties = (schema.properties as Record<string, Record<string, unknown>> | undefined) || {};
  const aliases: Record<string, keyof FieldOverrides> = {
    aspectratio: 'aspect_ratio',
    aspect_ratio: 'aspect_ratio',
    ratio: 'aspect_ratio',
    duration: 'duration_s',
    durations: 'duration_s',
    duration_s: 'duration_s',
    durationseconds: 'duration_s',
    seconds: 'duration_s',
    fps: 'fps',
    framerate: 'fps',
    frame_rate: 'fps',
    resolution: 'resolution',
    size: 'resolution',
    audio: 'audio',
    enableaudio: 'audio',
    enable_audio: 'audio',
    seed: 'seed',
    guidance: 'guidance',
    guidancescale: 'guidance',
    guidance_scale: 'guidance',
    cfgscale: 'guidance',
    cfg_scale: 'guidance',
  };

  const knownKeys = new Set(Object.keys(aliases));
  Object.values(aliases).forEach((k) => knownKeys.add(k));
  knownKeys.add('prompt');
  knownKeys.add('image_url');
  knownKeys.add('image');
  knownKeys.add('images');

  const unknownFields: string[] = [];
  let hasText = false;
  let hasImage = false;

  for (const [rawKey, definition] of Object.entries(properties)) {
    const normalizedKey = rawKey.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (['prompt', 'text', 'text_prompt'].includes(rawKey) || ['prompt', 'text'].includes(normalizedKey)) {
      hasText = true;
    }
    if (['image', 'image_url', 'image_end_url', 'start_image', 'images'].includes(rawKey) || normalizedKey.includes('image')) {
      hasImage = true;
    }

    const canonical = aliases[normalizedKey];

    if (!canonical) {
      if (!knownKeys.has(normalizedKey) && !knownKeys.has(rawKey)) {
        unknownFields.push(rawKey);
      }
      continue;
    }

    const enumValues = parseEnumValues(definition);
    switch (canonical) {
      case 'aspect_ratio': {
        const ratios = unique(
          enumValues
            .filter((value): value is string => typeof value === 'string')
            .map((value) => normalizeAspectRatio(value))
            .filter(Boolean) as string[]
        );
        if (ratios.length > 0) {
          overrides.aspect_ratio = { values: ratios, default: ratios[0] };
        }
        break;
      }
      case 'duration_s': {
        const durations = unique(
          enumValues.map((value) => toInt(value)).filter((value): value is number => value !== null)
        ).sort((a, b) => a - b);
        if (durations.length > 0) {
          overrides.duration_s = { values: durations, default: durations[0] };
        }
        break;
      }
      case 'fps': {
        const fpsValues = unique(
          enumValues.map((value) => toInt(value)).filter((value): value is number => value !== null)
        ).sort((a, b) => a - b);
        if (fpsValues.length > 0) {
          overrides.fps = { values: fpsValues, default: fpsValues[0] };
        }
        break;
      }
      case 'resolution': {
        const resolutions = unique(
          enumValues
            .filter((value): value is string => typeof value === 'string')
            .map((value) => normalizeResolution(value))
            .filter(Boolean) as string[]
        );
        if (resolutions.length > 0) {
          overrides.resolution = { values: resolutions, default: resolutions[0] };
        }
        break;
      }
      case 'audio': {
        const defaultValue = toBool(definition.default);
        if (defaultValue !== null) {
          overrides.audio = { default: defaultValue };
        }
        break;
      }
      case 'seed':
      case 'guidance': {
        const min = toInt(definition.minimum);
        const max = toInt(definition.maximum);
        const step = toInt(definition.multipleOf);
        if (min !== null || max !== null || step !== null) {
          overrides[canonical] = {
            constraints: {
              ...(min !== null ? { min } : {}),
              ...(max !== null ? { max } : {}),
              ...(step !== null ? { step } : {}),
            },
          };
        }
        break;
      }
    }
  }

  return {
    fieldOverrides: overrides,
    features: { text_to_video: hasText, image_to_video: hasImage },
    unknownFields: unique(unknownFields).sort(),
  };
};

const fetchText = async (url: string, init?: RequestInit): Promise<string> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const snippet = body.replace(/\s+/g, ' ').trim().slice(0, 200);
    const suffix = snippet ? ` - ${snippet}` : '';
    throw new Error(`HTTP ${response.status} for ${sanitizeUrlForLog(url)}${suffix}`);
  }
  return response.text();
};

const fetchJson = async (url: string, init?: RequestInit): Promise<unknown> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const snippet = body.replace(/\s+/g, ' ').trim().slice(0, 200);
    const suffix = snippet ? ` - ${snippet}` : '';
    throw new Error(`HTTP ${response.status} for ${sanitizeUrlForLog(url)}${suffix}`);
  }
  return response.json();
};

const extractLumaOverrides = (
  openapi: Record<string, unknown>
): {
  fieldOverrides: FieldOverrides;
  features: { text_to_video: boolean; image_to_video: boolean };
  unknownFields: string[];
} => {
  const components = (openapi.components as Record<string, unknown> | undefined)
    ?.schemas as Record<string, unknown> | undefined;
  if (!components)
    return {
      fieldOverrides: {},
      features: { text_to_video: true, image_to_video: false },
      unknownFields: [],
    };

  const requestSchema = findLumaRequestSchema(components);
  const properties = getSchemaProperties(requestSchema);
  if (!properties)
    return {
      fieldOverrides: {},
      features: { text_to_video: true, image_to_video: false },
      unknownFields: [],
    };

  // Feature detection
  const hasText = !!properties.prompt;
  const hasImage = !!(properties.image_url || properties.start_image || properties.end_image);

  // Unknown fields detection
  const mappedFields = ['aspect_ratio', 'duration', 'resolution', 'prompt', 'image_url', 'callback_url'];
  const unknownFields = Object.keys(properties).filter(
    (k) => !mappedFields.includes(k)
  );

  const aspectSchema =
    typeof properties.aspect_ratio === 'object'
      ? (properties.aspect_ratio as Record<string, unknown>)
      : undefined;
  const durationSchema =
    typeof properties.duration === 'object'
      ? (properties.duration as Record<string, unknown>)
      : undefined;
  const resolutionSchema =
    typeof properties.resolution === 'object'
      ? (properties.resolution as Record<string, unknown>)
      : undefined;

  const aspectRatios = unique(
    extractEnumValuesDeep(aspectSchema, components)
      .filter((value): value is string => typeof value === 'string')
      .map((value) => normalizeAspectRatio(value))
      .filter(Boolean) as string[]
  );

  const durations = unique(
    extractEnumValuesDeep(durationSchema, components)
      .map((value) => toInt(value))
      .filter((value): value is number => value !== null)
  ).sort((a, b) => a - b);

  const resolutions = unique(
    extractEnumValuesDeep(resolutionSchema, components)
      .filter((value): value is string => typeof value === 'string')
      .map((value) => normalizeResolution(value))
      .filter(Boolean) as string[]
  );

  const fieldOverrides: FieldOverrides = {};
  if (aspectRatios.length > 0) {
    const defaultRatio = aspectRatios.includes('16:9') ? '16:9' : aspectRatios[0];
    fieldOverrides.aspect_ratio = { values: aspectRatios, default: defaultRatio };
  }
  if (durations.length > 0) {
    fieldOverrides.duration_s = { values: durations, default: durations[0] };
  }
  if (resolutions.length > 0) {
    const defaultResolution = resolutions.includes('720p') ? '720p' : resolutions[0];
    fieldOverrides.resolution = { values: resolutions, default: defaultResolution };
  }

  return {
    fieldOverrides,
    features: { text_to_video: hasText, image_to_video: hasImage },
    unknownFields,
  };
};

const fetchLumaOpenApiFromDocs = async (url: string): Promise<Record<string, unknown> | null> => {
  const html = await fetchText(url);
  const props = extractReadmeInitialProps(html);
  if (!props) return null;
  return extractLumaOpenApiSchema(props);
};

const extractOpenAIVideoOverridesFromOpenApi = (source: string): {
  fieldOverrides: FieldOverrides;
  modelIds: string[];
  features?: { text_to_video?: boolean; image_to_video?: boolean };
  unknownFields?: string[];
} => {
  let modelIds = parseYamlEnumValues(source, 'VideoModel');
  let sizes = parseYamlEnumValues(source, 'VideoSize');
  let seconds = parseYamlEnumValues(source, 'VideoSeconds');

  const features = {
    text_to_video: true,
    image_to_video: false,
  };

  // Fallback to known values from Node SDK if OpenAPI parsing fails
  // Source: src/resources/videos.ts from openai-node
  if (modelIds.length === 0) {
    modelIds = [
      'sora-2',
      'sora-2-pro',
      'sora-2-2025-10-06',
      'sora-2-pro-2025-10-06',
      'sora-2-2025-12-08',
    ];
  }
  if (sizes.length === 0) {
    sizes = ['720x1280', '1280x720', '1024x1792', '1792x1024'];
  }
  if (seconds.length === 0) {
    seconds = ['4', '8', '12'];
  }

  const durations = unique(
    seconds.map((value) => toInt(value)).filter((value): value is number => value !== null)
  ).sort((a, b) => a - b);

  const normalizedSizes = unique(
    sizes
      .map((value) => value.trim())
      .filter((value) => parseSize(value))
  );

  const sizeGroups: Record<string, string[]> = {};
  for (const size of normalizedSizes) {
    const parsed = parseSize(size);
    if (!parsed) continue;
    let ratio: string;
    if (parsed.width === parsed.height) {
      ratio = '1:1';
    } else if (parsed.width > parsed.height) {
      ratio = '16:9';
    } else {
      ratio = '9:16';
    }
    if (!sizeGroups[ratio]) {
      sizeGroups[ratio] = [];
    }
    sizeGroups[ratio].push(size);
  }

  const aspectRatios = Object.keys(sizeGroups);
  const fieldOverrides: FieldOverrides = {};

  if (aspectRatios.length > 0) {
    const defaultRatio = aspectRatios.includes('9:16') ? '9:16' : aspectRatios[0];
    fieldOverrides.aspect_ratio = { values: aspectRatios, default: defaultRatio };
  }

  if (durations.length > 0) {
    fieldOverrides.duration_s = { values: durations, default: durations[0] };
  }

  if (normalizedSizes.length > 0) {
    const constraints =
      aspectRatios.length > 0
        ? {
            available_values_if: aspectRatios.map((ratio) => ({
              if: { field: 'aspect_ratio', eq: ratio },
              values: sizeGroups[ratio],
            })),
          }
        : undefined;
    fieldOverrides.resolution = {
      values: normalizedSizes,
      default: normalizedSizes[0],
      ...(constraints ? { constraints } : {}),
    };
  }

  return { fieldOverrides, modelIds, features };
};

const updateOpenAI = async (
  registry: CapabilitiesRegistry,
  generatedAt: string
): Promise<void> => {
  const docsUrl =
    process.env.OPENAI_OPENAPI_URL ||
    'https://app.stainless.com/api/spec/documented/openai/openapi.documented.yml';
  const apiKey = process.env.OPENAI_API_KEY;
  
  let liveModels: string[] = [];

  // 1. Discovery Phase: Fetch available models from API
  if (apiKey) {
    try {
      const data = (await fetchJson('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      })) as { data?: Array<{ id?: string }> };
      
      liveModels = (data.data || [])
        .map((model) => model.id)
        .filter((id): id is string => typeof id === 'string' && id.includes('sora'));
        
      if (liveModels.length > 0) {
        log.info(`OpenAI discovery found models: ${liveModels.join(', ')}`);
      }
    } catch (error) {
      log.warn(`OpenAI model discovery failed: ${formatError(error)}`);
    }
  } else {
    log.warn('OPENAI_API_KEY not set; skipping live model discovery.');
  }

  // 2. Specification Phase: Fetch Docs to get capabilities
  try {
    log.info(`OpenAI docs sync: fetching OpenAPI spec from ${sanitizeUrlForLog(docsUrl)}`);
    const openapiSource = await fetchText(docsUrl);
    const { fieldOverrides, modelIds: specModels, features, unknownFields } = extractOpenAIVideoOverridesFromOpenApi(openapiSource);

    // 3. Targets Calculation
    // We want to update any model that is EITHER live OR in the spec.
    // (If we only have spec, we use that. If we only have live, we use that + spec capabilities).
    const allCandidates = unique([...liveModels, ...specModels]);
    
    // Filter to ensure we only touch video-like models (sora)
    const targets = allCandidates.filter(id => id.includes('sora'));
    
    // Fallback if absolutely nothing found
    const effectiveTargets = targets.length > 0 ? targets : ['sora-2', 'sora-2-pro'];

    if (specModels.length === 0) {
      log.warn('OpenAI docs sync missing VideoModel enum in OpenAPI spec.');
    }
    if (!fieldOverrides.resolution?.values) {
      log.warn('OpenAI docs sync missing VideoSize enum in OpenAPI spec.');
    }
    if (!fieldOverrides.duration_s?.values) {
      log.warn('OpenAI docs sync missing VideoSeconds enum in OpenAPI spec.');
    }

    const updated: string[] = [];
    for (const model of effectiveTargets) {
      // Determine source label: 'openai.api' if verified live, else 'openai.docs'
      const source = liveModels.includes(model) ? 'openai.api' : 'openai.docs';
      
      if (
        applySchemaUpdate({
          registry,
          provider: 'openai',
          model,
          source,
          generatedAt,
          fieldOverrides,
          features,
          unknownFields,
        })
      ) {
        updated.push(model);
      }
    }
    
    if (updated.length > 0) {
      log.info(`OpenAI sync complete. Updated/Created: ${updated.join(', ')}`);
    }

  } catch (error) {
    log.warn(`OpenAI docs sync failed: ${formatError(error)}`);
  }
};

const updateLuma = async (
  registry: CapabilitiesRegistry,
  generatedAt: string
): Promise<void> => {
  const docsUrl = process.env.LUMA_DOCS_URL || 'https://docs.lumalabs.ai/reference/ping-1';
  
  // 1. Gather Overrides (Docs or SDK)
  let extractedData = {
    fieldOverrides: {} as FieldOverrides,
    features: { text_to_video: true, image_to_video: false },
    unknownFields: [] as string[],
  };
  let overridesSource = 'manual';

  // Try Docs
  try {
    const openapi = await fetchLumaOpenApiFromDocs(docsUrl);
    if (openapi) {
      extractedData = extractLumaOverrides(openapi);
      overridesSource = 'luma.docs';
    } else {
      log.warn('Luma docs sync missing OpenAPI schema; checking SDK.');
    }
  } catch (error) {
    log.warn(`Luma docs sync failed: ${formatError(error)}`);
  }

  // Try SDK for model discovery (always) and overrides (if needed)
  let sdkModelIds: string[] = [];
  const sdkUrl =
    process.env.LUMA_SDK_VIDEO_TS_URL ||
    'https://raw.githubusercontent.com/lumalabs/lumaai-node/main/src/resources/generations/video.ts';

  try {
    const sdkSource = await fetchText(sdkUrl);
    const { fieldOverrides: sdkOverrides, modelIds } = extractLumaOverridesFromSdk(sdkSource);
    sdkModelIds = modelIds;

    if (overridesSource === 'manual' && Object.keys(sdkOverrides).length > 0) {
      extractedData.fieldOverrides = sdkOverrides;
      overridesSource = 'luma.sdk';
    }
  } catch (error) {
    log.warn(`Luma SDK sync failed: ${formatError(error)}`);
  }

  // 2. Discover Models via API
  const apiKey = process.env.LUMA_API_KEY || process.env.LUMAAI_API_KEY;
  let liveModels: string[] = [];
  
  if (apiKey) {
    // ... (existing API logic)
    const modelsEndpoint = process.env.LUMA_MODELS_ENDPOINT?.trim();
    const baseUrl = (process.env.LUMAAI_BASE_URL || 'https://api.lumalabs.ai/dream-machine/v1')
      .replace(/\/+$/, '');
    const modelsUrl = modelsEndpoint
      ? (modelsEndpoint.startsWith('http') ? modelsEndpoint : `${baseUrl}/${modelsEndpoint.replace(/^\/+/, '')}`)
      : `${baseUrl}/models`; 

    if (modelsEndpoint) {
      try {
        const response = await fetch(modelsUrl, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (response.ok) {
          const data = (await response.json()) as
            | { data?: Array<{ id?: string; name?: string }> }
            | Array<string>;

          const allIds: string[] = Array.isArray(data)
            ? data.filter((id): id is string => typeof id === 'string')
            : (data.data || [])
                .map((model) => model.id || model.name)
                .filter((id): id is string => typeof id === 'string');
          
          liveModels = allIds.filter(id => id.includes('ray'));
          if (liveModels.length > 0) {
             log.info(`Luma discovery found models: ${liveModels.join(', ')}`);
          }
        }
      } catch (error) {
        log.warn(`Luma model discovery failed: ${formatError(error)}`);
      }
    }
  }

  // Fallback: If API returned nothing, use SDK discovered models
  if (liveModels.length === 0 && sdkModelIds.length > 0) {
      liveModels = sdkModelIds;
      log.info(`Luma discovery using SDK models: ${liveModels.join(', ')}`);
  }

  // 3. Apply Updates
  const targets = liveModels.length > 0 ? liveModels : ['luma-ray3'];
  const updated: string[] = [];

  for (const model of targets) {
    // If it came from SDK discovery but not API, source is luma.sdk
    const source = liveModels.includes(model) && apiKey ? 'luma.api' : overridesSource;
    
    // Map SDK model names to internal names if needed, or use as is
    // 'ray-2' -> 'luma-ray-2'? The manual registry uses 'luma-ray3' but SDK has 'ray-2'.
    // We should probably prefix them with 'luma-' if they don't have it, to avoid collision?
    // Current manual registry has 'luma-ray3'. 
    // The SDK has 'ray-1-6', 'ray-2'.
    // We will standardize to 'luma-' prefix if missing.
    
    let targetModelId = model;
    if (!model.startsWith('luma-')) {
        targetModelId = `luma-${model}`;
    }

    if (
      applySchemaUpdate({
        registry,
        provider: 'luma',
        model: targetModelId,
        source,
        generatedAt,
        fieldOverrides: extractedData.fieldOverrides,
        features: extractedData.features,
        unknownFields: extractedData.unknownFields,
      })
    ) {
      updated.push(targetModelId);
    }
  }
  
  if (updated.length > 0) {
    log.info(`Luma sync complete. Updated/Created: ${updated.join(', ')}`);
  }
};

const updateGoogle = async (
  registry: CapabilitiesRegistry,
  generatedAt: string
): Promise<void> => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  let liveModels: string[] = [];

  // 1. Discover Models via API
  if (apiKey) {
    try {
      const data = (await fetchJson(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      )) as { models?: Array<{ name?: string }> };
      
      const modelIds = (data.models || [])
        .map((model) => model.name?.replace('models/', ''))
        .filter((id): id is string => typeof id === 'string');
      
      liveModels = modelIds.filter((id) => id.toLowerCase().includes('veo'));
      
      if (liveModels.length > 0) {
        log.info(`Google discovery found models: ${liveModels.join(', ')}`);
      }
    } catch (error) {
      log.warn(`Google model list sync failed: ${formatError(error)}`);
    }
  } else {
    log.warn('GOOGLE_API_KEY/GEMINI_API_KEY not set; skipping live model discovery.');
  }

  // 2. Gather Overrides (Docs)
  const docPath = join(
    process.cwd(),
    'docs',
    'integrations',
    'Gemini',
    'veo-3.1.md'
  );
  let docText = '';
  try {
    docText = fs.readFileSync(docPath, 'utf8');
  } catch {
    docText = '';
  }

  const findRow = (label: string): string | null => {
    if (!docText) return null;
    const needle = `**${label}**`.toLowerCase();
    const lines = docText.split(/\r?\n/);
    return lines.find((line) => line.toLowerCase().includes(needle)) || null;
  };

  const resolutionRow = findRow('Resolution') || '';
  const fpsRow = findRow('Frame Rate') || '';
  const durationRow = findRow('Video Duration') || '';
  const audioRow = findRow('Audio') || '';

  const resolutions = unique(
    (resolutionRow.match(/\b\d{3,4}p\b/gi) || []).map((value) => value.toLowerCase())
  );
  const fpsValues = unique(
    (fpsRow.match(/\b\d{2,3}\s*fps\b/gi) || [])
      .map((value) => toInt(value))
      .filter((value): value is number => value !== null)
  );
  const durations = unique(
    (durationRow.match(/\b\d+\s*seconds?\b/gi) || [])
      .map((value) => toInt(value))
      .filter((value): value is number => value !== null)
  ).sort((a, b) => a - b);

  const aspectRatios = unique(
    (docText.match(/\b\d+(?:\.\d+)?:\d+\b/g) || [])
      .map((value) => normalizeAspectRatio(value))
      .filter(Boolean) as string[]
  );

  const audioSupported = audioRow
    ? !/silent/i.test(audioRow)
    : null;

  const fieldOverrides: FieldOverrides = {};
  if (resolutions.length > 0) {
    fieldOverrides.resolution = { values: resolutions, default: resolutions[0] };
  }
  if (fpsValues.length > 0) {
    fieldOverrides.fps = { values: fpsValues, default: fpsValues[0] };
  }
  if (durations.length > 0) {
    fieldOverrides.duration_s = { values: durations, default: durations[0] };
  }
  if (aspectRatios.length > 0) {
    fieldOverrides.aspect_ratio = { values: aspectRatios, default: aspectRatios[0] };
  }
  if (audioSupported !== null) {
    fieldOverrides.audio = { default: audioSupported };
  }

  // 3. Apply Updates
  const targets = liveModels.length > 0 ? liveModels : ['veo-4'];
  const updated: string[] = [];

  for (const model of targets) {
    const source = liveModels.includes(model) ? 'google.models' : 'google.docs';
    
    if (
      applySchemaUpdate({
        registry,
        provider: 'google',
        model,
        source,
        generatedAt,
        fieldOverrides: Object.keys(fieldOverrides).length ? fieldOverrides : undefined,
        // Google docs don't easily map to features/unknowns via regex here, so we default or could parse more if needed
        features: { text_to_video: true, image_to_video: false } 
      })
    ) {
      updated.push(model);
    }
  }

  if (updated.length > 0) {
    log.info(`Google sync complete. Updated/Created: ${updated.join(', ')}`);
  }
};

const updateFal = async (
  registry: CapabilitiesRegistry,
  generatedAt: string
): Promise<void> => {
  const falKey = process.env.FAL_KEY || process.env.FAL_API_KEY;
  const endpoints = [
    {
      provider: 'kling',
      model: 'kling-26',
      endpointId:
        process.env.FAL_KLING_ENDPOINT_ID ||
        'fal-ai/kling-video/v2.1/pro/image-to-video',
    },
    {
      provider: 'wan',
      model: 'wan-2.2',
      endpointId: process.env.FAL_WAN_ENDPOINT_ID || '',
    },
  ].filter((entry) => entry.endpointId);

  if (endpoints.length === 0) {
    log.warn('No Fal endpoint IDs configured; skipping Fal metadata sync.');
    return;
  }

  for (const entry of endpoints) {
    try {
      const url = `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=${encodeURIComponent(
        entry.endpointId
      )}`;
      const openapi = (await fetchJson(url, falKey ? {
        headers: { Authorization: `Key ${falKey}` },
      } : undefined)) as Record<string, unknown>;
      const inputSchema = extractFalInputSchema(openapi);
      if (!inputSchema) {
        log.warn(`Fal sync missing input schema for ${entry.endpointId}`);
        continue;
      }

      const { fieldOverrides, features, unknownFields } = extractFalOverrides(inputSchema);
      const updated = applySchemaUpdate({
        registry,
        provider: entry.provider,
        model: entry.model,
        source: `fal.openapi:${entry.endpointId}`,
        generatedAt,
        fieldOverrides: Object.keys(fieldOverrides).length ? fieldOverrides : undefined,
        features,
        unknownFields,
      });
      if (updated) {
        log.info(`Fal sync updated: ${entry.provider}/${entry.model}`);
      }
    } catch (error) {
      log.warn(`Fal sync failed for ${entry.endpointId}: ${formatError(error)}`);
    }
  }
};

const printReport = (registry: CapabilitiesRegistry): void => {
  console.log('\n----------------------------------------');
  console.log('CAPABILITIES SYNC REPORT');
  console.log('----------------------------------------');

  for (const [provider, models] of Object.entries(registry)) {
    if (provider === 'generic') continue;
    
    console.log(`\nPROVIDER: ${provider.toUpperCase()}`);
    
    for (const [model, schema] of Object.entries(models)) {
      console.log(`  Model: ${model}`);
      
      // Features
      const features = [];
      if (schema.features?.text_to_video) features.push('Text-to-Video');
      if (schema.features?.image_to_video) features.push('Image-to-Video');
      if (schema.features?.video_to_video) features.push('Video-to-Video');
      console.log(`    Features: ${features.join(', ') || 'None detected'}`);

      // Key Specs
      const getValues = (fieldId: string): string => {
        const field = schema.fields[fieldId];
        if (!field) return '-';
        if (field.values) return field.values.join(', ');
        if (field.type === 'bool') return field.default ? 'Supported' : 'Unsupported';
        if (field.type === 'int' && field.constraints) {
            return `${field.constraints.min}-${field.constraints.max}`;
        }
        return '?';
      };

      console.log(`    Specs:`);
      console.log(`      • Resolution:   ${getValues('resolution')}`);
      console.log(`      • Duration:     ${getValues('duration_s')}s`);
      console.log(`      • Aspect Ratio: ${getValues('aspect_ratio')}`);
      console.log(`      • FPS:          ${getValues('fps')}`);
      console.log(`      • Audio:        ${getValues('audio')}`);
      
      if (schema.unknown_fields && schema.unknown_fields.length > 0) {
        console.log(`    Unknown Params: ${schema.unknown_fields.join(', ')}`);
      }
    }
  }
  console.log('\n----------------------------------------\n');
};

const main = async (): Promise<void> => {
  const registry = cloneRegistry(MANUAL_CAPABILITIES_REGISTRY);

  await updateOpenAI(registry, GENERATED_AT);
  await updateLuma(registry, GENERATED_AT);
  await updateFal(registry, GENERATED_AT);
  await updateGoogle(registry, GENERATED_AT);

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  log.info(`Wrote ${OUTPUT_PATH}`);
  
  printReport(registry);
};

main().catch((error) => {
  log.error(`Sync failed: ${formatError(error)}`);
  process.exit(1);
});
