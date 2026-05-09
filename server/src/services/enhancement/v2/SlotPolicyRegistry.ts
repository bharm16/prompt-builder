import { getParentCategory } from "@shared/taxonomy";
import { SLOT_POLICIES } from "./policies/slotPolicies.js";
import type { SlotPolicy } from "./types.js";

const fallbackPolicy: SlotPolicy = {
  categoryId: "subject",
  mode: "guided_llm",
  grammar: { kind: "freeform", minWords: 1, maxWords: 8 },
  targetCount: 6,
  minAcceptableCount: 3,
  requiredFamilies: ["subject_identity", "subject_appearance"],
  forbiddenFamilies: ["camera_movement", "camera_lens", "lighting_direction"],
  promptGuidance: "Suggest literal, camera-visible alternatives.",
  rescueStrategy: { enabled: true, maxCalls: 1 },
  scorerWeights: {
    familyFit: 0.45,
    contextFit: 0.25,
    literalness: 0.2,
    overlapPenalty: 0.1,
  },
};

/**
 * Synthetic category ID for the custom-request policy. Not part of the
 * taxonomy — it's a marker the engine uses to resolve the CustomPolicy
 * when a request carries `customRequest`.
 */
export const CUSTOM_POLICY_CATEGORY_ID = "__custom__";

/**
 * Policy used when a user provides a free-form custom request (e.g. "make
 * this more cinematic"). It has no required/forbidden semantic families —
 * the user's request is the steering signal — and a wider grammar so
 * stylistic phrases aren't rejected by slot-shape checks. Scoring leans
 * away from family-fit (which doesn't apply) and toward literalness +
 * context fit. Rescue is enabled so we still benefit from the V2 engine's
 * compensatory call when too few candidates survive scoring.
 */
const customPolicy: SlotPolicy = {
  categoryId: CUSTOM_POLICY_CATEGORY_ID,
  mode: "guided_llm",
  grammar: { kind: "freeform", minWords: 1, maxWords: 50 },
  targetCount: 12,
  minAcceptableCount: 4,
  requiredFamilies: [],
  forbiddenFamilies: [],
  promptGuidance:
    "Fulfill the user's custom request literally while keeping the replacement grammatical in context.",
  rescueStrategy: { enabled: true, maxCalls: 1 },
  scorerWeights: {
    familyFit: 0,
    contextFit: 0.5,
    literalness: 0.4,
    overlapPenalty: 0.1,
  },
  suggestionSchemaName: "custom",
};

export class SlotPolicyRegistry {
  private readonly exact = new Map<string, SlotPolicy>();

  constructor(private readonly policyVersion: string) {
    for (const policy of SLOT_POLICIES) {
      this.exact.set(policy.categoryId, policy);
    }
    this.exact.set(CUSTOM_POLICY_CATEGORY_ID, customPolicy);
  }

  resolve(categoryId: string | null | undefined): SlotPolicy {
    if (!categoryId) {
      return fallbackPolicy;
    }

    const direct = this.exact.get(categoryId);
    if (direct) {
      return direct;
    }

    const parent = getParentCategory(categoryId);
    if (parent) {
      const parentPolicy = this.exact.get(parent);
      if (parentPolicy) {
        return parentPolicy;
      }
    }

    return fallbackPolicy;
  }

  getVersion(): string {
    return this.policyVersion;
  }
}
