/**
 * Motion Frame - FrameNet-Inspired Frame for Video Generation
 * 
 * The Motion frame is central to video generation. It defines the necessary
 * components to simulate movement physics and trajectory.
 * 
 * Based on FrameNet's Motion frame but adapted specifically for video prompts.
 * 
 * Frame Definition:
 * - Lexical Units: Verbs/terms that evoke motion (run, walk, fly, swim, glide, swerve, drift)
 * - Frame Elements: Core components needed to understand and render motion
 * 
 * Usage Example:
 * "A soldier runs through the forest"
 * - THEME: "soldier" (the moving object)
 * - PATH: "through the forest" (route covered)
 * - MANNER: implicit (how the motion occurs - can be inferred from "runs")
 * 
 * The Motion frame unifies disparate verbs under a single schematic representation,
 * allowing for broad generalization across similar motion types.
 */

/**
 * Motion frame definition
 */
export const MotionFrame = {
  name: 'Motion',
  description: 'Movement or change of location of an entity',
  
  /**
   * Lexical Units - words/phrases that evoke this frame
   * Grouped by motion type for easier classification
   */
  lexicalUnits: {
    // Ground motion (bipedal/quadrupedal)
    walking: ['walk', 'walks', 'walking', 'walked', 'stroll', 'stride', 'march', 'pace'],
    running: ['run', 'runs', 'running', 'ran', 'sprint', 'dash', 'jog'],
    jumping: ['jump', 'jumps', 'jumping', 'jumped', 'leap', 'bound', 'hop'],
    
    // Aerial motion
    flying: ['fly', 'flies', 'flying', 'flew', 'soar', 'glide', 'hover'],
    falling: ['fall', 'falls', 'falling', 'fell', 'drop', 'plummet', 'descend'],
    
    // Aquatic motion
    swimming: ['swim', 'swims', 'swimming', 'swam', 'dive', 'float'],
    
    // Vehicular/mechanical motion
    driving: ['drive', 'drives', 'driving', 'drove', 'cruise', 'speed'],
    riding: ['ride', 'rides', 'riding', 'rode'],
    
    // Non-linear motion
    swerving: ['swerve', 'swerves', 'swerving', 'swerved', 'veer', 'turn', 'curve'],
    drifting: ['drift', 'drifts', 'drifting', 'drifted', 'float', 'wander'],
    spinning: ['spin', 'spins', 'spinning', 'spun', 'rotate', 'twirl', 'whirl'],
    
    // Approach/departure
    approaching: ['approach', 'approaches', 'approaching', 'approached', 'near'],
    leaving: ['leave', 'leaves', 'leaving', 'left', 'depart', 'exit'],
  },

  /**
   * Frame Elements - semantic roles within the motion frame
   */
  frameElements: {
    // ===== CORE ELEMENTS (required for full understanding) =====
    
    THEME: {
      type: 'Core',
      definition: 'The object or entity that is moving',
      examples: ['The soldier runs', 'A bird flies'],
      mapsTo: 'subject.identity',
      required: true,
    },
    
    PATH: {
      type: 'Core',
      definition: 'The ground or route covered during motion',
      examples: ['through the forest', 'along the street', 'across the sky'],
      mapsTo: 'action.path',
      required: false,
    },
    
    SOURCE: {
      type: 'Core',
      definition: 'Where the motion begins',
      examples: ['from the building', 'out of the car'],
      mapsTo: 'environment.source',
      required: false,
    },
    
    GOAL: {
      type: 'Core',
      definition: 'Where the motion ends',
      examples: ['to the door', 'into the house', 'toward the camera'],
      mapsTo: 'environment.location',
      required: false,
    },
    
    // ===== PERIPHERAL ELEMENTS (optional modifiers) =====
    
    MANNER: {
      type: 'Peripheral',
      definition: 'How the motion occurs (style, quality)',
      examples: ['quickly', 'smoothly', 'erratically', 'gracefully'],
      mapsTo: 'action.manner',
      indicators: ['adverbs', 'manner phrases'],
    },
    
    SPEED: {
      type: 'Peripheral',
      definition: 'Rate of motion',
      examples: ['slowly', 'rapidly', 'at full speed'],
      mapsTo: 'action.speed',
      indicators: ['speed adverbs', 'rate expressions'],
    },
    
    AREA: {
      type: 'Peripheral',
      definition: 'The region containing the motion',
      examples: ['in the forest', 'throughout the city'],
      mapsTo: 'environment.location',
      indicators: ['in', 'throughout', 'within'],
    },
    
    DISTANCE: {
      type: 'Peripheral',
      definition: 'Extent of motion',
      examples: ['50 meters', 'a long way', 'for miles'],
      mapsTo: 'action.extent',
    },
    
    DURATION: {
      type: 'Peripheral',
      definition: 'Time span of motion',
      examples: ['for 10 seconds', 'briefly'],
      mapsTo: 'technical.duration',
    },
  },

  /**
   * Pattern detection - how to identify frame elements from syntax
   */
  patterns: {
    THEME: {
      syntactic: ['NP before verb', 'subject NP'],
      position: 'pre-verb',
    },
    PATH: {
      syntactic: ['PP with "through", "along", "across"'],
      prepositions: ['through', 'along', 'across', 'over', 'around'],
    },
    SOURCE: {
      syntactic: ['PP with "from", "out of"'],
      prepositions: ['from', 'out of', 'off'],
    },
    GOAL: {
      syntactic: ['PP with "to", "toward", "into"'],
      prepositions: ['to', 'toward', 'towards', 'into', 'onto'],
    },
    MANNER: {
      syntactic: ['RB after verb', 'manner adverb'],
      position: 'post-verb',
    },
    SPEED: {
      syntactic: ['RB indicating rate'],
      keywords: ['quickly', 'slowly', 'rapidly', 'fast', 'slow'],
    },
    AREA: {
      syntactic: ['PP with "in", "within", "throughout"'],
      prepositions: ['in', 'within', 'throughout'],
    },
  },

  /**
   * Check if a verb is a lexical unit of this frame
   * 
   * @param {string} verb - Verb to check (normalized)
   * @returns {boolean|string} False or the motion type
   */
  evokesFrame(verb) {
    const normalized = verb.toLowerCase();
    
    for (const [motionType, verbs] of Object.entries(this.lexicalUnits)) {
      if (verbs.includes(normalized)) {
        return motionType;
      }
    }
    
    return false;
  },

  /**
   * Get all verbs that evoke this frame
   * 
   * @returns {Array<string>} All lexical units
   */
  getAllLexicalUnits() {
    return Object.values(this.lexicalUnits).flat();
  },

  /**
   * Infer motion characteristics from verb
   * 
   * @param {string} verb - Motion verb
   * @returns {Object} Motion characteristics
   */
  inferCharacteristics(verb) {
    const motionType = this.evokesFrame(verb);
    
    if (!motionType) return null;
    
    const characteristics = {
      verb,
      motionType,
      linear: ['walking', 'running', 'flying', 'swimming', 'driving'].includes(motionType),
      nonLinear: ['swerving', 'spinning', 'drifting'].includes(motionType),
      aerial: ['flying', 'falling'].includes(motionType),
      aquatic: ['swimming'].includes(motionType),
      ground: ['walking', 'running', 'jumping'].includes(motionType),
    };
    
    return characteristics;
  },
};

export default MotionFrame;

