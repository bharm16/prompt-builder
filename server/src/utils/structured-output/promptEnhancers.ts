import { logger } from '@infrastructure/Logger';
import type { StructuredOutputSchema } from './types';

export function enhancePromptForJSON(
  systemPrompt: string,
  isArray: boolean,
  hasStrictSchema: boolean,
  needsPromptFormatInstructions: boolean,
  schema?: StructuredOutputSchema | null
): string {
  if (hasStrictSchema && !needsPromptFormatInstructions) {
    logger.debug('Skipping JSON format instructions (strict schema mode)');
    return systemPrompt;
  }

  const schemaExpectsObject = schema?.type === 'object';

  if (schemaExpectsObject && schema?.required?.includes('suggestions')) {
    return `${systemPrompt}\n\nIMPORTANT: Return ONLY valid JSON in this exact wrapper format:\n{"suggestions": [...your suggestions array here...]}`;
  }

  const start = schemaExpectsObject ? '{' : (isArray ? '[' : '{');
  return `${systemPrompt}\n\nRespond with ONLY valid JSON. Start with ${start} - no other text.`;
}

export function enhancePromptWithErrorFeedback(
  systemPrompt: string,
  errorMessage: string,
  isArray: boolean,
  _needsPromptFormatInstructions: boolean,
  schema?: StructuredOutputSchema | null
): string {
  const schemaExpectsObject = schema?.type === 'object';

  if (schemaExpectsObject && schema?.required?.includes('suggestions')) {
    return `${systemPrompt}

Previous attempt failed: ${errorMessage}

RETRY - USE THIS EXACT FORMAT:
{"suggestions": [array of suggestion objects]}

Do NOT return a bare array. Wrap it in {"suggestions": ...}`;
  }

  const start = schemaExpectsObject ? '{' : (isArray ? '[' : '{');

  return `${systemPrompt}

Previous attempt failed: ${errorMessage}

RETRY INSTRUCTIONS:
- Respond with ONLY valid JSON
- Start with ${start}
- No markdown code blocks, no explanatory text
- Ensure all required fields are present`;
}
