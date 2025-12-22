#!/usr/bin/env tsx

/**
 * Span Labeling Evaluation Script
 * 
 * Uses real production prompts + LLM-as-Judge evaluation.
 * No ground truth annotation required.
 * 
 * Usage:
 *   npx tsx scripts/evaluation/span-labeling-evaluation.ts [--prompts-file path] [--sample N]
 * 
 * Options:
 *   --prompts-file  Path to JSON file with input/output pairs (default: finds latest)
 *   --sample N      Only evaluate N random prompts (default: all)
 *   --baseline      Lock current results as baseline
 */

import { config as loadEnv } from 'dotenv';
loadEnv();

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { labelSpans } from '../../server/src/llm/span-labeling/SpanLabelingService.js';
import { AIModelService } from '../../server/src/services/ai-model/AIModelService.js';
import { OpenAICompatibleAdapter } from '../../server/src/clients/adapters/OpenAICompatibleAdapter.js';
import { warmupGliner } from '../../server/src/llm/span-labeling/nlp/NlpSpanService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SNAPSHOTS_DIR = join(__dirname, 'snapshots');

// =============================================================================
// LLM Judge Rubric
// =============================================================================

const JUDGE_SYSTEM_PROMPT = `You are evaluating span labeling quality for video prompts.

A span is a "visual control point" - a phrase that, if changed, would produce a visually different video.

## Evaluation Criteria (score each 1-5)

1. **Coverage** (1-5): Did it extract ALL visual control points?
   - Subjects, actions, environments, lighting, camera movements, technical specs
   - 5 = Comprehensive, nothing missed
   - 1 = Major elements missing

2. **Precision** (1-5): Did it correctly SKIP abstract/non-renderable content?
   - Should skip: "determination", "inviting the viewer", "enhancing authenticity"
   - Should include: "focused demeanor" (visible expression), "gripping" (visible action)
   - 5 = Only extracted renderable elements
   - 1 = Extracted many abstract concepts

3. **Granularity** (1-5): Are span boundaries correct?
   - Not too fine: "soft" + "highlights" should be "soft highlights"
   - Not too coarse: Don't merge unrelated elements
   - 5 = All boundaries appropriate
   - 1 = Many boundary errors

4. **Taxonomy** (1-5): Are roles assigned correctly?
   - camera.movement vs action.movement
   - shot.type vs camera.angle
   - 5 = All roles correct
   - 1 = Many misclassifications

5. **Technical Specs** (1-5): Did it extract format parameters?
   - Duration, fps, aspect ratio, resolution
   - These are often in structured sections
   - 5 = All specs extracted
   - 1 = Specs ignored

## Response Format

Return ONLY valid JSON:
{
  "scores": {
    "coverage": <1-5>,
    "precision": <1-5>,
    "granularity": <1-5>,
    "taxonomy": <1-5>,
    "technicalSpecs": <1-5>
  },
  "totalScore": <sum of above, max 25>,
  "missedElements": ["list of visual elements that should have been extracted but weren't"],
  "incorrectExtractions": ["list of abstract/non-renderable elements that shouldn't have been extracted"],
  "notes": "brief explanation of scoring"
}`;

interface JudgeResult {
  scores: {
    coverage: number;
    precision: number;
    granularity: number;
    taxonomy: number;
    technicalSpecs: number;
  };
  totalScore: number;
  missedElements: string[];
  incorrectExtractions: string[];
  notes: string;
}

interface PromptRecord {
  id: string;
  input: string;
  output: string;
  timestamp?: string;
  generatedAt?: string;
  error?: string | null;
}

interface EvaluationDataset {
  metadata?: {
    generatedAt: string;
    promptCount: number;
  };
  prompts?: PromptRecord[];
}

interface SpanResult {
  text: string;
  role: string;
  confidence: number;
}

interface EvaluationResult {
  promptId: string;
  input: string;
  output: string;
  spanCount: number;
  spans: SpanResult[];
  judgeResult: JudgeResult | null;
  error: string | null;
  latencyMs: number;
}

interface Snapshot {
  timestamp: string;
  promptCount: number;
  sourceFile: string;
  judgeModel: string;
  results: EvaluationResult[];
  summary: {
    avgScore: number;
    avgSpanCount: number;
    scoreDistribution: Record<string, number>;
    commonMissedElements: string[];
    commonIncorrectExtractions: string[];
    errorCount: number;
  };
}

// =============================================================================
// AI Service Setup
// =============================================================================

function createAIService(): AIModelService {
  const clients: Record<string, any> = {};

  if (process.env.GROQ_API_KEY) {
    clients.groq = new OpenAICompatibleAdapter({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
      defaultModel: 'llama-3.1-8b-instant',
      providerName: 'groq',
    });
  }

  if (process.env.OPENAI_API_KEY) {
    clients.openai = new OpenAICompatibleAdapter({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      providerName: 'openai',
    });
  }

  if (!clients.openai && clients.groq) {
    clients.openai = clients.groq;
  }

  if (Object.keys(clients).length === 0) {
    throw new Error('No AI API keys found. Set GROQ_API_KEY or OPENAI_API_KEY');
  }

  return new AIModelService({ clients });
}

/**
 * Create a dedicated GPT-4o client for LLM-as-Judge evaluation.
 * Using a stronger model than the one being evaluated ensures unbiased assessment.
 */
function createJudgeClient(): OpenAICompatibleAdapter {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY required for LLM-as-Judge (uses GPT-4o)');
  }
  
  return new OpenAICompatibleAdapter({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    providerName: 'openai-judge',
  });
}

// =============================================================================
// LLM Judge (GPT-4o)
// =============================================================================

async function judgeSpanQuality(
  prompt: string,
  spans: SpanResult[],
  judgeClient: OpenAICompatibleAdapter
): Promise<JudgeResult> {
  const userMessage = `## Original Prompt
${prompt}

## Extracted Spans (${spans.length} total)
${JSON.stringify(spans, null, 2)}

Evaluate the span extraction quality using the rubric. Return only JSON.`;

  try {
    const response = await judgeClient.complete({
      messages: [
        { role: 'system', content: JUDGE_SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.1,
      maxTokens: 1000,
    });

    const content = response.content || response.text || '';
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in judge response');
    }
    
    return JSON.parse(jsonMatch[0]) as JudgeResult;
  } catch (error) {
    console.error('Judge error:', error);
    return {
      scores: { coverage: 0, precision: 0, granularity: 0, taxonomy: 0, technicalSpecs: 0 },
      totalScore: 0,
      missedElements: [],
      incorrectExtractions: [],
      notes: `Judge failed: ${(error as Error).message}`
    };
  }
}

// =============================================================================
// Main Evaluation
// =============================================================================

async function evaluatePrompt(
  record: PromptRecord,
  aiService: AIModelService,
  judgeClient: OpenAICompatibleAdapter
): Promise<EvaluationResult> {
  const startTime = Date.now();
  
  try {
    // Run span labeling
    const response = await labelSpans({
      text: record.output,
      maxSpans: 50,
      minConfidence: 0.5,
      templateVersion: 'v3.0'
    }, aiService);

    const spans: SpanResult[] = (response.spans || []).map((s: any) => ({
      text: s.text,
      role: s.role,
      confidence: s.confidence
    }));

    // Run LLM judge (GPT-4o)
    const judgeResult = await judgeSpanQuality(record.output, spans, judgeClient);

    return {
      promptId: record.id,
      input: record.input,
      output: record.output,
      spanCount: spans.length,
      spans,
      judgeResult,
      error: null,
      latencyMs: Date.now() - startTime
    };
  } catch (error) {
    return {
      promptId: record.id,
      input: record.input,
      output: record.output,
      spanCount: 0,
      spans: [],
      judgeResult: null,
      error: (error as Error).message,
      latencyMs: Date.now() - startTime
    };
  }
}

function computeSummary(results: EvaluationResult[]): Snapshot['summary'] {
  const successfulResults = results.filter(r => r.judgeResult && r.judgeResult.totalScore > 0);
  
  const avgScore = successfulResults.length > 0
    ? successfulResults.reduce((sum, r) => sum + (r.judgeResult?.totalScore || 0), 0) / successfulResults.length
    : 0;

  const avgSpanCount = results.reduce((sum, r) => sum + r.spanCount, 0) / results.length;

  // Score distribution
  const scoreDistribution: Record<string, number> = {
    'excellent (23-25)': 0,
    'good (18-22)': 0,
    'acceptable (13-17)': 0,
    'poor (8-12)': 0,
    'failing (0-7)': 0,
  };

  for (const r of successfulResults) {
    const score = r.judgeResult?.totalScore || 0;
    if (score >= 23) scoreDistribution['excellent (23-25)']++;
    else if (score >= 18) scoreDistribution['good (18-22)']++;
    else if (score >= 13) scoreDistribution['acceptable (13-17)']++;
    else if (score >= 8) scoreDistribution['poor (8-12)']++;
    else scoreDistribution['failing (0-7)']++;
  }

  // Aggregate missed/incorrect elements
  const allMissed: string[] = [];
  const allIncorrect: string[] = [];
  
  for (const r of successfulResults) {
    if (r.judgeResult?.missedElements) {
      allMissed.push(...r.judgeResult.missedElements);
    }
    if (r.judgeResult?.incorrectExtractions) {
      allIncorrect.push(...r.judgeResult.incorrectExtractions);
    }
  }

  // Count frequency and get top issues
  const countFrequency = (arr: string[]): string[] => {
    const counts = new Map<string, number>();
    for (const item of arr) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([item, count]) => `${item} (${count}x)`);
  };

  return {
    avgScore: Math.round(avgScore * 100) / 100,
    avgSpanCount: Math.round(avgSpanCount * 100) / 100,
    scoreDistribution,
    commonMissedElements: countFrequency(allMissed),
    commonIncorrectExtractions: countFrequency(allIncorrect),
    errorCount: results.filter(r => r.error).length
  };
}

function findLatestPromptsFile(): string | null {
  // First check for generated evaluation prompts in data directory
  const dataDir = join(__dirname, 'data');
  if (existsSync(dataDir)) {
    const latestPath = join(dataDir, 'evaluation-prompts-latest.json');
    if (existsSync(latestPath)) {
      return latestPath;
    }
    
    // Fall back to timestamped files
    const evalFiles = readdirSync(dataDir)
      .filter(f => f.startsWith('evaluation-prompts-') && f.endsWith('.json'))
      .sort()
      .reverse();
    
    if (evalFiles.length > 0) {
      return join(dataDir, evalFiles[0]);
    }
  }
  
  // Fall back to raw prompts in project root
  const projectRoot = join(__dirname, '../..');
  const files = readdirSync(projectRoot)
    .filter(f => f.startsWith('raw-prompts-') && f.endsWith('.json'))
    .sort()
    .reverse();
  
  return files.length > 0 ? join(projectRoot, files[0]) : null;
}

function loadPrompts(filePath: string): PromptRecord[] {
  const data = JSON.parse(readFileSync(filePath, 'utf-8'));
  
  // Handle new evaluation dataset format
  if (data.metadata && data.prompts) {
    const dataset = data as EvaluationDataset;
    return (dataset.prompts || [])
      .filter((p: PromptRecord) => !p.error && p.output) // Skip failed generations
      .map((item: PromptRecord) => ({
        id: item.id,
        input: item.input || '',
        output: item.output || '',
        timestamp: item.generatedAt || item.timestamp
      }));
  }
  
  // Handle legacy raw prompts format
  return data.map((item: any, index: number) => ({
    id: item.id || item.uuid || `prompt-${index}`,
    input: item.input || '',
    output: item.output || '',
    timestamp: item.timestamp
  }));
}

function printReport(snapshot: Snapshot): void {
  console.log('\n' + '='.repeat(80));
  console.log('  SPAN LABELING EVALUATION REPORT');
  console.log('='.repeat(80));
  console.log();

  console.log(`📊 SUMMARY (${snapshot.promptCount} prompts evaluated):`);
  console.log(`  Average Score:      ${snapshot.summary.avgScore}/25`);
  console.log(`  Average Span Count: ${snapshot.summary.avgSpanCount}`);
  console.log(`  Errors:             ${snapshot.summary.errorCount}`);
  console.log();

  console.log('📈 SCORE DISTRIBUTION:');
  for (const [range, count] of Object.entries(snapshot.summary.scoreDistribution)) {
    const bar = '█'.repeat(Math.round(count / snapshot.promptCount * 40));
    console.log(`  ${range.padEnd(20)} ${bar} ${count}`);
  }
  console.log();

  if (snapshot.summary.commonMissedElements.length > 0) {
    console.log('❌ COMMONLY MISSED ELEMENTS:');
    for (const item of snapshot.summary.commonMissedElements.slice(0, 5)) {
      console.log(`  - ${item}`);
    }
    console.log();
  }

  if (snapshot.summary.commonIncorrectExtractions.length > 0) {
    console.log('⚠️  COMMONLY INCORRECT EXTRACTIONS:');
    for (const item of snapshot.summary.commonIncorrectExtractions.slice(0, 5)) {
      console.log(`  - ${item}`);
    }
    console.log();
  }

  // Show worst performers
  const worstResults = snapshot.results
    .filter(r => r.judgeResult)
    .sort((a, b) => (a.judgeResult?.totalScore || 0) - (b.judgeResult?.totalScore || 0))
    .slice(0, 3);

  if (worstResults.length > 0) {
    console.log('🔍 WORST PERFORMERS (for debugging):');
    for (const r of worstResults) {
      console.log(`  [${r.judgeResult?.totalScore}/25] "${r.input.slice(0, 50)}..."`);
      console.log(`    Notes: ${r.judgeResult?.notes?.slice(0, 100)}`);
    }
    console.log();
  }

  console.log('='.repeat(80));
}

async function main(): Promise<void> {
  // Parse CLI args
  const args = process.argv.slice(2);
  let promptsFile = findLatestPromptsFile();
  let sampleSize: number | null = null;
  let lockBaseline = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--prompts-file' && args[i + 1]) {
      promptsFile = args[++i];
    } else if (args[i] === '--sample' && args[i + 1]) {
      sampleSize = parseInt(args[++i], 10);
    } else if (args[i] === '--baseline') {
      lockBaseline = true;
    }
  }

  if (!promptsFile || !existsSync(promptsFile)) {
    console.error('No prompts file found. Specify with --prompts-file or place raw-prompts-*.json in project root.');
    process.exit(1);
  }

  console.log(`Loading prompts from: ${promptsFile}`);
  let prompts = loadPrompts(promptsFile);
  console.log(`Found ${prompts.length} prompts`);

  // Sample if requested
  if (sampleSize && sampleSize < prompts.length) {
    console.log(`Sampling ${sampleSize} prompts...`);
    prompts = prompts
      .sort(() => Math.random() - 0.5)
      .slice(0, sampleSize);
  }

  // Warmup GLiNER
  console.log('Warming up GLiNER model...');
  const warmup = await warmupGliner();
  console.log(`GLiNER: ${warmup.success ? 'ready' : 'not ready'}`);

  // Create AI service (for span labeling)
  const aiService = createAIService();
  console.log(`AI service ready`);

  // Create dedicated GPT-4o judge client
  const judgeClient = createJudgeClient();
  console.log(`Judge client ready (GPT-4o)`);

  // Evaluate each prompt
  console.log(`\nEvaluating ${prompts.length} prompts...`);
  const results: EvaluationResult[] = [];

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    process.stdout.write(`\r  Processing ${i + 1}/${prompts.length}: ${prompt.input.slice(0, 40)}...`);
    
    const result = await evaluatePrompt(prompt, aiService, judgeClient);
    results.push(result);

    // Rate limiting pause
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.log('\n');

  // Build snapshot
  const snapshot: Snapshot = {
    timestamp: new Date().toISOString(),
    promptCount: results.length,
    sourceFile: promptsFile,
    judgeModel: 'gpt-4o',
    results,
    summary: computeSummary(results)
  };

  // Save snapshot
  const snapshotPath = join(SNAPSHOTS_DIR, 'latest.json');
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  console.log(`📄 Snapshot saved to: ${snapshotPath}`);

  // Optionally lock as baseline
  if (lockBaseline) {
    const baselinePath = join(SNAPSHOTS_DIR, 'baseline.json');
    writeFileSync(baselinePath, JSON.stringify(snapshot, null, 2));
    console.log(`🔒 Baseline locked at: ${baselinePath}`);
  }

  // Print report
  printReport(snapshot);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
