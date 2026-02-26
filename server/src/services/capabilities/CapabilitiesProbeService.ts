import { readFile } from 'node:fs/promises';
import { logger } from '@infrastructure/Logger';
import type { CapabilitiesSchema } from '@shared/capabilities';
import { setDynamicCapabilitiesRegistry } from './dynamicRegistry';

type CapabilitiesRegistry = Record<string, Record<string, CapabilitiesSchema>>;

const DEFAULT_REFRESH_MS = 1000 * 60 * 60 * 6; // 6 hours

interface CapabilitiesProbeConfig {
  probeUrl: string | undefined;
  probePath: string | undefined;
  probeRefreshMs: number;
}

export class CapabilitiesProbeService {
  private readonly log = logger.child({ service: 'CapabilitiesProbeService' });
  private readonly config: CapabilitiesProbeConfig;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(config?: CapabilitiesProbeConfig) {
    this.config = config ?? {
      probeUrl: undefined,
      probePath: undefined,
      probeRefreshMs: DEFAULT_REFRESH_MS,
    };
  }

  start(): void {
    const url = this.config.probeUrl;
    const path = this.config.probePath;
    const intervalMs = this.config.probeRefreshMs > 0 ? this.config.probeRefreshMs : DEFAULT_REFRESH_MS;

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
