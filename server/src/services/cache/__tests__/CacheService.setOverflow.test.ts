import { describe, expect, it } from "vitest";
import { CacheService } from "../CacheService";

// Regression: when NodeCache hits its maxKeys bound, .set() throws
// "Cache max keys amount exceeded". Existing callers (OptimizationCacheService,
// EnhancementService, ObservationCache, etc.) await this.cacheService.set(...)
// without try/catch and rely on the documented {Promise<boolean>} contract.
// Without swallowing the throw, a saturated cache would surface as an
// unhandled rejection in user request flows.

describe("CacheService.set overflow handling", () => {
  it("returns false instead of throwing when NodeCache rejects on overflow", async () => {
    const cache = new CacheService({ maxKeys: 2, defaultTtl: 60 });

    expect(await cache.set("k1", "v1")).toBe(true);
    expect(await cache.set("k2", "v2")).toBe(true);

    // 3rd entry should be rejected by NodeCache. We must NOT throw — best-effort
    // contract is preserved by returning false.
    let result: boolean | undefined;
    let threw: unknown;
    try {
      result = await cache.set("k3", "v3");
    } catch (error) {
      threw = error;
    }

    expect(threw).toBeUndefined();
    expect(result).toBe(false);
  });

  it("continues serving existing entries after overflow is rejected", async () => {
    const cache = new CacheService({ maxKeys: 2, defaultTtl: 60 });

    await cache.set("k1", "v1");
    await cache.set("k2", "v2");
    await cache.set("k3", "v3"); // rejected

    expect(await cache.get<string>("k1")).toBe("v1");
    expect(await cache.get<string>("k2")).toBe("v2");
    expect(await cache.get<string>("k3")).toBeNull();
  });
});
