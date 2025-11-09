import { FEATURE_WEIGHTS } from '../config/qualityMetrics.js';
import { SPECIFIC_TERMS, ACTION_WORDS, DOMAIN_TERMS, CONTEXT_PATTERNS } from '../config/domainTerms.js';

/**
 * Pure text analysis utilities
 */

/**
 * Calculate specificity score based on terminology
 */
export function calculateSpecificity(text) {
  let score = 0;
  const textLower = text.toLowerCase();

  SPECIFIC_TERMS.forEach(term => {
    if (textLower.includes(term)) score += 0.15;
  });

  // Check for concrete nouns and technical terms (CamelCase pattern)
  const technicalPattern = /\b[A-Z][a-z]+[A-Z]\w*\b/g;
  const technicalMatches = text.match(technicalPattern) || [];
  score += technicalMatches.length * 0.1;

  return Math.min(score, 1);
}

/**
 * Calculate clarity score based on readability
 */
export function calculateClarity(text) {
  const { CLARITY } = FEATURE_WEIGHTS;
  let score = CLARITY.BASE_SCORE;

  // Positive indicators
  if (text.length >= CLARITY.IDEAL_LENGTH.min && text.length <= CLARITY.IDEAL_LENGTH.max) {
    score += 0.2;
  }
  if (text.includes(':') || text.includes('-')) score += 0.1; // Structure
  if (!/\b(thing|stuff|whatever)\b/i.test(text)) score += 0.1; // No vague words

  // Negative indicators
  const words = text.split(/\s+/);
  const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / (words.length || 1);
  if (avgWordLength > CLARITY.MAX_AVG_WORD_LENGTH) score -= 0.1; // Too complex

  // Check sentence structure
  const sentences = text.split(/[.!?]+/);
  const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / (sentences.length || 1);
  if (avgSentenceLength < CLARITY.IDEAL_AVG_SENTENCE_LENGTH) score += 0.1;

  return Math.min(Math.max(score, 0), 1);
}

/**
 * Calculate actionability score
 */
export function calculateActionability(text) {
  let score = 0;
  const textLower = text.toLowerCase();

  ACTION_WORDS.forEach(word => {
    if (textLower.includes(word)) score += 0.1;
  });

  // Check for imperative mood (starts with verb)
  const firstWord = text.trim().split(/\s+/)[0].toLowerCase();
  if (ACTION_WORDS.includes(firstWord)) score += 0.2;

  // Check for clear steps or instructions
  if (text.includes('1.') || text.includes('first')) score += 0.15;
  if (text.includes('then') || text.includes('next')) score += 0.15;

  return Math.min(score, 1);
}

/**
 * Calculate context match score
 */
export function calculateContextMatch(text, context) {
  const { CONTEXT_MATCH } = FEATURE_WEIGHTS;
  
  if (!context) return CONTEXT_MATCH.DEFAULT_SCORE;

  let score = 0;
  const textLower = text.toLowerCase();

  // Check if key context terms appear in the suggestion
  if (context.domain) {
    const domainTerms = DOMAIN_TERMS[context.domain] || [];
    domainTerms.forEach(term => {
      if (textLower.includes(term)) score += 0.1;
    });
  }

  // Check if suggestion addresses the context type
  if (context.type) {
    const pattern = CONTEXT_PATTERNS[context.type];
    if (pattern && pattern.test(text)) {
      score += 0.2;
    }
  }

  // Check length appropriateness for context
  if (context.expectedLength) {
    const lengthRatio = text.length / context.expectedLength;
    if (lengthRatio >= CONTEXT_MATCH.LENGTH_RATIO.min && 
        lengthRatio <= CONTEXT_MATCH.LENGTH_RATIO.max) {
      score += 0.2;
    }
  }

  return Math.min(score, 1);
}

/**
 * Normalize text length to a 0-1 scale
 */
export function normalizeLength(text) {
  return Math.min(text.length / FEATURE_WEIGHTS.TEXT_ANALYSIS.MAX_LENGTH_NORMALIZED, 1);
}

/**
 * Count sentences in text
 */
export function countSentences(text) {
  return (text.match(/[.!?]+/g) || []).length;
}

/**
 * Count questions in text
 */
export function countQuestions(text) {
  return (text.match(/\?/g) || []).length;
}

/**
 * Check if text has structural elements
 */
export function hasStructure(text) {
  return text.includes('\n') || text.includes('•') || text.includes('-');
}

/**
 * Check if text has examples
 */
export function hasExamples(text) {
  return text.includes('example') || text.includes('e.g.');
}

/**
 * Check if text has numbers
 */
export function hasNumbers(text) {
  return /\d+/.test(text);
}

