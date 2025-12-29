import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';
import { GeminiAdapter } from '../server/src/clients/adapters/GeminiAdapter.js';
import { OpenAICompatibleAdapter } from '../server/src/clients/adapters/OpenAICompatibleAdapter.js';
import { GEMINI_SIMPLE_SYSTEM_PROMPT, GEMINI_JSON_SCHEMA } from '../server/src/llm/span-labeling/schemas/GeminiSchema.js';
import { VALID_CATEGORIES } from '../shared/taxonomy.js';
import {
  CATEGORY_NAMES,
  FALSE_POSITIVE_REASONS,
  GRANULARITY_ERROR_TYPES,
  MISSED_SEVERITIES,
  type CategoryScores,
  type EnhancedJudgeResult,
  type SpanResult,
  type PromptRecord,
  type EvaluationDataset,
} from './evaluation/types.js';

// Load environment variables from project root .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try loading from project root (relative to script location)
const envPathFromScript = join(__dirname, '../..', '.env');
// Also try from current working directory (should be project root when running script)
const envPathFromCwd = join(process.cwd(), '.env');

// Try to load .env file - check which path exists first
let envLoaded = false;
if (fs.existsSync(envPathFromScript)) {
  const result = loadEnv({ path: envPathFromScript });
  envLoaded = !result.error;
} else if (fs.existsSync(envPathFromCwd)) {
  const result = loadEnv({ path: envPathFromCwd });
  envLoaded = !result.error;
} else {
  // Try default location
  const result = loadEnv();
  envLoaded = !result.error;
}

// Verify .env was loaded
if (!process.env.GOOGLE_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  console.error(`❌ Error: Could not load GOOGLE_API_KEY from .env file.`);
  console.error(`   Tried: ${envPathFromScript} (exists: ${fs.existsSync(envPathFromScript)})`);
  console.error(`   Tried: ${envPathFromCwd} (exists: ${fs.existsSync(envPathFromCwd)})`);
  console.error(`   Current working directory: ${process.cwd()}`);
  console.error(`   Please ensure GOOGLE_API_KEY is set in your .env file.`);
  process.exit(1);
}

// Helper to find and load prompts file
function findLatestPromptsFile(): string | null {
  const scriptDir = dirname(__filename);
  const dataDir = join(scriptDir, 'evaluation', 'data');
  if (fs.existsSync(dataDir)) {
    const latestPath = join(dataDir, 'evaluation-prompts-latest.json');
    if (fs.existsSync(latestPath)) {
      return latestPath;
    }
    const evalFiles = fs.readdirSync(dataDir)
      .filter(f => f.startsWith('evaluation-prompts-') && f.endsWith('.json'))
      .sort()
      .reverse();
    if (evalFiles.length > 0) {
      return join(dataDir, evalFiles[0]);
    }
  }
  return null;
}

function loadPrompts(filePath: string): PromptRecord[] {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (data.metadata && data.prompts) {
    const dataset = data as EvaluationDataset;
    return (dataset.prompts || [])
      .filter((p: PromptRecord) => !p.error && p.output)
      .map((item: PromptRecord) => ({
        id: item.id,
        input: item.input || '',
        output: item.output || '',
        timestamp: item.generatedAt || item.timestamp
      }));
  }
  return data.map((item: any, index: number) => ({
    id: item.id || item.uuid || `prompt-${index}`,
    input: item.input || '',
    output: item.output || '',
    timestamp: item.timestamp
  }));
}

// Judge service setup (from span-labeling-evaluation.ts)
const VALID_ROLE_LIST = [...VALID_CATEGORIES].sort();

const JUDGE_SYSTEM_PROMPT = `You are evaluating span labeling quality for video prompts.

A span is a "visual control point" - a phrase that, if changed, would produce a visually different video.

## Prompt Structure

The prompts have THREE sections:
1. **Main paragraph**: Dense description of the primary shot (shot type, subject, action, environment, lighting, camera, style)
2. **TECHNICAL SPECS section**: Bulleted list with Duration, Aspect Ratio, Frame Rate, Audio, Camera, Lighting, Style
3. **ALTERNATIVE APPROACHES section**: 2 variations describing alternate shots (different angles, lighting, etc.)

Section headers like "**TECHNICAL SPECS**" and "**ALTERNATIVE APPROACHES**" are NOT visual content and should NOT be extracted.
Variation labels like "**Variation 1 (Alternate Angle):**" are headers, not content.
BUT the actual content within alternatives (e.g., "high-angle shot", "golden hour lighting") ARE visual control points and SHOULD be extracted.

## Evaluation Criteria (score each 1-5)

1. Coverage (1-5): Did it extract ALL visual control points from ALL sections?
   - Main: Shot type, subjects, subject actions (physical movements BY subjects), environments, lighting, camera movements, style
   - Technical Specs: Duration, fps/frame rate, aspect ratio, audio description, camera settings, lighting setup, style reference
   - Alternatives: Shot types, angles, lighting variations described in alternative approaches
   - Note: "actions" = what subjects physically DO (running, gazing). Framing/continuity = camera category.
   - 5 = Comprehensive across all sections
   - 1 = Major elements missing

2. Precision (1-5): Did it correctly SKIP abstract/non-renderable content?
   - Skip: "determination", "inviting the viewer", "enhancing authenticity", section headers, variation labels
   - Include: "focused demeanor" (visible expression), "gripping" (visible action)
   - 5 = Only extracted renderable elements
   - 1 = Extracted many abstract concepts or headers

3. Granularity (1-5): Are span boundaries correct?
   - Not too fine: "soft" + "highlights" should be "soft highlights"
   - Not too coarse: Do not merge unrelated elements
   - 5 = All boundaries appropriate
   - 1 = Many boundary errors

4. Taxonomy (1-5): Are roles assigned correctly?
   - camera.movement vs action.movement
   - shot.type vs camera.angle
   - technical.duration vs technical.framerate
   - 5 = All roles correct
   - 1 = Many misclassifications

5. Technical Specs (1-5): Did it extract format parameters from the TECHNICAL SPECS section?
   - Duration (e.g., "6s"), Frame Rate (e.g., "60fps"), Aspect Ratio (e.g., "16:9")
   - Audio description, Camera settings (lens, aperture), Lighting setup, Style reference
   - 5 = All specs extracted with correct roles
   - 1 = Specs ignored or misclassified

## Error Types (diagnostics)

- missedElements: visual elements present in the prompt that were not extracted.
  - Provide: text, expectedRole (taxonomy role), category, severity.
  - category must be EXACTLY one of: shot, subject, action, environment, lighting, camera, style, technical, audio.
  - severity must be EXACTLY one of: critical, important, minor.
  - CATEGORY DEFINITIONS:
    - action = ONLY physical movements/gestures by subjects (running, jumping, waving, gazing)
    - camera = camera movement, framing, angles, continuity (pan, zoom, consistent framing, subject continuity)
    - shot = shot type/composition (close-up, wide shot, establishing shot)
  - "consistent framing and subject continuity" → category: "camera", NOT "action"
  - "maintain visual flow" → category: "camera" or "style", NOT "action"
  - Example: { "text": "red leather jacket", "expectedRole": "subject.wardrobe", "category": "subject", "severity": "important" }
  - Example: { "text": "high-angle shot", "expectedRole": "camera.angle", "category": "camera", "severity": "important" } (from alternatives section)
  - Example: { "text": "60fps", "expectedRole": "technical.framerate", "category": "technical", "severity": "important" } (from tech specs)

- falsePositives: extracted spans that should NOT have been extracted.
  - Provide: text, assignedRole, reason, spanIndex.
  - spanIndex is the 0-based index of the extracted span; use null if no match.
  - reason must be EXACTLY one of: section_header, abstract_concept, non_visual, instruction_text, duplicate, other.
  - Section headers include: "TECHNICAL SPECS", "ALTERNATIVE APPROACHES", "Variation 1", "Variation 2", field labels like "Duration:", "Frame Rate:"
  - Example: { "text": "TECHNICAL SPECS", "assignedRole": "technical", "reason": "section_header", "spanIndex": 12 }
  - Example: { "text": "Variation 1 (Alternate Angle)", "assignedRole": "shot.type", "reason": "section_header", "spanIndex": 8 }
  - Example: { "text": "emotional resonance", "assignedRole": "style.mood", "reason": "abstract_concept", "spanIndex": 4 }

- taxonomyErrors: extracted spans with the wrong role.
  - Provide: text, assignedRole, expectedRole, spanIndex.
  - spanIndex is the 0-based index of the extracted span; use null if no match.
  - Example: { "text": "slow pan", "assignedRole": "action.movement", "expectedRole": "camera.movement", "spanIndex": 7 }

- granularityErrors: span boundary issues (too fine or too coarse).
  - Provide: text, spanIndex, reason.
  - spanIndex is the 0-based index of the extracted span; use null if no match.
  - reason must be EXACTLY one of: too_fine, too_coarse, other.
  - Example: { "text": "soft highlights", "spanIndex": 15, "reason": "too_fine" }
  - Example: { "text": "man in red jacket walking in rain", "spanIndex": 3, "reason": "too_coarse" }

## Category Scores (coverage and precision, 1-5 each)

Return categoryScores for: shot, subject, action, environment, lighting, camera, style, technical, audio.

## Valid Taxonomy Roles

Use ONLY the following roles (exact strings). If uncertain, choose the closest valid role:
${VALID_ROLE_LIST.join(', ')}

## Response Format

Return ONLY valid JSON with double quotes and no trailing commas.
If there are many items, include the 12 most impactful (critical and important first).
If there are no items for a list, return an empty array.

{
  "scores": {
    "coverage": <1-5>,
    "precision": <1-5>,
    "granularity": <1-5>,
    "taxonomy": <1-5>,
    "technicalSpecs": <1-5>
  },
  "totalScore": <sum of above, max 25>,
  "missedElements": [
    {
      "text": "...",
      "expectedRole": "...",
      "category": "shot|subject|action|environment|lighting|camera|style|technical|audio",
      "severity": "critical|important|minor"
    }
  ],
  "falsePositives": [
    {
      "text": "...",
      "assignedRole": "...",
      "reason": "section_header|abstract_concept|non_visual|instruction_text|duplicate|other",
      "spanIndex": 0
    }
  ],
  "taxonomyErrors": [
    {
      "text": "...",
      "assignedRole": "...",
      "expectedRole": "...",
      "spanIndex": 0
    }
  ],
  "granularityErrors": [
    {
      "text": "...",
      "spanIndex": 0,
      "reason": "too_fine|too_coarse|other"
    }
  ],
  "categoryScores": {
    "shot": { "coverage": <1-5>, "precision": <1-5> },
    "subject": { "coverage": <1-5>, "precision": <1-5> },
    "action": { "coverage": <1-5>, "precision": <1-5> },
    "environment": { "coverage": <1-5>, "precision": <1-5> },
    "lighting": { "coverage": <1-5>, "precision": <1-5> },
    "camera": { "coverage": <1-5>, "precision": <1-5> },
    "style": { "coverage": <1-5>, "precision": <1-5> },
    "technical": { "coverage": <1-5>, "precision": <1-5> },
    "audio": { "coverage": <1-5>, "precision": <1-5> }
  },
  "notes": "brief explanation of scoring"
}`;

const JUDGE_JSON_SCHEMA = {
  type: "object",
  properties: {
    scores: {
      type: "object",
      properties: {
        coverage: { type: "number" },
        precision: { type: "number" },
        granularity: { type: "number" },
        taxonomy: { type: "number" },
        technicalSpecs: { type: "number" }
      },
      required: ["coverage", "precision", "granularity", "taxonomy", "technicalSpecs"],
      additionalProperties: false
    },
    totalScore: { type: "number" },
    missedElements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          expectedRole: { type: "string" },
          category: { type: "string", enum: [...CATEGORY_NAMES, "unknown"] },
          severity: { type: "string", enum: MISSED_SEVERITIES }
        },
        required: ["text", "expectedRole", "category", "severity"],
        additionalProperties: false
      }
    },
    falsePositives: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          assignedRole: { type: "string" },
          reason: { type: "string", enum: FALSE_POSITIVE_REASONS },
          spanIndex: { type: ["number", "null"] }
        },
        required: ["text", "assignedRole", "reason", "spanIndex"],
        additionalProperties: false
      }
    },
    taxonomyErrors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          assignedRole: { type: "string" },
          expectedRole: { type: "string" },
          spanIndex: { type: ["number", "null"] }
        },
        required: ["text", "assignedRole", "expectedRole", "spanIndex"],
        additionalProperties: false
      }
    },
    granularityErrors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          spanIndex: { type: ["number", "null"] },
          reason: { type: "string", enum: GRANULARITY_ERROR_TYPES }
        },
        required: ["text", "spanIndex", "reason"],
        additionalProperties: false
      }
    },
    categoryScores: {
      type: "object",
      properties: Object.fromEntries(
        CATEGORY_NAMES.map(cat => [
          cat,
          {
            type: "object",
            properties: {
              coverage: { type: "number" },
              precision: { type: "number" }
            },
            required: ["coverage", "precision"],
            additionalProperties: false
          }
        ])
      ),
      required: [...CATEGORY_NAMES],
      additionalProperties: false
    },
    notes: { type: "string" }
  },
  required: [
    "scores",
    "totalScore",
    "missedElements",
    "falsePositives",
    "taxonomyErrors",
    "granularityErrors",
    "categoryScores",
    "notes"
  ],
  additionalProperties: false
};

function createEmptyCategoryScores(): CategoryScores {
  return {
    shot: { coverage: 0, precision: 0 },
    subject: { coverage: 0, precision: 0 },
    action: { coverage: 0, precision: 0 },
    environment: { coverage: 0, precision: 0 },
    lighting: { coverage: 0, precision: 0 },
    camera: { coverage: 0, precision: 0 },
    style: { coverage: 0, precision: 0 },
    technical: { coverage: 0, precision: 0 },
    audio: { coverage: 0, precision: 0 },
  };
}

// Extraction result type (module-level for caching)
interface ExtractionResult {
  promptId: string;
  input: string;
  output: string;
  spans: SpanResult[];
  error: string | null;
  latency: number;
}

interface ExtractionCache {
  metadata: {
    model: string;
    timestamp: string;
    promptsFile: string | null;
    sampleSize: number | null;
    totalPrompts: number;
    successCount: number;
    errorCount: number;
  };
  results: ExtractionResult[];
}

function getDefaultCachePath(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const cacheDir = join(scriptDir, 'evaluation', 'cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

function saveExtractionCache(
  results: ExtractionResult[],
  metadata: ExtractionCache['metadata'],
  customPath?: string | null
): string {
  const cacheDir = getDefaultCachePath();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `extractions-${timestamp}.json`;
  const cachePath = customPath || join(cacheDir, filename);
  const latestPath = join(cacheDir, 'extractions-latest.json');

  const cache: ExtractionCache = { metadata, results };
  const json = JSON.stringify(cache, null, 2);

  fs.writeFileSync(cachePath, json);
  fs.writeFileSync(latestPath, json);

  console.log(`\n  💾 Extraction cache saved to:`);
  console.log(`     ${cachePath}`);
  console.log(`     ${latestPath} (symlink)`);

  return cachePath;
}

function loadExtractionCache(cachePath: string): ExtractionCache {
  if (!fs.existsSync(cachePath)) {
    throw new Error(`Cache file not found: ${cachePath}`);
  }

  const json = fs.readFileSync(cachePath, 'utf-8');
  const cache = JSON.parse(json) as ExtractionCache;

  console.log(`\n  📂 Loaded extraction cache from: ${cachePath}`);
  console.log(`     Model: ${cache.metadata.model}`);
  console.log(`     Timestamp: ${cache.metadata.timestamp}`);
  console.log(`     Prompts: ${cache.metadata.totalPrompts} (${cache.metadata.successCount} success, ${cache.metadata.errorCount} errors)`);

  return cache;
}

// =========================================================================
// Report Generation
// =========================================================================

interface EvaluationReport {
  timestamp: string;
  extractionModel: string;
  judgeModel: string;
  promptCount: number;
  sourceFile: string | null;
  summary: {
    avgScore: number;
    avgSpanCount: number;
    successCount: number;
    errorCount: number;
    scoreDistribution: { excellent: number; good: number; acceptable: number; poor: number; failing: number };
  };
  latencyStats: {
    extraction: { avg: number; p50: number; p95: number };
    judge: { avg: number; p50: number; p95: number };
  };
  categoryScores: Record<string, { coverage: number; precision: number }>;
  commonErrors: {
    missedElements: Array<{ text: string; count: number; category: string }>;
    falsePositives: Array<{ text: string; count: number; reason: string }>;
    taxonomyErrors: Array<{ from: string; to: string; count: number; examples: string[] }>;
  };
  results: Array<{
    promptId: string;
    input: string;
    spanCount: number;
    score: number | null;
    notes: string;
  }>;
}

function generateReport(
  extractionResults: ExtractionResult[],
  judgeResults: (EnhancedJudgeResult | null)[],
  metadata: {
    extractionModel: string;
    judgeModel: string;
    sourceFile: string | null;
    extractionLatencies: number[];
    judgeLatencies: number[];
  }
): EvaluationReport {
  const timestamp = new Date().toISOString();
  const validJudgments = judgeResults.filter((r): r is EnhancedJudgeResult => r !== null && r.totalScore > 0);

  // Score distribution
  const scoreDistribution = { excellent: 0, good: 0, acceptable: 0, poor: 0, failing: 0 };
  validJudgments.forEach(r => {
    if (r.totalScore >= 23) scoreDistribution.excellent++;
    else if (r.totalScore >= 18) scoreDistribution.good++;
    else if (r.totalScore >= 13) scoreDistribution.acceptable++;
    else if (r.totalScore >= 8) scoreDistribution.poor++;
    else scoreDistribution.failing++;
  });

  // Aggregate category scores
  const categoryTotals: Record<string, { coverage: number; precision: number; count: number }> = {};
  validJudgments.forEach(r => {
    if (r.categoryScores) {
      Object.entries(r.categoryScores).forEach(([cat, scores]) => {
        if (!categoryTotals[cat]) categoryTotals[cat] = { coverage: 0, precision: 0, count: 0 };
        categoryTotals[cat].coverage += scores.coverage;
        categoryTotals[cat].precision += scores.precision;
        categoryTotals[cat].count++;
      });
    }
  });
  const categoryScores: Record<string, { coverage: number; precision: number }> = {};
  Object.entries(categoryTotals).forEach(([cat, totals]) => {
    categoryScores[cat] = {
      coverage: totals.count > 0 ? totals.coverage / totals.count : 0,
      precision: totals.count > 0 ? totals.precision / totals.count : 0,
    };
  });

  // Common missed elements
  const missedCounts: Record<string, { count: number; category: string }> = {};
  validJudgments.forEach(r => {
    r.missedElements?.forEach(m => {
      const key = m.text.toLowerCase();
      if (!missedCounts[key]) missedCounts[key] = { count: 0, category: m.category };
      missedCounts[key].count++;
    });
  });
  const missedElements = Object.entries(missedCounts)
    .map(([text, { count, category }]) => ({ text, count, category }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Common false positives
  const fpCounts: Record<string, { count: number; reason: string }> = {};
  validJudgments.forEach(r => {
    r.falsePositives?.forEach(fp => {
      const key = fp.text.toLowerCase();
      if (!fpCounts[key]) fpCounts[key] = { count: 0, reason: fp.reason };
      fpCounts[key].count++;
    });
  });
  const falsePositives = Object.entries(fpCounts)
    .map(([text, { count, reason }]) => ({ text, count, reason }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Taxonomy errors
  const taxCounts: Record<string, { count: number; examples: string[] }> = {};
  validJudgments.forEach(r => {
    r.taxonomyErrors?.forEach(te => {
      const key = `${te.assignedRole} → ${te.expectedRole}`;
      if (!taxCounts[key]) taxCounts[key] = { count: 0, examples: [] };
      taxCounts[key].count++;
      if (taxCounts[key].examples.length < 3) taxCounts[key].examples.push(te.text);
    });
  });
  const taxonomyErrors = Object.entries(taxCounts)
    .map(([key, { count, examples }]) => {
      const [from, to] = key.split(' → ');
      return { from, to, count, examples };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Latency stats helper
  const calcLatencyStats = (latencies: number[]) => {
    if (latencies.length === 0) return { avg: 0, p50: 0, p95: 0 };
    const sorted = [...latencies].sort((a, b) => a - b);
    return {
      avg: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
    };
  };

  const totalSpans = extractionResults.reduce((sum, r) => sum + r.spans.length, 0);
  const successCount = extractionResults.filter(r => !r.error).length;

  return {
    timestamp,
    extractionModel: metadata.extractionModel,
    judgeModel: metadata.judgeModel,
    promptCount: extractionResults.length,
    sourceFile: metadata.sourceFile,
    summary: {
      avgScore: validJudgments.length > 0
        ? validJudgments.reduce((sum, r) => sum + r.totalScore, 0) / validJudgments.length
        : 0,
      avgSpanCount: successCount > 0 ? totalSpans / successCount : 0,
      successCount,
      errorCount: extractionResults.filter(r => r.error).length,
      scoreDistribution,
    },
    latencyStats: {
      extraction: calcLatencyStats(metadata.extractionLatencies),
      judge: calcLatencyStats(metadata.judgeLatencies),
    },
    categoryScores,
    commonErrors: { missedElements, falsePositives, taxonomyErrors },
    results: extractionResults.map((ext, i) => ({
      promptId: ext.promptId,
      input: ext.input,
      spanCount: ext.spans.length,
      score: judgeResults[i]?.totalScore ?? null,
      notes: judgeResults[i]?.notes ?? (ext.error || ''),
    })),
  };
}

function formatTextReport(report: EvaluationReport): string {
  const lines: string[] = [];
  const hr = '='.repeat(80);

  lines.push(`Evaluation Report - ${report.timestamp}`);
  lines.push(`Extraction Model: ${report.extractionModel}`);
  lines.push(`Judge Model: ${report.judgeModel}`);
  if (report.sourceFile) lines.push(`Source: ${report.sourceFile}`);
  lines.push('');
  lines.push(hr);
  lines.push('  GEMINI SPAN LABELING EVALUATION REPORT');
  lines.push(hr);
  lines.push('');

  // Summary
  lines.push(`📊 SUMMARY (${report.promptCount} prompts evaluated):`);
  lines.push(`  Average Score:      ${report.summary.avgScore.toFixed(2)}/25`);
  lines.push(`  Average Span Count: ${report.summary.avgSpanCount.toFixed(2)}`);
  lines.push(`  Success/Errors:     ${report.summary.successCount}/${report.summary.errorCount}`);
  lines.push('');

  // Score distribution
  const dist = report.summary.scoreDistribution;
  const maxBar = Math.max(dist.excellent, dist.good, dist.acceptable, dist.poor, dist.failing, 1);
  const bar = (n: number) => '█'.repeat(Math.ceil((n / maxBar) * 30));
  lines.push('📈 SCORE DISTRIBUTION:');
  lines.push(`  excellent (23-25)    ${bar(dist.excellent)} ${dist.excellent}`);
  lines.push(`  good (18-22)         ${bar(dist.good)} ${dist.good}`);
  lines.push(`  acceptable (13-17)   ${bar(dist.acceptable)} ${dist.acceptable}`);
  lines.push(`  poor (8-12)          ${bar(dist.poor)} ${dist.poor}`);
  lines.push(`  failing (0-7)        ${bar(dist.failing)} ${dist.failing}`);
  lines.push('');

  // Latency stats
  lines.push('⏱️  LATENCY STATS (ms):');
  const ext = report.latencyStats.extraction;
  const jdg = report.latencyStats.judge;
  lines.push(`  Extraction: Avg=${ext.avg} | P50=${ext.p50} | P95=${ext.p95}`);
  lines.push(`  Judge:      Avg=${jdg.avg} | P50=${jdg.p50} | P95=${jdg.p95}`);
  lines.push('');

  // Category scores
  lines.push('CATEGORY SCORES (avg coverage/precision):');
  Object.entries(report.categoryScores).forEach(([cat, scores]) => {
    lines.push(`  ${cat.padEnd(14)} ${scores.coverage.toFixed(2)} / ${scores.precision.toFixed(2)}`);
  });
  lines.push('');

  // Common errors
  if (report.commonErrors.missedElements.length > 0) {
    lines.push('❌ COMMONLY MISSED ELEMENTS:');
    report.commonErrors.missedElements.slice(0, 5).forEach(m => {
      lines.push(`  - ${m.text} (${m.count}x, ${m.category})`);
    });
    lines.push('');
  }

  if (report.commonErrors.falsePositives.length > 0) {
    lines.push('⚠️  COMMON FALSE POSITIVES:');
    report.commonErrors.falsePositives.slice(0, 5).forEach(fp => {
      lines.push(`  - ${fp.text} (${fp.count}x, ${fp.reason})`);
    });
    lines.push('');
  }

  if (report.commonErrors.taxonomyErrors.length > 0) {
    lines.push('🔄 TOP TAXONOMY ERRORS:');
    report.commonErrors.taxonomyErrors.slice(0, 5).forEach(te => {
      lines.push(`  - ${te.from} → ${te.to} (${te.count}x) e.g. "${te.examples[0]}"`);
    });
    lines.push('');
  }

  // Worst performers
  const worstPerformers = report.results
    .filter(r => r.score !== null)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 3);
  if (worstPerformers.length > 0) {
    lines.push('🔍 WORST PERFORMERS (for debugging):');
    worstPerformers.forEach(r => {
      const preview = r.input.slice(0, 40).replace(/\n/g, ' ');
      lines.push(`  [${r.score}/25] "${preview}..."`);
      if (r.notes) lines.push(`    Notes: ${r.notes.slice(0, 100)}`);
    });
    lines.push('');
  }

  lines.push(hr);
  return lines.join('\n');
}

function saveReport(report: EvaluationReport): { jsonPath: string; textPath: string } {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const snapshotsDir = join(scriptDir, 'evaluation', 'snapshots');
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true });
  }

  const timestamp = report.timestamp.replace(/[:.]/g, '-').slice(0, 19);
  const jsonPath = join(snapshotsDir, `snapshot-gemini-${timestamp}.json`);
  const textPath = join(snapshotsDir, `report-gemini-${timestamp}.txt`);
  const latestJsonPath = join(snapshotsDir, 'latest-gemini.json');
  const latestTextPath = join(snapshotsDir, 'latest-gemini-report.txt');

  const jsonContent = JSON.stringify(report, null, 2);
  const textContent = formatTextReport(report);

  fs.writeFileSync(jsonPath, jsonContent);
  fs.writeFileSync(textPath, textContent);
  fs.writeFileSync(latestJsonPath, jsonContent);
  fs.writeFileSync(latestTextPath, textContent);

  console.log(`\n  📄 Report saved to:`);
  console.log(`     ${jsonPath}`);
  console.log(`     ${textPath}`);
  console.log(`     ${latestJsonPath}`);
  console.log(`     ${latestTextPath}`);

  return { jsonPath, textPath };
}

function formatSpansForJudge(spans: SpanResult[]): string {
  if (spans.length === 0) {
    return '(none)';
  }

  return spans
    .map((span, index) => {
      const confidence = Number.isFinite(span.confidence)
        ? span.confidence.toFixed(2)
        : '0.00';
      const text = span.text.replace(/\s+/g, ' ').trim();
      const section = span.section ?? 'main';
      return `[${index}] "${text}" (${span.role}, ${confidence}, start=${span.start}, end=${span.end}, section=${section})`;
    })
    .join('\n');
}

function parseJudgeResponse(content: string): EnhancedJudgeResult {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON in judge response');
  }

  const parsed = JSON.parse(jsonMatch[0]);
  
  const scores = {
    coverage: Number(parsed.scores?.coverage) || 0,
    precision: Number(parsed.scores?.precision) || 0,
    granularity: Number(parsed.scores?.granularity) || 0,
    taxonomy: Number(parsed.scores?.taxonomy) || 0,
    technicalSpecs: Number(parsed.scores?.technicalSpecs) || 0,
  };
  
  const totalScore = scores.coverage + scores.precision + scores.granularity + scores.taxonomy + scores.technicalSpecs;
  
  return {
    scores,
    totalScore,
    missedElements: Array.isArray(parsed.missedElements) ? parsed.missedElements : [],
    falsePositives: Array.isArray(parsed.falsePositives) ? parsed.falsePositives : [],
    taxonomyErrors: Array.isArray(parsed.taxonomyErrors) ? parsed.taxonomyErrors : [],
    granularityErrors: Array.isArray(parsed.granularityErrors) ? parsed.granularityErrors : [],
    categoryScores: parsed.categoryScores || createEmptyCategoryScores(),
    notes: parsed.notes || '',
  };
}

function createJudgeClient(useFastModel = false): OpenAICompatibleAdapter {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY required for LLM-as-Judge');
  }
  
  const model = useFastModel 
    ? 'gpt-4o-mini' 
    : (process.env.OPENAI_JUDGE_MODEL || 'gpt-4o');
  
  return new OpenAICompatibleAdapter({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    defaultModel: model,
    defaultTimeout: Number(process.env.OPENAI_TIMEOUT_MS || 60000),
    providerName: 'openai-judge',
  });
}

async function judgeSpanQuality(
  prompt: string,
  spans: SpanResult[],
  judgeClient: OpenAICompatibleAdapter
): Promise<EnhancedJudgeResult> {
  let content = '';
  const userMessage = `## Original Prompt
${prompt}

## Extracted Spans (${spans.length} total)
${formatSpansForJudge(spans)}

Span indices are 0-based and must be used in spanIndex fields.

Evaluate the span extraction quality using the rubric. Return only JSON.`;

  try {
    const response = await judgeClient.complete('', {
      messages: [
        { role: 'system', content: JUDGE_SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      schema: JUDGE_JSON_SCHEMA
    });

    content = response.content || response.text || '';
    return parseJudgeResponse(content);
  } catch (error) {
    console.error('Judge error:', error);
    console.error('Failed to parse judge response content:', content);
    return {
      scores: { coverage: 0, precision: 0, granularity: 0, taxonomy: 0, technicalSpecs: 0 },
      totalScore: 0,
      missedElements: [],
      falsePositives: [],
      taxonomyErrors: [],
      granularityErrors: [],
      categoryScores: createEmptyCategoryScores(),
      notes: `Judge failed: ${(error as Error).message}`,
    };
  }
}

// 1. Setup & Configuration
// Support both GOOGLE_API_KEY (from .env) and GOOGLE_GENERATIVE_AI_API_KEY (legacy)
const API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const MODEL_ID = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent`;

if (!API_KEY) {
  console.error("❌ Error: GOOGLE_API_KEY is not set in the environment.");
  console.error("   Please set GOOGLE_API_KEY in your .env file.");
  process.exit(1);
}

const geminiAdapter = new GeminiAdapter({
  apiKey: API_KEY!,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta',
  defaultModel: MODEL_ID,
  defaultTimeout: 60000,
  providerName: 'gemini',
});

// 2. Parse CLI args
const args = process.argv.slice(2);
let promptsFile: string | null = null;
let sampleSize: number | null = null;
let useSinglePrompt = false;
let resumeFromCache: string | null = null;
let cacheOutputPath: string | null = null;
let useFastJudge = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--prompts-file' && args[i + 1]) {
    promptsFile = args[++i];
  } else if (args[i] === '--sample' && args[i + 1]) {
    sampleSize = parseInt(args[++i], 10);
  } else if (args[i] === '--single') {
    useSinglePrompt = true;
  } else if (args[i] === '--resume' && args[i + 1]) {
    resumeFromCache = args[++i];
  } else if (args[i] === '--cache-output' && args[i + 1]) {
    cacheOutputPath = args[++i];
  } else if (args[i] === '--fast') {
    useFastJudge = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Usage: npx tsx scripts/test-gemini-flash-spans.ts [options]

Options:
  --prompts-file <path>   Path to prompts JSON file
  --sample <n>            Sample n random prompts
  --single                Use single test prompt
  --resume <path>         Resume from cached extraction results (skip Phase 1)
  --cache-output <path>   Custom path for extraction cache output
  --fast                  Use gpt-4o-mini for judging (faster & cheaper)
  --help, -h              Show this help message

Examples:
  # Run full extraction + judging
  npx tsx scripts/test-gemini-flash-spans.ts --sample 10

  # Resume judging from cached extractions with fast model
  npx tsx scripts/test-gemini-flash-spans.ts --resume scripts/evaluation/cache/extractions-latest.json --fast
`);
    process.exit(0);
  }
}

// 3. Load prompts
const DEFAULT_INPUT_TEXT = `Medium Shot of a woman with bright blue sports jersey, white high-top sneakers, and black braided hair dribbling a basketball with precision and agility in an outdoor basketball court with painted lines at mid-morning. The camera uses handheld tracking from a low angle with selective focus (f/4-f/5.6) to guide attention to the main action. Lit by natural daylight from the sun, casting soft shadows. Style reference: Shot with sports photography clarity.

**TECHNICAL SPECS**
- **Duration:** 6s
- **Aspect Ratio:** 16:9
- **Frame Rate:** 60fps
- **Audio:** Sound of sneakers on court and ball dribbling
- **Camera:** Low-angle handheld tracking with a 50mm lens, f/2.8
- **Lighting:** Natural daylight from the sun, high CRI
- **Style:** Dynamic sports photography`;

let prompts: PromptRecord[] = [];
if (useSinglePrompt || (!promptsFile && !findLatestPromptsFile())) {
  prompts = [{
    id: 'test-prompt-1',
    input: 'Test input',
    output: DEFAULT_INPUT_TEXT,
  }];
  console.log('Using single test prompt');
} else {
  const fileToLoad = promptsFile || findLatestPromptsFile();
  if (!fileToLoad || !fs.existsSync(fileToLoad)) {
    console.error('No prompts file found. Use --single for single prompt test, or --prompts-file to specify a file.');
    process.exit(1);
  }
  console.log(`Loading prompts from: ${fileToLoad}`);
  prompts = loadPrompts(fileToLoad);
  console.log(`Found ${prompts.length} prompts`);
  
  if (sampleSize && sampleSize < prompts.length) {
    console.log(`Sampling ${sampleSize} prompts...`);
    prompts = prompts.sort(() => Math.random() - 0.5).slice(0, sampleSize);
  }
}

// 4. System Instruction
const SYSTEM_INSTRUCTION = GEMINI_SIMPLE_SYSTEM_PROMPT;

// 5. Process prompts
async function processPrompts() {
  const extractionBatchSize = 5;
  let extractionResults: ExtractionResult[] = [];
  let successCount = 0;
  let errorCount = 0;
  let phase1Time = 0;
  let totalSpans = 0;
  let avgSpansPerPrompt = '0';
  let avgLatency = 0;
  let p50Latency = 0;
  let p95Latency = 0;
  let extractionLatencies: number[] = [];

  // =========================================================================
  // PHASE 1: Extract spans (or load from cache)
  // =========================================================================
  if (resumeFromCache) {
    // Resume from cached extraction results
    console.log(`🚀 Resuming from cached extraction results...`);
    console.log("---------------------------------------------------");

    const cache = loadExtractionCache(resumeFromCache);
    extractionResults = cache.results;
    successCount = cache.metadata.successCount;
    errorCount = cache.metadata.errorCount;
    totalSpans = extractionResults.reduce((sum, r) => sum + r.spans.length, 0);
    avgSpansPerPrompt = successCount > 0 ? (totalSpans / successCount).toFixed(1) : '0';

    console.log(`\n  ✓ Phase 1 SKIPPED (loaded ${extractionResults.length} cached results)`);
    console.log(`  Summary: ${successCount} succeeded, ${errorCount} failed, ${totalSpans} total spans`);
    console.log(`  Avg spans/prompt: ${avgSpansPerPrompt}`);
  } else {
    // Run fresh extraction
    const totalPrompts = prompts.length;

    console.log(`🚀 Starting ${MODEL_ID} span extraction test...`);
    console.log("---------------------------------------------------");
    console.log(`Model: ${MODEL_ID}`);
    console.log(`Endpoint: ${API_ENDPOINT}`);
    console.log(`Processing ${totalPrompts} prompt(s) in batches of ${extractionBatchSize}`);
    console.log("---------------------------------------------------");

    console.log(`\n📝 Phase 1: Extracting spans...`);
    const startPhase1 = Date.now();

    extractionResults = new Array(prompts.length);
    extractionLatencies = []; // Reset for fresh extraction
    const totalBatches = Math.ceil(prompts.length / extractionBatchSize);
    let currentBatch = 0;

  for (let batchStart = 0; batchStart < prompts.length; batchStart += extractionBatchSize) {
    currentBatch++;
    const batchEnd = Math.min(batchStart + extractionBatchSize, prompts.length);
    const batch = prompts.slice(batchStart, batchEnd);
    
    if (totalBatches > 1) {
      console.log(`  Batch ${currentBatch}/${totalBatches} (prompts ${batchStart + 1}-${batchEnd})...`);
    }

    await Promise.all(batch.map(async (prompt, batchIndex) => {
      const globalIndex = batchStart + batchIndex;
      const promptNum = globalIndex + 1;
      const INPUT_TEXT = prompt.output;
      const promptStartTime = Date.now();

      try {
        const response = await geminiAdapter.complete(SYSTEM_INSTRUCTION, {
          messages: [{ role: 'user', content: INPUT_TEXT }],
          jsonMode: true,
          responseSchema: GEMINI_JSON_SCHEMA,
          temperature: 0.1,
          maxTokens: 16384, // Ensure plenty of tokens for JSON output
        });

        const extractionLatency = Date.now() - promptStartTime;
        extractionLatencies.push(extractionLatency);

        const textContent = response.text || '';
        if (textContent) {
          try {
            // Helper to clean JSON
            const cleanJson = (text: string): string => {
              // Remove markdown code blocks
              let cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
              // Remove any text before the first '{' and after the last '}'
              const firstOpen = cleaned.indexOf('{');
              const lastClose = cleaned.lastIndexOf('}');
              if (firstOpen !== -1 && lastClose !== -1) {
                cleaned = cleaned.substring(firstOpen, lastClose + 1);
              }
              return cleaned;
            };

            const cleanedText = cleanJson(textContent);
            const parsedContent = JSON.parse(cleanedText);
            const spans = Array.isArray(parsedContent.spans) ? parsedContent.spans : [];
            
            if (spans.length === 0) {
              console.warn(`    ⚠️ No spans found. Raw text preview: "${textContent.slice(0, 500)}..."`);
              console.warn(`    Parsed object keys: ${Object.keys(parsedContent).join(', ')}`);
            }
            
            const spanResults: SpanResult[] = spans.map((span: any) => {
              const text = span.text || '';
              const start = INPUT_TEXT.indexOf(text);
              const end = start >= 0 ? start + text.length : 0;
              
              return {
                text: text,
                role: span.category || span.role || 'unknown',
                confidence: Number(span.confidence) || 0,
                start: start >= 0 ? start : 0,
                end: end,
                section: start >= 0 && INPUT_TEXT.indexOf('**TECHNICAL SPECS**') > 0 && start >= INPUT_TEXT.indexOf('**TECHNICAL SPECS**')
                  ? 'technicalSpecs'
                  : 'main',
              };
            });

            successCount++;
            const preview = prompt.input.slice(0, 40).replace(/\n/g, ' ');
            console.log(`  [${String(promptNum).padStart(3)}/${totalPrompts}] ✓ "${preview}..." → ${spans.length} spans (${extractionLatency}ms)`);

            extractionResults[globalIndex] = {
              promptId: prompt.id,
              input: prompt.input,
              output: INPUT_TEXT,
              spans: spanResults,
              error: null,
              latency: extractionLatency,
            };
          } catch (e) {
            errorCount++;
            const preview = prompt.input.slice(0, 40).replace(/\n/g, ' ');
            console.error(`  [${String(promptNum).padStart(3)}/${totalPrompts}] ✗ "${preview}..." → Parse error: ${(e as Error).message}`);
            
            // Check for finish reason in metadata
            const metaRaw = response.metadata?.raw as any;
            const candidate = metaRaw?.candidates?.[0];
            const finishReason = candidate?.finishReason;
            
            if (finishReason) {
              console.error(`    Finish Reason: ${finishReason}`);
            }
            
            console.error(`    Raw text (${textContent.length} chars): "${textContent.slice(0, 1000).replace(/\n/g, '\\n')}"`);

            extractionResults[globalIndex] = {
              promptId: prompt.id,
              input: prompt.input,
              output: INPUT_TEXT,
              spans: [],
              error: (e as Error).message,
              latency: extractionLatency,
            };
          }
        } else {
          errorCount++;
          const preview = prompt.input.slice(0, 40).replace(/\n/g, ' ');
          console.error(`  [${String(promptNum).padStart(3)}/${totalPrompts}] ✗ "${preview}..." → No content in response`);
          
          extractionResults[globalIndex] = {
            promptId: prompt.id,
            input: prompt.input,
            output: INPUT_TEXT,
            spans: [],
            error: 'No content in response',
            latency: extractionLatency,
          };
        }
      } catch (error) {
        errorCount++;
        const extractionLatency = Date.now() - promptStartTime;
        const preview = prompt.input.slice(0, 40).replace(/\n/g, ' ');
        console.error(`  [${String(promptNum).padStart(3)}/${totalPrompts}] ✗ "${preview}..." → API error: ${(error as Error).message}`);
        
        extractionResults[globalIndex] = {
          promptId: prompt.id,
          input: prompt.input,
          output: INPUT_TEXT,
          spans: [],
          error: (error as Error).message,
          latency: extractionLatency,
        };
      }
    }));

    if (batchEnd < prompts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

    phase1Time = Date.now() - startPhase1;
    totalSpans = extractionResults.reduce((sum, r) => sum + r.spans.length, 0);
    avgSpansPerPrompt = successCount > 0 ? (totalSpans / successCount).toFixed(1) : '0';
    avgLatency = extractionLatencies.length > 0
      ? Math.round(extractionLatencies.reduce((a, b) => a + b, 0) / extractionLatencies.length)
      : 0;
    p50Latency = extractionLatencies.length > 0
      ? extractionLatencies.sort((a, b) => a - b)[Math.floor(extractionLatencies.length * 0.5)]
      : 0;
    p95Latency = extractionLatencies.length > 0
      ? extractionLatencies.sort((a, b) => a - b)[Math.floor(extractionLatencies.length * 0.95)]
      : 0;

    console.log(`\n  ✓ Phase 1 complete in ${(phase1Time / 1000).toFixed(1)}s`);
    console.log(`  Summary: ${successCount} succeeded, ${errorCount} failed, ${totalSpans} total spans extracted`);
    console.log(`  Avg spans/prompt: ${avgSpansPerPrompt}, Latency: avg=${avgLatency}ms, p50=${p50Latency}ms, p95=${p95Latency}ms`);

    // Save extraction cache for later resume
    saveExtractionCache(extractionResults, {
      model: MODEL_ID,
      timestamp: new Date().toISOString(),
      promptsFile: promptsFile,
      sampleSize: sampleSize,
      totalPrompts: prompts.length,
      successCount,
      errorCount,
    }, cacheOutputPath);
  } // end of fresh extraction else block

  // =========================================================================
  // PHASE 2: Judge with LLM
  // =========================================================================
  const totalExtractions = extractionResults.length;
  const judgeModel = useFastJudge ? 'gpt-4o-mini' : (process.env.OPENAI_JUDGE_MODEL || 'gpt-4o');
  console.log(`\n⚖️  Phase 2: Judging quality with ${judgeModel} (concurrency: 2)...`);
  const startPhase2 = Date.now();
  const concurrency = 2;
  const totalJudgeBatches = Math.ceil(totalExtractions / concurrency);
  console.log(`  Processing ${totalExtractions} extractions in ${totalJudgeBatches} batch(es)`);
  
  const judgeResults: (EnhancedJudgeResult | null)[] = new Array(totalExtractions);
  const judgeLatencies: number[] = [];
  let judgedCount = 0;
  let judgeBatchNum = 0;

  for (let batchStart = 0; batchStart < totalExtractions; batchStart += concurrency) {
    judgeBatchNum++;
    const batchEnd = Math.min(batchStart + concurrency, totalExtractions);
    
    if (totalJudgeBatches > 1) {
      console.log(`  Judge batch ${judgeBatchNum}/${totalJudgeBatches} (${batchEnd - batchStart} prompts)...`);
    }

    await Promise.all(
      extractionResults.slice(batchStart, batchEnd).map(async (extraction, batchIndex) => {
        const globalIndex = batchStart + batchIndex;
        const promptNum = globalIndex + 1;
        const startTime = Date.now();
        
        let judgeResult: EnhancedJudgeResult | null = null;
        if (!extraction.error && extraction.spans.length > 0) {
          try {
            const judgeClient = createJudgeClient(useFastJudge);
            judgeResult = await judgeSpanQuality(extraction.output, extraction.spans, judgeClient);
          } catch (judgeError) {
            console.error(`      ❌ Judge failed: ${(judgeError as Error).message}`);
          }
        }
        
        judgeResults[globalIndex] = judgeResult;
        const judgeLatency = Date.now() - startTime;
        if (judgeResult) {
          judgeLatencies.push(judgeLatency);
        }
        
        judgedCount++;
        const score = judgeResult?.totalScore ?? 'SKIP';
        const preview = extraction.input.slice(0, 40).replace(/\n/g, ' ');
        const spanCount = extraction.spans.length;
        const status = extraction.error ? 'ERR' : (judgeResult ? '✓' : 'SKIP');
        console.log(`  [${String(judgedCount).padStart(3)}/${totalExtractions}] ${status} "${preview}..." → ${score}/25 (${spanCount} spans, ${judgeLatency}ms)`);
      })
    );

    if (batchEnd < totalExtractions) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const phase2Time = Date.now() - startPhase2;
  const successfulJudgments = judgeResults.filter(r => r && r.totalScore > 0).length;
  const skippedJudgments = extractionResults.filter(r => !r.error && r.spans.length === 0).length;
  const avgJudgeScore = successfulJudgments > 0
    ? (judgeResults.reduce((sum, r) => sum + (r?.totalScore || 0), 0) / successfulJudgments).toFixed(2)
    : '0.00';
  const avgJudgeLatency = judgeLatencies.length > 0
    ? Math.round(judgeLatencies.reduce((a, b) => a + b, 0) / judgeLatencies.length)
    : 0;

  console.log(`  ✓ Phase 2 complete in ${(phase2Time / 1000).toFixed(1)}s`);
  console.log(`  Summary: ${successfulJudgments} judged, ${skippedJudgments} skipped, ${errorCount} failed`);
  console.log(`  Avg score: ${avgJudgeScore}/25, Avg judge latency: ${avgJudgeLatency}ms`);
  console.log(`\n  Total time: ${((phase1Time + phase2Time) / 1000).toFixed(1)}s`);

  // =========================================================================
  // PHASE 3: Generate and save report
  // =========================================================================
  console.log(`\n📊 Phase 3: Generating report...`);
  const report = generateReport(extractionResults, judgeResults, {
    extractionModel: MODEL_ID,
    judgeModel,
    sourceFile: promptsFile,
    extractionLatencies,
    judgeLatencies,
  });
  saveReport(report);
}

// Run the async function
processPrompts().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
