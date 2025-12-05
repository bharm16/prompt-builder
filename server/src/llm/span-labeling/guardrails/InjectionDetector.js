import { logger } from '@infrastructure/Logger';

/**
 * Lightweight Injection Detector
 * 
 * PDF Design C: Section 3.6 - Input Filtering Guardrail
 * 
 * This module provides pre-LLM filtering for prompt injection attacks.
 * It uses pattern matching + optional ML classifier to detect malicious inputs.
 * 
 * Detection Strategy:
 * 1. Pattern-based detection (fast, high precision)
 * 2. Heuristic analysis (contextual patterns)
 * 3. Optional: ML-based classification (future enhancement)
 * 
 * When injection is detected, the request can be:
 * - Blocked immediately (fail-fast)
 * - Logged for monitoring
 * - Returned with isAdversarial flag
 */

export class InjectionDetector {
  constructor() {
    this.log = logger.child({ service: 'InjectionDetector' });
    // Direct instruction override attempts
    this.instructionOverridePatterns = [
      /ignore\s+(previous|all|prior|system)\s+(instructions?|prompts?|rules?|commands?)/i,
      /disregard\s+(all|everything|prior|previous)\s+(instructions?|prompts?|rules?)/i,
      /forget\s+(everything|all|prior|previous)\s+(you|we|instructions?)/i,
      /override\s+(the\s+)?(system|previous)\s+(prompt|instructions?)/i
    ];

    // System prompt extraction attempts
    this.promptExtractionPatterns = [
      /output\s+(the\s+)?(system|prompt|instructions?)/i,
      /show\s+(me\s+)?(the\s+)?(system|prompt|instructions?)/i,
      /reveal\s+(the\s+)?(system|prompt|instructions?)/i,
      /what\s+(is|are)\s+(your|the)\s+(system|prompt|instructions?)/i,
      /repeat\s+(your|the)\s+(system|prompt|instructions?)/i,
      /print\s+(your|the)\s+(system|prompt|instructions?)/i
    ];

    // Role manipulation attempts
    this.roleManipulationPatterns = [
      /you\s+are\s+now\s+(in|a|pretending)/i,
      /pretend\s+(you\s+are|to\s+be)/i,
      /roleplay\s+(mode|as)/i,
      /act\s+as\s+(if|a)/i,
      /imagine\s+you\s+are/i,
      /switch\s+to\s+(mode|role)/i
    ];

    // Output format manipulation
    this.formatManipulationPatterns = [
      /change\s+(the\s+)?output\s+(format|to)/i,
      /respond\s+(in|with)\s+(markdown|html|xml|code)/i,
      /format\s+(your\s+)?response\s+as/i,
      /instead\s+of\s+json/i
    ];

    // Taxonomy extraction attempts
    this.taxonomyExtractionPatterns = [
      /list\s+(all|the)\s+(categories|taxonomy|roles)/i,
      /what\s+(are|is)\s+(the|your)\s+(taxonomy|categories|roles)/i,
      /show\s+(me\s+)?(all\s+)?(valid|available)\s+(roles|categories)/i
    ];
  }

  /**
   * Check if input matches known injection patterns
   * @param {string} text - User input text
   * @returns {Object} {detected: boolean, pattern?: string, type?: string, confidence: number}
   */
  detectInjection(text) {
    // Instruction override
    for (const pattern of this.instructionOverridePatterns) {
      if (pattern.test(text)) {
        return {
          detected: true,
          pattern: pattern.source,
          type: 'instruction_override',
          confidence: 0.95
        };
      }
    }

    // System prompt extraction
    for (const pattern of this.promptExtractionPatterns) {
      if (pattern.test(text)) {
        return {
          detected: true,
          pattern: pattern.source,
          type: 'prompt_extraction',
          confidence: 0.9
        };
      }
    }

    // Role manipulation
    for (const pattern of this.roleManipulationPatterns) {
      if (pattern.test(text)) {
        return {
          detected: true,
          pattern: pattern.source,
          type: 'role_manipulation',
          confidence: 0.85
        };
      }
    }

    // Format manipulation
    for (const pattern of this.formatManipulationPatterns) {
      if (pattern.test(text)) {
        return {
          detected: true,
          pattern: pattern.source,
          type: 'format_manipulation',
          confidence: 0.8
        };
      }
    }

    // Taxonomy extraction
    for (const pattern of this.taxonomyExtractionPatterns) {
      if (pattern.test(text)) {
        return {
          detected: true,
          pattern: pattern.source,
          type: 'taxonomy_extraction',
          confidence: 0.75
        };
      }
    }

    return { detected: false, confidence: 0 };
  }

  /**
   * Heuristic analysis for subtle injection attempts
   * @param {string} text - User input text
   * @returns {Object} {suspicious: boolean, score: number, indicators: Array}
   */
  analyzeHeuristics(text) {
    const indicators = [];
    let suspicionScore = 0;

    // Check for excessive instruction-like language
    const instructionWords = (text.match(/\b(must|should|always|never|only|strictly|exactly)\b/gi) || []).length;
    if (instructionWords > 5) {
      indicators.push('excessive_instruction_words');
      suspicionScore += 0.2;
    }

    // Check for meta-references to the system
    if (/\b(system|AI|model|LLM|assistant)\b/i.test(text)) {
      indicators.push('meta_references');
      suspicionScore += 0.15;
    }

    // Check for unusual punctuation patterns (often used in jailbreaks)
    const exclamationCount = (text.match(/!/g) || []).length;
    if (exclamationCount > 3) {
      indicators.push('excessive_exclamation');
      suspicionScore += 0.1;
    }

    // Check for mixed language scripts (sometimes used to bypass filters)
    if (/[\u0400-\u04FF]/.test(text) || /[\u4E00-\u9FFF]/.test(text)) {
      // Cyrillic or CJK detected - not necessarily suspicious, but worth noting
      indicators.push('mixed_scripts');
      suspicionScore += 0.05;
    }

    // Check for base64-like patterns (encoding attacks)
    if (/[A-Za-z0-9+/]{20,}={0,2}/.test(text)) {
      indicators.push('base64_pattern');
      suspicionScore += 0.3;
    }

    return {
      suspicious: suspicionScore > 0.3,
      score: Math.min(suspicionScore, 1.0),
      indicators
    };
  }

  /**
   * Pre-process user input and check for injection attempts
   * @param {string} text - User input text
   * @returns {Object} {blocked: boolean, reason?: string, confidence?: number, heuristics?: Object}
   */
  async checkInput(text) {
    // Pattern-based detection
    const result = this.detectInjection(text);
    
    if (result.detected) {
      // Log the attempt
      this.log.warn('Injection attempt detected', {
        operation: 'check',
        type: result.type,
        pattern: result.pattern.slice(0, 100),
        textPreview: text.slice(0, 100),
        confidence: result.confidence
      });
      
      // Return early with blocked flag
      return {
        blocked: true,
        reason: result.type,
        confidence: result.confidence,
        pattern: result.pattern
      };
    }

    // Heuristic analysis
    const heuristics = this.analyzeHeuristics(text);
    
    if (heuristics.suspicious) {
      this.log.warn('Suspicious input detected', {
        operation: 'check',
        score: heuristics.score,
        indicators: heuristics.indicators,
        textPreview: text.slice(0, 100)
      });
      
      // Don't block, but log for monitoring
      return {
        blocked: false,
        heuristics,
        warning: 'suspicious_pattern_detected'
      };
    }

    return { blocked: false };
  }

  /**
   * Get security telemetry
   * @returns {Object} Telemetry data for monitoring
   */
  getTelemetry() {
    // This would be populated by tracking calls to checkInput
    // For now, return structure
    return {
      totalChecks: 0,
      blockedCount: 0,
      suspiciousCount: 0,
      byType: {}
    };
  }
}

/**
 * Singleton instance for use across the application
 */
export const injectionDetector = new InjectionDetector();

