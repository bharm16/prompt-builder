import type { DIContainer } from "@infrastructure/DIContainer";
import { MetricsService } from "@infrastructure/MetricsService";
import { CacheService } from "@services/cache/CacheService";
import { initSpanLabelingCache } from "@services/cache/SpanLabelingCacheService";
import type { RedisClient } from "@services/cache/types";
import { createRedisClient, getRedisStatus } from "../redis.ts";
import type { ServiceConfig } from "./service-config.types.ts";

export function registerCacheServices(container: DIContainer): void {
  container.register(
    "cacheService",
    (metricsService: MetricsService) => new CacheService({}, metricsService),
    ["metricsService"],
    { singleton: true },
  );

  container.register(
    "redisClient",
    (metricsService: MetricsService) => {
      const client = createRedisClient();
      // Publish initial Redis status to Prometheus and keep it updated
      metricsService.updateRedisConnectionStatus(getRedisStatus());
      if (client) {
        const pushStatus = (): void =>
          metricsService.updateRedisConnectionStatus(getRedisStatus());
        client.on("ready", pushStatus);
        client.on("close", pushStatus);
        client.on("reconnecting", pushStatus);
        client.on("end", pushStatus);
      }
      return client;
    },
    ["metricsService"],
  );

  container.register(
    "spanLabelingCacheService",
    (
      redisClient: ReturnType<typeof createRedisClient>,
      config: ServiceConfig,
      metricsService: MetricsService,
    ) =>
      initSpanLabelingCache(
        {
          redis: redisClient as RedisClient | null,
          defaultTTL: config.redis.defaultTTL,
          shortTTL: config.redis.shortTTL,
          maxMemoryCacheSize: config.redis.maxMemoryCacheSize,
        },
        metricsService,
      ),
    ["redisClient", "config", "metricsService"],
  );
}
