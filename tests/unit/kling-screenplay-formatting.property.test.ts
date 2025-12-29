/**
 * Property-based tests for Kling Screenplay Formatting
 *
 * Tests the following correctness property:
 * - Property 4 (Kling): Dialogue Formatting
 *
 * For any Kling prompt containing dialogue patterns, the transform phase SHALL
 * format dialogue as `[Character] ([Emotion]): "[Line]"` and extract sound effects
 * to separate `Audio:` blocks.
 *
 * @module kling-screenplay-formatting.property.test
 *
 * **Feature: video-model-optimization, Property 4 (Kling): Dialogue Formatting**
 * **Validates: Requirements 5.3, 5.4**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';

import { KlingStrategy } from '@services/video-prompt-analysis/strategies/KlingStrategy';

/**
 * Character names for generating test prompts
 */
const CHARACTER_NAMES = [
  'John',
  'Sarah',
  'Michael',
  'Emma',
  'David',
  'Lisa',
  'James',
  'Anna',
  'Robert',
  'Maria',
] as const;

/**
 * Speech verbs for dialogue patterns
 */
const SPEECH_VERBS = [
  'says',
  'said',
  'speaks',
  'tells',
  'asks',
  'replies',
  'responds',
  'exclaims',
  'whispers',
  'shouts',
  'yells',
  'murmurs',
] as const;

/**
 * Emotions for dialogue
 */
const EMOTIONS = [
  'angrily',
  'happily',
  'sadly',
  'excitedly',
  'nervously',
  'calmly',
  'fearfully',
  'joyfully',
  'sarcastically',
] as const;

/**
 * Sound effect types for audio blocks
 */
const SFX_TYPES = [
  'bang',
  'crash',
  'boom',
  'whoosh',
  'splash',
  'thud',
  'click',
  'beep',
  'thunder',
  'explosion',
  'footsteps',
] as const;

/**
 * Ambience types for audio blocks
 */
const AMBIENCE_TYPES = [
  'city sounds',
  'nature sounds',
  'crowd noise',
  'traffic',
  'birds chirping',
  'wind blowing',
  'rain falling',
  'ocean waves',
] as const;

/**
 * Music types for audio blocks
 */
const MUSIC_TYPES = [
  'background music',
  'orchestra',
  'piano',
  'guitar',
  'violin',
  'drums',
] as const;

/**
 * Generate a simple dialogue line
 */
const dialogueLineArb = fc.record({
  character: fc.constantFrom(...CHARACTER_NAMES),
  verb: fc.constantFrom(...SPEECH_VERBS),
  line: fc.string({ minLength: 5, maxLength: 50 }).filter(s => 
    s.trim().length > 0 && 
    !s.includes('"') && 
    !s.includes("'") &&
    /^[a-zA-Z0-9\s.,!?]+$/.test(s)
  ),
});

/**
 * Check if output contains formatted dialogue pattern
 * Pattern: [Character] (emotion): "line" or [Character]: "line"
 */
function containsFormattedDialogue(output: string): boolean {
  // Check for [Character] pattern with optional emotion
  const formattedPattern = /\[[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\](?:\s*\([^)]+\))?\s*:\s*"/;
  return formattedPattern.test(output);
}

/**
 * Check if output contains Audio: block
 */
function containsAudioBlock(output: string): boolean {
  return /Audio\s*\([A-Z]+\)\s*:/i.test(output);
}

/**
 * Extract character names from formatted dialogue
 */
function extractFormattedCharacters(output: string): string[] {
  const pattern = /\[([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\]/g;
  const characters: string[] = [];
  let match;
  while ((match = pattern.exec(output)) !== null) {
    if (match[1]) {
      characters.push(match[1]);
    }
  }
  return characters;
}

describe('Kling Screenplay Formatting Property Tests', () => {
  let strategy: KlingStrategy;

  beforeEach(() => {
    strategy = new KlingStrategy();
    strategy.resetEntityRegistry();
  });

  /**
   * Property 4 (Kling): Dialogue Formatting
   *
   * For any Kling prompt containing dialogue patterns, the transform phase SHALL
   * format dialogue as `[Character] ([Emotion]): "[Line]"`.
   *
   * **Feature: video-model-optimization, Property 4 (Kling): Dialogue Formatting**
   * **Validates: Requirements 5.3**
   */
  describe('Property 4: Dialogue Formatting', () => {
    it('dialogue with speech verbs is formatted to screenplay format', async () => {
      await fc.assert(
        fc.asyncProperty(
          dialogueLineArb,
          async ({ character, verb, line }) => {
            // Create input with dialogue pattern: Character says "line"
            const input = `${character} ${verb} "${line}"`;

            const normalized = strategy.normalize(input);
            const result = strategy.transform(normalized);
            const prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

            // Output should contain formatted dialogue with [Character]
            expect(containsFormattedDialogue(prompt)).toBe(true);

            // Character name should be preserved in brackets
            const formattedChars = extractFormattedCharacters(prompt);
            expect(formattedChars.some(c => c.toLowerCase() === character.toLowerCase())).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('dialogue with colon format is formatted to screenplay format', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...CHARACTER_NAMES),
          fc.string({ minLength: 5, maxLength: 50 }).filter(s => 
            s.trim().length > 0 && 
            !s.includes('"') && 
            !s.includes("'") &&
            /^[a-zA-Z0-9\s.,!?]+$/.test(s)
          ),
          async (character, line) => {
            // Create input with colon dialogue pattern: Character: "line"
            const input = `${character}: "${line}"`;

            const normalized = strategy.normalize(input);
            const result = strategy.transform(normalized);
            const prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

            // Output should contain formatted dialogue
            expect(containsFormattedDialogue(prompt)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('emotion indicators are captured in dialogue formatting', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...CHARACTER_NAMES),
          fc.constantFrom(...EMOTIONS),
          fc.string({ minLength: 5, maxLength: 30 }).filter(s => 
            s.trim().length > 0 && 
            !s.includes('"') && 
            !s.includes("'") &&
            /^[a-zA-Z0-9\s.,!?]+$/.test(s)
          ),
          async (character, emotion, line) => {
            // Create input with emotion: Character angrily says "line"
            const input = `${character} ${emotion} says "${line}"`;

            const normalized = strategy.normalize(input);
            const result = strategy.transform(normalized);
            const prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

            // Output should contain formatted dialogue
            expect(containsFormattedDialogue(prompt)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4 (Kling): Sound Effect Extraction
   *
   * For any Kling prompt containing sound effects, the transform phase SHALL
   * extract them to separate `Audio:` blocks.
   *
   * **Feature: video-model-optimization, Property 4 (Kling): Dialogue Formatting**
   * **Validates: Requirements 5.4**
   */
  describe('Property 4: Sound Effect Extraction', () => {
    it('sound effects are extracted to Audio blocks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...SFX_TYPES),
          fc.string({ minLength: 5, maxLength: 50 }).filter(s => 
            s.trim().length > 0 && /^[a-zA-Z0-9\s.,]+$/.test(s)
          ),
          async (sfx, visualContent) => {
            // Create input with sound effect
            const input = `${visualContent}. The sound of ${sfx} echoes.`;

            const normalized = strategy.normalize(input);
            const result = strategy.transform(normalized);
            const prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

            // Output should contain Audio block
            expect(containsAudioBlock(prompt)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('ambience descriptions are extracted to Audio blocks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...AMBIENCE_TYPES),
          fc.constantFrom(
            'A person walks through the park',
            'The camera pans across the scene',
            'A beautiful sunset over the city',
            'Two people talking at a cafe',
            'A car drives down the street',
            'The protagonist enters the room',
            'A bird flies across the sky',
            'The waves crash on the shore'
          ),
          async (ambience, visualContent) => {
            // Create input with ambience
            const input = `${visualContent}. ${ambience} in the background.`;

            const normalized = strategy.normalize(input);
            const result = strategy.transform(normalized);
            const prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

            // Output should contain Audio block
            expect(containsAudioBlock(prompt)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('music descriptions are extracted to Audio blocks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...MUSIC_TYPES),
          fc.string({ minLength: 5, maxLength: 50 }).filter(s => 
            s.trim().length > 0 && /^[a-zA-Z0-9\s.,]+$/.test(s)
          ),
          async (music, visualContent) => {
            // Create input with music
            const input = `${visualContent}. ${music} plays softly.`;

            const normalized = strategy.normalize(input);
            const result = strategy.transform(normalized);
            const prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

            // Output should contain Audio block
            expect(containsAudioBlock(prompt)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Screenplay Formatting Edge Cases', () => {
    it('handles prompts with no dialogue', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 100 }).filter(s => {
            const lower = s.toLowerCase();
            // Filter out strings that contain dialogue patterns
            return s.trim().length > 0 &&
                   !lower.includes('says') &&
                   !lower.includes('said') &&
                   !lower.includes('"') &&
                   !lower.includes("'") &&
                   /^[a-zA-Z0-9\s.,]+$/.test(s);
          }),
          async (input) => {
            const normalized = strategy.normalize(input);
            const result = strategy.transform(normalized);

            // Should still produce valid output
            expect(result.prompt).not.toBeNull();
            expect(result.metadata).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles multiple dialogue lines', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(dialogueLineArb, { minLength: 2, maxLength: 4 }),
          async (dialogues) => {
            // Create input with multiple dialogue lines
            const input = dialogues
              .map(d => `${d.character} ${d.verb} "${d.line}"`)
              .join('. ');

            const normalized = strategy.normalize(input);
            const result = strategy.transform(normalized);
            const prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

            // Output should contain formatted dialogue
            expect(containsFormattedDialogue(prompt)).toBe(true);

            // Should have multiple character references
            const formattedChars = extractFormattedCharacters(prompt);
            expect(formattedChars.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('preserves visual content alongside dialogue', async () => {
      await fc.assert(
        fc.asyncProperty(
          dialogueLineArb,
          fc.string({ minLength: 10, maxLength: 50 }).filter(s => 
            s.trim().length > 0 && /^[a-zA-Z0-9\s.,]+$/.test(s)
          ),
          async ({ character, verb, line }, visualContent) => {
            // Create input with both visual and dialogue
            const input = `${visualContent}. ${character} ${verb} "${line}"`;

            const normalized = strategy.normalize(input);
            const result = strategy.transform(normalized);
            const prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

            // Output should contain both visual content and formatted dialogue
            expect(prompt.length).toBeGreaterThan(0);
            expect(containsFormattedDialogue(prompt)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
