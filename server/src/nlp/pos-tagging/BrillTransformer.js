/**
 * Brill-Style Transformation Rules for Domain-Specific Disambiguation
 * 
 * Named after Eric Brill's Error-Driven Transformation-Based Learner (1993),
 * this module implements deterministic transformation rules that "patch" POS tags
 * based on local context patterns.
 * 
 * The Brill Tagger operates in two phases:
 * 1. Initialization: Assign tags based on most frequent usage
 * 2. Patching: Apply context-sensitive rules to correct errors
 * 
 * For video prompt building, we need domain-specific rules to handle:
 * - Camera movements (pan, dolly, truck, crane, roll)
 * - Lighting terms (key, fill, hard, soft)
 * - Technical specifications (35mm, 16:9, 24fps)
 * 
 * These transformation rules are CRITICAL for the "Pan Paradox":
 * - "Pan left" (VB - camera movement) vs "frying pan" (NN - cooking)
 * - "Dolly in" (VB - camera movement) vs "toy dolly" (NN - object)
 * - "Truck right" (VB - camera movement) vs "delivery truck" (NN - vehicle)
 */

import { CAMERA_MOVES, DIRECTIONS, MOVEMENT_SPEEDS } from '../gazetteers/cameraMovements.js';
import { LIGHTING_STYLES } from '../gazetteers/lightingTerms.js';
import { isVerbTag, isNounTag, isPrepositionTag, isDeterminerTag } from '../utils/PennTreebankTags.js';

/**
 * Transformation rule definition
 */
class TransformationRule {
  constructor(name, condition, transform, priority = 1) {
    this.name = name;
    this.condition = condition; // Function that checks if rule should apply
    this.transform = transform; // Function that applies the transformation
    this.priority = priority; // Higher priority rules apply first
  }

  /**
   * Check if rule applies to token at given index
   * 
   * @param {Array<Object>} tokens - Token array
   * @param {number} index - Current token index
   * @param {string} text - Original text
   * @returns {boolean}
   */
  applies(tokens, index, text) {
    return this.condition(tokens, index, text);
  }

  /**
   * Apply transformation to token
   * 
   * @param {Object} token - Token to transform
   * @param {Array<Object>} tokens - Full token array
   * @param {number} index - Token index
   * @param {string} text - Original text
   * @returns {Object} Transformed token
   */
  apply(token, tokens, index, text) {
    return this.transform(token, tokens, index, text);
  }
}

/**
 * Brill Transformer for video-specific POS disambiguation
 */
export class BrillTransformer {
  constructor() {
    this.rules = this.buildRules();
    // Sort rules by priority (highest first)
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Build all transformation rules
   * 
   * @returns {Array<TransformationRule>}
   */
  buildRules() {
    return [
      // ============================================
      // CATEGORY 1: CAMERA MOVEMENT DISAMBIGUATION
      // ============================================

      // Rule 1.1: "Pan" + directional word → VB (Verb)
      new TransformationRule(
        'pan-verb-direction',
        (tokens, i, text) => {
          if (tokens[i].normal.toLowerCase() !== 'pan') return false;
          
          // Check next token for direction
          if (i + 1 < tokens.length) {
            const nextWord = tokens[i + 1].normal.toLowerCase();
            return DIRECTIONS.includes(nextWord);
          }
          return false;
        },
        (token) => ({ ...token, tag: 'VB', transformed: true, rule: 'pan-verb-direction' }),
        10 // High priority
      ),

      // Rule 1.2: "Determiner + Pan" → NN (Noun, likely cooking)
      new TransformationRule(
        'pan-noun-determiner',
        (tokens, i, text) => {
          if (tokens[i].normal.toLowerCase() !== 'pan') return false;
          
          // Check previous token for determiner
          if (i > 0 && isDeterminerTag(tokens[i - 1].tag)) {
            return true;
          }
          
          // Check for adjectives like "frying", "cooking"
          if (i > 0) {
            const prevWord = tokens[i - 1].normal.toLowerCase();
            if (['frying', 'cooking', 'sauce', 'hot'].includes(prevWord)) {
              return true;
            }
          }
          
          return false;
        },
        (token) => ({ ...token, tag: 'NN', transformed: true, rule: 'pan-noun-determiner' }),
        9
      ),

      // Rule 1.3: "Dolly" + (in|out|forward|back) → VB
      new TransformationRule(
        'dolly-verb-direction',
        (tokens, i, text) => {
          if (tokens[i].normal.toLowerCase() !== 'dolly') return false;
          
          if (i + 1 < tokens.length) {
            const nextWord = tokens[i + 1].normal.toLowerCase();
            return ['in', 'out', 'forward', 'back', 'toward', 'away'].includes(nextWord);
          }
          return false;
        },
        (token) => ({ ...token, tag: 'VB', transformed: true, rule: 'dolly-verb-direction' }),
        10
      ),

      // Rule 1.4: Adjective/Determiner + "Dolly" → NN (toy doll)
      new TransformationRule(
        'dolly-noun-toy',
        (tokens, i, text) => {
          if (tokens[i].normal.toLowerCase() !== 'dolly') return false;
          
          if (i > 0) {
            const prevWord = tokens[i - 1].normal.toLowerCase();
            if (['toy', 'wooden', 'child', 'little'].includes(prevWord)) {
              return true;
            }
            if (isDeterminerTag(tokens[i - 1].tag)) {
              // Only if NOT followed by direction
              if (i + 1 < tokens.length) {
                const nextWord = tokens[i + 1].normal.toLowerCase();
                if (['in', 'out', 'forward', 'back'].includes(nextWord)) {
                  return false;
                }
              }
              return true;
            }
          }
          return false;
        },
        (token) => ({ ...token, tag: 'NN', transformed: true, rule: 'dolly-noun-toy' }),
        8
      ),

      // Rule 1.5: "Crane" + (up|down) → VB
      new TransformationRule(
        'crane-verb-direction',
        (tokens, i, text) => {
          if (tokens[i].normal.toLowerCase() !== 'crane') return false;
          
          if (i + 1 < tokens.length) {
            const nextWord = tokens[i + 1].normal.toLowerCase();
            return ['up', 'down', 'over', 'above'].includes(nextWord);
          }
          return false;
        },
        (token) => ({ ...token, tag: 'VB', transformed: true, rule: 'crane-verb-direction' }),
        10
      ),

      // Rule 1.6: "Crane" + (bird|construction|tall) context → NN
      new TransformationRule(
        'crane-noun-bird',
        (tokens, i, text) => {
          if (tokens[i].normal.toLowerCase() !== 'crane') return false;
          
          // Check surrounding context
          const contextStart = Math.max(0, i - 3);
          const contextEnd = Math.min(tokens.length, i + 4);
          const contextWords = tokens.slice(contextStart, contextEnd).map(t => t.normal.toLowerCase());
          
          return ['bird', 'construction', 'tall', 'machine', 'operator'].some(w => contextWords.includes(w));
        },
        (token) => ({ ...token, tag: 'NN', transformed: true, rule: 'crane-noun-bird' }),
        8
      ),

      // Rule 1.7: "Truck" + (left|right) → VB
      new TransformationRule(
        'truck-verb-direction',
        (tokens, i, text) => {
          if (tokens[i].normal.toLowerCase() !== 'truck') return false;
          
          if (i + 1 < tokens.length) {
            const nextWord = tokens[i + 1].normal.toLowerCase();
            return ['left', 'right', 'alongside', 'parallel'].includes(nextWord);
          }
          return false;
        },
        (token) => ({ ...token, tag: 'VB', transformed: true, rule: 'truck-verb-direction' }),
        10
      ),

      // Rule 1.8: "Truck" + (delivery|pickup|vehicle) context → NN
      new TransformationRule(
        'truck-noun-vehicle',
        (tokens, i, text) => {
          if (tokens[i].normal.toLowerCase() !== 'truck') return false;
          
          // Check for vehicle context
          const contextStart = Math.max(0, i - 3);
          const contextEnd = Math.min(tokens.length, i + 4);
          const contextWords = tokens.slice(contextStart, contextEnd).map(t => t.normal.toLowerCase());
          
          return ['delivery', 'pickup', 'red', 'vehicle', 'driving', 'parked'].some(w => contextWords.includes(w));
        },
        (token) => ({ ...token, tag: 'NN', transformed: true, rule: 'truck-noun-vehicle' }),
        8
      ),

      // Rule 1.9: "Roll" + camera context → VB
      new TransformationRule(
        'roll-verb-camera',
        (tokens, i, text) => {
          if (tokens[i].normal.toLowerCase() !== 'roll') return false;
          
          // Check for camera context or directional words
          const contextStart = Math.max(0, i - 3);
          const contextEnd = Math.min(tokens.length, i + 4);
          const contextWords = tokens.slice(contextStart, contextEnd).map(t => t.normal.toLowerCase());
          
          if (contextWords.includes('camera') || contextWords.includes('lens')) {
            return true;
          }
          
          // Check next word for rotation direction
          if (i + 1 < tokens.length) {
            const nextWord = tokens[i + 1].normal.toLowerCase();
            if (['clockwise', 'counterclockwise', 'left', 'right', 'slightly'].includes(nextWord)) {
              return true;
            }
          }
          
          return false;
        },
        (token) => ({ ...token, tag: 'VB', transformed: true, rule: 'roll-verb-camera' }),
        9
      ),

      // Rule 1.10: "Roll" + (bread|drum|butter) context → NN
      new TransformationRule(
        'roll-noun-object',
        (tokens, i, text) => {
          if (tokens[i].normal.toLowerCase() !== 'roll') return false;
          
          const contextStart = Math.max(0, i - 3);
          const contextEnd = Math.min(tokens.length, i + 4);
          const contextWords = tokens.slice(contextStart, contextEnd).map(t => t.normal.toLowerCase());
          
          return ['bread', 'butter', 'drum', 'bake', 'bakery'].some(w => contextWords.includes(w));
        },
        (token) => ({ ...token, tag: 'NN', transformed: true, rule: 'roll-noun-object' }),
        8
      ),

      // Rule 1.11: "Tilt" + (up|down) → VB
      new TransformationRule(
        'tilt-verb-direction',
        (tokens, i, text) => {
          if (tokens[i].normal.toLowerCase() !== 'tilt') return false;
          
          if (i + 1 < tokens.length) {
            const nextWord = tokens[i + 1].normal.toLowerCase();
            return ['up', 'down', 'upward', 'downward'].includes(nextWord);
          }
          return false;
        },
        (token) => ({ ...token, tag: 'VB', transformed: true, rule: 'tilt-verb-direction' }),
        10
      ),

      // Rule 1.12: "Zoom" + (in|out) → VB
      new TransformationRule(
        'zoom-verb-direction',
        (tokens, i, text) => {
          if (tokens[i].normal.toLowerCase() !== 'zoom') return false;
          
          if (i + 1 < tokens.length) {
            const nextWord = tokens[i + 1].normal.toLowerCase();
            return ['in', 'out', 'on', 'to'].includes(nextWord);
          }
          return false;
        },
        (token) => ({ ...token, tag: 'VB', transformed: true, rule: 'zoom-verb-direction' }),
        10
      ),

      // ============================================
      // CATEGORY 2: LIGHTING TERM DISAMBIGUATION
      // ============================================

      // Rule 2.1: "Key" + "light" → Force as NN compound
      new TransformationRule(
        'key-light-compound',
        (tokens, i, text) => {
          if (tokens[i].normal.toLowerCase() !== 'key') return false;
          
          if (i + 1 < tokens.length) {
            const nextWord = tokens[i + 1].normal.toLowerCase();
            return nextWord === 'light' || nextWord === 'lighting';
          }
          return false;
        },
        (token) => ({ ...token, tag: 'NN', transformed: true, rule: 'key-light-compound' }),
        10
      ),

      // Rule 2.2: "Fill" + "light" → Force as NN compound
      new TransformationRule(
        'fill-light-compound',
        (tokens, i, text) => {
          if (tokens[i].normal.toLowerCase() !== 'fill') return false;
          
          if (i + 1 < tokens.length) {
            const nextWord = tokens[i + 1].normal.toLowerCase();
            return nextWord === 'light' || nextWord === 'lighting';
          }
          return false;
        },
        (token) => ({ ...token, tag: 'NN', transformed: true, rule: 'fill-light-compound' }),
        10
      ),

      // Rule 2.3: "Soft"/"Hard" + "light" → JJ + NN (lighting quality)
      new TransformationRule(
        'quality-light-adjective',
        (tokens, i, text) => {
          const word = tokens[i].normal.toLowerCase();
          if (!['soft', 'hard', 'diffused', 'harsh'].includes(word)) return false;
          
          if (i + 1 < tokens.length) {
            const nextWord = tokens[i + 1].normal.toLowerCase();
            return nextWord === 'light' || nextWord === 'lighting';
          }
          return false;
        },
        (token) => ({ ...token, tag: 'JJ', transformed: true, rule: 'quality-light-adjective' }),
        10
      ),

      // ============================================
      // CATEGORY 3: TECHNICAL TERM DISAMBIGUATION
      // ============================================

      // Rule 3.1: Number + "mm" → Lens focal length (NN)
      new TransformationRule(
        'focal-length-mm',
        (tokens, i, text) => {
          const word = tokens[i].word.toLowerCase();
          return /^\d+mm$/.test(word);
        },
        (token) => ({ ...token, tag: 'NN', transformed: true, rule: 'focal-length-mm' }),
        10
      ),

      // Rule 3.2: Number + ":" + Number → Aspect ratio (NN)
      new TransformationRule(
        'aspect-ratio',
        (tokens, i, text) => {
          const word = tokens[i].word;
          return /^\d+:\d+(\.\d+)?$/.test(word) || /^\d+\.\d+:\d+$/.test(word);
        },
        (token) => ({ ...token, tag: 'NN', transformed: true, rule: 'aspect-ratio' }),
        10
      ),

      // Rule 3.3: Number + "fps"/"hz" → Frame rate (NN)
      new TransformationRule(
        'frame-rate',
        (tokens, i, text) => {
          const word = tokens[i].word.toLowerCase();
          return /^\d+(fps|hz|p)$/.test(word);
        },
        (token) => ({ ...token, tag: 'NN', transformed: true, rule: 'frame-rate' }),
        10
      ),

      // Rule 3.4: "Camera" context enforcement
      // When we see "camera", mark following camera movements as verbs
      new TransformationRule(
        'camera-context-verb',
        (tokens, i, text) => {
          // Check if previous tokens include "camera"
          if (i < 2) return false;
          
          const hasCameraInContext = tokens.slice(Math.max(0, i - 3), i).some(
            t => t.normal.toLowerCase() === 'camera'
          );
          
          if (!hasCameraInContext) return false;
          
          const word = tokens[i].normal.toLowerCase();
          return Object.keys(CAMERA_MOVES).includes(word);
        },
        (token) => ({ ...token, tag: 'VB', transformed: true, rule: 'camera-context-verb' }),
        9
      ),
    ];
  }

  /**
   * Apply all transformation rules to a token array
   * 
   * @param {Array<Object>} tokens - Tokens from PosTagger
   * @param {string} text - Original text
   * @returns {Array<Object>} Transformed tokens
   */
  applyRules(tokens, text) {
    const transformedTokens = [...tokens];
    
    // Track which tokens have been transformed
    const transformed = new Set();
    
    // Apply rules in priority order
    for (const rule of this.rules) {
      for (let i = 0; i < transformedTokens.length; i++) {
        // Skip if already transformed by a higher priority rule
        if (transformed.has(i)) continue;
        
        if (rule.applies(transformedTokens, i, text)) {
          transformedTokens[i] = rule.apply(transformedTokens[i], transformedTokens, i, text);
          transformed.add(i);
        }
      }
    }
    
    return transformedTokens;
  }

  /**
   * Apply rules and return statistics
   * 
   * @param {Array<Object>} tokens - Input tokens
   * @param {string} text - Original text
   * @returns {Object} Transformed tokens and stats
   */
  applyWithStats(tokens, text) {
    const transformedTokens = this.applyRules(tokens, text);
    
    const stats = {
      totalTokens: tokens.length,
      transformedCount: transformedTokens.filter(t => t.transformed).length,
      ruleApplications: {},
    };
    
    transformedTokens.forEach(t => {
      if (t.transformed && t.rule) {
        stats.ruleApplications[t.rule] = (stats.ruleApplications[t.rule] || 0) + 1;
      }
    });
    
    return {
      tokens: transformedTokens,
      stats,
    };
  }

  /**
   * Get all available rules
   * 
   * @returns {Array<Object>} Rule descriptions
   */
  getRules() {
    return this.rules.map(r => ({
      name: r.name,
      priority: r.priority,
    }));
  }
}

// Export singleton instance
export const brillTransformer = new BrillTransformer();

export default BrillTransformer;

