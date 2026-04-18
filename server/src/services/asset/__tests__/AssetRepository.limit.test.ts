import { describe, it, expect, vi } from "vitest";
import AssetRepository from "../AssetRepository";

/**
 * Regression: AssetRepository.getByType must cap the Firestore query with
 * `.limit()` to bound memory usage and read cost. Without this, a user with
 * many assets of the same type could trigger unbounded document reads.
 */

interface QueryChain {
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
}

function buildQueryChain(): QueryChain {
  const chain: QueryChain = {
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    get: vi.fn().mockResolvedValue({ docs: [] }),
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

describe("AssetRepository.getByType limit", () => {
  it("applies .limit() to the Firestore query (default cap = 200)", async () => {
    const chain = buildQueryChain();
    const repository = buildRepository(chain);

    await repository.getByType("user-1", "character");

    expect(chain.where).toHaveBeenCalledWith("type", "==", "character");
    expect(chain.orderBy).toHaveBeenCalledWith("updatedAt", "desc");
    // Invariant: the query chain must include a .limit() call.
    expect(chain.limit).toHaveBeenCalledTimes(1);
    expect(chain.limit).toHaveBeenCalledWith(200);
  });

  it("forwards a caller-provided limit to the Firestore query", async () => {
    const chain = buildQueryChain();
    const repository = buildRepository(chain);

    await repository.getByType("user-1", "character", 50);

    expect(chain.limit).toHaveBeenCalledTimes(1);
    expect(chain.limit).toHaveBeenCalledWith(50);
  });
});
