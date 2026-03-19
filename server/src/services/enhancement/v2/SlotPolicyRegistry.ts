import { getParentCategory } from '@shared/taxonomy';
import { SLOT_POLICIES } from './policies/slotPolicies.js';
import type { SlotPolicy } from './types.js';

const fallbackPolicy: SlotPolicy = {
  categoryId: 'subject',
  mode: 'guided_llm',
  grammar: { kind: 'freeform', minWords: 1, maxWords: 8 },
  targetCount: 6,
  minAcceptableCount: 3,
  requiredFamilies: ['subject_identity', 'subject_appearance'],
  forbiddenFamilies: ['camera_movement', 'camera_lens', 'lighting_direction'],
  promptGuidance: 'Suggest literal, camera-visible alternatives.',
  rescueStrategy: { enabled: true, maxCalls: 1 },
  scorerWeights: {
    familyFit: 0.45,
    contextFit: 0.25,
    literalness: 0.2,
    overlapPenalty: 0.1,
  },
};

export class SlotPolicyRegistry {
  private readonly exact = new Map<string, SlotPolicy>();

  constructor(private readonly policyVersion: string) {
    for (const policy of SLOT_POLICIES) {
      this.exact.set(policy.categoryId, policy);
    }
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
