import type { CapabilitiesSchema } from '../../../shared/capabilities';
import type { CatalogEntry } from '../modelCatalog';
import { MANUAL_CAPABILITIES_REGISTRY } from '../../../server/src/services/capabilities/manualRegistry';

export function getManualCapabilities(
  entry: CatalogEntry,
  log: (message: string, meta?: Record<string, unknown>) => void
): CapabilitiesSchema {
  const models = MANUAL_CAPABILITIES_REGISTRY[entry.provider];
  if (!models) {
    throw new Error(`No manual registry for provider '${entry.provider}'`);
  }

  const schema = models[entry.id];
  if (!schema) {
    throw new Error(`No manual registry entry for ${entry.provider}/${entry.id}`);
  }

  log('Using manual capabilities', { provider: entry.provider, model: entry.id });
  return JSON.parse(JSON.stringify(schema)) as CapabilitiesSchema;
}
