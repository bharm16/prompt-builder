import type { AIModelService } from '@services/ai-model/AIModelService';
import { normalizeText } from '../utils/text';

export type IntentPreservationResult = {
  score: number;
  missing: string[];
  evidence?: Array<{ element: string; present: boolean; evidence?: string }>;
};

export async function evaluateIntentPreservation(
  ai: AIModelService,
  input: string,
  optimized: string,
  requiredElements: string[]
): Promise<IntentPreservationResult> {
  const opt = normalizeText(optimized);
  const missing = (requiredElements || []).filter((el) => !opt.includes(normalizeText(el)));
  if (missing.length === 0) {
    return { score: 1.0, missing: [] };
  }

  try {
    const systemPrompt = [
      'You are a strict intent-preservation evaluator for video prompts.',
      'Task: Decide whether the OPTIMIZED prompt preserves each required element from the ORIGINAL prompt.',
      '',
      'Rules:',
      '- Treat synonyms/paraphrases as preserved if the concept is clearly present.',
      '- Be conservative: if it is not clearly present, mark it as NOT preserved.',
      '- Provide a short evidence snippet (a phrase from the optimized prompt) when preserved.',
      '- Output ONLY valid JSON with the exact schema below.',
      '',
      'JSON schema:',
      '{',
      '  "items": [',
      '    { "element": string, "present": boolean, "evidence": string }',
      '  ],',
      '  "allPresent": boolean',
      '}',
      '',
      `ORIGINAL: ${input}`,
      `OPTIMIZED: ${optimized}`,
      `REQUIRED_ELEMENTS: ${JSON.stringify(requiredElements || [])}`,
    ].join('\n');

    const resp = await (ai as any).execute('optimize_intent_check', {
      systemPrompt,
      maxTokens: 600,
      temperature: 0,
      jsonMode: true,
    });

    const rawText =
      (resp && typeof resp.text === 'string' && resp.text) ||
      (Array.isArray(resp?.content) && resp.content[0]?.text) ||
      '';

    const parsed = JSON.parse(rawText);
    const items: Array<{ element: string; present: boolean; evidence?: string }> = Array.isArray(parsed?.items)
      ? parsed.items
      : [];
    const allPresent = parsed?.allPresent === true;

    return { score: allPresent ? 1.0 : 0.0, missing: missing, evidence: items };
  } catch {
    return { score: 0.0, missing };
  }
}
