import { readFile } from 'node:fs/promises';
import { logger } from '@infrastructure/Logger';
import type { CapabilitiesSchema } from '@shared/capabilities';
import { setDynamicCapabilitiesRegistry } from './dynamicRegistry';

type CapabilitiesRegistry = Record<string, Record<string, CapabilitiesSchema>>;

const DEFAULT_REFRESH_MS = 1000 * 60 * 60 * 6; // 6 hours

export class CapabilitiesProbeService {
  private readonly log = logger.child({ service: 'CapabilitiesProbeService' });
  private refreshTimer: NodeJS.Timeout | null = null;

  start(): void {
    const url = process.env.CAPABILITIES_PROBE_URL;
    const path = process.env.CAPABILITIES_PROBE_PATH;
    const refreshMs = Number.parseInt(process.env.CAPABILITIES_PROBE_REFRESH_MS || '', 10);
    const intervalMs = Number.isFinite(refreshMs) && refreshMs > 0 ? refreshMs : DEFAULT_REFRESH_MS;

    if (!url && !path) {
      this.log.debug('Capabilities probe disabled (no URL or path configured)');
      return;
    }

    const runOnce = async () => {
      try {
        const registry = url
          ? await this.loadFromUrl(url)
          : path
            ? await this.loadFromFile(path)
            : null;

        if (registry) {
          setDynamicCapabilitiesRegistry(registry);
          this.log.info('Capabilities registry updated', {
            source: url ? 'url' : 'file',
            providers: Object.keys(registry).length,
          });
        }
      } catch (error) {
        this.log.warn('Failed to refresh capabilities registry', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    void runOnce();

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.refreshTimer = setInterval(runOnce, intervalMs);
  }

  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private async loadFromUrl(url: string): Promise<CapabilitiesRegistry> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Capabilities probe failed (${response.status})`);
    }
    const json = await response.json();
    return this.normalizeRegistry(json);
  }

  private async loadFromFile(path: string): Promise<CapabilitiesRegistry> {
    const data = await readFile(path, 'utf-8');
    return this.normalizeRegistry(JSON.parse(data));
  }

  private normalizeRegistry(raw: unknown): CapabilitiesRegistry {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Capabilities registry payload is invalid');
    }
    return raw as CapabilitiesRegistry;
  }
}

export default CapabilitiesProbeService;
