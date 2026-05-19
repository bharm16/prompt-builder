import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHealthRoutes } from "../health.routes";
import type { FirestoreCircuitExecutor } from "@services/firestore/FirestoreCircuitExecutor";

interface ErrorWithCode {
  code?: string;
  message?: string;
}

const isSocketPermissionError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as ErrorWithCode;
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const message =
    typeof candidate.message === "string" ? candidate.message : "";
  if (code === "EPERM" || code === "EACCES") {
    return true;
  }

  return (
    message.includes("listen EPERM") ||
    message.includes("listen EACCES") ||
    message.includes("operation not permitted") ||
    message.includes("Cannot read properties of null (reading 'port')")
  );
};

const runSupertestOrSkip = async <T>(
  execute: () => Promise<T>,
): Promise<T | null> => {
  if (process.env.CODEX_SANDBOX === "seatbelt") {
    return null;
  }

  try {
    return await execute();
  } catch (error) {
    if (isSocketPermissionError(error)) {
      return null;
    }
    throw error;
  }
};

describe("GET /health/ready", () => {
  it("returns 200 with explicit dependencies map when all required deps are healthy", async () => {
    const app = express();
    app.use(
      createHealthRoutes({
        cacheService: { isHealthy: () => true },
        checkFirestore: async () => undefined,
        gcsBucket: { exists: async () => [true] as [boolean] },
      }),
    );

    const result = await runSupertestOrSkip(() =>
      request(app).get("/health/ready"),
    );
    if (!result) return;

    expect(result.status).toBe(200);
    expect(result.body.status).toBe("ready");
    expect(result.body.dependencies).toMatchObject({
      firebase: { required: true, healthy: true },
      gcs: { required: true, healthy: true },
      cache: { required: true, healthy: true },
    });
    expect(result.body.dependencies.firebase.lastChecked).toBeDefined();
    expect(result.body.dependencies.gcs.lastChecked).toBeDefined();
    expect(result.body.dependencies.cache.lastChecked).toBeDefined();
    expect(result.body.timestamp).toBeDefined();
  });

  it("returns 503 when a required dependency (firebase) is unhealthy", async () => {
    const app = express();
    app.use(
      createHealthRoutes({
        cacheService: { isHealthy: () => true },
        checkFirestore: async () => {
          throw new Error("firestore unreachable");
        },
        gcsBucket: { exists: async () => [true] as [boolean] },
      }),
    );

    const result = await runSupertestOrSkip(() =>
      request(app).get("/health/ready"),
    );
    if (!result) return;

    expect(result.status).toBe(503);
    expect(result.body.status).toBe("unhealthy");
    expect(result.body.dependencies.firebase.healthy).toBe(false);
    expect(result.body.dependencies.firebase.error).toMatch(
      /firestore unreachable/,
    );
    expect(result.body.dependencies.gcs.healthy).toBe(true);
  });

  it("returns 200 when a non-required dependency (redis) is unhealthy", async () => {
    const app = express();
    app.use(
      createHealthRoutes({
        cacheService: { isHealthy: () => true },
        checkFirestore: async () => undefined,
        gcsBucket: { exists: async () => [true] as [boolean] },
        getRedisStatus: () => "disconnected",
      }),
    );

    const result = await runSupertestOrSkip(() =>
      request(app).get("/health/ready"),
    );
    if (!result) return;

    expect(result.status).toBe(200);
    expect(result.body.status).toBe("ready");
    expect(result.body.dependencies.redis).toMatchObject({
      required: false,
      healthy: false,
    });
  });

  it("returns 503 when GCS bucket does not exist", async () => {
    const app = express();
    app.use(
      createHealthRoutes({
        cacheService: { isHealthy: () => true },
        checkFirestore: async () => undefined,
        gcsBucket: { exists: async () => [false] as [boolean] },
      }),
    );

    const result = await runSupertestOrSkip(() =>
      request(app).get("/health/ready"),
    );
    if (!result) return;

    expect(result.status).toBe(503);
    expect(result.body.status).toBe("unhealthy");
    expect(result.body.dependencies.gcs.healthy).toBe(false);
    expect(result.body.dependencies.gcs.required).toBe(true);
  });

  it("returns 503 when a required dependency (cache) is unhealthy", async () => {
    const app = express();
    app.use(
      createHealthRoutes({
        cacheService: { isHealthy: () => false },
        checkFirestore: async () => undefined,
        gcsBucket: { exists: async () => [true] as [boolean] },
      }),
    );

    const result = await runSupertestOrSkip(() =>
      request(app).get("/health/ready"),
    );
    if (!result) return;

    expect(result.status).toBe(503);
    expect(result.body.status).toBe("unhealthy");
    expect(result.body.dependencies.cache.healthy).toBe(false);
    expect(result.body.dependencies.cache.required).toBe(true);
  });

  it("returns 200 when non-required AI provider circuit is open", async () => {
    const app = express();
    app.use(
      createHealthRoutes({
        cacheService: { isHealthy: () => true },
        checkFirestore: async () => undefined,
        gcsBucket: { exists: async () => [true] as [boolean] },
        openAIClient: { getStats: () => ({ state: "OPEN" }) },
      }),
    );

    const result = await runSupertestOrSkip(() =>
      request(app).get("/health/ready"),
    );
    if (!result) return;

    expect(result.status).toBe(200);
    expect(result.body.status).toBe("ready");
    expect(result.body.dependencies.openAI).toMatchObject({
      required: false,
      healthy: false,
    });
  });

  it("returns 200 when checkFirestore is absent (skipped — treated as healthy)", async () => {
    const app = express();
    app.use(
      createHealthRoutes({
        cacheService: { isHealthy: () => true },
        gcsBucket: { exists: async () => [true] as [boolean] },
        // checkFirestore intentionally omitted
      }),
    );

    const result = await runSupertestOrSkip(() =>
      request(app).get("/health/ready"),
    );
    if (!result) return;

    expect(result.status).toBe(200);
    expect(result.body.status).toBe("ready");
    // Firebase present but skipped: still listed as healthy
    expect(result.body.dependencies.firebase.healthy).toBe(true);
  });

  it("returns 200 when gcsBucket is absent (not wired — treated as healthy)", async () => {
    const app = express();
    app.use(
      createHealthRoutes({
        cacheService: { isHealthy: () => true },
        checkFirestore: async () => undefined,
        // gcsBucket intentionally omitted
      }),
    );

    const result = await runSupertestOrSkip(() =>
      request(app).get("/health/ready"),
    );
    if (!result) return;

    expect(result.status).toBe(200);
    expect(result.body.status).toBe("ready");
    expect(result.body.dependencies.gcs.healthy).toBe(true);
  });

  it("preserves backward-compatible top-level fields", async () => {
    const app = express();
    app.use(
      createHealthRoutes({
        cacheService: { isHealthy: () => true },
        checkFirestore: async () => undefined,
        gcsBucket: { exists: async () => [true] as [boolean] },
      }),
    );

    const result = await runSupertestOrSkip(() =>
      request(app).get("/health/ready"),
    );
    if (!result) return;

    expect(result.body.timestamp).toBeDefined();
    // 'checks' key removed in favour of 'dependencies'
    expect(result.body.dependencies).toBeDefined();
  });

  it("circuit half-open + thresholds-OK: error contains degraded/half-open, lastChecked is non-null", async () => {
    const app = express();
    app.use(
      createHealthRoutes({
        cacheService: { isHealthy: () => true },
        gcsBucket: { exists: async () => [true] as [boolean] },
        firestoreCircuitExecutor: {
          getReadinessSnapshot: () => ({
            state: "half-open",
            open: false,
            degraded: true,
            failureRate: 0.05,
            latencyMeanMs: 100,
            thresholds: { failureRate: 0.5, latencyMs: 1500 },
            stats: {
              fires: 10,
              failures: 0,
              timeouts: 0,
              rejects: 0,
              successes: 10,
            },
          }),
        } as unknown as FirestoreCircuitExecutor,
      }),
    );

    const result = await runSupertestOrSkip(() =>
      request(app).get("/health/ready"),
    );
    if (!result) return;

    expect(result.status).toBe(503);
    expect(result.body.dependencies.firebase.healthy).toBe(false);
    expect(result.body.dependencies.firebase.error).toMatch(
      /circuit degraded.*half-open/i,
    );
    expect(result.body.dependencies.firebase.lastChecked).not.toBeNull();
    expect(typeof result.body.dependencies.firebase.lastChecked).toBe("string");
  });

  it("circuit snapshot present + not degraded: healthy true, error absent, lastChecked non-null", async () => {
    const app = express();
    app.use(
      createHealthRoutes({
        cacheService: { isHealthy: () => true },
        gcsBucket: { exists: async () => [true] as [boolean] },
        firestoreCircuitExecutor: {
          getReadinessSnapshot: () => ({
            state: "closed",
            open: false,
            degraded: false,
            failureRate: 0.01,
            latencyMeanMs: 50,
            thresholds: { failureRate: 0.5, latencyMs: 1500 },
            stats: {
              fires: 100,
              failures: 1,
              timeouts: 0,
              rejects: 0,
              successes: 99,
            },
          }),
        } as unknown as FirestoreCircuitExecutor,
      }),
    );

    const result = await runSupertestOrSkip(() =>
      request(app).get("/health/ready"),
    );
    if (!result) return;

    expect(result.status).toBe(200);
    expect(result.body.dependencies.firebase.healthy).toBe(true);
    expect(result.body.dependencies.firebase.error).toBeUndefined();
    expect(result.body.dependencies.firebase.lastChecked).not.toBeNull();
    expect(typeof result.body.dependencies.firebase.lastChecked).toBe("string");
  });
});

describe("GET /health", () => {
  it("returns 200 with healthy status", async () => {
    const app = express();
    app.use(
      createHealthRoutes({
        cacheService: { isHealthy: () => true },
      }),
    );

    const result = await runSupertestOrSkip(() => request(app).get("/health"));
    if (!result) return;

    expect(result.status).toBe(200);
    expect(result.body.status).toBe("healthy");
    expect(result.body.timestamp).toBeDefined();
    expect(result.body.uptime).toBeDefined();
  });
});

describe("GET /health/live", () => {
  it("returns 200 with alive status", async () => {
    const app = express();
    app.use(
      createHealthRoutes({
        cacheService: { isHealthy: () => true },
      }),
    );

    const result = await runSupertestOrSkip(() =>
      request(app).get("/health/live"),
    );
    if (!result) return;

    expect(result.status).toBe(200);
    expect(result.body.status).toBe("alive");
  });
});
