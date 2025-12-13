#!/usr/bin/env tsx

import { config as loadEnv } from 'dotenv';
loadEnv();

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { AIModelService } from '../../../server/src/services/ai-model/AIModelService.ts';
import { OpenAICompatibleAdapter } from '../../../server/src/clients/adapters/OpenAICompatibleAdapter.ts';
import { GeminiAdapter } from '../../../server/src/clients/adapters/GeminiAdapter.ts';

import { PromptOptimizationService } from '../../../server/src/services/prompt-optimization/PromptOptimizationService.ts';
import { OptimizationQualityEvaluator, type OptimizationTestCase } from '../../../server/src/services/prompt-optimization/evaluation/OptimizationQualityEvaluator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CASES_PATH = join(__dirname, 'test-cases.json');

function createAIService(): AIModelService {
  const clients: Record<string, unknown> = {};

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

  if (process.env.GEMINI_API_KEY) {
    clients.gemini = new GeminiAdapter({
      apiKey: process.env.GEMINI_API_KEY,
      defaultModel: 'gemini-2.0-flash-exp',
      providerName: 'gemini',
    });
  }

  if (!clients.openai && clients.groq) {
    clients.openai = clients.groq;
  }

  if (Object.keys(clients).length === 0) {
    throw new Error('No AI API keys found. Set GROQ_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY');
  }

  return new AIModelService({ clients: clients as any });
}

function loadCases(): OptimizationTestCase[] {
  const raw = JSON.parse(readFileSync(CASES_PATH, 'utf-8'));
  return raw.cases || [];
}

export async function runOptimizationBenchmark() {
  const aiService = createAIService();
  const optimizationService = new PromptOptimizationService(aiService as any);
  const evaluator = new OptimizationQualityEvaluator(aiService as any);

  const cases = loadCases();
  if (cases.length === 0) throw new Error(`No cases found at ${CASES_PATH}`);

  const results = [];
  for (const testCase of cases) {
    let optimized = testCase.input;
    let optimizationError: string | null = null;
    try {
      // eslint-disable-next-line no-await-in-loop
      optimized = await optimizationService.optimize({ prompt: testCase.input, mode: 'video' } as any);
    } catch (e) {
      optimizationError = (e as Error).message;
      optimized = testCase.input;
    }
    if (process.env.EVAL_FAULT_OPTIMIZATION_IDENTITY === '1') {
      optimized = testCase.input;
    }
    // eslint-disable-next-line no-await-in-loop
    const quality = await evaluator.evaluateCase(testCase, optimized);
    results.push({ testCase, quality, optimizationError });
    process.stdout.write(quality.passed && !optimizationError ? '.' : 'F');
  }
  process.stdout.write('\n');

  const suiteScores = results.map((r) => r.quality.scores);
  const mean = (key: keyof (typeof suiteScores)[number]) =>
    suiteScores.reduce((sum, s) => sum + (s[key] || 0), 0) / suiteScores.length;

  const suiteMetrics = {
    intentPreservation: mean('intentPreservation'),
    structuralCompleteness: mean('structuralCompleteness'),
    wordCountCompliance: mean('wordCountCompliance'),
    technicalDensity: mean('technicalDensity'),
    modelCompliance: mean('modelCompliance'),
    totalCases: suiteScores.length,
  };

  const outPath = join(__dirname, '../../../test-results/optimization-evaluation.json');
  writeFileSync(outPath, JSON.stringify({ suiteMetrics, results }, null, 2));
  return { suiteMetrics, results, outPath };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runOptimizationBenchmark()
    .then(({ suiteMetrics, outPath }) => {
      console.log(`📄 Optimization report written to ${outPath}`);
      console.log('Suite metrics:', suiteMetrics);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
