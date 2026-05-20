import { describe, it, expect } from "vitest";
import { buildArchitectureMap } from "../generate-architecture-map.ts";

describe("generate-architecture-map", () => {
  it("emits a JSON object with meta, runtime, routes, featureFlags", () => {
    const map = buildArchitectureMap();
    expect(map).toMatchObject({
      meta: expect.objectContaining({ project: "Vidra" }),
      runtime: expect.objectContaining({ node: expect.any(String) }),
      routes: expect.any(Array),
      featureFlags: expect.any(Array),
    });
  });

  it("featureFlags entries include requiresEnv and dependsOn", () => {
    const map = buildArchitectureMap();
    const faceEmbedding = map.featureFlags.find(
      (f: { envName: string }) => f.envName === "ENABLE_FACE_EMBEDDING",
    );
    expect(faceEmbedding).toBeDefined();
    expect(faceEmbedding.requiresEnv).toEqual(["REPLICATE_API_TOKEN"]);
    expect(faceEmbedding.dependsOn).toEqual(["ENABLE_CONVERGENCE"]);
  });

  it("routes entries are non-empty", () => {
    const map = buildArchitectureMap();
    expect(map.routes.length).toBeGreaterThan(10);
  });
});
