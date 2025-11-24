/**
 * Penn Treebank (PTB) Tagset Definitions and Mappings
 * 
 * The Penn Treebank tagset is the academic standard for English POS tagging,
 * comprising 36 distinct tags that provide granular taxonomy of English grammar.
 * 
 * This module provides:
 * 1. Complete PTB tag definitions
 * 2. Mappings from compromise.js tags to PTB tags
 * 3. Helper functions for tag operations
 * 
 * References:
 * - Penn Treebank POS Tags: https://www.ling.upenn.edu/courses/Fall_2003/ling001/penn_treebank_pos.html
 * - Compromise.js tags: https://github.com/spencermountain/compromise
 */

/**
 * Penn Treebank Tag Definitions
 * Key tags for video prompt engineering are marked with relevance notes
 */
export const PTB_TAGS = {
  // Nouns
  NN: {
    name: 'Noun, singular or mass',
    examples: ['soldier', 'forest', 'pan'],
    relevance: 'Identifies primary atomic objects in the scene'
  },
  NNS: {
    name: 'Noun, plural',
    examples: ['soldiers', 'trees'],
    relevance: 'Signals need for crowd generation or object multiplicity'
  },
  NNP: {
    name: 'Proper noun, singular',
    examples: ['Batman', 'Tokyo', 'Kodak'],
    relevance: 'Triggers domain-specific embeddings or LoRA models'
  },
  NNPS: {
    name: 'Proper noun, plural',
    examples: ['Americans', 'Beatles'],
    relevance: 'Named entities in plural form'
  },

  // Verbs
  VB: {
    name: 'Verb, base form',
    examples: ['run', 'eat', 'pan'],
    relevance: 'Used in imperative prompts (e.g., "Make the soldier run")'
  },
  VBD: {
    name: 'Verb, past tense',
    examples: ['ran', 'ate'],
    relevance: 'Indicates completed action, useful for narrative sequencing'
  },
  VBG: {
    name: 'Verb, gerund or present participle',
    examples: ['running', 'eating'],
    relevance: 'Critical for video: implies continuous, ongoing action during clip duration'
  },
  VBN: {
    name: 'Verb, past participle',
    examples: ['run', 'eaten'],
    relevance: 'Used in passive constructions and perfect tenses'
  },
  VBP: {
    name: 'Verb, non-3rd person singular present',
    examples: ['run', 'eat'],
    relevance: 'Present tense for current actions'
  },
  VBZ: {
    name: 'Verb, 3rd person singular present',
    examples: ['runs', 'eats'],
    relevance: 'Present tense with singular subjects'
  },

  // Adjectives
  JJ: {
    name: 'Adjective',
    examples: ['robotic', 'dark', 'weathered'],
    relevance: 'Defines visual texture, lighting, and atmospheric attributes'
  },
  JJR: {
    name: 'Adjective, comparative',
    examples: ['darker', 'brighter'],
    relevance: 'Comparative visual qualities'
  },
  JJS: {
    name: 'Adjective, superlative',
    examples: ['darkest', 'brightest'],
    relevance: 'Superlative visual qualities'
  },

  // Adverbs
  RB: {
    name: 'Adverb',
    examples: ['quickly', 'smoothly', 'slowly'],
    relevance: 'Modifies interpolation speed of action or camera movement'
  },
  RBR: {
    name: 'Adverb, comparative',
    examples: ['faster', 'slower'],
    relevance: 'Comparative motion speed'
  },
  RBS: {
    name: 'Adverb, superlative',
    examples: ['fastest', 'slowest'],
    relevance: 'Superlative motion speed'
  },

  // Prepositions
  IN: {
    name: 'Preposition or subordinating conjunction',
    examples: ['in', 'on', 'with', 'at'],
    relevance: 'Establishes spatial relationships (e.g., "soldier in forest")'
  },

  // Determiners
  DT: {
    name: 'Determiner',
    examples: ['the', 'a', 'an', 'this'],
    relevance: 'Marks beginning of noun phrases'
  },

  // Pronouns
  PRP: {
    name: 'Personal pronoun',
    examples: ['I', 'he', 'she', 'it'],
    relevance: 'Subject references'
  },
  PRP$: {
    name: 'Possessive pronoun',
    examples: ['my', 'his', 'her', 'its'],
    relevance: 'Possessive relationships'
  },

  // Wh-words
  WDT: { name: 'Wh-determiner', examples: ['which', 'that'] },
  WP: { name: 'Wh-pronoun', examples: ['who', 'what'] },
  WP$: { name: 'Possessive wh-pronoun', examples: ['whose'] },
  WRB: { name: 'Wh-adverb', examples: ['where', 'when', 'why'] },

  // Coordinating conjunctions
  CC: {
    name: 'Coordinating conjunction',
    examples: ['and', 'or', 'but'],
    relevance: 'Connects multiple elements'
  },

  // Cardinal numbers
  CD: {
    name: 'Cardinal number',
    examples: ['1', '35', '2.39'],
    relevance: 'Used in technical specs (35mm, 16:9, 24fps)'
  },

  // Existential there
  EX: { name: 'Existential there', examples: ['there'] },

  // Foreign words
  FW: { name: 'Foreign word', examples: ['d\'hoevre'] },

  // Modal verbs
  MD: {
    name: 'Modal',
    examples: ['can', 'should', 'will'],
    relevance: 'Expresses possibility or necessity'
  },

  // Predeterminer
  PDT: { name: 'Predeterminer', examples: ['all', 'both', 'half'] },

  // Possessive ending
  POS: { name: 'Possessive ending', examples: ['\'s'] },

  // To
  TO: { name: 'to', examples: ['to'] },

  // Interjection
  UH: { name: 'Interjection', examples: ['uh', 'well'] },

  // Punctuation
  '.': { name: 'Sentence-final punctuation', examples: ['.', '!', '?'] },
  ',': { name: 'Comma', examples: [','] },
  ':': { name: 'Colon or ellipsis', examples: [':', ';', '...'] },
  '(': { name: 'Left bracket', examples: ['(', '[', '{'] },
  ')': { name: 'Right bracket', examples: [')', ']', '}'] },
  '``': { name: 'Left quote', examples: ['`', '``'] },
  "''": { name: 'Right quote', examples: ["'", "''"] },
};

/**
 * Mapping from compromise.js tags to Penn Treebank tags
 * 
 * Compromise uses a different tag system, so we map their tags to PTB equivalents.
 * Some compromise tags map to multiple PTB tags depending on context.
 */
export const COMPROMISE_TO_PTB = {
  // Nouns
  Noun: 'NN',
  Plural: 'NNS',
  ProperNoun: 'NNP',
  Possessive: 'POS',

  // Verbs
  Verb: 'VB',
  PastTense: 'VBD',
  PresentTense: 'VBP',
  Gerund: 'VBG',
  Participle: 'VBN',
  Infinitive: 'VB',
  
  // Adjectives
  Adjective: 'JJ',
  Comparative: 'JJR',
  Superlative: 'JJS',

  // Adverbs
  Adverb: 'RB',

  // Determiners
  Determiner: 'DT',
  Article: 'DT',

  // Prepositions
  Preposition: 'IN',

  // Pronouns
  Pronoun: 'PRP',
  PossessivePronoun: 'PRP$',

  // Conjunctions
  Conjunction: 'CC',
  CoordinatingConjunction: 'CC',

  // Numbers
  Cardinal: 'CD',
  Ordinal: 'CD',
  Value: 'CD',

  // Modal
  Modal: 'MD',

  // Punctuation
  Punctuation: '.',
  Comma: ',',
  
  // Other
  Unknown: 'NN', // Default to noun for unknown words
};

/**
 * Get PTB tag for a compromise.js term
 * 
 * @param {Object} term - compromise.js term object
 * @returns {string} PTB tag
 */
export function getPTBTag(term) {
  // Try to find the most specific tag
  const tags = term.tags || [];
  
  // Priority order for tag selection (most specific first)
  const priorityTags = [
    'Gerund',
    'Participle',
    'PastTense',
    'PresentTense',
    'Infinitive',
    'ProperNoun',
    'Plural',
    'Comparative',
    'Superlative',
    'PossessivePronoun',
    'Possessive',
    'Modal',
    'Adverb',
    'Adjective',
    'Verb',
    'Noun',
    'Pronoun',
    'Determiner',
    'Article',
    'Preposition',
    'Conjunction',
    'Cardinal',
    'Ordinal',
  ];

  for (const tag of priorityTags) {
    if (tags.includes(tag)) {
      return COMPROMISE_TO_PTB[tag] || 'NN';
    }
  }

  // Check for punctuation
  if (term.isPunctuation || tags.includes('Punctuation')) {
    if (term.text === ',') return ',';
    if (term.text === ':' || term.text === ';') return ':';
    return '.';
  }

  // Default to noun
  return 'NN';
}

/**
 * Check if a tag is a noun tag
 * @param {string} tag - PTB tag
 * @returns {boolean}
 */
export function isNounTag(tag) {
  return ['NN', 'NNS', 'NNP', 'NNPS'].includes(tag);
}

/**
 * Check if a tag is a verb tag
 * @param {string} tag - PTB tag
 * @returns {boolean}
 */
export function isVerbTag(tag) {
  return ['VB', 'VBD', 'VBG', 'VBN', 'VBP', 'VBZ'].includes(tag);
}

/**
 * Check if a tag is an adjective tag
 * @param {string} tag - PTB tag
 * @returns {boolean}
 */
export function isAdjectiveTag(tag) {
  return ['JJ', 'JJR', 'JJS'].includes(tag);
}

/**
 * Check if a tag is an adverb tag
 * @param {string} tag - PTB tag
 * @returns {boolean}
 */
export function isAdverbTag(tag) {
  return ['RB', 'RBR', 'RBS'].includes(tag);
}

/**
 * Check if a tag is a preposition tag
 * @param {string} tag - PTB tag
 * @returns {boolean}
 */
export function isPrepositionTag(tag) {
  return tag === 'IN';
}

/**
 * Check if a tag is a determiner tag
 * @param {string} tag - PTB tag
 * @returns {boolean}
 */
export function isDeterminerTag(tag) {
  return tag === 'DT' || tag === 'PDT';
}

const COMMON_VERBS = new Set(['carrying', 'filled', 'rolls', 'emphasize', 'remains', 'capturing', 'picks', 'streams', 'creating', 'highlighting', 'uses', 'accentuate', 'immersing', 'casting', 'shot', 'filmed', 'recorded', 'create', 'analyze', 'sort', 'write', 'make', 'get', 'go', 'do']);

/**
 * Check if a token is a verb form (including gerunds/participles)
 * @param {Object} token - Token object with 'tag' and 'word' property
 * @returns {boolean}
 */
export function isVerbForm(token) {
  if (!token) return false;
  if (COMMON_VERBS.has(token.word.toLowerCase())) return true;
  return token.tag === 'VBG' || 
         token.tag === 'VBN' || 
         token.tag === 'VBZ' ||
         isVerbTag(token.tag);
}

/**
 * Check if a word is an auxiliary verb
 * @param {string} word - The word to check
 * @returns {boolean}
 */
export function isAuxiliaryVerb(word) {
  if (!word) return false;
  const auxiliaries = ['is', 'am', 'are', 'was', 'were', 'be', 'being', 'been', 'has', 'have', 'had', 'do', 'does', 'did', 'will', 'shall', 'can', 'may', 'must'];
  return auxiliaries.includes(word.toLowerCase());
}

/**
 * Normalize verb to base form based on PTB tag
 * For video generation, we often want to normalize to gerund (VBG) for temporal continuity
 * 
 * @param {string} word - The word
 * @param {string} tag - PTB tag
 * @returns {string} Normalized form
 */
export function normalizeVerbToGerund(word, tag) {
  if (!isVerbTag(tag)) return word;
  
  // Already a gerund
  if (tag === 'VBG') return word;
  
  // Simple heuristic for common cases
  // In production, you'd want to use a proper inflection library
  if (word.endsWith('e') && !word.endsWith('ee')) {
    return word.slice(0, -1) + 'ing'; // run -> running (but free -> freeing)
  }
  
  // Double consonant for short words ending in consonant
  if (word.length <= 4 && /[^aeiou]$/.test(word)) {
    return word + word.slice(-1) + 'ing'; // sit -> sitting
  }
  
  return word + 'ing';
}

export default {
  PTB_TAGS,
  COMPROMISE_TO_PTB,
  getPTBTag,
  isNounTag,
  isVerbTag,
  isAdjectiveTag,
  isAdverbTag,
  isPrepositionTag,
  isDeterminerTag,
  isVerbForm,
  isAuxiliaryVerb,
  normalizeVerbToGerund,
};

