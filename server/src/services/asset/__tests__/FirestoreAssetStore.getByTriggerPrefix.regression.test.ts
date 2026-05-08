import { describe, it, expect, vi } from "vitest";
import FirestoreAssetStore from "../storage/FirestoreAssetStore";

/**
 * Regression: `getByTriggerPrefix` builds a Firestore range query of the
 * form `trigger >= prefix AND trigger < prefix + ""`. The upper
 * bound must be the high-codepoint sentinel ``, not an empty string
 * or the bare prefix — otherwise the range collapses to an unsatisfiable
 * predicate and the method silently returns `[]` for every input.
 *
 * The sentinel is a single Unicode code point in the Private Use Area;
 * when written as a literal character it renders invisibly in editors
 * and diff viewers, which makes accidental deletion easy and silent.
 * Always write it as the escape sequence `""`.
 *
 * No tests previously covered this method, so this codifies the contract
 * that asset-trigger autocomplete (`AssetResolverService.findByPrefix`)
 * depends on.
 */

interface QueryClause {
  field: string;
  op: string;
  value: string;
}

const triggerDoc = (trigger: string) => ({
  data: () => ({
    id: `asset_${trigger}`,
    userId: "user-1",
    type: "character",
    trigger,
    name: trigger,
    textDefinition: "",
    negativePrompt: "",
    referenceImages: [],
    faceEmbedding: null,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }),
});

const matchesClauses = (trigger: string, clauses: QueryClause[]): boolean =>
  clauses.every((clause) => {
    if (clause.field !== "trigger") return true;
    if (clause.op === ">=") return trigger >= clause.value;
    if (clause.op === "<") return trigger < clause.value;
    if (clause.op === "==") return trigger === clause.value;
    return true;
  });

const buildFirestoreMock = (triggers: string[]) => {
  const allDocs = triggers.map(triggerDoc);

  const buildQuery = (clauses: QueryClause[]): any => ({
    where: (field: string, op: string, value: string) =>
      buildQuery([...clauses, { field, op, value }]),
    orderBy: () => buildQuery(clauses),
    limit: () => buildQuery(clauses),
    get: vi.fn().mockImplementation(async () => {
      const docs = allDocs.filter((doc) =>
        matchesClauses(
          (doc.data() as { trigger: string }).trigger,
          clauses,
        ),
      );
      return { docs, empty: docs.length === 0 };
    }),
  });

  const assetsCollection = buildQuery([]);
  const userDoc = { collection: vi.fn(() => assetsCollection) };
  const usersCollection = { doc: vi.fn(() => userDoc) };
  return {
    collection: vi.fn(() => usersCollection),
  } as unknown as FirebaseFirestore.Firestore;
};

const createStore = (triggers: string[]) => {
  const db = buildFirestoreMock(triggers);
  const bucket = { name: "test-bucket", file: vi.fn() } as any;
  return new FirestoreAssetStore({
    db,
    bucket,
    bucketName: "test-bucket",
  });
};

describe("regression: FirestoreAssetStore.getByTriggerPrefix", () => {
  it("returns every stored trigger that starts with the prefix", async () => {
    const store = createStore([
      "@hero",
      "@hero-knight",
      "@hero-mage",
      "@heroine",
      "@villain",
      "@nemesis",
    ]);

    const matches = await store.getByTriggerPrefix("user-1", "@hero", 50);
    const triggers = matches.map((asset) => asset.trigger).sort();

    expect(triggers).toEqual([
      "@hero",
      "@hero-knight",
      "@hero-mage",
      "@heroine",
    ]);
  });

  it("excludes triggers that fall outside the prefix range", async () => {
    const store = createStore(["@hero", "@hi", "@villain"]);

    const matches = await store.getByTriggerPrefix("user-1", "@hero", 50);
    const triggers = matches.map((asset) => asset.trigger);

    expect(triggers).toEqual(["@hero"]);
  });

  it("returns an empty list when the prefix is empty", async () => {
    const store = createStore(["@hero", "@villain"]);

    const matches = await store.getByTriggerPrefix("user-1", "", 50);

    expect(matches).toEqual([]);
  });
});
