#!/usr/bin/env tsx

import { config as loadEnv } from 'dotenv';
loadEnv();

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { AIModelService } from '../../../server/src/services/ai-model/AIModelService.ts';
import { OpenAICompatibleAdapter } from '../../../server/src/clients/adapters/OpenAICompatibleAdapter.ts';
import { GeminiAdapter } from '../../../server/src/clients/adapters/GeminiAdapter.ts';

import { EnhancementService } from '../../../server/src/services/enhancement/EnhancementService.ts';
import { PlaceholderDetectionService } from '../../../server/src/services/enhancement/services/PlaceholderDetectionService.ts';
import { VideoPromptService } from '../../../server/src/services/video-prompt-analysis/VideoPromptService.ts';
import { BrainstormContextBuilder } from '../../../server/src/services/enhancement/services/BrainstormContextBuilder.ts';
import { CleanPromptBuilder } from '../../../server/src/services/enhancement/services/CleanPromptBuilder.ts';
import { SuggestionValidationService } from '../../../server/src/services/enhancement/services/SuggestionValidationService.ts';
import { SuggestionDiversityEnforcer } from '../../../server/src/services/enhancement/services/SuggestionDeduplicator.ts';
import { CategoryAlignmentService } from '../../../server/src/services/enhancement/services/CategoryAlignmentService.ts';
import { SuggestionQualityEvaluator, type SuggestionTestCase } from '../../../server/src/services/enhancement/evaluation/SuggestionQualityEvaluator.ts';
import { TextCategorizerService } from '../../../server/src/services/text-categorization/TextCategorizerService.ts';

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

function loadCases(): SuggestionTestCase[] {
  const raw = JSON.parse(readFileSync(CASES_PATH, 'utf-8'));
  return raw.cases || [];
}

function findContext(fullPrompt: string, spanText: string): { contextBefore: string; contextAfter: string } {
  let idx = fullPrompt.indexOf(spanText);
  if (idx === -1) {
    idx = fullPrompt.toLowerCase().indexOf(spanText.toLowerCase());
  }
  if (idx === -1) return { contextBefore: '', contextAfter: '' };
  const before = fullPrompt.slice(0, idx);
  const after = fullPrompt.slice(idx + spanText.length);
  return {
    contextBefore: before.slice(-160),
    contextAfter: after.slice(0, 160),
  };
}

export async function runSuggestionBenchmark() {
  const aiService = createAIService();

  const placeholderDetector = new PlaceholderDetectionService();
  const videoService = new VideoPromptService();
  const brainstormBuilder = new BrainstormContextBuilder();
  const promptBuilder = new CleanPromptBuilder();
  const validationService = new SuggestionValidationService(videoService);
  const diversityEnforcer = new SuggestionDiversityEnforcer(aiService as any);
  const categoryAligner = new CategoryAlignmentService(validationService);

  const enhancementService = new EnhancementService(
    aiService as any,
    placeholderDetector,
    videoService,
    brainstormBuilder,
    promptBuilder,
    validationService,
    diversityEnforcer,
    categoryAligner,
    null
  );

  const classifier = new TextCategorizerService(aiService as any);
  const evaluator = new SuggestionQualityEvaluator(validationService, videoService, classifier);

  const cases = loadCases();
  if (cases.length === 0) {
    throw new Error(`No cases found at ${CASES_PATH}`);
  }

  const results = [];
  for (const testCase of cases) {
    const { prompt, span } = testCase;
    const ctx = findContext(prompt, span.text);

    let suggestions: any[] = [];
    let generationError: string | null = null;
    try {
      // eslint-disable-next-line no-await-in-loop
      const enhancement = await enhancementService.getEnhancementSuggestions({
        highlightedText: span.text,
        contextBefore: ctx.contextBefore,
        contextAfter: ctx.contextAfter,
        fullPrompt: prompt,
        originalUserPrompt: prompt,
        highlightedCategory: span.category,
        highlightedCategoryConfidence: 1.0,
      } as any);
      suggestions = enhancement.suggestions || [];
    } catch (e) {
      generationError = (e as Error).message;
      suggestions = [];
    }

    if (process.env.EVAL_FAULT_SUGGESTIONS_ECHO === '1') {
      const count = Math.max(5, suggestions.length || 0);
      suggestions = Array.from({ length: count }, () => ({
        text: span.text,
        explanation: 'echo',
        category: span.category,
        _fault: 'echo',
      }));
    }
    // eslint-disable-next-line no-await-in-loop
    const quality = await evaluator.evaluateCase(testCase, suggestions);
    results.push({ testCase, quality, generationError });

    process.stdout.write(quality.passed && !generationError ? '.' : 'F');
  }
  process.stdout.write('\n');

  const suiteScores = results.map((r) => r.quality.scores);
  const mean = (key: keyof (typeof suiteScores)[number]) =>
    suiteScores.reduce((sum, s) => sum + (s[key] || 0), 0) / suiteScores.length;

  const suiteMetrics = {
    categoryCoherence: mean('categoryCoherence'),
    diversity: mean('diversity'),
    nonRepetition: mean('nonRepetition'),
    syntacticValidity: mean('syntacticValidity'),
    lengthAppropriateness: mean('lengthAppropriateness'),
    totalCases: suiteScores.length,
  };

  const outPath = join(__dirname, '../../../test-results/suggestions-evaluation.json');
  writeFileSync(outPath, JSON.stringify({ suiteMetrics, results }, null, 2));
  return { suiteMetrics, results, outPath };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runSuggestionBenchmark()
    .then(({ suiteMetrics, outPath }) => {
      console.log(`📄 Suggestion report written to ${outPath}`);
      console.log('Suite metrics:', suiteMetrics);
    })
    .catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
