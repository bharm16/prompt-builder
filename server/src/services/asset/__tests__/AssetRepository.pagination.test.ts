import { describe, it, expect, vi } from "vitest";
import AssetRepository from "../AssetRepository";
import type { Asset } from "@shared/types/asset";

/**
 * Regression: AssetRepository.getByType returns a structured `{ items, hasMore }`
 * result so callers can detect when their result set was truncated by the
 * query cap. Implementation uses the "fetch one extra row" probe pattern:
 * query with `.limit(limit + 1)`, slice off the excess, and set
 * `hasMore = allFetched.length > limit`.
 */

interface QueryChain {
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
}

interface FakeDoc {
  data: () => Asset;
}

function buildAsset(id: string): Asset {
  return {
    id,
    userId: "user-1",
    type: "character",
    trigger: id,
    name: id,
    textDefinition: "",
    negativePrompt: "",
    referenceImages: [],
    faceEmbedding: null,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function buildDocs(count: number): FakeDoc[] {
  return Array.from({ length: count }, (_, i) => ({
    data: () => buildAsset(`asset-${i}`),
  }));
}

function buildQueryChain(docs: FakeDoc[]): QueryChain {
  const chain: QueryChain = {
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    get: vi.fn().mockResolvedValue({ docs }),
  };
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

function buildRepository(chain: QueryChain): AssetRepository {
  const assetsCollection = {
    ...chain,
    doc: vi.fn(() => ({ get: vi.fn() })),
  };
  const userDoc = { collection: vi.fn(() => assetsCollection) };
  const usersCollection = { doc: vi.fn(() => userDoc) };
  const db = {
    collection: vi.fn(() => usersCollection),
  } as unknown as FirebaseFirestore.Firestore;

  return new AssetRepository({
    db,
    bucket: { name: "test-bucket", file: vi.fn() } as never,
    bucketName: "test-bucket",
  });
}

describe("AssetRepository.getByType pagination", () => {
  it("returns hasMore=false when fewer than limit rows are available", async () => {
    // Firestore returned 5 rows when we asked for limit+1=11 — there are no more.
    const limit = 10;
    const chain = buildQueryChain(buildDocs(5));
    const repository = buildRepository(chain);

    const result = await repository.getByType("user-1", "character", limit);

    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(5);
  });

  it("returns hasMore=false when exactly limit rows are available", async () => {
    // Firestore returned 10 rows for limit+1=11 — exactly limit, no probe row.
    const limit = 10;
    const chain = buildQueryChain(buildDocs(10));
    const repository = buildRepository(chain);

    const result = await repository.getByType("user-1", "character", limit);

    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(limit);
  });

  it("returns hasMore=true and slices excess when the probe row is present", async () => {
    // Firestore returned limit+1=11 rows — the probe row exists, so more are available.
    const limit = 10;
    const chain = buildQueryChain(buildDocs(11));
    const repository = buildRepository(chain);

    const result = await repository.getByType("user-1", "character", limit);

    expect(result.hasMore).toBe(true);
    // Excess sliced — caller must never see more than `limit` items.
    expect(result.items).toHaveLength(limit);
  });

  it("queries Firestore with limit+1 to enable the probe", async () => {
    const limit = 10;
    const chain = buildQueryChain(buildDocs(0));
    const repository = buildRepository(chain);

    await repository.getByType("user-1", "character", limit);

    expect(chain.limit).toHaveBeenCalledWith(limit + 1);
  });

  it("preserves item order from the Firestore snapshot when slicing", async () => {
    const limit = 3;
    const chain = buildQueryChain(buildDocs(4));
    const repository = buildRepository(chain);

    const result = await repository.getByType("user-1", "character", limit);

    expect(result.hasMore).toBe(true);
    expect(result.items.map((asset) => asset.id)).toEqual([
      "asset-0",
      "asset-1",
      "asset-2",
    ]);
  });
});
