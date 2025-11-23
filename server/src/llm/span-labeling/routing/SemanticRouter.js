/**
 * Semantic Router - Classifies input and injects context-aware examples
 * 
 * PDF Design B: Role-Aware Semantic Router
 * 
 * This router analyzes user input for characteristics like:
 * - Technical terminology (Director's Lexicon)
 * - Ambiguous terms that need disambiguation
 * - Context-specific patterns
 * 
 * Based on these characteristics, it injects targeted few-shot examples
 * to improve model accuracy on complex inputs.
 */

export class SemanticRouter {
  constructor() {
    // Technical cinematography terms from Director's Lexicon
    this.technicalTerms = /\b(pan|pans|panning|tilt|tilts|tilting|dolly|dollies|dollying|truck|trucks|trucking|crane|cranes|craning|zoom|zooms|zooming|rack\s+focus|tracking\s+shot|35mm|16mm|super\s+8|anamorphic|bokeh|chiaroscuro|rembrandt|golden\s+hour|high\s+key|low\s+key|practical\s+light|kodak|fuji|velvia|portra|vision)\b/i;
    
    // Ambiguous terms that require extra disambiguation
    this.ambiguousTerms = /\b(pan|pans|light|lights|shot|shots|move|moves|frame|frames|focus|focuses)\b/i;
    
    // Camera-related context
    this.cameraContext = /\b(camera|lens|focal|aperture|shutter|exposure)\b/i;
  }

  /**
   * Detect if input is technical (contains Director's Lexicon terms)
   * @param {string} text - User input text
   * @returns {boolean} True if technical terminology detected
   */
  isTechnical(text) {
    return this.technicalTerms.test(text);
  }

  /**
   * Detect if input has ambiguous terms requiring extra disambiguation
   * @param {string} text - User input text
   * @returns {boolean} True if ambiguous terms detected
   */
  hasAmbiguity(text) {
    return this.ambiguousTerms.test(text);
  }

  /**
   * Detect if input is camera-heavy (likely needs camera/action disambiguation)
   * @param {string} text - User input text
   * @returns {boolean} True if camera context detected
   */
  hasCameraContext(text) {
    return this.cameraContext.test(text);
  }

  /**
   * Get specialized few-shot examples based on input characteristics
   * @param {string} text - User input text
   * @returns {Array} Array of example objects with input/output pairs
   */
  getFewShotExamples(text) {
    const examples = [];

    // Example 1: Technical camera movement with subject action (for technical inputs)
    if (this.isTechnical(text) || this.hasCameraContext(text)) {
      examples.push({
        input: "The camera dollies back as the astronaut floats weightlessly through the ISS corridor",
        output: {
          spans: [
            { text: "camera dollies back", role: "camera.movement", confidence: 0.95 },
            { text: "astronaut", role: "subject.identity", confidence: 0.9 },
            { text: "floats weightlessly", role: "action.movement", confidence: 0.9 },
            { text: "ISS corridor", role: "environment.location", confidence: 0.85 }
          ],
          meta: {
            version: "v3.0",
            notes: "Disambiguated camera movement from subject action"
          }
        }
      });
    }

    // Example 2: Ambiguous "pan" term (for ambiguous inputs)
    if (this.hasAmbiguity(text)) {
      examples.push({
        input: "Chef pans the vegetables in a hot pan while the camera pans left",
        output: {
          spans: [
            { text: "Chef", role: "subject.identity", confidence: 0.95 },
            { text: "pans the vegetables", role: "action.movement", confidence: 0.9 },
            { text: "hot pan", role: "environment.context", confidence: 0.85 },
            { text: "camera pans left", role: "camera.movement", confidence: 0.95 }
          ],
          meta: {
            version: "v3.0",
            notes: "Disambiguated 'pan' based on agent (Chef vs Camera)"
          }
        }
      });
    }

    // Example 3: Film stock and lighting terminology
    if (this.isTechnical(text) && /\b(35mm|16mm|kodak|fuji|golden\s+hour|chiaroscuro)\b/i.test(text)) {
      examples.push({
        input: "35mm anamorphic lens, golden hour lighting creating chiaroscuro shadows",
        output: {
          spans: [
            { text: "35mm anamorphic", role: "style.filmStock", confidence: 0.95 },
            { text: "golden hour", role: "lighting.timeOfDay", confidence: 0.95 },
            { text: "chiaroscuro shadows", role: "lighting.quality", confidence: 0.9 }
          ],
          meta: {
            version: "v3.0",
            notes: "Applied Director's Lexicon: 35mm→filmStock, golden hour→timeOfDay"
          }
        }
      });
    }

    // Example 4: Shot type vs camera movement
    if (/\b(close-up|closeup|wide\s+shot|medium\s+shot|zoom)\b/i.test(text)) {
      examples.push({
        input: "Close-up on her face as the camera zooms out to reveal the room",
        output: {
          spans: [
            { text: "Close-up", role: "shot.type", confidence: 0.95 },
            { text: "her face", role: "subject.appearance", confidence: 0.9 },
            { text: "camera zooms out", role: "camera.movement", confidence: 0.95 },
            { text: "the room", role: "environment.location", confidence: 0.85 }
          ],
          meta: {
            version: "v3.0",
            notes: "Shot type (close-up) is static framing, zoom is camera movement"
          }
        }
      });
    }

    return examples;
  }

  /**
   * Generate routing metadata for telemetry/logging
   * @param {string} text - User input text
   * @returns {Object} Routing decision metadata
   */
  getRoutingMetadata(text) {
    return {
      isTechnical: this.isTechnical(text),
      hasAmbiguity: this.hasAmbiguity(text),
      hasCameraContext: this.hasCameraContext(text),
      exampleCount: this.getFewShotExamples(text).length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format few-shot examples for injection into system prompt
   * @param {string} text - User input text
   * @returns {string} Formatted examples as markdown text
   */
  formatExamplesForPrompt(text) {
    const examples = this.getFewShotExamples(text);
    
    if (examples.length === 0) {
      return '';
    }

    let formatted = '\n\n## Few-Shot Examples (Context-Specific)\n\n';
    formatted += 'Based on your input characteristics, here are relevant examples:\n\n';

    examples.forEach((example, index) => {
      formatted += `**Example ${index + 1}:**\n`;
      formatted += `Input: "${example.input}"\n\n`;
      formatted += 'Output:\n```json\n';
      formatted += JSON.stringify(example.output, null, 2);
      formatted += '\n```\n\n';
    });

    return formatted;
  }
}

/**
 * Singleton instance for use across the application
 */
export const semanticRouter = new SemanticRouter();

