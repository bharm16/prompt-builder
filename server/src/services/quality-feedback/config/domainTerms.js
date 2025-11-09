/**
 * Domain-specific terminology for context matching
 */

export const DOMAIN_TERMS = {
  technical: ['code', 'function', 'api', 'database', 'algorithm', 'debug'],
  creative: ['story', 'character', 'plot', 'narrative', 'theme', 'style'],
  analytical: ['data', 'analysis', 'metrics', 'statistics', 'trend', 'pattern'],
  educational: ['learn', 'understand', 'concept', 'example', 'explain', 'practice'],
};

export const SPECIFIC_TERMS = [
  'specifically', 'exactly', 'precisely', 'particular',
  'must', 'require', 'ensure', 'define', 'implement',
];

export const ACTION_WORDS = [
  'create', 'implement', 'build', 'design', 'develop',
  'write', 'add', 'update', 'modify', 'configure',
  'analyze', 'evaluate', 'optimize', 'test', 'deploy',
];

export const CONTEXT_PATTERNS = {
  technical: /\b(code|api|function)\b/i,
  creative: /\b(design|create|imagine)\b/i,
};

