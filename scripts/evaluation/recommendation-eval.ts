#!/usr/bin/env tsx

/**
 * Model Intelligence Recommendation Eval (snapshot-style)
 *
 * Captures the current behavior of `ModelIntelligenceService.getRecommendation()`
 * across a fixed prompt set and gates future changes against drift from that
 * snapshot. This is a SNAPSHOT eval, not a quality eval — the baseline records
 * "what the recommender does today," not "what the right answer is."
 *
 * Why snapshot, not Relaxed-F1 like span labeling:
 *   - The recommender has no ground-truth "correct model" per prompt.
 *   - We just want a tight gate that flags unintended behavior changes when
 *     scoring weights, capability tables, or pipeline glue evolve.
 *
 * Why offline / mocked spans:
 *   - The recommender depends on PromptSpanProvider (an LLM). Calling live
 *     LLMs makes the eval slow, flaky, and budget-sensitive — and worse,
 *     conflates two failure modes (recommender drift vs span-labeling drift).
 *   - We mock spans per-prompt so this eval isolates the recommender.
 *   - All other dependencies (PromptRequirementsService, ModelScoringService,
 *     ModelCapabilityRegistry, AvailabilityGateService) run as production code.
 *
 * Usage:
 *   tsx scripts/evaluation/recommendation-eval.ts            # gate mode
 *   tsx scripts/evaluation/recommendation-eval.ts --bless    # write baseline
 *   tsx scripts/evaluation/recommendation-eval.ts --baseline default
 *
 * Exit codes:
 *   0 = passed (or bless succeeded)
 *   1 = drift detected
 *   2 = setup error (missing baseline, bad input file, runtime error)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ModelIntelligenceService } from "../../server/src/services/model-intelligence/ModelIntelligenceService.js";
import { ModelCapabilityRegistry } from "../../server/src/services/model-intelligence/services/ModelCapabilityRegistry.js";
import { ModelScoringService } from "../../server/src/services/model-intelligence/services/ModelScoringService.js";
import { PromptRequirementsService } from "../../server/src/services/model-intelligence/services/PromptRequirementsService.js";
import { RecommendationExplainerService } from "../../server/src/services/model-intelligence/services/RecommendationExplainerService.js";
import { AvailabilityGateService } from "../../server/src/services/model-intelligence/services/AvailabilityGateService.js";
import type { PromptSpanProvider } from "../../server/src/services/model-intelligence/ports/PromptSpanProvider.js";
import type {
  ModelRecommendation,
  PromptSpan,
} from "../../server/src/services/model-intelligence/types/index.js";
import type { VideoGenerationService } from "../../server/src/services/video-generation/VideoGenerationService.js";
import type {
  VideoAvailabilitySnapshot,
  VideoAvailabilitySnapshotModel,
} from "../../server/src/services/video-generation/types.js";
import type { VideoModelId } from "../../shared/videoModels.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROMPTS_PATH = join(__dirname, "recommendation-prompts.json");
const BASELINES_DIR = join(__dirname, "recommendation-baselines");
const RESULTS_PATH = join(__dirname, "recommendation-results-latest.json");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvalPrompt {
  id: string;
  prompt: string;
  mode: "t2v" | "i2v";
  durationSeconds: number;
  mockSpans: PromptSpan[];
}

interface EvalPromptSet {
  version: string;
  description?: string;
  prompts: EvalPrompt[];
}

/**
 * Per-prompt snapshot. Deliberately narrow — we only capture fields whose
 * stability we care about. Volatile fields (computedAt, promptId, full
 * factor-score arrays with explanations) are excluded because they would
 * cause noise without signal.
 */
interface PromptSnapshot {
  promptId: string;
  recommendedModelId: VideoModelId;
  recommendedConfidence: "high" | "medium" | "low";
  topRecommendations: Array<{
    modelId: VideoModelId;
    overallScore: number;
  }>;
  alsoConsiderModelId: VideoModelId | null;
  suggestComparison: boolean;
  comparisonModels: [VideoModelId, VideoModelId] | null;
  filteredOutCount: number;
  requirements: {
    physicsComplexity: string;
    hasParticleSystems: boolean;
    hasFluidDynamics: boolean;
    hasHumanCharacter: boolean;
    requiresFacialPerformance: boolean;
    emotionalIntensity: string;
    environmentType: string;
    environmentComplexity: string;
    lightingRequirements: string;
    requiresAtmospherics: boolean;
    isPhotorealistic: boolean;
    isStylized: boolean;
    requiresCinematicLook: boolean;
    cameraComplexity: string;
    subjectComplexity: string;
    hasMorphing: boolean;
  };
}

interface Baseline {
  blessedAt: string;
  baselineName: string;
  promptSetVersion: string;
  commit?: string;
  snapshots: Record<string, PromptSnapshot>;
}

interface CliOptions {
  bless: boolean;
  baselineName: string;
  promptsPath: string;
  commit: string | undefined;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    bless: false,
    baselineName: "default",
    promptsPath: PROMPTS_PATH,
    commit: process.env.GIT_COMMIT,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--bless") {
      opts.bless = true;
    } else if (arg === "--baseline") {
      const value = argv[++i];
      if (!value) throw new Error("--baseline requires a name");
      opts.baselineName = value;
    } else if (arg === "--prompts") {
      const value = argv[++i];
      if (!value) throw new Error("--prompts requires a path");
      opts.promptsPath = value;
    } else if (arg === "--commit") {
      opts.commit = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      // eslint-disable-next-line no-console
      console.log(
        "Usage: recommendation-eval.ts [--bless] [--baseline NAME] [--prompts PATH]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return opts;
}

// ---------------------------------------------------------------------------
// Mocked dependencies
// ---------------------------------------------------------------------------

/**
 * Synthetic availability snapshot: every registered model is fully available
 * with no plan-tier or credit gating. The eval cares about scoring drift, not
 * gating behavior — gating is exercised in unit tests.
 */
function buildFakeVideoGenerationService(
  modelIds: VideoModelId[],
): VideoGenerationService {
  const models: VideoAvailabilitySnapshotModel[] = modelIds.map((id) => ({
    id,
    available: true,
    supportsI2V: true,
    supportsImageInput: true,
    entitled: true,
    planTier: "unknown",
  }));
  const snapshot: VideoAvailabilitySnapshot = {
    models,
    availableModelIds: modelIds,
    unknownModelIds: [],
  };

  // The recommender only consumes getAvailabilitySnapshot; the rest of the
  // VideoGenerationService surface is irrelevant here. Cast through unknown
  // so we don't have to scaffold an entire fake.
  return {
    getAvailabilitySnapshot: () => snapshot,
  } as unknown as VideoGenerationService;
}

function buildSpanProvider(
  spansById: Map<string, PromptSpan[]>,
): PromptSpanProvider & { setActive(id: string): void } {
  let activeId = "";
  return {
    setActive(id: string) {
      activeId = id;
    },
    label(_prompt: string): Promise<PromptSpan[]> {
      return Promise.resolve(spansById.get(activeId) ?? []);
    },
  };
}

// ---------------------------------------------------------------------------
// Snapshot extraction
// ---------------------------------------------------------------------------

function extractSnapshot(
  promptId: string,
  recommendation: ModelRecommendation,
): PromptSnapshot {
  return {
    promptId,
    recommendedModelId: recommendation.recommended.modelId,
    recommendedConfidence: recommendation.recommended.confidence,
    topRecommendations: recommendation.recommendations
      .slice(0, 3)
      .map((score) => ({
        modelId: score.modelId,
        overallScore: score.overallScore,
      })),
    alsoConsiderModelId: recommendation.alsoConsider?.modelId ?? null,
    suggestComparison: recommendation.suggestComparison,
    comparisonModels: recommendation.comparisonModels ?? null,
    filteredOutCount: recommendation.filteredOut?.length ?? 0,
    requirements: {
      physicsComplexity: recommendation.requirements.physics.physicsComplexity,
      hasParticleSystems:
        recommendation.requirements.physics.hasParticleSystems,
      hasFluidDynamics: recommendation.requirements.physics.hasFluidDynamics,
      hasHumanCharacter:
        recommendation.requirements.character.hasHumanCharacter,
      requiresFacialPerformance:
        recommendation.requirements.character.requiresFacialPerformance,
      emotionalIntensity:
        recommendation.requirements.character.emotionalIntensity,
      environmentType: recommendation.requirements.environment.type,
      environmentComplexity: recommendation.requirements.environment.complexity,
      lightingRequirements: recommendation.requirements.lighting.requirements,
      requiresAtmospherics:
        recommendation.requirements.lighting.requiresAtmospherics,
      isPhotorealistic: recommendation.requirements.style.isPhotorealistic,
      isStylized: recommendation.requirements.style.isStylized,
      requiresCinematicLook:
        recommendation.requirements.style.requiresCinematicLook,
      cameraComplexity: recommendation.requirements.motion.cameraComplexity,
      subjectComplexity: recommendation.requirements.motion.subjectComplexity,
      hasMorphing: recommendation.requirements.motion.hasMorphing,
    },
  };
}

// ---------------------------------------------------------------------------
// Drift comparison
// ---------------------------------------------------------------------------

interface Drift {
  promptId: string;
  field: string;
  baseline: unknown;
  current: unknown;
}

function compareSnapshots(
  current: Record<string, PromptSnapshot>,
  baseline: Record<string, PromptSnapshot>,
): { drifts: Drift[]; missingPrompts: string[]; newPrompts: string[] } {
  const drifts: Drift[] = [];
  const missingPrompts: string[] = [];
  const newPrompts: string[] = [];

  for (const promptId of Object.keys(baseline)) {
    if (!(promptId in current)) {
      missingPrompts.push(promptId);
      continue;
    }
    const baselineSnap = baseline[promptId];
    const currentSnap = current[promptId];
    if (!baselineSnap || !currentSnap) continue;
    diffSnapshot(promptId, baselineSnap, currentSnap, drifts);
  }

  for (const promptId of Object.keys(current)) {
    if (!(promptId in baseline)) {
      newPrompts.push(promptId);
    }
  }

  return { drifts, missingPrompts, newPrompts };
}

function diffSnapshot(
  promptId: string,
  baseline: PromptSnapshot,
  current: PromptSnapshot,
  drifts: Drift[],
): void {
  // Top-level scalar fields
  const scalarFields: Array<keyof PromptSnapshot> = [
    "recommendedModelId",
    "recommendedConfidence",
    "alsoConsiderModelId",
    "suggestComparison",
    "filteredOutCount",
  ];
  for (const field of scalarFields) {
    if (!shallowEqual(baseline[field], current[field])) {
      drifts.push({
        promptId,
        field,
        baseline: baseline[field],
        current: current[field],
      });
    }
  }

  // Comparison models — array of two ids, order-sensitive (the recommender
  // returns a specific [first, second] tuple)
  if (
    JSON.stringify(baseline.comparisonModels) !==
    JSON.stringify(current.comparisonModels)
  ) {
    drifts.push({
      promptId,
      field: "comparisonModels",
      baseline: baseline.comparisonModels,
      current: current.comparisonModels,
    });
  }

  // Top recommendations — model id and score, both matter
  if (
    JSON.stringify(baseline.topRecommendations) !==
    JSON.stringify(current.topRecommendations)
  ) {
    drifts.push({
      promptId,
      field: "topRecommendations",
      baseline: baseline.topRecommendations,
      current: current.topRecommendations,
    });
  }

  // Requirements — drift here points at PromptRequirementsService changes
  for (const field of Object.keys(baseline.requirements) as Array<
    keyof PromptSnapshot["requirements"]
  >) {
    if (baseline.requirements[field] !== current.requirements[field]) {
      drifts.push({
        promptId,
        field: `requirements.${field}`,
        baseline: baseline.requirements[field],
        current: current.requirements[field],
      });
    }
  }
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  return false;
}

// ---------------------------------------------------------------------------
// IO helpers
// ---------------------------------------------------------------------------

function loadPrompts(path: string): EvalPromptSet {
  if (!existsSync(path)) {
    throw new Error(`Prompt set not found at ${path}`);
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as EvalPromptSet;
  if (!Array.isArray(parsed.prompts) || parsed.prompts.length === 0) {
    throw new Error(`Prompt set at ${path} has no prompts`);
  }
  return parsed;
}

function baselinePath(name: string): string {
  return join(BASELINES_DIR, `${name}.json`);
}

function readBaseline(name: string): Baseline | null {
  const path = baselinePath(name);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Baseline;
}

function writeBaseline(baseline: Baseline): void {
  if (!existsSync(BASELINES_DIR)) mkdirSync(BASELINES_DIR, { recursive: true });
  writeFileSync(
    baselinePath(baseline.baselineName),
    JSON.stringify(baseline, null, 2) + "\n",
    "utf8",
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function runEval(options: {
  promptsPath: string;
}): Promise<Record<string, PromptSnapshot>> {
  const promptSet = loadPrompts(options.promptsPath);

  const spansById = new Map<string, PromptSpan[]>();
  for (const prompt of promptSet.prompts) {
    spansById.set(prompt.id, prompt.mockSpans);
  }

  const registry = new ModelCapabilityRegistry();
  const modelIds = registry.getAllModels();
  const fakeVideoService = buildFakeVideoGenerationService(modelIds);
  const availabilityGate = new AvailabilityGateService(fakeVideoService, null);
  const spanProvider = buildSpanProvider(spansById);

  const service = new ModelIntelligenceService({
    promptSpanProvider: spanProvider,
    availabilityGate,
    requirementsService: new PromptRequirementsService(),
    registry,
    scoringService: new ModelScoringService(),
    explainerService: new RecommendationExplainerService(),
  });

  const snapshots: Record<string, PromptSnapshot> = {};

  for (const prompt of promptSet.prompts) {
    spanProvider.setActive(prompt.id);
    // Pass mockSpans explicitly so the service skips the provider call entirely
    // when spans are present — the provider only fires for prompts whose set
    // is empty (the no-spans-fallback case).
    const recommendation = await service.getRecommendation(prompt.prompt, {
      mode: prompt.mode,
      durationSeconds: prompt.durationSeconds,
      ...(prompt.mockSpans.length > 0 ? { spans: prompt.mockSpans } : {}),
    });
    snapshots[prompt.id] = extractSnapshot(prompt.id, recommendation);
  }

  return snapshots;
}

async function main(): Promise<number> {
  const opts = parseArgs(process.argv.slice(2));

  // eslint-disable-next-line no-console
  console.log("Model Intelligence Recommendation Eval");
  // eslint-disable-next-line no-console
  console.log(`  mode: ${opts.bless ? "bless" : "gate"}`);
  // eslint-disable-next-line no-console
  console.log(`  baseline: ${opts.baselineName}`);
  // eslint-disable-next-line no-console
  console.log(`  prompts: ${opts.promptsPath}`);

  const promptSet = loadPrompts(opts.promptsPath);
  // eslint-disable-next-line no-console
  console.log(`  loaded ${promptSet.prompts.length} prompts`);

  const snapshots = await runEval({ promptsPath: opts.promptsPath });

  // Always write latest results JSON for debugging / artifact upload
  writeFileSync(
    RESULTS_PATH,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        baselineName: opts.baselineName,
        promptSetVersion: promptSet.version,
        commit: opts.commit ?? null,
        snapshots,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
  // eslint-disable-next-line no-console
  console.log(`  results: ${RESULTS_PATH}`);

  if (opts.bless) {
    const baseline: Baseline = {
      blessedAt: new Date().toISOString(),
      baselineName: opts.baselineName,
      promptSetVersion: promptSet.version,
      ...(opts.commit !== undefined && { commit: opts.commit }),
      snapshots,
    };
    writeBaseline(baseline);
    // eslint-disable-next-line no-console
    console.log(`\nBaseline blessed: ${baselinePath(opts.baselineName)}`);
    return 0;
  }

  const baseline = readBaseline(opts.baselineName);
  if (!baseline) {
    // eslint-disable-next-line no-console
    console.error(
      `\nNo baseline at ${baselinePath(opts.baselineName)}. Run with --bless first to establish one.`,
    );
    return 2;
  }

  const { drifts, missingPrompts, newPrompts } = compareSnapshots(
    snapshots,
    baseline.snapshots,
  );

  if (drifts.length === 0 && missingPrompts.length === 0) {
    // eslint-disable-next-line no-console
    console.log("\nRecommendation snapshot gate: PASSED");
    if (newPrompts.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `  Note: ${newPrompts.length} new prompt(s) not in baseline — re-bless to capture: ${newPrompts.join(", ")}`,
      );
    }
    return 0;
  }

  // eslint-disable-next-line no-console
  console.error("\nRecommendation snapshot gate: FAILED");
  if (drifts.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`\nDrifts (${drifts.length}):`);
    for (const drift of drifts) {
      // eslint-disable-next-line no-console
      console.error(
        `  ${drift.promptId} ${drift.field}: ${JSON.stringify(drift.baseline)} -> ${JSON.stringify(drift.current)}`,
      );
    }
  }
  if (missingPrompts.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `\nMissing prompts (in baseline, not in current run): ${missingPrompts.join(", ")}`,
    );
  }
  if (newPrompts.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `\nNew prompts (not in baseline — bless required): ${newPrompts.join(", ")}`,
    );
  }
  return 1;
}

// Only execute when invoked directly (not when imported by tests)
const isDirectInvocation =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectInvocation) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error("\nFatal error:", error);
      process.exit(2);
    });
}
