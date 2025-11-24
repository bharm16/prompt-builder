/**
 * Cinematography Frame - Custom Frame for Video Generation
 * 
 * This is a domain-specific frame for camera movements and cinematography.
 * Unlike the Motion frame (which describes subject movement), the Cinematography
 * frame describes camera movement and operation.
 * 
 * This frame is CRITICAL for the "Pan Paradox" - distinguishing:
 * - "Pan left" (camera movement) from "frying pan" (cooking utensil)
 * - "Dolly in" (camera movement) from "toy dolly" (object)
 * - "Truck right" (camera movement) from "delivery truck" (vehicle)
 * 
 * Frame Elements in this frame explicitly handle the technical aspects of
 * video capture and composition.
 */

import { CAMERA_MOVES, CAMERA_ANGLES, SHOT_TYPES, DIRECTIONS } from '../gazetteers/cameraMovements.js';

/**
 * Cinematography frame definition
 */
export const CinematographyFrame = {
  name: 'Cinematography',
  description: 'Camera operation, movement, and shot composition for video',
  
  /**
   * Lexical Units - camera operations that evoke this frame
   */
  lexicalUnits: {
    // Rotational movements
    rotation: ['pan', 'pans', 'panning', 'panned', 'tilt', 'tilts', 'tilting', 'tilted', 'roll', 'rolls', 'rolling', 'rolled'],
    
    // Translational movements
    translation: ['dolly', 'dollies', 'dollying', 'truck', 'trucks', 'trucking', 'trucked', 'pedestal', 'crane', 'cranes', 'craning', 'craned'],
    
    // Optical changes
    optical: ['zoom', 'zooms', 'zooming', 'zoomed', 'focus', 'focuses', 'focusing', 'focused', 'rack focus', 'pull focus'],
    
    // Complex movements
    complex: ['orbit', 'orbits', 'orbiting', 'track', 'tracks', 'tracking', 'tracked', 'follow', 'follows', 'following', 'followed'],
    
    // Shot composition (not movements, but camera operations)
    composition: ['frame', 'frames', 'framing', 'framed', 'compose', 'composes', 'composing', 'composed'],
  },

  /**
   * Frame Elements - components of cinematography frame
   */
  frameElements: {
    // ===== CORE ELEMENTS =====
    
    AGENT: {
      type: 'Core',
      definition: 'The camera itself (usually implicit)',
      examples: ['camera', 'the lens'],
      mapsTo: 'camera',
      defaultValue: 'camera',
      implicitDefault: true, // Usually not stated explicitly
    },
    
    DIRECTION: {
      type: 'Core',
      definition: 'Direction of camera movement or orientation',
      examples: ['left', 'right', 'up', 'down', 'in', 'out', 'toward', 'away'],
      mapsTo: 'camera.direction',
      required: true,
      keywords: DIRECTIONS,
    },
    
    SUBJECT: {
      type: 'Core',
      definition: 'What is being filmed',
      examples: ['on the soldier', 'to the building', 'toward the character'],
      mapsTo: 'subject.identity',
      required: false,
    },
    
    // ===== PERIPHERAL ELEMENTS =====
    
    SPEED: {
      type: 'Peripheral',
      definition: 'Speed of camera movement',
      examples: ['slowly', 'quickly', 'smoothly', 'rapidly'],
      mapsTo: 'camera.speed',
      indicators: ['speed adverbs'],
    },
    
    EXTENT: {
      type: 'Peripheral',
      definition: 'Distance or degree of movement',
      examples: ['slightly', 'a lot', '45 degrees'],
      mapsTo: 'camera.extent',
    },
    
    STYLE: {
      type: 'Peripheral',
      definition: 'Style or manner of camera operation',
      examples: ['handheld', 'stabilized', 'steady', 'shaky'],
      mapsTo: 'camera.style',
      keywords: ['handheld', 'steadicam', 'stabilized', 'shaky', 'smooth'],
    },
    
    SHOT_TYPE: {
      type: 'Peripheral',
      definition: 'Type of shot being captured',
      examples: ['close-up', 'wide shot', 'medium shot'],
      mapsTo: 'shot.type',
      keywords: Object.keys(SHOT_TYPES),
    },
    
    ANGLE: {
      type: 'Peripheral',
      definition: 'Camera angle relative to subject',
      examples: ['low angle', 'high angle', 'eye level'],
      mapsTo: 'camera.angle',
      keywords: Object.keys(CAMERA_ANGLES),
    },
  },

  /**
   * Pattern detection for frame elements
   */
  patterns: {
    AGENT: {
      syntactic: ['Implicit or explicit "camera"'],
      keywords: ['camera', 'lens'],
    },
    DIRECTION: {
      syntactic: ['Directional word immediately after camera verb'],
      position: 'post-verb',
      keywords: DIRECTIONS,
    },
    SUBJECT: {
      syntactic: ['PP with "on", "to", "toward"'],
      prepositions: ['on', 'to', 'toward', 'towards', 'at'],
    },
    SPEED: {
      syntactic: ['RB indicating speed'],
      keywords: ['slowly', 'quickly', 'smoothly', 'rapidly', 'fast', 'slow'],
    },
  },

  /**
   * Check if a verb/term evokes the Cinematography frame
   * This is THE CRITICAL disambiguation function
   * 
   * @param {string} term - Term to check
   * @param {Object} context - Surrounding context
   * @returns {boolean|string} False or the camera operation type
   */
  evokesFrame(term, context = {}) {
    const normalized = term.toLowerCase();
    
    // Check all lexical unit categories
    for (const [operationType, terms] of Object.entries(this.lexicalUnits)) {
      if (terms.includes(normalized)) {
        // Found a potential match, but need to check context
        
        // Strong indicators that this IS a camera operation:
        if (context.hasCameraKeyword) return operationType;
        if (context.hasDirectionalWord && DIRECTIONS.includes(context.hasDirectionalWord.toLowerCase())) {
          return operationType;
        }
        
        // If no strong context, still return true for some obvious camera-only terms
        const cameraOnlyTerms = ['tilt', 'pedestal', 'rack focus', 'pull focus'];
        if (cameraOnlyTerms.some(t => normalized.includes(t))) {
          return operationType;
        }
        
        // For ambiguous terms (pan, dolly, truck, roll), require context
        const ambiguousTerms = ['pan', 'dolly', 'truck', 'roll', 'crane'];
        if (ambiguousTerms.includes(normalized)) {
          // Weak match - needs stronger context to confirm
          return context.likelyCameraContext ? operationType : false;
        }
        
        // For other terms, assume camera context if found in lexical units
        return operationType;
      }
    }
    
    return false;
  },

  /**
   * Get all camera operation terms
   * 
   * @returns {Array<string>} All lexical units
   */
  getAllLexicalUnits() {
    return Object.values(this.lexicalUnits).flat();
  },

  /**
   * Get camera movement definition from gazetteer
   * 
   * @param {string} term - Camera movement term
   * @returns {Object|null} Movement definition
   */
  getMovementDefinition(term) {
    const normalized = term.toLowerCase();
    return CAMERA_MOVES[normalized] || null;
  },

  /**
   * Infer camera operation characteristics
   * 
   * @param {string} term - Camera operation term
   * @returns {Object|null} Operation characteristics
   */
  inferCharacteristics(term) {
    const operationType = this.evokesFrame(term, { likelyCameraContext: true });
    
    if (!operationType) return null;
    
    const moveDef = this.getMovementDefinition(term);
    
    return {
      term,
      operationType,
      movementType: moveDef?.type || 'unknown',
      axis: moveDef?.axis || null,
      requiresDirection: moveDef?.frame_elements?.direction === 'required',
      definition: moveDef?.definition || null,
    };
  },

  /**
   * Validate a camera movement phrase
   * Check if it has required frame elements
   * 
   * @param {string} verb - Camera verb
   * @param {Object} frameElements - Extracted frame elements
   * @returns {Object} Validation result
   */
  validate(verb, frameElements) {
    const characteristics = this.inferCharacteristics(verb);
    
    if (!characteristics) {
      return { valid: false, reason: 'Not a camera operation' };
    }
    
    // Check required elements
    if (characteristics.requiresDirection && !frameElements.DIRECTION) {
      return { 
        valid: false, 
        reason: `Camera operation "${verb}" requires a direction (left, right, up, down, etc.)`,
        suggestion: `Add a direction: "${verb} left", "${verb} right", etc.`,
      };
    }
    
    return { valid: true, characteristics };
  },
};

export default CinematographyFrame;

