const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /\*\*TECHNICAL SPECS\*\*/i, message: 'Contains technical specs markdown section.' },
  { pattern: /\*\*ALTERNATIVE APPROACHES\*\*/i, message: 'Contains alternative approaches markdown section.' },
  { pattern: /^\s*#{1,6}\s+/m, message: 'Contains markdown heading syntax.' },
  { pattern: /\bVariation\s+\d+\b/i, message: 'Contains template variation artifact.' },
];

const MODEL_WORD_LIMITS: Record<string, { min: number; max: number }> = {
  'sora-2': { min: 60, max: 120 },
  'kling-2.1': { min: 40, max: 80 },
  'kling-26': { min: 40, max: 80 },
  'wan-2.2': { min: 30, max: 60 },
};

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function clampToWords(value: string, maxWords: number): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return value.trim();
  }
  return `${words.slice(0, maxWords).join(' ')}.`.trim();
}

function sanitizeMarkdownArtifacts(prompt: string): string {
  let cleaned = prompt.trim();
  const markers = [
    /\r?\n\s*\*\*\s*technical specs\s*\*\*/i,
    /\r?\n\s*\*\*\s*alternative approaches\s*\*\*/i,
    /\r?\n\s*technical specs\s*[:\n]/i,
    /\r?\n\s*alternative approaches\s*[:\n]/i,
  ];

  let cutIndex = -1;
  for (const marker of markers) {
    const match = marker.exec(cleaned);
    if (match && (cutIndex === -1 || match.index < cutIndex)) {
      cutIndex = match.index;
    }
  }

  if (cutIndex >= 0) {
    cleaned = cleaned.slice(0, cutIndex).trim();
  }

  return cleaned
    .replace(/^\s*\*\*\s*prompt\s*:\s*\*\*/i, '')
    .replace(/^\s*prompt\s*:\s*/i, '')
    .replace(/\b(in\s+(?:a|an|the)\s+car)\s+\1\b/gi, '$1')
    .trim();
}

export interface PromptLintResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  wordCount: number;
}

export interface PromptLintEnforcementResult {
  prompt: string;
  lint: PromptLintResult;
  repaired: boolean;
}

export class PromptLintGateService {
  evaluate(prompt: string, modelId?: string | null): PromptLintResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const wordCount = countWords(prompt);

    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.pattern.test(prompt)) {
        errors.push(rule.message);
      }
    }

    const limits = modelId ? MODEL_WORD_LIMITS[modelId] : undefined;
    if (limits) {
      if (wordCount > limits.max) {
        errors.push(`Prompt too long for ${modelId} (${wordCount} words > ${limits.max}).`);
      } else if (wordCount < limits.min) {
        warnings.push(`Prompt short for ${modelId} (${wordCount} words < ${limits.min}).`);
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      wordCount,
    };
  }

  enforce(params: { prompt: string; modelId?: string | null }): PromptLintEnforcementResult {
    const originalPrompt = params.prompt.trim();
    let candidate = sanitizeMarkdownArtifacts(originalPrompt);
    const limits = params.modelId ? MODEL_WORD_LIMITS[params.modelId] : undefined;

    if (limits) {
      candidate = clampToWords(candidate, limits.max);
    }

    const lint = this.evaluate(candidate, params.modelId);
    if (!lint.ok) {
      throw new Error(`Prompt lint gate failed: ${lint.errors.join(' ')}`);
    }

    return {
      prompt: candidate,
      lint,
      repaired: candidate !== originalPrompt,
    };
  }
}
