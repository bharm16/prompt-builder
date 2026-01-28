/**
 * OpenAI Video Template Builder with Locked Span Support
 *
 * Builds a new template variant that enforces locked spans without
 * modifying the existing OpenAI template content.
 */

import { logger } from '@infrastructure/Logger';
import { wrapUserData } from '@utils/provider/PromptBuilder';
import { OpenAIVideoTemplateBuilder } from './OpenAIVideoTemplateBuilder';
import { BaseVideoTemplateBuilder, type VideoTemplateContext, type VideoTemplateResult } from './BaseVideoTemplateBuilder';

export class OpenAIVideoTemplateBuilderLocked extends BaseVideoTemplateBuilder {
  protected override readonly log = logger.child({ service: 'OpenAIVideoTemplateBuilderLocked' });
  private readonly baseBuilder = new OpenAIVideoTemplateBuilder();

  override buildTemplate(context: VideoTemplateContext): VideoTemplateResult {
    const { userConcept, interpretedPlan, includeInstructions = true, lockedSpans = [], generationParams, originalUserPrompt } = context;

    const baseTemplate = this.baseBuilder.buildTemplate({
      userConcept,
      includeInstructions,
      ...(originalUserPrompt ? { originalUserPrompt } : {}),
      ...(interpretedPlan !== undefined ? { interpretedPlan } : {}),
      ...(generationParams ? { generationParams } : {}),
    });

    const developerMessage = `${baseTemplate.developerMessage ?? ''}\n\n${this.buildLockedSpanInstructions()}`.trim();
    const userMessage = this.wrapUserConceptWithLockedSpans(userConcept, interpretedPlan, lockedSpans, originalUserPrompt ?? null);

    return {
      ...baseTemplate,
      developerMessage,
      userMessage,
    };
  }

  private buildLockedSpanInstructions(): string {
    return `LOCKED SPANS (HARD CONSTRAINTS):
- Include EVERY locked span text verbatim in the final prompt.
- Do NOT paraphrase or drop locked spans.
- You may reposition them, but keep a coherent clause and preserve any provided left/right context.
- Place locked spans into the appropriate JSON fields so they appear in the assembled prompt.`;
  }

  private wrapUserConceptWithLockedSpans(
    userConcept: string,
    interpretedPlan?: Record<string, unknown> | null,
    lockedSpans: VideoTemplateContext['lockedSpans'] = [],
    originalUserPrompt?: string | null
  ): string {
    const fields: Record<string, string> = {
      user_concept: userConcept,
    };

    if (originalUserPrompt) {
      fields.original_user_prompt = originalUserPrompt;
    }

    if (interpretedPlan) {
      fields.interpreted_plan = JSON.stringify(interpretedPlan, null, 2);
    }

    if (lockedSpans && lockedSpans.length > 0) {
      const lockedPayload = lockedSpans.map((span) => ({
        text: span.text,
        leftCtx: span.leftCtx ?? null,
        rightCtx: span.rightCtx ?? null,
        category: span.category ?? null,
      }));
      fields.locked_spans = JSON.stringify(lockedPayload, null, 2);
    }

    return wrapUserData(fields);
  }
}
