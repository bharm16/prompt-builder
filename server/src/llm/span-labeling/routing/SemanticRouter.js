/**
 * Semantic Router - Classifies input and injects context-aware examples
 * 
 * PDF Design B: Role-Aware Semantic Router
 * 
 * This router analyzes user input for characteristics like:
 * - Technical terminology (Director's Lexicon)
 * - Ambiguous terms that need disambiguation
 * - Context-specific patterns
 * - Domain-specific language (academic, creative, conversational)
 * 
 * Based on these characteristics, it injects targeted few-shot examples
 * to improve model accuracy on complex inputs.
 * 
 * ENHANCED: Now uses domain-specific example banks and intelligent ranking
 * for 20-30% accuracy improvement (per PDF recommendation).
 */

import { ExampleRanker } from './ExampleRanker.js';
import { technicalExamples } from './examples/technical.js';
import { academicExamples } from './examples/academic.js';
import { creativeExamples } from './examples/creative.js';
import { conversationalExamples } from './examples/conversational.js';

export class SemanticRouter {
  constructor() {
    // Technical cinematography terms from Director's Lexicon
    this.technicalTerms = /\b(pan|pans|panning|tilt|tilts|tilting|dolly|dollies|dollying|truck|trucks|trucking|crane|cranes|craning|zoom|zooms|zooming|rack\s+focus|tracking\s+shot|35mm|16mm|super\s+8|anamorphic|bokeh|chiaroscuro|rembrandt|golden\s+hour|high\s+key|low\s+key|practical\s+light|kodak|fuji|velvia|portra|vision)\b/i;
    
    // Ambiguous terms that require extra disambiguation
    this.ambiguousTerms = /\b(pan|pans|light|lights|shot|shots|move|moves|frame|frames|focus|focuses)\b/i;
    
    // Camera-related context
    this.cameraContext = /\b(camera|lens|focal|aperture|shutter|exposure)\b/i;
    
    // Initialize example ranker and banks
    this.ranker = new ExampleRanker();
    this.exampleBanks = {
      technical: technicalExamples,
      academic: academicExamples,
      creative: creativeExamples,
      conversational: conversationalExamples,
    };
    
    // Combine all examples for comprehensive ranking
    this.allExamples = [
      ...technicalExamples,
      ...academicExamples,
      ...creativeExamples,
      ...conversationalExamples,
    ];
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
   * ENHANCED: Now uses intelligent ranking across all example banks
   * 
   * @param {string} text - User input text
   * @param {number} maxExamples - Maximum examples to return (default: 4)
   * @returns {Array} Array of example objects with input/output pairs
   */
  getFewShotExamples(text, maxExamples = 4) {
    if (!text) {
      return [];
    }

    // Use intelligent ranking to select best examples from all banks
    const rankedExamples = this.ranker.rankExamples(text, this.allExamples, maxExamples);
    
    // Extract just the example objects (remove ranking metadata)
    return rankedExamples.map(ranked => ranked.example);
  }

  /**
   * Get examples from a specific domain bank
   * Useful for targeted example selection when domain is known
   * 
   * @param {string} domain - Domain name ('technical', 'academic', 'creative', 'conversational')
   * @param {string} text - User input text for ranking
   * @param {number} maxExamples - Maximum examples to return
   * @returns {Array} Ranked examples from specified domain
   */
  getExamplesByDomain(domain, text, maxExamples = 4) {
    const bank = this.exampleBanks[domain];
    if (!bank) {
      return [];
    }

    const rankedExamples = this.ranker.rankExamples(text, bank, maxExamples);
    return rankedExamples.map(ranked => ranked.example);
  }

  /**
   * Select best examples using intelligent ranking
   * Replaces the hardcoded example logic with PDF-recommended approach
   * 
   * @param {string} text - User input text
   * @param {number} maxExamples - Maximum examples to return
   * @returns {Array} Top-ranked examples
   */
  selectBestExamples(text, maxExamples = 4) {
    return this.getFewShotExamples(text, maxExamples);
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

