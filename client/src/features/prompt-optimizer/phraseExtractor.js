import { runExtractionPipeline, extractVideoPromptPhrases as pipelineExtract } from './pipeline/index.js';

export { runExtractionPipeline } from './pipeline/index.js';
export { PARSER_VERSION, LEXICON_VERSION, EMOJI_POLICY_VERSION } from './pipeline/index.js';

export function extractVideoPromptPhrases(text, context = null, options = {}) {
  return pipelineExtract(text, context, options);
}

export function extractVideoPromptSpansWithMeta(text, context = null, options = {}) {
  return runExtractionPipeline(text, context, options);
}

