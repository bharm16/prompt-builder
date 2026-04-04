#!/usr/bin/env tsx

import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import type { EnhancementService } from "../server/src/services/enhancement/EnhancementService.ts";
import { hardCaseBenchmarks } from "../server/src/services/enhancement/evaluation/__fixtures__/suggestionQualityHardCases.ts";
import { PolicyAwareSuggestionQualityEvaluator } from "../server/src/services/enhancement/evaluation/PolicyAwareSuggestionQualityEvaluator.ts";
import type {
  EnhancementRequestParams,
  EnhancementResult,
  Suggestion,
} from "../server/src/services/enhancement/services/types.ts";
import type { SuggestionTestCase } from "../server/src/services/enhancement/evaluation/SuggestionQualityEvaluator.ts";
import type { VideoPromptService } from "../server/src/services/video-prompt-analysis/VideoPromptService.ts";

interface CliOptions {
  singleCase?: Partial<ComparisonCase>;
  filePath?: string;
  timeoutMs: number;
  skipInitialize: boolean;
  verbose: boolean;
  showDebug: boolean;
  useCache: boolean;
  useHardCases: boolean;
}

interface ComparisonCase {
  name: string;
  prompt: string;
  highlightedText: string;
  highlightedCategory: string;
  highlightedCategoryConfidence: number;
  contextBefore: string;
  contextAfter: string;
  originalUserPrompt: string;
  brainstormContext?: EnhancementRequestParams["brainstormContext"];
  allLabeledSpans?: EnhancementRequestParams["allLabeledSpans"];
  nearbySpans?: EnhancementRequestParams["nearbySpans"];
  editHistory?: EnhancementRequestParams["editHistory"];
  i2vContext?: EnhancementRequestParams["i2vContext"];
}

interface EngineRun {
  engine: "v1" | "v2";
  durationMs: number;
  suggestions: Suggestion[];
  result?: EnhancementResult;
  quality?: Awaited<
    ReturnType<PolicyAwareSuggestionQualityEvaluator["evaluateCase"]>
  >;
  error?: string;
}

type ScoreKey =
  | "contextualFit"
  | "categoryAlignment"
  | "diversity"
  | "videoSpecificity"
  | "sceneCoherence";

const SCORE_KEYS: ScoreKey[] = [
  "contextualFit",
  "categoryAlignment",
  "diversity",
  "videoSpecificity",
  "sceneCoherence",
];

const DEFAULT_TIMEOUT_MS = 120_000;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

function printUsage(): void {
  console.log(`\nEnhancement Engine Comparison Test\n
Usage:
  tsx --tsconfig server/tsconfig.json scripts/test-enhancement-v1-v2.ts --prompt "A cinematic drone shot over neon city at dusk" --highlighted-text "at dusk" --category "lighting.timeOfDay"
  tsx --tsconfig server/tsconfig.json scripts/test-enhancement-v1-v2.ts --file ./enhancement-cases.json
  tsx --tsconfig server/tsconfig.json scripts/test-enhancement-v1-v2.ts --hard-cases

Options:
  --prompt <text>         Full prompt for a single test case
  --highlighted-text <t>  Selected span to replace (required with --prompt)
  --category <id>         Highlighted category (required with --prompt)
  --confidence <n>        Highlighted category confidence (default: 0.95)
  --context-before <t>    Override context before the highlighted text
  --context-after <t>     Override context after the highlighted text
  --name <text>           Optional case label for single-case runs
  --file <path>           Load JSON array/object or NDJSON enhancement cases
  --hard-cases            Run the built-in hard-case benchmark fixtures
  --timeout-ms <ms>       Soft timeout per engine run (default: ${DEFAULT_TIMEOUT_MS})
  --skip-initialize       Skip initializeServices() startup checks
  --verbose               Keep server logger output enabled
  --show-debug            Print engine debug metadata
  --use-cache             Allow cache hits instead of forcing fresh runs
  --help                  Show this help

Notes:
  - This script runs both enhancement engines through the service layer, not over HTTP.
  - Cache is bypassed by default so V1 and V2 runs are comparable.
  - Unlike the optimizer script, enhancement testing cannot sensibly accept a bare prompt list.
    You need at least a prompt, a highlighted span, and a category.\n`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeText(text: string): string {
  return text.trim();
}

function loadEnvFiles(repoRoot: string): void {
  const candidates = [
    path.join(repoRoot, ".env.development.local"),
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, ".env.development"),
    path.join(repoRoot, ".env"),
  ];

  for (const file of candidates) {
    if (existsSync(file)) {
      loadEnv({ path: file });
    }
  }
}

function applyEnvFallbacks(): void {
  if (
    !process.env.FIREBASE_STORAGE_BUCKET &&
    process.env.VITE_FIREBASE_STORAGE_BUCKET
  ) {
    process.env.FIREBASE_STORAGE_BUCKET =
      process.env.VITE_FIREBASE_STORAGE_BUCKET;
  }

  if (!process.env.GCS_BUCKET_NAME && process.env.FIREBASE_STORAGE_BUCKET) {
    process.env.GCS_BUCKET_NAME = process.env.FIREBASE_STORAGE_BUCKET;
  }

  if (!process.env.OPENAI_API_KEY && process.env.VITE_OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;
  }

  if (!process.env.GROQ_API_KEY && process.env.VITE_GROQ_API_KEY) {
    process.env.GROQ_API_KEY = process.env.VITE_GROQ_API_KEY;
  }

  if (!process.env.GEMINI_API_KEY && process.env.VITE_GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
  }
}

function parseCliArgs(argv: string[]): CliOptions {
  const singleCase: Partial<ComparisonCase> = {};
  let filePath: string | undefined;
  let timeoutMs = DEFAULT_TIMEOUT_MS;
  let skipInitialize = false;
  let verbose = false;
  let showDebug = false;
  let useCache = false;
  let useHardCases = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--prompt") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --prompt");
      }
      singleCase.prompt = normalizeText(value);
      i += 1;
      continue;
    }

    if (arg === "--highlighted-text") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --highlighted-text");
      }
      singleCase.highlightedText = normalizeText(value);
      i += 1;
      continue;
    }

    if (arg === "--category") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --category");
      }
      singleCase.highlightedCategory = normalizeText(value);
      i += 1;
      continue;
    }

    if (arg === "--confidence") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --confidence");
      }
      const parsed = Number.parseFloat(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
        throw new Error(`Invalid --confidence value: ${value}`);
      }
      singleCase.highlightedCategoryConfidence = parsed;
      i += 1;
      continue;
    }

    if (arg === "--context-before") {
      const value = argv[i + 1];
      if (value === undefined) {
        throw new Error("Missing value for --context-before");
      }
      singleCase.contextBefore = value;
      i += 1;
      continue;
    }

    if (arg === "--context-after") {
      const value = argv[i + 1];
      if (value === undefined) {
        throw new Error("Missing value for --context-after");
      }
      singleCase.contextAfter = value;
      i += 1;
      continue;
    }

    if (arg === "--name") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --name");
      }
      singleCase.name = normalizeText(value);
      i += 1;
      continue;
    }

    if (arg === "--file") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --file");
      }
      filePath = value;
      i += 1;
      continue;
    }

    if (arg === "--timeout-ms") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("Missing value for --timeout-ms");
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --timeout-ms value: ${value}`);
      }
      timeoutMs = parsed;
      i += 1;
      continue;
    }

    if (arg === "--skip-initialize") {
      skipInitialize = true;
      continue;
    }

    if (arg === "--verbose") {
      verbose = true;
      continue;
    }

    if (arg === "--show-debug") {
      showDebug = true;
      continue;
    }

    if (arg === "--use-cache") {
      useCache = true;
      continue;
    }

    if (arg === "--hard-cases") {
      useHardCases = true;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return {
    ...(Object.keys(singleCase).length > 0 ? { singleCase } : {}),
    ...(filePath ? { filePath } : {}),
    timeoutMs,
    skipInitialize,
    verbose,
    showDebug,
    useCache,
    useHardCases,
  };
}

function deriveContext(
  prompt: string,
  highlightedText: string,
): { contextBefore: string; contextAfter: string } {
  const index = prompt.indexOf(highlightedText);
  if (index < 0) {
    throw new Error(
      `Highlighted text "${highlightedText}" was not found in the provided prompt. Pass --context-before/--context-after explicitly if the visible span differs.`,
    );
  }

  return {
    contextBefore: prompt.slice(0, index),
    contextAfter: prompt.slice(index + highlightedText.length),
  };
}

function normalizeCaseInput(input: unknown, index: number): ComparisonCase {
  if (!isRecord(input)) {
    throw new Error(`Case ${index + 1} must be an object`);
  }

  const source = isRecord(input.testCase) ? input.testCase : input;
  const span = isRecord(source.span) ? source.span : null;
  const prompt =
    typeof source.prompt === "string"
      ? source.prompt
      : typeof source.fullPrompt === "string"
        ? source.fullPrompt
        : null;
  const highlightedText =
    typeof source.highlightedText === "string"
      ? source.highlightedText
      : span && typeof span.text === "string"
        ? span.text
        : null;
  const highlightedCategory =
    typeof source.highlightedCategory === "string"
      ? source.highlightedCategory
      : typeof source.category === "string"
        ? source.category
        : span && typeof span.category === "string"
          ? span.category
          : null;

  if (!prompt) {
    throw new Error(`Case ${index + 1} is missing "prompt"`);
  }
  if (!highlightedText) {
    throw new Error(`Case ${index + 1} is missing "highlightedText"`);
  }
  if (!highlightedCategory) {
    throw new Error(
      `Case ${index + 1} is missing "highlightedCategory" / "category"`,
    );
  }

  const derivedContext =
    typeof source.contextBefore === "string" &&
    typeof source.contextAfter === "string"
      ? {
          contextBefore: source.contextBefore,
          contextAfter: source.contextAfter,
        }
      : deriveContext(prompt, highlightedText);

  const highlightedCategoryConfidence =
    typeof source.highlightedCategoryConfidence === "number"
      ? source.highlightedCategoryConfidence
      : typeof source.categoryConfidence === "number"
        ? source.categoryConfidence
        : 0.95;

  return {
    name:
      typeof input.name === "string"
        ? input.name
        : typeof source.id === "string"
          ? source.id
          : `case-${index + 1}`,
    prompt,
    highlightedText,
    highlightedCategory,
    highlightedCategoryConfidence,
    contextBefore: derivedContext.contextBefore,
    contextAfter: derivedContext.contextAfter,
    originalUserPrompt:
      typeof source.originalUserPrompt === "string"
        ? source.originalUserPrompt
        : prompt,
    ...(isRecord(source.brainstormContext)
      ? {
          brainstormContext:
            source.brainstormContext as EnhancementRequestParams["brainstormContext"],
        }
      : {}),
    ...(Array.isArray(source.allLabeledSpans)
      ? {
          allLabeledSpans:
            source.allLabeledSpans as EnhancementRequestParams["allLabeledSpans"],
        }
      : {}),
    ...(Array.isArray(source.nearbySpans)
      ? {
          nearbySpans:
            source.nearbySpans as EnhancementRequestParams["nearbySpans"],
        }
      : {}),
    ...(Array.isArray(source.editHistory)
      ? {
          editHistory:
            source.editHistory as EnhancementRequestParams["editHistory"],
        }
      : {}),
    ...(isRecord(source.i2vContext)
      ? {
          i2vContext:
            source.i2vContext as EnhancementRequestParams["i2vContext"],
        }
      : {}),
  };
}

function loadCasesFromFile(filePath: string): ComparisonCase[] {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(REPO_ROOT, filePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Case file not found: ${absolutePath}`);
  }

  const raw = readFileSync(absolutePath, "utf8").trim();
  if (!raw) {
    throw new Error(`Case file is empty: ${absolutePath}`);
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((item, index) => normalizeCaseInput(item, index));
    }

    if (isRecord(parsed)) {
      if (Array.isArray(parsed.cases)) {
        return parsed.cases.map((item, index) =>
          normalizeCaseInput(item, index),
        );
      }
      if (Array.isArray(parsed.prompts)) {
        return parsed.prompts.map((item, index) =>
          normalizeCaseInput(item, index),
        );
      }
      return [normalizeCaseInput(parsed, 0)];
    }
  } catch {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const ndjsonCases = lines.map((line, index) => {
      try {
        return normalizeCaseInput(JSON.parse(line) as unknown, index);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to parse line ${index + 1} as JSON. Non-JSON prompt lists are not supported for enhancement comparison. ${message}`,
        );
      }
    });

    if (ndjsonCases.length > 0) {
      return ndjsonCases;
    }
  }

  throw new Error(`Unsupported case file format: ${absolutePath}`);
}

function buildHardCases(): ComparisonCase[] {
  return hardCaseBenchmarks.map((fixture, index) =>
    normalizeCaseInput(
      {
        name: fixture.name,
        testCase: fixture.testCase,
      },
      index,
    ),
  );
}

function buildSingleCase(singleCase: Partial<ComparisonCase>): ComparisonCase {
  if (!singleCase.prompt) {
    throw new Error("Single-case mode requires --prompt");
  }
  if (!singleCase.highlightedText) {
    throw new Error("Single-case mode requires --highlighted-text");
  }
  if (!singleCase.highlightedCategory) {
    throw new Error("Single-case mode requires --category");
  }

  return normalizeCaseInput(
    {
      name: singleCase.name || "ad-hoc-case",
      prompt: singleCase.prompt,
      highlightedText: singleCase.highlightedText,
      highlightedCategory: singleCase.highlightedCategory,
      highlightedCategoryConfidence:
        singleCase.highlightedCategoryConfidence ?? 0.95,
      ...(singleCase.contextBefore !== undefined
        ? { contextBefore: singleCase.contextBefore }
        : {}),
      ...(singleCase.contextAfter !== undefined
        ? { contextAfter: singleCase.contextAfter }
        : {}),
    },
    0,
  );
}

function flattenSuggestions(
  resultSuggestions: EnhancementResult["suggestions"],
): Suggestion[] {
  if (!Array.isArray(resultSuggestions)) {
    return [];
  }

  const flattened: Suggestion[] = [];
  for (const entry of resultSuggestions) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    if ("text" in entry && typeof entry.text === "string") {
      flattened.push(entry as Suggestion);
      continue;
    }

    if ("suggestions" in entry && Array.isArray(entry.suggestions)) {
      const groupCategory =
        typeof entry.category === "string" ? entry.category : undefined;
      for (const suggestion of entry.suggestions) {
        if (
          suggestion &&
          typeof suggestion === "object" &&
          "text" in suggestion &&
          typeof suggestion.text === "string"
        ) {
          const normalizedSuggestion = suggestion as Suggestion;
          flattened.push(
            normalizedSuggestion.category
              ? normalizedSuggestion
              : {
                  ...normalizedSuggestion,
                  ...(groupCategory ? { category: groupCategory } : {}),
                },
          );
        }
      }
    }
  }

  return flattened;
}

function toEvaluationCase(testCase: ComparisonCase): SuggestionTestCase {
  return {
    id: testCase.name,
    prompt: testCase.prompt,
    span: {
      text: testCase.highlightedText,
      category: testCase.highlightedCategory,
    },
    contextBefore: testCase.contextBefore,
    contextAfter: testCase.contextAfter,
  };
}

function averageScore(
  scores:
    | Awaited<
        ReturnType<PolicyAwareSuggestionQualityEvaluator["evaluateCase"]>
      >["scores"]
    | undefined,
): number {
  if (!scores) {
    return 0;
  }

  return (
    SCORE_KEYS.reduce((sum, key) => sum + scores[key], 0) / SCORE_KEYS.length
  );
}

function formatSuggestionList(suggestions: Suggestion[]): string[] {
  return suggestions.map((suggestion, index) => {
    const suffix = suggestion.category ? ` [${suggestion.category}]` : "";
    return `${index + 1}. ${suggestion.text}${suffix}`;
  });
}

function formatScoreLine(
  quality:
    | Awaited<ReturnType<PolicyAwareSuggestionQualityEvaluator["evaluateCase"]>>
    | undefined,
): string {
  if (!quality) {
    return "n/a";
  }

  const parts = SCORE_KEYS.map(
    (key) => `${key}=${quality.scores[key].toFixed(1)}`,
  );
  return `${parts.join(" | ")} | avg=${averageScore(quality.scores).toFixed(2)}`;
}

function normalizedSet(suggestions: Suggestion[]): Set<string> {
  return new Set(
    suggestions.map((suggestion) =>
      suggestion.text
        .toLowerCase()
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .trim(),
    ),
  );
}

function sharedTexts(a: Suggestion[], b: Suggestion[]): string[] {
  const bSet = normalizedSet(b);
  return a
    .map((suggestion) => suggestion.text)
    .filter((text) =>
      bSet.has(
        text.toLowerCase().normalize("NFKC").replace(/\s+/g, " ").trim(),
      ),
    );
}

function onlyTexts(source: Suggestion[], other: Suggestion[]): string[] {
  const otherSet = normalizedSet(other);
  return source
    .map((suggestion) => suggestion.text)
    .filter(
      (text) =>
        !otherSet.has(
          text.toLowerCase().normalize("NFKC").replace(/\s+/g, " ").trim(),
        ),
    );
}

function formatDebugBlock(run: EngineRun): string[] {
  const debug = run.result?._debug;
  if (!debug) {
    return [];
  }

  const lines: string[] = [
    `engineVersion=${debug.engineVersion || run.engine}`,
    `policyVersion=${debug.policyVersion || "n/a"}`,
    `modelCallCount=${debug.modelCallCount ?? "n/a"}`,
  ];

  if (debug.stageCounts) {
    const stageCounts = Object.entries(debug.stageCounts)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ");
    lines.push(`stageCounts=${stageCounts}`);
  }

  if (debug.rejectionSummary) {
    const rejectionSummary = Object.entries(debug.rejectionSummary)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ");
    lines.push(`rejections=${rejectionSummary}`);
  }

  return lines;
}

async function withSoftTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${label} exceeded ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

async function runEngine(
  enhancementService: EnhancementService,
  evaluator: PolicyAwareSuggestionQualityEvaluator,
  testCase: ComparisonCase,
  engine: "v1" | "v2",
  timeoutMs: number,
  useCache: boolean,
): Promise<EngineRun> {
  const startTime = Date.now();

  try {
    const result = await withSoftTimeout(
      enhancementService.getEnhancementSuggestions({
        highlightedText: testCase.highlightedText,
        contextBefore: testCase.contextBefore,
        contextAfter: testCase.contextAfter,
        fullPrompt: testCase.prompt,
        originalUserPrompt: testCase.originalUserPrompt,
        highlightedCategory: testCase.highlightedCategory,
        highlightedCategoryConfidence: testCase.highlightedCategoryConfidence,
        ...(testCase.brainstormContext !== undefined
          ? { brainstormContext: testCase.brainstormContext }
          : {}),
        ...(testCase.allLabeledSpans !== undefined
          ? { allLabeledSpans: testCase.allLabeledSpans }
          : {}),
        ...(testCase.nearbySpans !== undefined
          ? { nearbySpans: testCase.nearbySpans }
          : {}),
        ...(testCase.editHistory !== undefined
          ? { editHistory: testCase.editHistory }
          : {}),
        ...(testCase.i2vContext !== undefined
          ? { i2vContext: testCase.i2vContext }
          : {}),
        requestedEngineVersion: engine,
        debug: !useCache,
      }),
      timeoutMs,
      `${engine.toUpperCase()} run`,
    );

    const suggestions = flattenSuggestions(result.suggestions);
    const quality = await evaluator.evaluateCase(
      toEvaluationCase(testCase),
      suggestions,
    );

    return {
      engine,
      durationMs: Date.now() - startTime,
      suggestions,
      result,
      quality,
    };
  } catch (error) {
    return {
      engine,
      durationMs: Date.now() - startTime,
      suggestions: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function printCaseComparison(
  testCase: ComparisonCase,
  v1Run: EngineRun,
  v2Run: EngineRun,
  index: number,
  total: number,
  showDebug: boolean,
): void {
  console.log("-".repeat(100));
  console.log(`Case ${index + 1}/${total}: ${testCase.name}`);
  console.log("-".repeat(100));
  console.log(`Prompt: ${testCase.prompt}`);
  console.log(`Highlight: "${testCase.highlightedText}"`);
  console.log(
    `Category: ${testCase.highlightedCategory} (${testCase.highlightedCategoryConfidence.toFixed(2)})`,
  );
  console.log("");

  for (const run of [v1Run, v2Run]) {
    console.log(
      `[${run.engine.toUpperCase()}] ${run.durationMs}ms${run.result ? ` | ${run.suggestions.length} suggestions` : ""}`,
    );

    if (run.error) {
      console.log(`ERROR: ${run.error}`);
      console.log("");
      continue;
    }

    console.log(`Scores: ${formatScoreLine(run.quality)}`);

    const suggestionLines = formatSuggestionList(run.suggestions);
    if (suggestionLines.length === 0) {
      console.log("Suggestions: none");
    } else {
      for (const line of suggestionLines) {
        console.log(line);
      }
    }

    if (showDebug) {
      const debugLines = formatDebugBlock(run);
      if (debugLines.length > 0) {
        console.log("Debug:");
        for (const line of debugLines) {
          console.log(`- ${line}`);
        }
      }
    }

    console.log("");
  }

  if (!v1Run.error && !v2Run.error) {
    const overlap = sharedTexts(v1Run.suggestions, v2Run.suggestions);
    const onlyV1 = onlyTexts(v1Run.suggestions, v2Run.suggestions);
    const onlyV2 = onlyTexts(v2Run.suggestions, v1Run.suggestions);
    const v1Average = averageScore(v1Run.quality?.scores);
    const v2Average = averageScore(v2Run.quality?.scores);

    console.log("[DELTA]");
    console.log(
      `Average quality delta (V2-V1): ${(v2Average - v1Average).toFixed(2)}`,
    );
    console.log(
      `Latency delta (V2-V1): ${v2Run.durationMs - v1Run.durationMs}ms`,
    );
    console.log(
      `Shared suggestions: ${overlap.length > 0 ? overlap.join(" | ") : "none"}`,
    );
    console.log(`Only V1: ${onlyV1.length > 0 ? onlyV1.join(" | ") : "none"}`);
    console.log(`Only V2: ${onlyV2.length > 0 ? onlyV2.join(" | ") : "none"}`);
    console.log("");
  }
}

function printSummary(
  cases: ComparisonCase[],
  runs: Array<{ v1: EngineRun; v2: EngineRun }>,
): void {
  const successfulV1 = runs.filter((item) => !item.v1.error);
  const successfulV2 = runs.filter((item) => !item.v2.error);

  const v1Duration =
    successfulV1.length > 0
      ? successfulV1.reduce((sum, item) => sum + item.v1.durationMs, 0) /
        successfulV1.length
      : 0;
  const v2Duration =
    successfulV2.length > 0
      ? successfulV2.reduce((sum, item) => sum + item.v2.durationMs, 0) /
        successfulV2.length
      : 0;

  const summarizeScores = (engineRuns: EngineRun[]): Record<ScoreKey, number> =>
    SCORE_KEYS.reduce<Record<ScoreKey, number>>(
      (accumulator, key) => {
        const values = engineRuns
          .map((run) => run.quality?.scores[key])
          .filter((value): value is number => typeof value === "number");
        accumulator[key] =
          values.length > 0
            ? values.reduce((sum, value) => sum + value, 0) / values.length
            : 0;
        return accumulator;
      },
      {
        contextualFit: 0,
        categoryAlignment: 0,
        diversity: 0,
        videoSpecificity: 0,
        sceneCoherence: 0,
      },
    );

  const v1ScoreSummary = summarizeScores(successfulV1.map((item) => item.v1));
  const v2ScoreSummary = summarizeScores(successfulV2.map((item) => item.v2));

  let v2Wins = 0;
  let v1Wins = 0;
  let ties = 0;

  for (const { v1, v2 } of runs) {
    if (v1.error || v2.error) {
      continue;
    }

    const v1Average = averageScore(v1.quality?.scores);
    const v2Average = averageScore(v2.quality?.scores);
    if (Math.abs(v2Average - v1Average) < 0.01) {
      ties += 1;
    } else if (v2Average > v1Average) {
      v2Wins += 1;
    } else {
      v1Wins += 1;
    }
  }

  console.log("=".repeat(100));
  console.log("Summary");
  console.log("=".repeat(100));
  console.log(`Cases: ${cases.length}`);
  console.log(`V1 success: ${successfulV1.length}/${cases.length}`);
  console.log(`V2 success: ${successfulV2.length}/${cases.length}`);
  console.log(
    `Average latency: V1=${v1Duration.toFixed(0)}ms | V2=${v2Duration.toFixed(0)}ms`,
  );
  console.log(
    `Average quality wins: V2=${v2Wins} | V1=${v1Wins} | ties=${ties}`,
  );
  console.log(
    `V1 scores: ${formatScoreLine({ id: "summary", scores: v1ScoreSummary, passed: true, failures: [], suggestions: [] })}`,
  );
  console.log(
    `V2 scores: ${formatScoreLine({ id: "summary", scores: v2ScoreSummary, passed: true, failures: [], suggestions: [] })}`,
  );
}

async function main(): Promise<void> {
  loadEnvFiles(REPO_ROOT);
  applyEnvFallbacks();

  const cli = parseCliArgs(process.argv.slice(2));

  if (!cli.verbose) {
    process.env.LOG_LEVEL = "fatal";
  }

  if (!process.env.GCS_BUCKET_NAME && !process.env.FIREBASE_STORAGE_BUCKET) {
    process.env.GCS_BUCKET_NAME = "local-script-placeholder.appspot.com";
  }

  const allCases: ComparisonCase[] = [];
  if (cli.singleCase) {
    allCases.push(buildSingleCase(cli.singleCase));
  }
  if (cli.filePath) {
    allCases.push(...loadCasesFromFile(cli.filePath));
  }
  if (cli.useHardCases) {
    allCases.push(...buildHardCases());
  }

  if (allCases.length === 0) {
    printUsage();
    throw new Error(
      "No enhancement cases provided. Use --prompt with span/category, --file, or --hard-cases.",
    );
  }

  const { configureServices, initializeServices } = await import(
    "../server/src/config/services.config.ts"
  );
  const container = await configureServices();

  if (!cli.skipInitialize) {
    try {
      await initializeServices(container);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("initializeServices() failed, continuing anyway:", message);
    }
  }

  const enhancementService =
    container.resolve<EnhancementService>("enhancementService");
  const videoService = container.resolve<VideoPromptService>("videoService");
  const evaluator = new PolicyAwareSuggestionQualityEvaluator(videoService);

  console.log("=".repeat(100));
  console.log("Enhancement Engine Comparison");
  console.log("=".repeat(100));
  console.log(`Cases: ${allCases.length}`);
  console.log(`Cache mode: ${cli.useCache ? "enabled" : "bypass"}`);
  console.log(`Timeout per engine run: ${cli.timeoutMs}ms`);
  console.log("");

  const runs: Array<{ v1: EngineRun; v2: EngineRun }> = [];

  for (let index = 0; index < allCases.length; index += 1) {
    const testCase = allCases[index]!;
    const v1Run = await runEngine(
      enhancementService,
      evaluator,
      testCase,
      "v1",
      cli.timeoutMs,
      cli.useCache,
    );
    const v2Run = await runEngine(
      enhancementService,
      evaluator,
      testCase,
      "v2",
      cli.timeoutMs,
      cli.useCache,
    );

    runs.push({ v1: v1Run, v2: v2Run });
    printCaseComparison(
      testCase,
      v1Run,
      v2Run,
      index,
      allCases.length,
      cli.showDebug,
    );
  }

  printSummary(allCases, runs);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nScript failed: ${message}`);
  process.exit(1);
});
