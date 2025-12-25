/**
 * Compromise NLP Service - Verb Phrase Extraction (Tier 1.5)
 *
 * Uses compromise.js for grammatical analysis to extract action-related spans.
 * Positioned between Aho-Corasick (Tier 1) and GLiNER (Tier 2) in the pipeline.
 *
 * Why Compromise for Actions:
 * - Actions are syntactic (verb phrases), not semantic entities
 * - GLiNER is trained for NER (nouns: people, places, organizations)
 * - Compromise has dedicated .verbs() API with grammar understanding
 * - Fast: ~1MB/sec processing, 200KB bundle
 *
 * Extracts:
 * - Verb phrases: "running energetically", "dribbling a basketball"
 * - Gerunds: "jogging", "swimming", "catching"
 * - State verbs: "sitting", "standing", "laying"
 * - Gestures: "waving", "pointing", "nodding"
 */

import nlp from 'compromise';
import { logger } from '@infrastructure/Logger';
import type { NlpSpan } from './types';
import {
  classifyVerbSemantically,
  isVerbSemanticsReady,
  warmupVerbSemantics,
} from './VerbSemantics';

const log = logger.child({ service: 'CompromiseService' });

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface CompromiseConfig {
  enabled: boolean;
  minConfidence: number;
  extractVerbPhrases: boolean;
  extractGerunds: boolean;
  includeAdverbs: boolean;
  includeObjects: boolean;
  maxPhraseWords: number;
}

export const DEFAULT_COMPROMISE_CONFIG: CompromiseConfig = {
  enabled: true,
  minConfidence: 0.75,
  extractVerbPhrases: true,
  extractGerunds: true,
  includeAdverbs: true,
  includeObjects: true,
  maxPhraseWords: 5,
};

// =============================================================================
// ROLE CLASSIFICATION
// =============================================================================

/**
 * State verbs that indicate position/condition rather than movement
 */
const STATE_VERBS = new Set([
  'sit', 'sitting', 'sits', 'sat',
  'stand', 'standing', 'stands', 'stood',
  'lay', 'laying', 'lays', 'laid', 'lying', 'lie', 'lies',
  'lean', 'leaning', 'leans', 'leaned',
  'rest', 'resting', 'rests', 'rested',
  'hang', 'hanging', 'hangs', 'hung',
  'float', 'floating', 'floats', 'floated',
  'wait', 'waiting', 'waits', 'waited',
  'sleep', 'sleeping', 'sleeps', 'slept',
  'pose', 'posing', 'poses', 'posed',
  'crouch', 'crouching', 'crouches', 'crouched',
  'kneel', 'kneeling', 'kneels', 'knelt',
  'perch', 'perching', 'perches', 'perched',
]);

/**
 * Gesture verbs that indicate communicative body movements
 */
const GESTURE_VERBS = new Set([
  'wave', 'waving', 'waves', 'waved',
  'point', 'pointing', 'points', 'pointed',
  'nod', 'nodding', 'nods', 'nodded',
  'shake', 'shaking', 'shakes', 'shook',
  'shrug', 'shrugging', 'shrugs', 'shrugged',
  'bow', 'bowing', 'bows', 'bowed',
  'salute', 'saluting', 'salutes', 'saluted',
  'beckon', 'beckoning', 'beckons', 'beckoned',
  'gesture', 'gesturing', 'gestures', 'gestured',
  'signal', 'signaling', 'signals', 'signaled',
  'clap', 'clapping', 'claps', 'clapped',
  'wink', 'winking', 'winks', 'winked',
  'smile', 'smiling', 'smiles', 'smiled',
  'frown', 'frowning', 'frowns', 'frowned',
  'grimace', 'grimacing', 'grimaces', 'grimaced',
]);

/**
 * Common action verbs that should be recognized even when tagged as nouns
 * These are -ing forms that typically represent actions in video prompts
 * Compromise sometimes tags these as Nouns in fragments like "woman dribbling"
 */
const ACTION_GERUNDS = new Set([
  'dribbling', 'jogging', 'running', 'walking', 'jumping', 'dancing',
  'swimming', 'climbing', 'flying', 'falling', 'sliding', 'rolling',
  'spinning', 'twirling', 'turning', 'moving', 'shaking', 'bouncing',
  'throwing', 'catching', 'hitting', 'kicking', 'punching', 'pushing',
  'pulling', 'lifting', 'carrying', 'holding', 'gripping', 'grabbing',
  'reaching', 'pointing', 'waving', 'clapping', 'nodding',
  'eating', 'drinking', 'cooking', 'baking', 'cutting', 'chopping',
  'reading', 'writing', 'typing', 'drawing', 'painting', 'sculpting',
  'playing', 'singing', 'humming', 'whistling', 'shouting', 'screaming',
  'laughing', 'crying', 'smiling', 'frowning', 'staring', 'gazing',
  'looking', 'watching', 'observing', 'examining', 'studying', 'searching',
  'fighting', 'wrestling', 'boxing', 'sparring', 'dodging', 'blocking',
  'driving', 'riding', 'cycling', 'skating', 'skiing', 'surfing',
  'sailing', 'rowing', 'paddling', 'diving', 'snorkeling', 'fishing',
  'hunting', 'shooting', 'aiming', 'loading', 'firing', 'reloading',
  'working', 'building', 'fixing', 'repairing', 'cleaning', 'washing',
  'drying', 'folding', 'ironing', 'sewing', 'knitting', 'weaving',
  'planting', 'watering', 'harvesting', 'picking', 'digging', 'raking',
  'sweeping', 'mopping', 'scrubbing', 'polishing', 'dusting', 'vacuuming',
  'packing', 'unpacking', 'loading', 'unloading', 'stacking', 'arranging',
  'opening', 'closing', 'locking', 'unlocking', 'entering', 'exiting',
  'ascending', 'descending', 'rising', 'sinking', 'floating', 'drifting',
  'flowing', 'streaming', 'pouring', 'dripping', 'splashing', 'spraying',
  'blowing', 'breathing', 'inhaling', 'exhaling', 'coughing', 'sneezing',
  'stretching', 'bending', 'twisting', 'crouching', 'kneeling', 'sitting',
  'standing', 'lying', 'leaning', 'resting', 'sleeping', 'waking',
  'chasing', 'fleeing', 'escaping', 'hiding', 'seeking', 'finding',
  'exploring', 'wandering', 'roaming', 'traveling', 'journeying', 'trekking',
  'barking', 'meowing', 'howling', 'chirping', 'buzzing', 'flapping',
  'casting', 'sowing', 'dipping', 'stirring', 'mixing', 'blending',
  'sprinting', 'leaping', 'hopping', 'skipping', 'marching', 'strutting',
  'crawling', 'slithering', 'gliding', 'swooping', 'soaring', 'hovering',
]);

/**
 * Verbs to exclude - these are not visual actions
 */
const EXCLUDED_VERBS = new Set([
  // Auxiliary/modal verbs
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'has', 'have', 'had', 'having',
  'do', 'does', 'did', 'doing', 'done',
  'can', 'could', 'will', 'would', 'shall', 'should',
  'may', 'might', 'must',
  'get', 'gets', 'got', 'getting', 'gotten',
  'make', 'makes', 'made', 'making',
  'use', 'uses', 'used', 'using',
  'keep', 'keeps', 'kept', 'keeping',
  'let', 'lets', 'letting',
  'begin', 'begins', 'began', 'beginning',
  'seem', 'seems', 'seemed', 'seeming',
  'appear', 'appears', 'appeared', 'appearing',
  'become', 'becomes', 'became', 'becoming',
  // Camera/technical verbs handled by other tiers
  'shot', 'capture', 'captures', 'captured', 'capturing',
  'film', 'films', 'filmed', 'filming',
  'emphasize', 'emphasizes', 'emphasized', 'emphasizing',
  'enhance', 'enhances', 'enhanced', 'enhancing',
  'create', 'creates', 'created', 'creating',
  'maintain', 'maintains', 'maintained', 'maintaining',
  // Lighting/atmosphere verbs (not subject actions)
  'lit', 'illuminate', 'illuminates', 'illuminated', 'illuminating',
  'filter', 'filters', 'filtered', 'filtering',
  'stream', 'streams', 'streamed', 'streaming',
  'pour', 'pours', 'poured', 'pouring',
  'cast', 'casts', 'casting', // when used for shadows/light
  'highlight', 'highlights', 'highlighted', 'highlighting',
  'reflect', 'reflects', 'reflected', 'reflecting',
  // Camera instruction verbs
  'isolate', 'isolates', 'isolated', 'isolating',
  'guide', 'guides', 'guided', 'guiding',
  'frame', 'frames', 'framed', 'framing',
  'focus', 'focuses', 'focused', 'focusing',
  'track', 'tracks', 'tracked', 'tracking',
  // Template/style reference verbs
  'inspired', 'inspire', 'inspires', 'inspiring',
  'reference', 'references', 'referenced', 'referencing',
  'reminiscent', 'remind', 'reminds', 'reminded', 'reminding',
]);

/**
 * Meta/abstract objects that indicate camera instructions, not scene actions
 * e.g., "isolate the main subject", "guide attention", "maintain framing"
 */
const META_OBJECTS = new Set([
  'subject', 'subjects',
  'attention', 'focus',
  'framing', 'composition',
  'viewer', 'audience',
  'scene', 'shot',
  'mood', 'atmosphere',
  'tension', 'emotion',
  'narrative', 'story',
]);

/**
 * Lighting/atmosphere subjects - when these are the subject of a verb,
 * the verb describes lighting effects, not scene actions
 */
const LIGHTING_SUBJECTS = new Set([
  'light', 'lights', 'lighting',
  'sunlight', 'moonlight', 'daylight',
  'shadow', 'shadows',
  'glow', 'glows',
  'ray', 'rays',
  'beam', 'beams',
  'haze', 'mist', 'fog',
]);

/**
 * Gerunds that are commonly used as adjectives or nouns, not verbs
 * e.g., "winding path" (adjective), "oil painting" (noun)
 */
const ADJECTIVE_GERUNDS = new Set([
  'winding', 'curving', 'twisting', // path descriptions
  'pending', 'ongoing', 'incoming', 'outgoing',
  'leading', 'following', // when describing paths/roads
  'living', 'dining', // room types
  'moving', 'touching', // when used as adjectives
  'stunning', 'striking', 'compelling', 'gripping', // emotional adjectives
  'growing', 'rising', 'falling', // can be adjectives
]);

/**
 * Ambiguous single-word gerunds that need context to be valid actions
 * These are often lighting effects, adjectives, or nouns when standalone
 * Only valid as actions when part of a larger phrase with clear agent
 */
const AMBIGUOUS_SINGLE_GERUNDS = new Set([
  'coming', 'going', // often lighting: "light coming through"
  'streaming', 'flowing', 'pouring', // often lighting/water effects
  'casting', // often shadows
  'painting', 'drawing', // can be nouns (a painting, a drawing)
  'winding', 'curving', // often adjectives (winding path)
  'setting', 'rising', // often sun/moon
  'passing', 'changing', // often time/seasons
  'hanging', 'floating', // can be atmospheric
]);

/**
 * Words that look like verbs but are adjectives/other in video prompts
 * Compromise sometimes mis-tags these
 */
const FALSE_VERB_ADJECTIVES = new Set([
  'short', // "short hair" - not a verb
  'long', // "long hair" - not a verb
  'aged', // "aged man" - adjective
  'weathered', // "weathered face" - adjective
  'worn', // "worn clothes" - adjective
]);

/**
 * Classify a verb into the appropriate action role (sync fallback)
 * Uses small curated lists as fallback when semantic model not ready
 */
function classifyActionRoleSync(verbText: string): string {
  const lowerVerb = verbText.toLowerCase().split(/\s+/)[0] || '';

  if (STATE_VERBS.has(lowerVerb)) {
    return 'action.state';
  }

  if (GESTURE_VERBS.has(lowerVerb)) {
    return 'action.gesture';
  }

  return 'action.movement';
}

/**
 * Classify a verb semantically using embeddings
 * Falls back to sync classification if semantic model not ready
 */
async function classifyActionRole(verbText: string): Promise<string> {
  // Use semantic classification if model is ready
  if (isVerbSemanticsReady()) {
    try {
      const result = await classifyVerbSemantically(verbText);
      return `action.${result.actionClass}`;
    } catch {
      // Fall back to sync on error
    }
  }

  return classifyActionRoleSync(verbText);
}

/**
 * Check if a verb should be excluded
 * For multi-word phrases, checks if ANY word is a meaningful action verb
 */
function shouldExcludeVerb(verbText: string): boolean {
  const words = verbText.toLowerCase().split(/\s+/);

  // For single words, check if it's excluded
  if (words.length === 1) {
    return EXCLUDED_VERBS.has(words[0] || '');
  }

  // For multi-word phrases, keep if ANY word is a meaningful action (not just auxiliary)
  // e.g., "is running energetically" should be kept because "running" is an action
  const hasActionWord = words.some(word =>
    ACTION_GERUNDS.has(word) ||
    (word.endsWith('ing') && !EXCLUDED_VERBS.has(word) && word.length > 4)
  );

  if (hasActionWord) {
    return false; // Don't exclude if it has an action word
  }

  // If first word is excluded and no action word found, exclude
  return EXCLUDED_VERBS.has(words[0] || '');
}

/**
 * Linguistic analysis to detect template/camera instructions vs. scene actions
 *
 * Uses grammatical patterns rather than phrase lists:
 * - Imperative mood → template instruction → EXCLUDE
 * - Meta objects (subject, attention, framing) → camera instruction → EXCLUDE
 * - Participial phrases with concrete objects → scene action → KEEP
 */
function isTemplateInstruction(phraseText: string): boolean {
  const lower = phraseText.toLowerCase().trim();
  const words = lower.split(/\s+/);
  const firstWord = words[0] || '';
  const doc = nlp(phraseText);

  // 1. Check for imperative mood (commands without subjects)
  // Imperatives start with base verb (infinitive): "maintain", "isolate", "guide"
  // BUT we want to keep gerunds (-ing) like "running", "playing"
  if (!firstWord.endsWith('ing')) {
    const firstWordDoc = nlp(firstWord);
    const isInfinitive = firstWordDoc.match('#Infinitive').found;

    if (isInfinitive) {
      // Check if there's no subject before the verb (imperative pattern)
      const hasSubjectBeforeVerb = doc.match('#Noun #Verb').found ||
                                    doc.match('#Pronoun #Verb').found;

      if (!hasSubjectBeforeVerb) {
        return true; // Imperative instruction like "maintain", "isolate"
      }
    }
  }

  // 2. Check if object is a meta/abstract term (camera instructions)
  // e.g., "isolate the main subject", "guide attention", "maintain framing"
  for (const word of words) {
    if (META_OBJECTS.has(word)) {
      return true;
    }
  }

  // 3. Check for passive voice describing lighting/atmosphere (not actions)
  // e.g., "dimly lit", "softly illuminated"
  if (lower.endsWith(' lit') || lower.includes('illuminated')) {
    return true;
  }

  // 4. Check if this is a lighting effect (subject is light/shadow)
  // e.g., "sunlight streaming", "shadows casting", "light coming through"
  for (const word of words) {
    if (LIGHTING_SUBJECTS.has(word)) {
      return true;
    }
  }

  // 5. Check if the gerund is being used as an adjective
  // e.g., "winding path" - "winding" modifies "path"
  if (firstWord.endsWith('ing') && ADJECTIVE_GERUNDS.has(firstWord)) {
    // If followed by a noun, it's likely an adjective
    if (doc.match('#Gerund #Noun').found || doc.match('#Adjective #Noun').found) {
      return true;
    }
  }

  // 6. Check if this is a noun phrase, not a verb phrase
  // e.g., "short brown hair" - no verb here, just adjectives + noun
  const hasVerb = doc.has('#Verb') || doc.has('#Gerund');
  if (!hasVerb) {
    // Check if it ends with a noun (pure noun phrase)
    const lastWord = words[words.length - 1] || '';
    const lastWordDoc = nlp(lastWord);
    if (lastWordDoc.has('#Noun') && !lastWord.endsWith('ing')) {
      return true;
    }
  }

  // 7. Check for false verb adjectives (Compromise mis-tags these)
  // e.g., "short brown hair" - "short" is tagged as verb but it's an adjective
  if (FALSE_VERB_ADJECTIVES.has(firstWord)) {
    return true;
  }

  // 8. Check for ambiguous single-word gerunds that need context
  // These are only valid as actions when part of a larger phrase
  // e.g., standalone "coming" is likely lighting, but "woman coming home" is an action
  if (words.length === 1 && AMBIGUOUS_SINGLE_GERUNDS.has(firstWord)) {
    return true;
  }

  return false;
}

// =============================================================================
// SPAN EXTRACTION
// =============================================================================

interface VerbMatch {
  text: string;
  start: number;
  end: number;
  pattern: string;
}

/**
 * Find the position of a phrase in the original text
 * Handles case-insensitive matching while preserving original case
 */
function findPhrasePosition(text: string, phrase: string, afterIndex: number = 0): { start: number; end: number } | null {
  const lowerText = text.toLowerCase();
  const lowerPhrase = phrase.toLowerCase().trim();

  // Try exact match first
  let start = lowerText.indexOf(lowerPhrase, afterIndex);

  if (start === -1) {
    // Try without extra whitespace
    const normalizedPhrase = lowerPhrase.replace(/\s+/g, ' ');
    start = lowerText.indexOf(normalizedPhrase, afterIndex);
  }

  if (start === -1) {
    // Try finding just the first word (for gerunds that might be part of longer phrases)
    const firstWord = lowerPhrase.split(/\s+/)[0];
    if (firstWord && firstWord.length >= 4) {
      start = lowerText.indexOf(firstWord, afterIndex);
      if (start !== -1) {
        // Return just the first word position
        return {
          start,
          end: start + firstWord.length
        };
      }
    }
  }

  if (start === -1) return null;

  // Calculate actual end based on matched content in original text
  const matchedLength = lowerPhrase.length;
  return {
    start,
    end: start + matchedLength
  };
}

/**
 * Extract verb phrases using compromise patterns
 */
function extractVerbPhrases(doc: ReturnType<typeof nlp>, text: string, config: CompromiseConfig): VerbMatch[] {
  const matches: VerbMatch[] = [];
  const seenPositions = new Set<string>();

  // Pattern 1: Adverb + Verb + Object (e.g., "skillfully dribbling a basketball")
  if (config.includeAdverbs && config.includeObjects) {
    doc.match('#Adverb? #Verb+ #Determiner? #Adjective* #Noun+').forEach((match: ReturnType<typeof nlp>) => {
      const matchText = match.text().trim();
      const words = matchText.split(/\s+/);
      if (words.length <= config.maxPhraseWords && words.length >= 2) {
        const pos = findPhrasePosition(text, matchText);
        if (pos) {
          const key = `${pos.start}-${pos.end}`;
          if (!seenPositions.has(key)) {
            seenPositions.add(key);
            matches.push({ ...pos, text: text.slice(pos.start, pos.end), pattern: 'adv-verb-obj' });
          }
        }
      }
    });
  }

  // Pattern 2: Verb + Preposition + Noun (e.g., "looking through a window")
  doc.match('#Verb+ #Preposition #Determiner? #Adjective* #Noun+').forEach((match: ReturnType<typeof nlp>) => {
    const matchText = match.text().trim();
    const words = matchText.split(/\s+/);
    if (words.length <= config.maxPhraseWords && words.length >= 2) {
      const pos = findPhrasePosition(text, matchText);
      if (pos) {
        const key = `${pos.start}-${pos.end}`;
        if (!seenPositions.has(key)) {
          seenPositions.add(key);
          matches.push({ ...pos, text: text.slice(pos.start, pos.end), pattern: 'verb-prep-noun' });
        }
      }
    }
  });

  // Pattern 3: Simple verb + object (e.g., "catching a ball")
  if (config.includeObjects) {
    doc.match('#Verb+ #Determiner? #Adjective* #Noun').forEach((match: ReturnType<typeof nlp>) => {
      const matchText = match.text().trim();
      const words = matchText.split(/\s+/);
      if (words.length <= config.maxPhraseWords && words.length >= 2) {
        const pos = findPhrasePosition(text, matchText);
        if (pos) {
          const key = `${pos.start}-${pos.end}`;
          if (!seenPositions.has(key)) {
            seenPositions.add(key);
            matches.push({ ...pos, text: text.slice(pos.start, pos.end), pattern: 'verb-obj' });
          }
        }
      }
    });
  }

  // Pattern 4: Adverb + Verb (e.g., "running energetically")
  if (config.includeAdverbs) {
    doc.match('#Adverb #Verb+').forEach((match: ReturnType<typeof nlp>) => {
      const matchText = match.text().trim();
      const pos = findPhrasePosition(text, matchText);
      if (pos) {
        const key = `${pos.start}-${pos.end}`;
        if (!seenPositions.has(key)) {
          seenPositions.add(key);
          matches.push({ ...pos, text: text.slice(pos.start, pos.end), pattern: 'adv-verb' });
        }
      }
    });

    // Also match Verb + Adverb (e.g., "runs quickly")
    doc.match('#Verb+ #Adverb').forEach((match: ReturnType<typeof nlp>) => {
      const matchText = match.text().trim();
      const pos = findPhrasePosition(text, matchText);
      if (pos) {
        const key = `${pos.start}-${pos.end}`;
        if (!seenPositions.has(key)) {
          seenPositions.add(key);
          matches.push({ ...pos, text: text.slice(pos.start, pos.end), pattern: 'verb-adv' });
        }
      }
    });
  }

  return matches;
}

/**
 * Extract standalone gerunds (-ing verbs that act as actions)
 */
function extractGerunds(doc: ReturnType<typeof nlp>, text: string, config: CompromiseConfig): VerbMatch[] {
  const matches: VerbMatch[] = [];
  const seenPositions = new Set<string>();

  // Match gerunds (present participles used as main verbs)
  doc.match('#Gerund').forEach((match: ReturnType<typeof nlp>) => {
    const matchText = match.text().trim();

    // Skip very short or excluded verbs
    if (matchText.length < 4 || shouldExcludeVerb(matchText)) {
      return;
    }

    const pos = findPhrasePosition(text, matchText);
    if (pos) {
      const key = `${pos.start}-${pos.end}`;
      if (!seenPositions.has(key)) {
        seenPositions.add(key);
        matches.push({ ...pos, text: text.slice(pos.start, pos.end), pattern: 'gerund' });
      }
    }
  });

  // Also check for -ing words that Compromise tagged as nouns but are likely actions
  // This handles cases like "woman dribbling a basketball" where "dribbling" is tagged as Noun
  doc.match('#Noun').forEach((match: ReturnType<typeof nlp>) => {
    const matchText = match.text().trim().toLowerCase();

    // Check if it's a known action gerund (ends in -ing and is in our list)
    if (matchText.endsWith('ing') && ACTION_GERUNDS.has(matchText)) {
      const pos = findPhrasePosition(text, matchText);
      if (pos) {
        const key = `${pos.start}-${pos.end}`;
        if (!seenPositions.has(key)) {
          seenPositions.add(key);
          matches.push({ ...pos, text: text.slice(pos.start, pos.end), pattern: 'action-noun' });
        }
      }
    }
  });

  return matches;
}

/**
 * Remove overlapping spans, keeping the longest/most specific
 */
function deduplicateMatches(matches: VerbMatch[]): VerbMatch[] {
  if (matches.length === 0) return [];

  // Sort by start position, then by length (longer first)
  const sorted = [...matches].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (b.end - b.start) - (a.end - a.start);
  });

  const result: VerbMatch[] = [];
  let lastEnd = -1;

  for (const match of sorted) {
    // Skip if this match is contained within or overlaps with the previous
    if (match.start < lastEnd) {
      // Check if this is a longer match starting at the same position
      const lastMatch = result[result.length - 1];
      if (lastMatch && match.start === lastMatch.start && (match.end - match.start) > (lastMatch.end - lastMatch.start)) {
        result.pop();
        result.push(match);
        lastEnd = match.end;
      }
      continue;
    }

    result.push(match);
    lastEnd = match.end;
  }

  return result;
}

// =============================================================================
// PUBLIC API
// =============================================================================

export interface CompromiseExtractionResult {
  spans: NlpSpan[];
  stats: {
    verbPhrases: number;
    gerunds: number;
    totalExtracted: number;
    latencyMs: number;
  };
}

/**
 * Extract action spans using Compromise NLP
 * Uses semantic classification for verb role detection
 */
export async function extractActionSpans(
  text: string,
  config: Partial<CompromiseConfig> = {}
): Promise<CompromiseExtractionResult> {
  const startTime = performance.now();
  const mergedConfig = { ...DEFAULT_COMPROMISE_CONFIG, ...config };

  if (!mergedConfig.enabled || !text || typeof text !== 'string') {
    return {
      spans: [],
      stats: { verbPhrases: 0, gerunds: 0, totalExtracted: 0, latencyMs: 0 }
    };
  }

  try {
    const doc = nlp(text);
    const allMatches: VerbMatch[] = [];
    let verbPhraseCount = 0;
    let gerundCount = 0;

    // Extract verb phrases
    if (mergedConfig.extractVerbPhrases) {
      const verbPhrases = extractVerbPhrases(doc, text, mergedConfig);
      verbPhraseCount = verbPhrases.length;
      allMatches.push(...verbPhrases);
    }

    // Extract gerunds
    if (mergedConfig.extractGerunds) {
      const gerunds = extractGerunds(doc, text, mergedConfig);
      gerundCount = gerunds.length;
      allMatches.push(...gerunds);
    }

    // Deduplicate overlapping matches
    const dedupedMatches = deduplicateMatches(allMatches);

    // Filter out excluded verbs and template instructions
    const filteredMatches = dedupedMatches
      .filter(match => !shouldExcludeVerb(match.text))
      .filter(match => !isTemplateInstruction(match.text));

    // Classify verbs semantically (async) and convert to NlpSpan format
    const spans: NlpSpan[] = await Promise.all(
      filteredMatches.map(async match => ({
        text: match.text,
        role: await classifyActionRole(match.text),
        confidence: mergedConfig.minConfidence,
        start: match.start,
        end: match.end,
        source: 'compromise' as const,
      }))
    );

    const latencyMs = Math.round(performance.now() - startTime);

    log.debug('Compromise extraction completed', {
      operation: 'extractActionSpans',
      textLength: text.length,
      verbPhrases: verbPhraseCount,
      gerunds: gerundCount,
      totalExtracted: spans.length,
      latencyMs
    });

    return {
      spans,
      stats: {
        verbPhrases: verbPhraseCount,
        gerunds: gerundCount,
        totalExtracted: spans.length,
        latencyMs
      }
    };
  } catch (error) {
    log.error('Compromise extraction failed', error as Error, {
      operation: 'extractActionSpans',
      textLength: text.length
    });

    return {
      spans: [],
      stats: { verbPhrases: 0, gerunds: 0, totalExtracted: 0, latencyMs: 0 }
    };
  }
}

/**
 * Check if Compromise is available and working
 */
export function isCompromiseAvailable(): boolean {
  try {
    const doc = nlp('test sentence');
    return doc !== null && typeof doc.verbs === 'function';
  } catch {
    return false;
  }
}

/**
 * Warm up Compromise and semantic classifier by running a sample extraction
 */
export async function warmupCompromise(): Promise<{ success: boolean; latencyMs: number }> {
  const startTime = performance.now();

  try {
    // Warm up the semantic verb classifier first
    await warmupVerbSemantics();

    // Then run a sample extraction
    const result = await extractActionSpans(
      'A dog is running energetically through the park, chasing a bright red ball.'
    );

    const latencyMs = Math.round(performance.now() - startTime);

    log.info('Compromise warmup completed', {
      operation: 'warmupCompromise',
      spansExtracted: result.spans.length,
      semanticsReady: isVerbSemanticsReady(),
      latencyMs,
    });

    return { success: result.spans.length > 0, latencyMs };
  } catch (error) {
    log.error('Compromise warmup failed', error as Error, {
      operation: 'warmupCompromise',
    });
    return { success: false, latencyMs: 0 };
  }
}

export default {
  extractActionSpans,
  isCompromiseAvailable,
  warmupCompromise,
  DEFAULT_COMPROMISE_CONFIG
};
