/**
 * Simplified Semantic Role Labeling (SRL) - PropBank-Inspired
 * 
 * This module implements a simplified version of PropBank's semantic role labeling,
 * adapted specifically for video prompt generation.
 * 
 * PropBank defines roles on a verb-by-verb basis, but uses a consistent prototype
 * for Arg0 and Arg1 based on Dowty's Proto-Roles:
 * - Arg0 (Proto-Agent): The entity that performs the action, causes an event
 * - Arg1 (Proto-Patient): The entity that undergoes change or is affected
 * - ArgM-*: Adjunct modifiers (Location, Manner, Time, Direction, etc.)
 * 
 * For video generation, SRL helps us understand:
 * - WHO is the subject (Arg0) → Maps to subject.identity
 * - WHAT is being acted upon (Arg1) → Maps to environment or secondary subject
 * - WHERE (ArgM-LOC) → Maps to environment.location
 * - HOW (ArgM-MNR) → Maps to action.manner
 * - WHEN (ArgM-TMP) → Maps to lighting.timeOfDay
 * 
 * Example: "A soldier runs through a dark forest"
 * - Predicate: runs
 * - Arg0: A soldier (Agent - who is running)
 * - ArgM-LOC: through a dark forest (Location - where)
 */

import { CHUNK_TYPES } from '../chunking/ChunkParser.js';
import { isVerbTag, isNounTag } from '../utils/PennTreebankTags.js';

/**
 * Semantic Role types
 */
export const SEMANTIC_ROLES = {
  // Core arguments
  ARG0: 'Arg0', // Agent/Experiencer
  ARG1: 'Arg1', // Patient/Theme
  ARG2: 'Arg2', // Instrument/Beneficiary/Attribute
  ARG3: 'Arg3', // Starting point/Benefactive
  ARG4: 'Arg4', // Ending point
  
  // Adjunct modifiers
  ARGM_LOC: 'ArgM-LOC', // Location
  ARGM_TMP: 'ArgM-TMP', // Time
  ARGM_MNR: 'ArgM-MNR', // Manner
  ARGM_DIR: 'ArgM-DIR', // Direction
  ARGM_EXT: 'ArgM-EXT', // Extent
  ARGM_PRP: 'ArgM-PRP', // Purpose
  ARGM_CAU: 'ArgM-CAU', // Cause
};

/**
 * Semantic Role annotation
 */
class SemanticRole {
  constructor(role, chunk, predicate, confidence = 1.0) {
    this.role = role;
    this.chunk = chunk;
    this.predicate = predicate; // The verb this role relates to
    this.text = chunk.text;
    this.confidence = confidence;
  }
}

/**
 * Predicate-Argument Structure
 */
class PredicateArgumentStructure {
  constructor(predicate, predicateChunk) {
    this.predicate = predicate; // Main verb token
    this.predicateChunk = predicateChunk; // VP chunk
    this.arguments = {}; // Map of role -> SemanticRole
  }

  /**
   * Add an argument
   */
  addArgument(role, chunk, confidence = 1.0) {
    this.arguments[role] = new SemanticRole(role, chunk, this.predicate, confidence);
  }

  /**
   * Get argument by role
   */
  getArgument(role) {
    return this.arguments[role] || null;
  }

  /**
   * Get all arguments
   */
  getAllArguments() {
    return Object.values(this.arguments);
  }

  /**
   * Check if has argument
   */
  hasArgument(role) {
    return role in this.arguments;
  }
}

/**
 * Simplified Semantic Role Labeler
 */
export class SimplifiedSRL {
  /**
   * Label semantic roles in chunks
   * 
   * @param {Array<Chunk>} chunks - Chunks from ChunkParser
   * @param {Array<FrameInstance>} frames - Frame instances from FrameMatcher
   * @returns {Array<PredicateArgumentStructure>} Predicate-argument structures
   */
  static labelRoles(chunks, frames = []) {
    if (!chunks || chunks.length === 0) return [];
    
    const structures = [];
    
    // Find all predicates (verb phrases)
    const vpChunks = chunks.filter(c => c.type === CHUNK_TYPES.VP);
    
    for (const vpChunk of vpChunks) {
      const mainVerb = vpChunk.getMainVerb();
      if (!mainVerb) continue;
      
      const structure = SimplifiedSRL.labelPredicateArguments(mainVerb, vpChunk, chunks, frames);
      structures.push(structure);
    }
    
    return structures;
  }

  /**
   * Label arguments for a single predicate
   * 
   * @param {Object} predicate - Main verb token
   * @param {Chunk} predicateChunk - VP chunk containing the verb
   * @param {Array<Chunk>} chunks - All chunks
   * @param {Array<FrameInstance>} frames - Frame instances
   * @returns {PredicateArgumentStructure}
   */
  static labelPredicateArguments(predicate, predicateChunk, chunks, frames) {
    const structure = new PredicateArgumentStructure(predicate, predicateChunk);
    
    // Find predicate chunk index
    const predicateIndex = chunks.indexOf(predicateChunk);
    if (predicateIndex === -1) return structure;
    
    // Check if this is passive voice
    const isPassive = SimplifiedSRL.detectPassiveVoice(predicate, predicateChunk, chunks);
    
    // Arg0 (Agent): Subject NP before verb
    // In passive voice, Arg0 comes after "by"
    if (!isPassive) {
      for (let i = predicateIndex - 1; i >= 0; i--) {
        if (chunks[i].type === CHUNK_TYPES.NP) {
          structure.addArgument(SEMANTIC_ROLES.ARG0, chunks[i]);
          break;
        }
      }
    } else {
      // Look for "by" PP for passive agent
      for (let i = predicateIndex + 1; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk.type === CHUNK_TYPES.PP) {
          const prep = chunk.getPreposition();
          if (prep && prep.normal.toLowerCase() === 'by') {
            structure.addArgument(SEMANTIC_ROLES.ARG0, chunk);
            break;
          }
        }
      }
    }
    
    // Arg1 (Patient/Theme): Object NP after verb
    // In passive voice, Arg1 is the syntactic subject (before verb)
    if (!isPassive) {
      for (let i = predicateIndex + 1; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (chunk.type === CHUNK_TYPES.NP) {
          structure.addArgument(SEMANTIC_ROLES.ARG1, chunk);
          break;
        }
      }
    } else {
      // Passive: Arg1 is subject
      for (let i = predicateIndex - 1; i >= 0; i--) {
        if (chunks[i].type === CHUNK_TYPES.NP) {
          structure.addArgument(SEMANTIC_ROLES.ARG1, chunks[i]);
          break;
        }
      }
    }
    
    // ArgM modifiers (from PPs and adverbs)
    SimplifiedSRL.labelAdjuncts(structure, predicateIndex, chunks);
    
    return structure;
  }

  /**
   * Label adjunct modifiers (ArgM-*)
   * 
   * @param {PredicateArgumentStructure} structure - Structure to add adjuncts to
   * @param {number} predicateIndex - Index of predicate chunk
   * @param {Array<Chunk>} chunks - All chunks
   */
  static labelAdjuncts(structure, predicateIndex, chunks) {
    const predicateChunk = chunks[predicateIndex];
    
    // ArgM-MNR (Manner): Adverbs in VP
    const adverbs = predicateChunk.tokens.filter(t => t.tag.startsWith('RB'));
    if (adverbs.length > 0) {
      const adverbChunk = {
        type: 'ADVERB',
        tokens: adverbs,
        text: adverbs.map(a => a.word).join(' '),
      };
      structure.addArgument(SEMANTIC_ROLES.ARGM_MNR, adverbChunk);
    }
    
    // ArgM from Prepositional Phrases
    for (let i = predicateIndex + 1; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.type === CHUNK_TYPES.PP) {
        const prep = chunk.getPreposition();
        if (!prep) continue;
        
        const prepText = prep.normal.toLowerCase();
        const role = SimplifiedSRL.classifyPPRole(prepText);
        
        if (role && !structure.hasArgument(role)) {
          structure.addArgument(role, chunk);
        }
      }
    }
  }

  /**
   * Classify PP role based on preposition
   * 
   * @param {string} prep - Preposition text
   * @returns {string|null} ArgM role or null
   */
  static classifyPPRole(prep) {
    // Location prepositions
    const locationPreps = ['in', 'at', 'on', 'under', 'over', 'near', 'by', 'beside'];
    if (locationPreps.includes(prep)) {
      return SEMANTIC_ROLES.ARGM_LOC;
    }
    
    // Direction prepositions
    const directionPreps = ['to', 'toward', 'towards', 'from', 'into', 'onto', 'through', 'across'];
    if (directionPreps.includes(prep)) {
      return SEMANTIC_ROLES.ARGM_DIR;
    }
    
    // Temporal prepositions
    const temporalPreps = ['during', 'before', 'after', 'while', 'at'];
    if (temporalPreps.includes(prep)) {
      return SEMANTIC_ROLES.ARGM_TMP;
    }
    
    // Manner prepositions
    const mannerPreps = ['with', 'without'];
    if (mannerPreps.includes(prep)) {
      return SEMANTIC_ROLES.ARGM_MNR;
    }
    
    // Purpose prepositions
    if (prep === 'for') {
      return SEMANTIC_ROLES.ARGM_PRP;
    }
    
    return null;
  }

  /**
   * Detect passive voice
   * Pattern: <BE> + <VBN> (past participle) + optional "by"
   * 
   * @param {Object} mainVerb - Main verb token
   * @param {Chunk} vpChunk - VP chunk
   * @param {Array<Chunk>} chunks - All chunks
   * @returns {boolean} True if passive
   */
  static detectPassiveVoice(mainVerb, vpChunk, chunks) {
    // Check if main verb is past participle (VBN)
    if (mainVerb.tag !== 'VBN') return false;
    
    // Check if there's a form of "be" before it
    const verbIndex = vpChunk.tokens.findIndex(t => t.index === mainVerb.index);
    
    if (verbIndex > 0) {
      const prevToken = vpChunk.tokens[verbIndex - 1];
      const beVerbs = ['is', 'am', 'are', 'was', 'were', 'been', 'being', 'be'];
      
      if (beVerbs.includes(prevToken.normal.toLowerCase())) {
        return true;
      }
    }
    
    // Also check if there's a "by" PP after the verb (strong indicator of passive)
    const vpIndex = chunks.indexOf(vpChunk);
    for (let i = vpIndex + 1; i < chunks.length; i++) {
      if (chunks[i].type === CHUNK_TYPES.PP) {
        const prep = chunks[i].getPreposition();
        if (prep && prep.normal.toLowerCase() === 'by') {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get role description
   * 
   * @param {string} role - Role identifier
   * @returns {string} Human-readable description
   */
  static getRoleDescription(role) {
    const descriptions = {
      [SEMANTIC_ROLES.ARG0]: 'Agent (who performs the action)',
      [SEMANTIC_ROLES.ARG1]: 'Patient/Theme (what is affected)',
      [SEMANTIC_ROLES.ARG2]: 'Instrument/Beneficiary',
      [SEMANTIC_ROLES.ARG3]: 'Starting point',
      [SEMANTIC_ROLES.ARG4]: 'Ending point',
      [SEMANTIC_ROLES.ARGM_LOC]: 'Location (where)',
      [SEMANTIC_ROLES.ARGM_TMP]: 'Time (when)',
      [SEMANTIC_ROLES.ARGM_MNR]: 'Manner (how)',
      [SEMANTIC_ROLES.ARGM_DIR]: 'Direction (to/from where)',
      [SEMANTIC_ROLES.ARGM_EXT]: 'Extent (how much)',
      [SEMANTIC_ROLES.ARGM_PRP]: 'Purpose (why)',
      [SEMANTIC_ROLES.ARGM_CAU]: 'Cause (because of what)',
    };
    
    return descriptions[role] || role;
  }

  /**
   * Analyze SRL output for debugging
   * 
   * @param {Array<PredicateArgumentStructure>} structures - SRL structures
   * @returns {Object} Analysis
   */
  static analyzeStructures(structures) {
    return {
      totalPredicates: structures.length,
      structures: structures.map(s => ({
        predicate: s.predicate.word,
        argumentCount: Object.keys(s.arguments).length,
        roles: Object.keys(s.arguments),
        hasAgent: s.hasArgument(SEMANTIC_ROLES.ARG0),
        hasPatient: s.hasArgument(SEMANTIC_ROLES.ARG1),
        hasLocation: s.hasArgument(SEMANTIC_ROLES.ARGM_LOC),
      })),
      roleDistribution: SimplifiedSRL.getRoleDistribution(structures),
    };
  }

  /**
   * Get distribution of roles across all structures
   * 
   * @param {Array<PredicateArgumentStructure>} structures - SRL structures
   * @returns {Object} Role counts
   */
  static getRoleDistribution(structures) {
    const distribution = {};
    
    for (const structure of structures) {
      for (const role of Object.keys(structure.arguments)) {
        distribution[role] = (distribution[role] || 0) + 1;
      }
    }
    
    return distribution;
  }
}

export { SemanticRole, PredicateArgumentStructure };
export default SimplifiedSRL;

