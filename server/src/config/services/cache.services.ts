import type { DIContainer } from "@infrastructure/DIContainer";
import { CacheService } from "@services/cache/CacheService";
import { initSpanLabelingCache } from "@services/cache/SpanLabelingCacheService";
import type { RedisClient } from "@services/cache/types";
import { createRedisClient } from "../redis.ts";
import type { ServiceConfig } from "./service-config.types.ts";

export function registerCacheServices(container: DIContainer): void {
  container.register("cacheService", () => new CacheService({}), []);

  container.register("redisClient", () => createRedisClient(), []);

  container.register(
    "spanLabelingCacheService",
    (
      redisClient: ReturnType<typeof createRedisClient>,
      config: ServiceConfig,
    ) =>
      initSpanLabelingCache({
        redis: redisClient as RedisClient | null,
        defaultTTL: config.redis.defaultTTL,
        shortTTL: config.redis.shortTTL,
        maxMemoryCacheSize: config.redis.maxMemoryCacheSize,
      }),
    ["redisClient", "config"],
  );
}
