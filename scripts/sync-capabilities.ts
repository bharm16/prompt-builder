#!/usr/bin/env node

import dotenv from 'dotenv';
import fs from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { CapabilitiesSchema } from '../shared/capabilities';
import { MANUAL_CAPABILITIES_REGISTRY } from '../server/src/services/capabilities/manualRegistry';
import { CAPABILITIES_VERSION } from '../server/src/services/capabilities/templates';
import { resolveFalApiKey } from '../server/src/utils/falApiKey';
import { MODEL_CATALOG, type CatalogEntry } from './lib/modelCatalog';
import { fetchReplicateCapabilities } from './lib/providers/replicate';
import { fetchFalCapabilities } from './lib/providers/fal';
import { fetchOpenAICapabilities } from './lib/providers/openai';
import { fetchGoogleCapabilities } from './lib/providers/google';
import { getManualCapabilities } from './lib/providers/manual';
import { validateSchema, type ValidationError } from './lib/validate';

type CapabilitiesRegistry = Record<string, Record<string, CapabilitiesSchema>>;

interface SyncError {
  model: string;
  error: string;
}

interface SyncResult {
  registry: CapabilitiesRegistry;
  errors: SyncError[];
  validationErrors: ValidationError[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OUTPUT_PATH = join(
  process.cwd(),
  'server',
  'src',
  'services',
  'capabilities',
  'registry.generated.json'
);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const resolveEnvFile = (): string => {
  const args = process.argv.slice(2);
  const flag = '--env-file';
  let envPath: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg) {
      continue;
    }
    if (arg === flag) {
      envPath = args[i + 1];
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

const log = (message: string, meta?: Record<string, unknown>): void => {
  if (meta) {
    console.log(`[sync] ${message}`, meta);
    return;
  }
  console.log(`[sync] ${message}`);
};

const sortFields = (
  fields: Record<string, CapabilitiesSchema['fields'][string]>
): Record<string, CapabilitiesSchema['fields'][string]> => {
  const entries = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
};

export const sortRegistryForOutput = (registry: CapabilitiesRegistry): CapabilitiesRegistry => {
  const providerEntries = Object.entries(registry).sort(([a], [b]) => a.localeCompare(b));

  return Object.fromEntries(
    providerEntries.map(([provider, models]) => {
      const modelEntries = Object.entries(models)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([modelId, schema]) => [
          modelId,
          {
            ...schema,
            fields: sortFields(schema.fields),
          },
        ]);

      return [provider, Object.fromEntries(modelEntries)];
    })
  );
};

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const insertSchema = (
  registry: CapabilitiesRegistry,
  entry: CatalogEntry,
  schema: CapabilitiesSchema
): void => {
  const providerModels = registry[entry.provider] ?? (registry[entry.provider] = {});
  providerModels[entry.id] = schema;
};

const printReport = (
  registry: CapabilitiesRegistry,
  errors: SyncError[],
  validationErrors: ValidationError[]
): void => {
  console.log('\n========================================');
  console.log('CAPABILITIES SYNC REPORT');
  console.log('========================================\n');

  for (const [provider, models] of Object.entries(registry)) {
    if (provider === 'generic') {
      continue;
    }
    console.log(`PROVIDER: ${provider.toUpperCase()}`);
    for (const [modelId, schema] of Object.entries(models)) {
      console.log(`  ${modelId} [${schema.source ?? 'unknown'}]`);
      console.log(`    Fields: ${Object.keys(schema.fields).join(', ')}`);
      const features = schema.features
        ? Object.entries(schema.features)
            .filter(([, value]) => Boolean(value))
            .map(([name]) => name)
        : [];
      console.log(`    Features: ${features.join(', ') || 'none'}`);
    }
    console.log('');
  }

  if (errors.length > 0) {
    console.log('ERRORS:');
    for (const error of errors) {
      console.log(`  ❌ ${error.model}: ${error.error}`);
    }
    console.log('');
  }

  if (validationErrors.length > 0) {
    console.log('VALIDATION ERRORS:');
    for (const validationError of validationErrors) {
      console.log(
        `  ⚠️  ${validationError.model}.${validationError.field}: ${validationError.error}`
      );
    }
    console.log('');
  }
};

export async function runSyncCapabilities(): Promise<SyncResult> {
  const envPath = resolveEnvFile();
  const envResult = dotenv.config({ path: envPath });
  if (envResult.error) {
    log('Unable to load env file; continuing with process env', { envPath });
  }

  const generatedAt = new Date().toISOString();
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  const falKey = resolveFalApiKey();
  const openaiKey = process.env.OPENAI_API_KEY;
  const googleKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const genericAuto = MANUAL_CAPABILITIES_REGISTRY.generic?.auto;
  if (!genericAuto) {
    throw new Error('Missing manual capabilities entry for generic/auto');
  }

  const registry: CapabilitiesRegistry = {
    generic: {
      auto: clone(genericAuto),
    },
  };

  const errors: SyncError[] = [];
  const validationErrors: ValidationError[] = [];

  for (const entry of MODEL_CATALOG) {
    try {
      let schema: CapabilitiesSchema;

      switch (entry.source) {
        case 'replicate': {
          if (!replicateToken) {
            throw new Error('REPLICATE_API_TOKEN not set');
          }
          schema = await fetchReplicateCapabilities(
            entry,
            replicateToken,
            generatedAt,
            CAPABILITIES_VERSION,
            log
          );
          break;
        }
        case 'fal': {
          schema = await fetchFalCapabilities(
            entry,
            falKey,
            generatedAt,
            CAPABILITIES_VERSION,
            log
          );
          break;
        }
        case 'openai': {
          schema = await fetchOpenAICapabilities(entry, openaiKey, generatedAt, log);
          break;
        }
        case 'google': {
          schema = await fetchGoogleCapabilities(entry, googleKey, generatedAt, log);
          break;
        }
        case 'manual': {
          schema = getManualCapabilities(entry, log);
          schema.generated_at = generatedAt;
          break;
        }
        default: {
          throw new Error(`Unsupported source: ${(entry as { source?: string }).source ?? 'unknown'}`);
        }
      }

      const schemaErrors = validateSchema(schema);
      if (schemaErrors.length > 0) {
        validationErrors.push(...schemaErrors);
        throw new Error(`Validation failed (${schemaErrors.length} errors)`);
      }

      insertSchema(registry, entry, schema);
      log('Synced capabilities', {
        provider: entry.provider,
        model: entry.id,
        source: schema.source,
        fieldCount: Object.keys(schema.fields).length,
      });
    } catch (error) {
      const formatted = formatError(error);
      errors.push({ model: `${entry.provider}/${entry.id}`, error: formatted });
      log('Sync failed, attempting manual fallback', {
        provider: entry.provider,
        model: entry.id,
        error: formatted,
      });

      try {
        const fallback = getManualCapabilities(entry, log);
        fallback.generated_at = generatedAt;
        fallback.source = `manual (fallback: ${formatted})`;
        insertSchema(registry, entry, fallback);
        log('Applied manual fallback', { provider: entry.provider, model: entry.id });
      } catch (fallbackError) {
        log('Manual fallback failed', {
          provider: entry.provider,
          model: entry.id,
          error: formatError(fallbackError),
        });
      }
    }
  }

  const sortedRegistry = sortRegistryForOutput(registry);
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(sortedRegistry, null, 2)}\n`, 'utf8');
  log('Wrote registry file', { outputPath: OUTPUT_PATH });

  printReport(sortedRegistry, errors, validationErrors);

  return {
    registry: sortedRegistry,
    errors,
    validationErrors,
  };
}

const isDirectExecution = (): boolean => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return import.meta.url === pathToFileURL(resolve(entry)).href;
};

const main = async (): Promise<void> => {
  const result = await runSyncCapabilities();

  const unresolved = MODEL_CATALOG.filter((entry) => !result.registry[entry.provider]?.[entry.id]);
  if (unresolved.length > 0) {
    throw new Error(
      `Sync completed with unresolved models: ${unresolved
        .map((entry) => `${entry.provider}/${entry.id}`)
        .join(', ')}`
    );
  }
};

if (isDirectExecution()) {
  main().catch((error) => {
    console.error('[sync] Sync failed', { error: formatError(error) });
    process.exit(1);
  });
}
