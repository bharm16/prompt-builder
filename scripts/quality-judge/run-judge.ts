import {
  createEvalEmitter,
  resolveDistinctId,
} from "../evaluation/posthog-emitter.js";

import {
  extractInputContent,
  extractOutputContent,
  isJudgeable,
} from "./content-extractors.js";
import { runJudge, JUDGE_MODEL_NAME } from "./judge-client.js";
import {
  createPostHogQueryClient,
  type PostHogQueryClient,
} from "./posthog-query-client.js";
import { loadRubric, rubricVersionFor } from "./rubric-loader.js";
import {
  scoredEventNameFor,
  sumDimensions,
  type QualityScoredSurface,
} from "./judge-event-types.js";

export interface RunJudgeOptions {
  hoursBack: number;
  /**
   * Fraction (0..1) of `source = 'user'` events to score.
   * Per spec § 1: 10% pre-launch (0.1). `synthetic` + `dogfood` are always 100%.
   */
  userSampleRate: number;
}

export async function runJudgeForSurface(
  surface: QualityScoredSurface,
  opts: RunJudgeOptions,
  // Injectable for tests; default to the real implementations
  deps?: { queryClient?: PostHogQueryClient },
): Promise<void> {
  const emitter = createEvalEmitter();
  const queryClient = deps?.queryClient ?? createPostHogQueryClient();
  try {
    const rubric = await loadRubric(surface);
    const rubricVersion = await rubricVersionFor(surface);
    const eventName = scoredEventNameFor(surface);

    const events = await queryClient.fetchEventsToScore(
      eventName,
      opts.hoursBack,
      opts.userSampleRate,
    );
    if (events.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`[quality-judge] ${surface}: no events to score.`);
      return;
    }

    const seen = await queryClient.fetchAlreadyScoredIds(
      events.map((e) => e.uuid),
      rubricVersion,
      JUDGE_MODEL_NAME,
    );

    for (const event of events) {
      if (seen.has(event.uuid)) continue;
      if (!isJudgeable(event, surface)) continue;

      const startedAt = Date.now();
      try {
        const judged = await runJudge({
          rubric,
          surface,
          inputContent: extractInputContent(event, surface),
          outputContent: extractOutputContent(event, surface),
        });
        const totalScore = sumDimensions(judged.dimensions);
        emitter.emit({
          distinctId: resolveDistinctId(),
          event: "quality.scored",
          properties: {
            scoredEvent: event.event,
            scoredEventId: event.uuid,
            surface,
            rubricVersion,
            judgeModel: JUDGE_MODEL_NAME,
            judgeDurationMs: Date.now() - startedAt,
            judgeCostUsd: judged.costUsd,
            totalScore,
            dimensions: judged.dimensions,
            reasoning: judged.reasoning,
            source: event.properties.source ?? "unknown",
          },
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `[quality-judge] ${surface} ${event.uuid}: judge failed: ${String(err)}`,
        );
      }
    }
  } finally {
    await emitter.shutdown();
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const surfaces: QualityScoredSurface[] = args.has("--surface")
    ? [
        process.argv[
          process.argv.indexOf("--surface") + 1
        ] as QualityScoredSurface,
      ]
    : ["optimize", "suggestions", "span-labeling"];
  const hoursBack = Number(process.env.QUALITY_JUDGE_HOURS_BACK ?? 24);
  // Default 0.1 per spec § 1 ("10% user initially"). synth/dogfood always 100%.
  const userSampleRate = Number(
    process.env.QUALITY_JUDGE_USER_SAMPLE_RATE ?? 0.1,
  );

  for (const surface of surfaces) {
    // eslint-disable-next-line no-console
    console.log(`[quality-judge] running for ${surface}`);
    await runJudgeForSurface(surface, { hoursBack, userSampleRate });
  }
}

// Run when invoked directly via tsx
const invokedAsScript = import.meta.url === `file://${process.argv[1]}`;
if (invokedAsScript) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[quality-judge] fatal:", err);
    process.exit(1);
  });
}
