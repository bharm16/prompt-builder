import { describe, it, expect, vi } from "vitest";
import { CacheService } from "../CacheService";

// Use real NodeCache (not mocked) to verify maxKeys behavior
vi.unmock("node-cache");

vi.mock("@infrastructure/Logger", () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../SemanticCacheService.js", () => ({
  SemanticCacheEnhancer: {
    generateSemanticKey: vi.fn(
      (namespace: string, data: unknown) =>
        `semantic:${namespace}:${JSON.stringify(data)}`,
    ),
  },
}));

describe("CacheService maxKeys bound", () => {
  it("never exceeds configured maxKeys after insert storm", async () => {
    const maxKeys = 100;
    const service = new CacheService({ maxKeys });

    // Insert maxKeys + 100 entries. NodeCache throws ECACHEFULL on overflow,
    // which enforces the bound. We swallow those errors here — the invariant
    // under test is that the final cache size is bounded, not that every
    // insert succeeds.
    const totalInserts = maxKeys + 100;
    for (let i = 0; i < totalInserts; i++) {
      try {
        await service.set(`key-${i}`, `value-${i}`);
      } catch {
        // expected once cache is full — bound enforcement
      }
    }

    const stats = service.getCacheStats();
    // Invariant: cache size must be <= maxKeys
    expect(stats.keys).toBeLessThanOrEqual(maxKeys);
  });

  it("defaults to 50000 maxKeys when not specified", () => {
    const service = new CacheService();
    // Access the underlying cache options to confirm default is applied
    const internalCache = (
      service as unknown as { cache: { options: { maxKeys?: number } } }
    ).cache;
    expect(internalCache.options.maxKeys).toBe(50_000);
  });

  it("honors custom maxKeys from config", () => {
    const service = new CacheService({ maxKeys: 250 });
    const internalCache = (
      service as unknown as { cache: { options: { maxKeys?: number } } }
    ).cache;
    expect(internalCache.options.maxKeys).toBe(250);
  });
});
