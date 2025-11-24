/**
 * Frame Matcher - Extract Frame Elements from Syntactic Chunks
 * 
 * This module bridges syntax and semantics by matching chunks to frame-semantic roles.
 * 
 * Process:
 * 1. Detect lexical units (words that evoke frames)
 * 2. Identify which frame is evoked (Motion, Cinematography, Lighting)
 * 3. Extract Frame Elements based on chunk types and positions
 * 4. Map Frame Elements to taxonomy categories
 * 
 * Example:
 * Input: "A soldier runs through the forest"
 * Chunks: [NP: "A soldier"], [VP: "runs"], [PP: "through the forest"]
 * Frame: Motion (evoked by "runs")
 * Frame Elements:
 *   - THEME: "A soldier" (from pre-verb NP)
 *   - PATH: "through the forest" (from PP with "through")
 */

import MotionFrame from './MotionFrame.js';
import CinematographyFrame from './CinematographyFrame.js';
import LightingFrame from './LightingFrame.js';
import { CHUNK_TYPES } from '../chunking/ChunkParser.js';
import { DIRECTIONS } from '../gazetteers/cameraMovements.js';

/**
 * Frame instantiation - a specific instance of a frame evoked by text
 */
class FrameInstance {
  constructor(frame, lexicalUnit, verb, verbIndex) {
    this.frame = frame;
    this.frameName = frame.name;
    this.lexicalUnit = lexicalUnit; // The word that evoked the frame
    this.verb = verb; // The verb token
    this.verbIndex = verbIndex; // Position in token array
    this.frameElements = {}; // Extracted FEs
  }

  /**
   * Add a frame element
   */
  addElement(feName, chunk, confidence = 1.0) {
    this.frameElements[feName] = {
      name: feName,
      chunk,
      text: chunk.text,
      tokens: chunk.tokens,
      confidence,
      mapsTo: this.frame.frameElements[feName]?.mapsTo || null,
    };
  }

  /**
   * Get all extracted frame elements
   */
  getElements() {
    return this.frameElements;
  }

  /**
   * Check if frame has a specific element
   */
  hasElement(feName) {
    return feName in this.frameElements;
  }
}

/**
 * Frame Matcher class
 */
export class FrameMatcher {
  constructor() {
    this.frames = [MotionFrame, CinematographyFrame, LightingFrame];
  }

  /**
   * Match text to frames and extract Frame Elements
   * 
   * @param {Array<Chunk>} chunks - Chunks from ChunkParser
   * @param {string} text - Original text
   * @returns {Array<FrameInstance>} Matched frames with FEs
   */
  matchFrames(chunks, text) {
    if (!chunks || chunks.length === 0) return [];
    
    const frameInstances = [];
    
    // Find all verbs in chunks (potential lexical units)
    const verbChunks = chunks.filter(c => c.type === CHUNK_TYPES.VP);
    
    for (const verbChunk of verbChunks) {
      const mainVerb = verbChunk.getMainVerb();
      if (!mainVerb) continue;
      
      // Try to match verb to a frame
      const matchedFrame = this.matchVerbToFrame(mainVerb, chunks, text);
      
      if (matchedFrame) {
        frameInstances.push(matchedFrame);
      }
    }
    
    return frameInstances;
  }

  /**
   * Match a verb to a specific frame
   * 
   * @param {Object} verb - Verb token
   * @param {Array<Chunk>} chunks - All chunks
   * @param {string} text - Original text
   * @returns {FrameInstance|null} Matched frame or null
   */
  matchVerbToFrame(verb, chunks, text) {
    const verbText = verb.normal.toLowerCase();
    
    // Try Motion frame
    const motionMatch = MotionFrame.evokesFrame(verbText);
    if (motionMatch) {
      return this.extractMotionFrameElements(verb, chunks, text);
    }
    
    // Try Cinematography frame
    const cameraContext = this.buildCameraContext(verb, chunks, text);
    const cinematographyMatch = CinematographyFrame.evokesFrame(verbText, cameraContext);
    if (cinematographyMatch) {
      return this.extractCinematographyFrameElements(verb, chunks, text);
    }
    
    // Try Lighting frame
    const lightingMatch = LightingFrame.evokesFrame(verbText);
    if (lightingMatch) {
      return this.extractLightingFrameElements(verb, chunks, text);
    }
    
    return null;
  }

  /**
   * Build context for camera movement disambiguation
   * 
   * @param {Object} verb - Verb token
   * @param {Array<Chunk>} chunks - All chunks
   * @param {string} text - Original text
   * @returns {Object} Context information
   */
  buildCameraContext(verb, chunks, text) {
    const textLower = text.toLowerCase();
    
    // Check for "camera" keyword
    const hasCameraKeyword = textLower.includes('camera') || textLower.includes('lens');
    
    // Check for directional word after verb
    const verbChunk = chunks.find(c => 
      c.type === CHUNK_TYPES.VP && 
      c.tokens.some(t => t.index === verb.index)
    );
    
    let hasDirectionalWord = null;
    if (verbChunk) {
      const verbPosition = verbChunk.tokens.findIndex(t => t.index === verb.index);
      if (verbPosition + 1 < verbChunk.tokens.length) {
        const nextToken = verbChunk.tokens[verbPosition + 1];
        if (DIRECTIONS.includes(nextToken.normal.toLowerCase())) {
          hasDirectionalWord = nextToken.normal;
        }
      }
    }
    
    // Look for directional words in following chunks
    if (!hasDirectionalWord) {
      const verbChunkIndex = chunks.findIndex(c => c === verbChunk);
      if (verbChunkIndex >= 0 && verbChunkIndex + 1 < chunks.length) {
        const nextChunk = chunks[verbChunkIndex + 1];
        if (nextChunk.tokens.length > 0) {
          const firstToken = nextChunk.tokens[0];
          if (DIRECTIONS.includes(firstToken.normal.toLowerCase())) {
            hasDirectionalWord = firstToken.normal;
          }
        }
      }
    }
    
    return {
      hasCameraKeyword,
      hasDirectionalWord,
      likelyCameraContext: hasCameraKeyword || hasDirectionalWord !== null,
    };
  }

  /**
   * Extract Frame Elements for Motion frame
   * 
   * @param {Object} verb - Verb token
   * @param {Array<Chunk>} chunks - All chunks
   * @param {string} text - Original text
   * @returns {FrameInstance} Frame instance with FEs
   */
  extractMotionFrameElements(verb, chunks, text) {
    const instance = new FrameInstance(MotionFrame, verb.normal, verb, verb.index);
    
    // Find verb chunk
    const verbChunkIndex = chunks.findIndex(c => 
      c.type === CHUNK_TYPES.VP && 
      c.tokens.some(t => t.index === verb.index)
    );
    
    if (verbChunkIndex === -1) return instance;
    
    // THEME: NP before verb (subject)
    for (let i = verbChunkIndex - 1; i >= 0; i--) {
      if (chunks[i].type === CHUNK_TYPES.NP) {
        instance.addElement('THEME', chunks[i]);
        break;
      }
    }
    
    // PATH, SOURCE, GOAL, AREA: PPs after verb
    for (let i = verbChunkIndex + 1; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.type === CHUNK_TYPES.PP) {
        const prep = chunk.getPreposition();
        if (!prep) continue;
        
        const prepText = prep.normal.toLowerCase();
        
        // Classify PP based on preposition
        if (['through', 'along', 'across', 'over', 'around'].includes(prepText)) {
          instance.addElement('PATH', chunk);
        } else if (['from', 'out of', 'off'].includes(prepText)) {
          instance.addElement('SOURCE', chunk);
        } else if (['to', 'toward', 'towards', 'into', 'onto'].includes(prepText)) {
          instance.addElement('GOAL', chunk);
        } else if (['in', 'within', 'throughout'].includes(prepText)) {
          instance.addElement('AREA', chunk);
        }
      }
    }
    
    // MANNER: Adverbs in VP
    const verbChunk = chunks[verbChunkIndex];
    const adverbs = verbChunk.tokens.filter(t => t.tag.startsWith('RB'));
    if (adverbs.length > 0) {
      // Create a pseudo-chunk for the adverbs
      const adverbChunk = {
        type: 'ADVERB',
        tokens: adverbs,
        text: adverbs.map(a => a.word).join(' '),
      };
      instance.addElement('MANNER', adverbChunk);
    }
    
    return instance;
  }

  /**
   * Extract Frame Elements for Cinematography frame
   * 
   * @param {Object} verb - Verb token
   * @param {Array<Chunk>} chunks - All chunks
   * @param {string} text - Original text
   * @returns {FrameInstance} Frame instance with FEs
   */
  extractCinematographyFrameElements(verb, chunks, text) {
    const instance = new FrameInstance(CinematographyFrame, verb.normal, verb, verb.index);
    
    // AGENT: Implicit "camera" (usually not stated)
    // We don't create a chunk for this, just note it
    
    // Find verb chunk
    const verbChunkIndex = chunks.findIndex(c => 
      c.type === CHUNK_TYPES.VP && 
      c.tokens.some(t => t.index === verb.index)
    );
    
    if (verbChunkIndex === -1) return instance;
    
    // DIRECTION: Look for directional word immediately after verb
    // Could be in VP chunk or in following chunks
    const verbChunk = chunks[verbChunkIndex];
    const verbPosition = verbChunk.tokens.findIndex(t => t.index === verb.index);
    
    // Check within VP
    if (verbPosition + 1 < verbChunk.tokens.length) {
      const nextToken = verbChunk.tokens[verbPosition + 1];
      if (DIRECTIONS.includes(nextToken.normal.toLowerCase())) {
        const directionChunk = {
          type: 'DIRECTION',
          tokens: [nextToken],
          text: nextToken.word,
        };
        instance.addElement('DIRECTION', directionChunk);
      }
    }
    
    // Check following chunks for direction if not found
    if (!instance.hasElement('DIRECTION')) {
      if (verbChunkIndex + 1 < chunks.length) {
        const nextChunk = chunks[verbChunkIndex + 1];
        if (nextChunk.tokens.length > 0) {
          const firstToken = nextChunk.tokens[0];
          if (DIRECTIONS.includes(firstToken.normal.toLowerCase())) {
            const directionChunk = {
              type: 'DIRECTION',
              tokens: [firstToken],
              text: firstToken.word,
            };
            instance.addElement('DIRECTION', directionChunk);
          }
        }
      }
    }
    
    // SUBJECT: PP with "on", "to", "toward"
    for (let i = verbChunkIndex + 1; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.type === CHUNK_TYPES.PP) {
        const prep = chunk.getPreposition();
        if (!prep) continue;
        
        const prepText = prep.normal.toLowerCase();
        
        if (['on', 'to', 'toward', 'towards', 'at'].includes(prepText)) {
          instance.addElement('SUBJECT', chunk);
          break;
        }
      }
    }
    
    // SPEED: Adverbs
    const adverbs = verbChunk.tokens.filter(t => t.tag.startsWith('RB'));
    if (adverbs.length > 0) {
      const adverbChunk = {
        type: 'ADVERB',
        tokens: adverbs,
        text: adverbs.map(a => a.word).join(' '),
      };
      instance.addElement('SPEED', adverbChunk);
    }
    
    return instance;
  }

  /**
   * Extract Frame Elements for Lighting frame
   * 
   * @param {Object} verb - Verb token
   * @param {Array<Chunk>} chunks - All chunks
   * @param {string} text - Original text
   * @returns {FrameInstance} Frame instance with FEs
   */
  extractLightingFrameElements(verb, chunks, text) {
    const instance = new FrameInstance(LightingFrame, verb.normal, verb, verb.index);
    
    // Find verb chunk
    const verbChunkIndex = chunks.findIndex(c => 
      c.type === CHUNK_TYPES.VP && 
      c.tokens.some(t => t.index === verb.index)
    );
    
    if (verbChunkIndex === -1) return instance;
    
    // SCENE: NP before verb or after verb
    // Look before first
    for (let i = verbChunkIndex - 1; i >= 0; i--) {
      if (chunks[i].type === CHUNK_TYPES.NP) {
        instance.addElement('SCENE', chunks[i]);
        break;
      }
    }
    
    // If not found before, look after
    if (!instance.hasElement('SCENE')) {
      for (let i = verbChunkIndex + 1; i < chunks.length; i++) {
        if (chunks[i].type === CHUNK_TYPES.NP) {
          instance.addElement('SCENE', chunks[i]);
          break;
        }
      }
    }
    
    // SOURCE: PP with "by", "from"
    for (let i = verbChunkIndex + 1; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (chunk.type === CHUNK_TYPES.PP) {
        const prep = chunk.getPreposition();
        if (!prep) continue;
        
        const prepText = prep.normal.toLowerCase();
        
        if (['by', 'from'].includes(prepText)) {
          instance.addElement('SOURCE', chunk);
          break;
        }
      }
    }
    
    // QUALITY: Adjectives modifying light
    // Look for adjectives in NPs that contain "light"
    for (const chunk of chunks) {
      if (chunk.type === CHUNK_TYPES.NP) {
        const hasLight = chunk.tokens.some(t => t.normal.toLowerCase() === 'light');
        if (hasLight) {
          const adjectives = chunk.tokens.filter(t => t.tag.startsWith('JJ'));
          if (adjectives.length > 0) {
            const qualityChunk = {
              type: 'ADJECTIVE',
              tokens: adjectives,
              text: adjectives.map(a => a.word).join(' '),
            };
            instance.addElement('QUALITY', qualityChunk);
          }
        }
      }
    }
    
    return instance;
  }

  /**
   * Get all available frames
   * 
   * @returns {Array<Object>} Frame objects
   */
  getFrames() {
    return this.frames;
  }

  /**
   * Get frame by name
   * 
   * @param {string} name - Frame name
   * @returns {Object|null} Frame or null
   */
  getFrame(name) {
    return this.frames.find(f => f.name === name) || null;
  }

  /**
   * Analyze frame matches for debugging
   * 
   * @param {Array<FrameInstance>} instances - Frame instances
   * @returns {Object} Analysis
   */
  analyzeFrameMatches(instances) {
    return {
      totalFrames: instances.length,
      frames: instances.map(inst => ({
        frame: inst.frameName,
        lexicalUnit: inst.lexicalUnit,
        elements: Object.keys(inst.frameElements),
        elementCount: Object.keys(inst.frameElements).length,
      })),
      byFrame: {
        Motion: instances.filter(i => i.frameName === 'Motion').length,
        Cinematography: instances.filter(i => i.frameName === 'Cinematography').length,
        Lighting: instances.filter(i => i.frameName === 'Lighting').length,
      },
    };
  }
}

export { FrameInstance };
export default FrameMatcher;

