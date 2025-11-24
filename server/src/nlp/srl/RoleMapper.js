/**
 * Role Mapper - Map Semantic Roles to Taxonomy Categories
 * 
 * This module bridges semantic roles (PropBank-style Arg0, Arg1, ArgM) and
 * frame elements (FrameNet-style THEME, AGENT, etc.) to the video prompt taxonomy.
 * 
 * The taxonomy is defined in shared/taxonomy.js and includes:
 * - subject.identity (Arg0/THEME)
 * - subject.appearance, subject.wardrobe (Arg0 modifiers)
 * - action.movement (Predicates)
 * - environment.location (ArgM-LOC)
 * - lighting.timeOfDay (ArgM-TMP)
 * - camera.movement (Cinematography predicates)
 * 
 * This mapping ensures that:
 * 1. Attributes attach to correct parents (no "orphaned attributes")
 * 2. Relationships are preserved (Subject → Action → Location)
 * 3. Semantic structure translates to taxonomy structure
 */

import { TAXONOMY, resolveCategory, getAllAttributes } from '#shared/taxonomy.js';
import { SEMANTIC_ROLES } from './SimplifiedSRL.js';

/**
 * Enhanced span with semantic metadata
 */
class EnhancedSpan {
  constructor(text, taxonomyRole, start, end, semantic = {}) {
    this.text = text;
    this.role = taxonomyRole; // Taxonomy category ID
    this.start = start;
    this.end = end;
    this.confidence = semantic.confidence || 1.0;
    
    // Semantic metadata
    this.semantic = {
      chunkType: semantic.chunkType || null,
      headNoun: semantic.headNoun || null,
      modifiers: semantic.modifiers || [],
      semanticRole: semantic.semanticRole || null,  // Arg0, Arg1, ArgM-LOC, etc.
      frameElement: semantic.frameElement || null,  // THEME, AGENT, PATH, etc.
      frame: semantic.frame || null,                 // Motion, Cinematography, Lighting
      ...semantic,
    };
  }
}

/**
 * Relationship between spans
 */
class SpanRelationship {
  constructor(source, target, relationshipType) {
    this.source = source; // Source span
    this.target = target; // Target span
    this.type = relationshipType; // "modifies", "acts-on", "located-in", etc.
  }
}

/**
 * Role Mapper class
 */
export class RoleMapper {
  /**
   * Map semantic roles and frame elements to taxonomy
   * 
   * @param {Array<PredicateArgumentStructure>} srlStructures - SRL output
   * @param {Array<FrameInstance>} frames - Frame instances
   * @param {Array<Object>} dictionarySpans - Spans from dictionary matching
   * @returns {Object} Enhanced spans with relationships
   */
  static mapToTaxonomy(srlStructures, frames, dictionarySpans = []) {
    const enhancedSpans = [];
    const relationships = [];
    
    // Process SRL structures
    for (const structure of srlStructures) {
      const predicateSpans = RoleMapper.mapPredicate(structure);
      enhancedSpans.push(...predicateSpans.spans);
      relationships.push(...predicateSpans.relationships);
    }
    
    // Process frame instances
    for (const frame of frames) {
      const frameSpans = RoleMapper.mapFrame(frame);
      enhancedSpans.push(...frameSpans.spans);
      relationships.push(...frameSpans.relationships);
    }
    
    // Merge with dictionary spans (avoid duplicates)
    const mergedSpans = RoleMapper.mergeSpans(enhancedSpans, dictionarySpans);
    
    // Sort by position
    mergedSpans.sort((a, b) => a.start - b.start);
    
    return {
      spans: mergedSpans,
      relationships,
      stats: {
        totalSpans: mergedSpans.length,
        srlSpans: enhancedSpans.length,
        dictionarySpans: dictionarySpans.length,
        relationships: relationships.length,
      },
    };
  }

  /**
   * Map a predicate-argument structure to taxonomy
   * 
   * @param {PredicateArgumentStructure} structure - SRL structure
   * @returns {Object} Spans and relationships
   */
  static mapPredicate(structure) {
    const spans = [];
    const relationships = [];
    
    // Map predicate itself (the action)
    const predicateSpan = new EnhancedSpan(
      structure.predicate.word,
      'action.movement', // Default mapping for verbs
      structure.predicate.charStart,
      structure.predicate.charEnd,
      {
        chunkType: 'VP',
        semanticRole: 'Predicate',
        confidence: 1.0,
      }
    );
    spans.push(predicateSpan);
    
    // Map Arg0 (Agent) → subject.identity
    if (structure.hasArgument(SEMANTIC_ROLES.ARG0)) {
      const arg0 = structure.getArgument(SEMANTIC_ROLES.ARG0);
      const arg0Span = new EnhancedSpan(
        arg0.chunk.text,
        'subject.identity',
        arg0.chunk.charStart,
        arg0.chunk.charEnd,
        {
          chunkType: arg0.chunk.type,
          headNoun: arg0.chunk.getHeadNoun?.()?.word,
          modifiers: arg0.chunk.getModifiers?.()?.map(m => m.word) || [],
          semanticRole: SEMANTIC_ROLES.ARG0,
          confidence: arg0.confidence,
        }
      );
      spans.push(arg0Span);
      
      // Relationship: Arg0 performs action
      relationships.push(new SpanRelationship(arg0Span, predicateSpan, 'performs'));
    }
    
    // Map Arg1 (Patient) → environment or secondary subject
    if (structure.hasArgument(SEMANTIC_ROLES.ARG1)) {
      const arg1 = structure.getArgument(SEMANTIC_ROLES.ARG1);
      
      // Determine if Arg1 is another entity or environment
      const taxonomyRole = RoleMapper.determineArg1Role(arg1.chunk);
      
      const arg1Span = new EnhancedSpan(
        arg1.chunk.text,
        taxonomyRole,
        arg1.chunk.charStart,
        arg1.chunk.charEnd,
        {
          chunkType: arg1.chunk.type,
          semanticRole: SEMANTIC_ROLES.ARG1,
          confidence: arg1.confidence,
        }
      );
      spans.push(arg1Span);
      
      // Relationship: Action affects Arg1
      relationships.push(new SpanRelationship(predicateSpan, arg1Span, 'affects'));
    }
    
    // Map ArgM-LOC (Location) → environment.location
    if (structure.hasArgument(SEMANTIC_ROLES.ARGM_LOC)) {
      const argmLoc = structure.getArgument(SEMANTIC_ROLES.ARGM_LOC);
      const locSpan = new EnhancedSpan(
        argmLoc.chunk.text,
        'environment.location',
        argmLoc.chunk.charStart,
        argmLoc.chunk.charEnd,
        {
          chunkType: argmLoc.chunk.type,
          semanticRole: SEMANTIC_ROLES.ARGM_LOC,
          confidence: argmLoc.confidence,
        }
      );
      spans.push(locSpan);
      
      // Relationship: Action occurs in location
      relationships.push(new SpanRelationship(predicateSpan, locSpan, 'located-in'));
    }
    
    // Map ArgM-MNR (Manner) → action.manner
    if (structure.hasArgument(SEMANTIC_ROLES.ARGM_MNR)) {
      const argmMnr = structure.getArgument(SEMANTIC_ROLES.ARGM_MNR);
      const mannerSpan = new EnhancedSpan(
        argmMnr.chunk.text,
        'action.manner',
        argmMnr.chunk.charStart || 0,
        argmMnr.chunk.charEnd || argmMnr.chunk.text.length,
        {
          chunkType: argmMnr.chunk.type,
          semanticRole: SEMANTIC_ROLES.ARGM_MNR,
          confidence: argmMnr.confidence,
        }
      );
      spans.push(mannerSpan);
      
      // Relationship: Manner modifies action
      relationships.push(new SpanRelationship(mannerSpan, predicateSpan, 'modifies'));
    }
    
    // Map ArgM-DIR (Direction) → action.direction or camera.direction
    if (structure.hasArgument(SEMANTIC_ROLES.ARGM_DIR)) {
      const argmDir = structure.getArgument(SEMANTIC_ROLES.ARGM_DIR);
      const dirSpan = new EnhancedSpan(
        argmDir.chunk.text,
        'action.direction',
        argmDir.chunk.charStart,
        argmDir.chunk.charEnd,
        {
          chunkType: argmDir.chunk.type,
          semanticRole: SEMANTIC_ROLES.ARGM_DIR,
          confidence: argmDir.confidence,
        }
      );
      spans.push(dirSpan);
    }
    
    // Map ArgM-TMP (Time) → lighting.timeOfDay
    if (structure.hasArgument(SEMANTIC_ROLES.ARGM_TMP)) {
      const argmTmp = structure.getArgument(SEMANTIC_ROLES.ARGM_TMP);
      const timeSpan = new EnhancedSpan(
        argmTmp.chunk.text,
        'lighting.timeOfDay',
        argmTmp.chunk.charStart,
        argmTmp.chunk.charEnd,
        {
          chunkType: argmTmp.chunk.type,
          semanticRole: SEMANTIC_ROLES.ARGM_TMP,
          confidence: argmTmp.confidence,
        }
      );
      spans.push(timeSpan);
    }
    
    return { spans, relationships };
  }

  /**
   * Map a frame instance to taxonomy
   * 
   * @param {FrameInstance} frame - Frame instance
   * @returns {Object} Spans and relationships
   */
  static mapFrame(frame) {
    const spans = [];
    const relationships = [];
    
    // Add frame information to spans
    for (const [feName, feData] of Object.entries(frame.frameElements)) {
      const taxonomyRole = feData.mapsTo || RoleMapper.inferTaxonomyRole(feName, frame.frameName);
      
      const span = new EnhancedSpan(
        feData.text,
        taxonomyRole,
        feData.chunk.charStart,
        feData.chunk.charEnd,
        {
          chunkType: feData.chunk.type,
          frameElement: feName,
          frame: frame.frameName,
          confidence: feData.confidence,
        }
      );
      
      spans.push(span);
    }
    
    return { spans, relationships };
  }

  /**
   * Determine taxonomy role for Arg1 based on context
   * 
   * @param {Chunk} chunk - Arg1 chunk
   * @returns {string} Taxonomy role
   */
  static determineArg1Role(chunk) {
    const text = chunk.text.toLowerCase();
    
    // Check if it's a location/environment
    const environmentKeywords = ['forest', 'building', 'room', 'street', 'field', 'ocean', 'sky'];
    if (environmentKeywords.some(kw => text.includes(kw))) {
      return 'environment.location';
    }
    
    // Check if it's another animate entity
    const entityKeywords = ['person', 'man', 'woman', 'character', 'soldier', 'animal'];
    if (entityKeywords.some(kw => text.includes(kw))) {
      return 'subject.identity';
    }
    
    // Default to generic subject
    return 'subject.identity';
  }

  /**
   * Infer taxonomy role from frame element name
   * 
   * @param {string} feName - Frame element name
   * @param {string} frameName - Frame name
   * @returns {string} Taxonomy role
   */
  static inferTaxonomyRole(feName, frameName) {
    // Motion frame mappings
    if (frameName === 'Motion') {
      const motionMap = {
        THEME: 'subject.identity',
        PATH: 'action.path',
        SOURCE: 'environment.source',
        GOAL: 'environment.location',
        AREA: 'environment.location',
        MANNER: 'action.manner',
        SPEED: 'action.speed',
      };
      return motionMap[feName] || 'subject';
    }
    
    // Cinematography frame mappings
    if (frameName === 'Cinematography') {
      const cameraMap = {
        AGENT: 'camera',
        DIRECTION: 'camera.direction',
        SUBJECT: 'subject.identity',
        SPEED: 'camera.speed',
        STYLE: 'camera.style',
      };
      return cameraMap[feName] || 'camera';
    }
    
    // Lighting frame mappings
    if (frameName === 'Lighting') {
      const lightingMap = {
        SCENE: 'environment.location',
        SOURCE: 'lighting.source',
        QUALITY: 'lighting.quality',
        TIME: 'lighting.timeOfDay',
        DIRECTION: 'lighting.direction',
      };
      return lightingMap[feName] || 'lighting';
    }
    
    return 'unknown';
  }

  /**
   * Merge semantic spans with dictionary spans, avoiding duplicates
   * 
   * @param {Array<EnhancedSpan>} semanticSpans - Spans from SRL/frames
   * @param {Array<Object>} dictionarySpans - Spans from dictionary
   * @returns {Array<EnhancedSpan>} Merged spans
   */
  static mergeSpans(semanticSpans, dictionarySpans) {
    const merged = [...semanticSpans];
    
    for (const dictSpan of dictionarySpans) {
      // Check if this span overlaps with any semantic span
      const hasOverlap = semanticSpans.some(semSpan => 
        RoleMapper.spansOverlap(semSpan, dictSpan)
      );
      
      if (!hasOverlap) {
        // Convert dictionary span to enhanced span
        const enhanced = new EnhancedSpan(
          dictSpan.text,
          dictSpan.role,
          dictSpan.start,
          dictSpan.end,
          {
            confidence: dictSpan.confidence,
            source: 'dictionary',
          }
        );
        merged.push(enhanced);
      }
    }
    
    return merged;
  }

  /**
   * Check if two spans overlap
   * 
   * @param {Object} span1 - First span
   * @param {Object} span2 - Second span
   * @returns {boolean} True if overlapping
   */
  static spansOverlap(span1, span2) {
    return (
      (span1.start >= span2.start && span1.start < span2.end) ||
      (span1.end > span2.start && span1.end <= span2.end) ||
      (span1.start <= span2.start && span1.end >= span2.end)
    );
  }

  /**
   * Build relationship graph for visualization or analysis
   * 
   * @param {Array<EnhancedSpan>} spans - Enhanced spans
   * @param {Array<SpanRelationship>} relationships - Relationships
   * @returns {Object} Graph structure
   */
  static buildRelationshipGraph(spans, relationships) {
    const nodes = spans.map((span, index) => ({
      id: index,
      text: span.text,
      role: span.role,
      semantic: span.semantic,
    }));
    
    const edges = relationships.map(rel => ({
      source: spans.indexOf(rel.source),
      target: spans.indexOf(rel.target),
      type: rel.type,
    }));
    
    return { nodes, edges };
  }

  /**
   * Validate taxonomy mappings
   * 
   * @param {Array<EnhancedSpan>} spans - Enhanced spans
   * @returns {Object} Validation results
   */
  static validateMappings(spans) {
    const valid = [];
    const invalid = [];
    const allAttributes = getAllAttributes();
    
    for (const span of spans) {
      const resolved = resolveCategory(span.role);
      if (allAttributes.includes(resolved) || TAXONOMY[resolved.toUpperCase()]) {
        valid.push(span);
      } else {
        invalid.push({ span, reason: `Invalid taxonomy role: ${span.role}` });
      }
    }
    
    return {
      valid: valid.length,
      invalid: invalid.length,
      validRate: (valid.length / spans.length) * 100,
      invalidSpans: invalid,
    };
  }
}

export { EnhancedSpan, SpanRelationship };
export default RoleMapper;

