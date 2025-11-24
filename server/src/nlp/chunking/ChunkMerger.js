/**
 * Chunk Merger - Cascading Attribute Attachment and Complex Modifier Handling
 * 
 * Video prompts often contain complex structures where Noun Phrases are modified
 * by Prepositional Phrases, creating ambiguity about attachment.
 * 
 * Example Ambiguity:
 * - "A man with a red hat" → Merge into single entity (attribute relationship)
 * - "A man in a car" → Keep separate (spatial relationship)
 * 
 * This module implements cascading finite state transducers (FST) that run
 * chunking in multiple passes:
 * 
 * Stage 1: Basic Chunking (identify NPs, VPs, PPs)
 * Stage 2: Pattern Merging (merge based on semantic affinity)
 * 
 * Merge Rules:
 * - NP + PP("with"|"wearing") → Complex NP (attribute)
 * - NP + PP("in"|"at"|"on") → Keep separate (spatial location)
 * - Lexical affinity (e.g., "telescope" has high affinity with "man" vs "hill")
 */

import { CHUNK_TYPES, Chunk } from './ChunkParser.js';
import { isPrepositionTag } from '../utils/PennTreebankTags.js';

/**
 * Prepositions that indicate attribute relationships (should merge)
 */
const ATTRIBUTE_PREPOSITIONS = new Set([
  'with',
  'wearing',
  'carrying',
  'holding',
  'having',
]);

/**
 * Prepositions that indicate spatial relationships (should NOT merge)
 */
const SPATIAL_PREPOSITIONS = new Set([
  'in',
  'at',
  'on',
  'near',
  'by',
  'beside',
  'under',
  'over',
  'through',
  'across',
  'behind',
  'in front of',
  'next to',
]);

/**
 * Temporal prepositions (should NOT merge)
 */
const TEMPORAL_PREPOSITIONS = new Set([
  'during',
  'before',
  'after',
  'while',
  'when',
]);

/**
 * Lexical affinity dictionary
 * Maps objects to their likely possessors/users
 */
const LEXICAL_AFFINITY = {
  // Clothing/Accessories (high affinity with people)
  'hat': ['man', 'woman', 'person', 'character', 'cowboy', 'soldier'],
  'jacket': ['man', 'woman', 'person', 'character', 'soldier'],
  'glasses': ['man', 'woman', 'person', 'character'],
  'scarf': ['man', 'woman', 'person', 'character'],
  'weapon': ['soldier', 'warrior', 'character', 'person'],
  'rifle': ['soldier', 'hunter', 'character'],
  'sword': ['warrior', 'knight', 'character'],
  
  // Tools/Instruments (affinity with users)
  'telescope': ['man', 'woman', 'person', 'astronomer'],
  'camera': ['photographer', 'person', 'character'],
  'microphone': ['singer', 'person', 'character'],
  
  // Body parts (strict affinity with beings)
  'eyes': ['man', 'woman', 'person', 'character', 'animal'],
  'hand': ['man', 'woman', 'person', 'character'],
  'face': ['man', 'woman', 'person', 'character'],
  
  // Environmental features (low affinity with people)
  'car': [], // Cars don't belong to people in spatial sense
  'building': [],
  'tree': [],
  'hill': [],
  'mountain': [],
};

/**
 * Complex Chunk - represents merged chunks
 */
class ComplexChunk extends Chunk {
  constructor(type, tokens, startIndex, endIndex, components = []) {
    super(type, tokens, startIndex, endIndex);
    this.components = components; // Original chunks that were merged
    this.isComplex = true;
  }
}

/**
 * Chunk Merger class
 */
export class ChunkMerger {
  /**
   * Merge chunks using cascading rules
   * 
   * @param {Array<Chunk>} chunks - Chunks from ChunkParser
   * @param {string} text - Original text
   * @returns {Array<Chunk>} Merged chunks
   */
  static mergeCascading(chunks, text) {
    if (!chunks || chunks.length === 0) return [];
    
    let mergedChunks = [...chunks];
    
    // Stage 1: Merge NP + Attribute PP
    mergedChunks = ChunkMerger.mergeAttributePPs(mergedChunks);
    
    // Stage 2: Apply lexical affinity rules
    mergedChunks = ChunkMerger.applyLexicalAffinity(mergedChunks);
    
    return mergedChunks;
  }

  /**
   * Merge NP + PP when PP indicates attribute relationship
   * 
   * Pattern: NP + PP(with/wearing/...) → Complex NP
   * 
   * @param {Array<Chunk>} chunks - Input chunks
   * @returns {Array<Chunk>} Merged chunks
   */
  static mergeAttributePPs(chunks) {
    const result = [];
    let i = 0;
    
    while (i < chunks.length) {
      const chunk = chunks[i];
      
      // Check if current chunk is NP and next is PP
      if (i + 1 < chunks.length &&
          chunk.type === CHUNK_TYPES.NP &&
          chunks[i + 1].type === CHUNK_TYPES.PP) {
        
        const pp = chunks[i + 1];
        const prep = pp.getPreposition();
        
        if (prep && ATTRIBUTE_PREPOSITIONS.has(prep.normal.toLowerCase())) {
          // Merge NP and PP into Complex NP
          const mergedTokens = [...chunk.tokens, ...pp.tokens];
          const complexChunk = new ComplexChunk(
            CHUNK_TYPES.NP,
            mergedTokens,
            chunk.startIndex,
            pp.endIndex,
            [chunk, pp]
          );
          result.push(complexChunk);
          i += 2; // Skip both chunks
          continue;
        }
      }
      
      // No merge, keep original chunk
      result.push(chunk);
      i++;
    }
    
    return result;
  }

  /**
   * Apply lexical affinity rules for ambiguous attachments
   * 
   * Example: "A man on a hill with a telescope"
   * - By adjacency: telescope → hill
   * - By affinity: telescope → man (correct)
   * 
   * @param {Array<Chunk>} chunks - Input chunks
   * @returns {Array<Chunk>} Chunks with corrected attachments
   */
  static applyLexicalAffinity(chunks) {
    // For now, this is a simplified implementation
    // In production, you'd want more sophisticated logic
    
    // This would analyze patterns like: NP1 + PP1 + PP2
    // And decide whether PP2 attaches to NP1 or the object of PP1
    // based on lexical affinity scores
    
    // For the current implementation, we'll keep it simple
    // and just return chunks as-is
    return chunks;
  }

  /**
   * Check if a PP should be merged with preceding NP
   * 
   * @param {Chunk} np - Noun phrase
   * @param {Chunk} pp - Prepositional phrase
   * @returns {boolean} True if should merge
   */
  static shouldMerge(np, pp) {
    if (np.type !== CHUNK_TYPES.NP || pp.type !== CHUNK_TYPES.PP) {
      return false;
    }
    
    const prep = pp.getPreposition();
    if (!prep) return false;
    
    const prepText = prep.normal.toLowerCase();
    
    // Rule 1: Attribute prepositions → merge
    if (ATTRIBUTE_PREPOSITIONS.has(prepText)) {
      return true;
    }
    
    // Rule 2: Spatial prepositions → don't merge
    if (SPATIAL_PREPOSITIONS.has(prepText)) {
      return false;
    }
    
    // Rule 3: Temporal prepositions → don't merge
    if (TEMPORAL_PREPOSITIONS.has(prepText)) {
      return false;
    }
    
    // Rule 4: Check lexical affinity
    const npHead = np.getHeadNoun();
    const ppObject = pp.getObject();
    
    if (npHead && ppObject && ppObject.length > 0) {
      const npHeadText = npHead.normal.toLowerCase();
      const ppObjectHead = ppObject.find(t => t.tag.startsWith('NN'));
      
      if (ppObjectHead) {
        const ppObjectText = ppObjectHead.normal.toLowerCase();
        const affinity = LEXICAL_AFFINITY[ppObjectText] || [];
        
        if (affinity.includes(npHeadText)) {
          return true; // High affinity → merge
        }
      }
    }
    
    // Default: don't merge
    return false;
  }

  /**
   * Split a complex chunk back into its components
   * 
   * @param {Chunk} chunk - Chunk to split
   * @returns {Array<Chunk>} Component chunks
   */
  static splitComplex(chunk) {
    if (chunk.isComplex && chunk.components) {
      return chunk.components;
    }
    return [chunk];
  }

  /**
   * Get all NPs from chunks (including components of complex chunks)
   * 
   * @param {Array<Chunk>} chunks - Chunks (may include complex chunks)
   * @returns {Array<Chunk>} All NP chunks
   */
  static getAllNPs(chunks) {
    const nps = [];
    
    for (const chunk of chunks) {
      if (chunk.type === CHUNK_TYPES.NP) {
        if (chunk.isComplex) {
          // Extract component NPs from complex chunk
          const components = ChunkMerger.splitComplex(chunk);
          nps.push(...components.filter(c => c.type === CHUNK_TYPES.NP));
        } else {
          nps.push(chunk);
        }
      }
    }
    
    return nps;
  }

  /**
   * Analyze merge decisions for debugging
   * 
   * @param {Array<Chunk>} originalChunks - Original chunks
   * @param {Array<Chunk>} mergedChunks - Merged chunks
   * @returns {Object} Analysis
   */
  static analyzeMerges(originalChunks, mergedChunks) {
    const mergeCount = originalChunks.length - mergedChunks.length;
    const complexChunks = mergedChunks.filter(c => c.isComplex);
    
    return {
      originalCount: originalChunks.length,
      mergedCount: mergedChunks.length,
      mergeOperations: mergeCount,
      complexChunks: complexChunks.length,
      mergeDetails: complexChunks.map(c => ({
        text: c.text,
        components: c.components.map(comp => ({
          type: comp.type,
          text: comp.text,
        })),
      })),
    };
  }

  /**
   * Check if a preposition indicates an attribute relationship
   * 
   * @param {string} prep - Preposition text
   * @returns {boolean}
   */
  static isAttributePreposition(prep) {
    return ATTRIBUTE_PREPOSITIONS.has(prep.toLowerCase());
  }

  /**
   * Check if a preposition indicates a spatial relationship
   * 
   * @param {string} prep - Preposition text
   * @returns {boolean}
   */
  static isSpatialPreposition(prep) {
    return SPATIAL_PREPOSITIONS.has(prep.toLowerCase());
  }

  /**
   * Check if a preposition indicates a temporal relationship
   * 
   * @param {string} prep - Preposition text
   * @returns {boolean}
   */
  static isTemporalPreposition(prep) {
    return TEMPORAL_PREPOSITIONS.has(prep.toLowerCase());
  }

  /**
   * Get lexical affinity score between two nouns
   * 
   * @param {string} possessor - Potential possessor noun
   * @param {string} object - Object noun
   * @returns {number} Affinity score (0-1)
   */
  static getLexicalAffinity(possessor, object) {
    const affinity = LEXICAL_AFFINITY[object.toLowerCase()] || [];
    
    if (affinity.includes(possessor.toLowerCase())) {
      return 1.0; // High affinity
    }
    
    return 0.0; // No affinity
  }
}

export { ComplexChunk, ATTRIBUTE_PREPOSITIONS, SPATIAL_PREPOSITIONS, TEMPORAL_PREPOSITIONS };
export default ChunkMerger;

