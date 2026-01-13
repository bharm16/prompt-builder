import { readFileSync } from 'fs';
import { vocabPath } from './paths';
import { log } from './log';

export const VOCAB: Record<string, string[]> = (() => {
  try {
    return JSON.parse(readFileSync(vocabPath, 'utf-8')) as Record<string, string[]>;
  } catch (e) {
    log.warn('NLP Service: Could not load vocab.json', {
      error: e instanceof Error ? e.message : String(e),
      vocabPath,
    });
    return {};
  }
})();
