import { describe, it, expect } from "vitest";
import { loadRubric } from "../rubric-loader.js";

describe("rubric prompts", () => {
  it("locks the optimize rubric content", async () => {
    expect(await loadRubric("optimize")).toMatchSnapshot();
  });

  it("locks the suggestions rubric content", async () => {
    expect(await loadRubric("suggestions")).toMatchSnapshot();
  });

  it("locks the span-labeling rubric content", async () => {
    expect(await loadRubric("span-labeling")).toMatchSnapshot();
  });
});
