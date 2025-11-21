/**
 * Analysis Patterns and Configuration
 * 
 * Centralized configuration for prompt analysis including:
 * - Ambiguity detection patterns
 * - Technical term identification
 * - Complexity assessment weights
 * - Question count thresholds
 */

/**
 * Terms that indicate ambiguity or vagueness in prompts
 */
export const AMBIGUOUS_TERMS = [
  'something', 'stuff', 'things', 'some', 'various', 'certain',
  'appropriate', 'relevant', 'proper', 'good', 'best', 'optimal',
  'nice', 'cool', 'interesting', 'useful', 'helpful',
];

/**
 * Regex patterns for identifying technical content
 */
export const TECHNICAL_PATTERNS = [
  /\bAPI\b/gi,
  /\bSDK\b/gi,
  /\bSQL\b/gi,
  /\bJSON\b/gi,
  /\balgorithm/gi,
  /\bframework/gi,
  /\bdatabase/gi,
  /\barchitecture/gi,
  /\bimplementation/gi,
  /\boptimization/gi,
];

/**
 * Patterns indicating vague or incomplete prompts
 */
export const VAGUE_PATTERNS = {
  // Verbs without sufficient context (e.g., "help me" without details)
  vagueVerbs: /\b(help|create|make|do|build|write)\b(?!\s+\w+\s+\w+)/gi,
  // Incomplete phrases (e.g., "about something")
  missingSpecifics: /\b(for|about|regarding|concerning)\s+(a|an|the|some)\s+\w+$/gi,
};

/**
 * Weights for calculating prompt complexity score
 */
export const COMPLEXITY_WEIGHTS = {
  length: 0.2,           // Longer prompts often more complex
  technicalTerms: 0.3,   // Technical language increases complexity
  multiPart: 0.25,       // Multiple connected ideas add complexity
  questions: 0.25,       // Questions in prompt indicate exploration
};

/**
 * Thresholds for determining optimal question count
 */
export const QUESTION_COUNT_THRESHOLDS = [
  {
    minComplexity: 0.7,
    minAmbiguity: 0.6,
    questionCount: 5,
    description: 'High complexity or high ambiguity',
  },
  {
    minComplexity: 0.4,
    minAmbiguity: 0.4,
    questionCount: 3,
    description: 'Medium complexity or ambiguity',
  },
  {
    minComplexity: 0,
    minAmbiguity: 0,
    questionCount: 2,
    description: 'Simple, clear prompts',
  },
];

/**
 * Scoring parameters for ambiguity detection
 */
export const AMBIGUITY_SCORES = {
  ambiguousTerm: 0.1,      // Score per ambiguous term found
  vaguePattern: 0.15,      // Score per vague pattern match
  missingSpecific: 0.2,    // Score per incomplete phrase
};

/**
 * Normalization factors for complexity calculation
 */
export const NORMALIZATION_FACTORS = {
  promptLength: 500,       // Normalize length against this baseline
  technicalTerms: 10,      // Normalize technical term count
  multiPartIndicators: 5,  // Normalize multi-part phrase count
  questionMarks: 3,        // Normalize question count
};

