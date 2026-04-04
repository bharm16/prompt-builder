import { describe, expect, it } from "vitest";

import {
  CANONICAL_PROMPT_MODEL_IDS,
  getPromptModelConstraints,
} from "@shared/videoModels";
import { createDefaultStrategyRegistry } from "../createDefaultStrategyRegistry";
import {
  REGISTERED_MODEL_PROMPT_STRATEGY_IDS,
  resolveModelPromptStrategy,
} from "../../services/rewriter/strategies";

describe("prompt model catalog consistency", () => {
  it("keeps model constraints, strategy registration, and rewrite strategies aligned", () => {
    const registry = createDefaultStrategyRegistry();

    for (const modelId of CANONICAL_PROMPT_MODEL_IDS) {
      expect(getPromptModelConstraints(modelId)).toBeDefined();
      expect(registry.has(modelId)).toBe(true);
      expect(registry.getModelConstraints(modelId)).toEqual(
        getPromptModelConstraints(modelId),
      );
      expect(REGISTERED_MODEL_PROMPT_STRATEGY_IDS).toContain(modelId);
      expect(resolveModelPromptStrategy(modelId).modelId).toBe(modelId);
    }
  });
});
