/**
 * ContextAwareExamples
 * 
 * Generates contextually appropriate examples for output format demonstration
 * based on GRAMMATICAL part of speech, not semantic categories.
 * 
 * Key Insight: The 5-stage context system (semantic dependencies, span composition,
 * edit history, model detection, brainstorm) provides semantic intelligence.
 * Examples only need to teach GRAMMAR (noun→noun, adjective→adjective, etc).
 * 
 * Single Responsibility: Part-of-speech aware example generation for LLM prompts
 */
export class ContextAwareExamples {
  /**
   * Generate examples based on grammatical context
   * @param {string} highlightedText - The placeholder text
   * @param {string} highlightedCategory - Detected category (ignored, kept for compatibility)
   * @param {string} placeholderType - Semantic type (ignored, kept for compatibility)
   * @param {string} contextBefore - Text before the highlight (for grammatical analysis)
   * @param {string} contextAfter - Text after the highlight (for grammatical analysis)
   * @param {Object} videoConstraints - Video constraints with minWords/maxWords
   * @returns {Array} Array of 3 example suggestions
   */
  static generateExamples(highlightedText, highlightedCategory, placeholderType, contextBefore = '', contextAfter = '', videoConstraints = null) {
    // Handle null/undefined inputs
    const text = highlightedText || '';

    // Detect required word count
    const wordCount = this._detectRequiredWordCount(text, contextAfter, videoConstraints);

    // Detect part of speech from grammatical context
    const partOfSpeech = this._detectPartOfSpeech(text, contextBefore, contextAfter);

    // Get generator based on part of speech
    const generator = this._getGeneratorForPartOfSpeech(partOfSpeech);
    
    return generator(wordCount);
  }

  /**
   * Detect required word count for examples
   * @private
   */
  static _detectRequiredWordCount(highlightedText, contextAfter, videoConstraints) {
    // Priority 1: Use videoConstraints if available and specific
    if (videoConstraints?.minWords && videoConstraints?.maxWords) {
      if (videoConstraints.minWords === videoConstraints.maxWords) {
        return videoConstraints.minWords;
      }
      // Use average for range
      return Math.floor((videoConstraints.minWords + videoConstraints.maxWords) / 2);
    }
    
    // Priority 2: Count words in highlighted text
    const wordCount = highlightedText.trim().split(/\s+/).filter(w => w.length > 0).length;
    
    // Priority 3: Analyze grammatical context for single-word adjectives/verbs
    // If contextAfter starts with article + noun, this is likely single-word slot
    if (contextAfter && wordCount === 1) {
      const afterTrimmed = contextAfter.trim();
      const startsWithArticleNoun = /^(a|an|the)\s+\w+/i.test(afterTrimmed);
      if (startsWithArticleNoun) {
        return 1; // Single word slot (adjective or verb)
      }
    }
    
    return wordCount;
  }

  /**
   * Detect part of speech from grammatical context (UNIVERSAL)
   * @returns {string} 'noun' | 'adjective' | 'verb' | 'adverb' | 'unknown'
   * @private
   */
  static _detectPartOfSpeech(highlightedText, contextBefore, contextAfter) {
    const text = highlightedText.trim().toLowerCase();
    const before = (contextBefore || '').trim().toLowerCase();
    const after = (contextAfter || '').trim().toLowerCase();
    
    const isSingleWord = !text.includes(' ');
    
    // VERB detection (gerunds with article after) - Check this FIRST
    // "gripping a paintbrush" = verb
    if (text.endsWith('ing') && /^\s*(a|an|the)\s/i.test(after)) {
      return 'verb';
    }
    
    // NOUN detection (after possessive or determiners) - Check BEFORE adjectives
    // "painter's hands" = noun
    if (before.match(/(painter's|artist's|person's|their|his|her|its|my|your|our)\s*$/i)) {
      return 'noun';
    }
    // "the canvas" - noun after article without noun after
    // Only if there's no common noun word after (which would make it an adjective)
    if (before.match(/\s*(the|these|those)$/i) && !after.match(/^\s*(painter|artist|person|man|woman|child|hand|hands|face|eyes|brush|canvas|painting|scene|light|room|studio|space|area|place|moment|time|style|way|feel|mood)/i)) {
      return 'noun';
    }
    // Single word with verb after = likely noun subject
    // "hands gripping" = noun
    if (isSingleWord && after.match(/^\s+\w+ing\b/)) {
      return 'noun';
    }
    
    // ADJECTIVE detection (before nouns or after articles)
    // "a [adjective] painter" = adjective slot
    if (before.match(/\s*(a|an|the|some|many|few|several|this|that|these|those)$/i) && 
        after.match(/^\s*(painter|artist|person|man|woman|child|hand|hands|face|eyes|brush|canvas|painting|scene|light|room|studio|space|area|place|moment|time|style|way|feel|mood|breeze|wind|atmosphere)/i)) {
      return 'adjective';
    }
    // "[adjective] painter" = adjective before common nouns (no article before)
    if (!before.match(/\s*(the|a|an)$/i) && 
        after.match(/^\s*(painter|artist|person|man|woman|child|hand|hands|face|eyes|brush|canvas|painting|scene|light|room|studio|space|area|place|moment|time|style|way|feel|mood|breeze|wind|atmosphere)/i)) {
      return 'adjective';
    }
    
    // ADVERB detection (before verbs or adjectives)
    // "was [adverb] painting" = adverb - but only if not followed by a noun
    if (before.match(/\b(is|was|were|are|being|been|am|be)\s*$/i) && !after.match(/^\s*(painter|artist|person|painting)/i)) {
      return 'adverb';
    }
    // "very [adverb]" or "[adverb] beautiful" patterns
    if (before.match(/\b(very|quite|extremely|really|so|too|more|most)\s*$/i)) {
      return 'adverb';
    }
    
    // Default for single words without clear context = noun
    // (Most standalone words in prompts are nouns)
    if (isSingleWord) {
      return 'noun';
    }
    
    return 'unknown';
  }

  /**
   * Select generator based on part of speech (UNIVERSAL)
   * @private
   */
  static _getGeneratorForPartOfSpeech(partOfSpeech) {
    switch (partOfSpeech) {
      case 'noun':
        return (wc) => this._generateNounExamples(wc);
      case 'adjective':
        return (wc) => this._generateAdjectiveExamples(wc);
      case 'verb':
        return (wc) => this._generateVerbExamples(wc);
      case 'adverb':
        return (wc) => this._generateAdverbExamples(wc);
      default:
        return (wc) => this._generateGenericExamples(wc);
    }
  }

  // ============================================
  // Universal Generators (Based on Part of Speech)
  // ============================================

  /**
   * Generate noun replacement examples (UNIVERSAL)
   * Examples are intentionally generic - semantic intelligence comes from context system
   * @private
   */
  static _generateNounExamples(wordCount = 1) {
    if (wordCount === 1) {
      // Single noun
      return [
        {
          text: "element",
          category: "Noun Alternatives",
          explanation: "Different noun option"
        },
        {
          text: "aspect",
          category: "Noun Alternatives",
          explanation: "Another noun choice"
        },
        {
          text: "feature",
          category: "Noun Alternatives",
          explanation: "Alternative noun"
        }
      ];
    } else if (wordCount <= 3) {
      // Short noun phrase
      return [
        {
          text: "specific element detail",
          category: "Noun Phrases",
          explanation: "Multi-word noun replacement"
        },
        {
          text: "alternative aspect feature",
          category: "Noun Phrases",
          explanation: "Another noun phrase option"
        },
        {
          text: "different compositional element",
          category: "Noun Phrases",
          explanation: "Alternative noun phrase"
        }
      ];
    } else {
      // Longer noun phrase
      return [
        {
          text: "detailed compositional element with specific characteristics",
          category: "Extended Noun Phrases",
          explanation: "Comprehensive noun phrase"
        },
        {
          text: "alternative structural aspect featuring distinct qualities",
          category: "Extended Noun Phrases",
          explanation: "Another extended noun phrase"
        },
        {
          text: "varied thematic element showcasing unique attributes",
          category: "Extended Noun Phrases",
          explanation: "Different extended noun phrase"
        }
      ];
    }
  }

  /**
   * Generate adjective examples (UNIVERSAL)
   * @private
   */
  static _generateAdjectiveExamples(wordCount = 1) {
    if (wordCount === 1) {
      // Single adjective
      return [
        {
          text: "distinctive",
          category: "Single Adjectives",
          explanation: "Quality descriptor"
        },
        {
          text: "remarkable",
          category: "Single Adjectives",
          explanation: "Different quality"
        },
        {
          text: "notable",
          category: "Single Adjectives",
          explanation: "Another descriptor"
        }
      ];
    } else if (wordCount <= 3) {
      // Short adjective phrase
      return [
        {
          text: "visually striking",
          category: "Adjective Phrases",
          explanation: "Multi-word description"
        },
        {
          text: "particularly distinctive",
          category: "Adjective Phrases",
          explanation: "Different description"
        },
        {
          text: "notably characteristic",
          category: "Adjective Phrases",
          explanation: "Another descriptive phrase"
        }
      ];
    } else {
      // Longer adjective phrase
      return [
        {
          text: "distinctively characterized by visual qualities",
          category: "Extended Adjective Phrases",
          explanation: "Comprehensive descriptive phrase"
        },
        {
          text: "remarkably defined through specific attributes",
          category: "Extended Adjective Phrases",
          explanation: "Another extended description"
        },
        {
          text: "notably distinguished by particular features",
          category: "Extended Adjective Phrases",
          explanation: "Different extended descriptive phrase"
        }
      ];
    }
  }

  /**
   * Generate verb examples (UNIVERSAL)
   * @private
   */
  static _generateVerbExamples(wordCount = 1) {
    if (wordCount === 1) {
      // Single verb (gerund form for consistency)
      return [
        {
          text: "engaging",
          category: "Single Verbs",
          explanation: "Action alternative"
        },
        {
          text: "interacting",
          category: "Single Verbs",
          explanation: "Movement verb"
        },
        {
          text: "working",
          category: "Single Verbs",
          explanation: "Different action"
        }
      ];
    } else if (wordCount <= 3) {
      // Short verb phrase
      return [
        {
          text: "actively engaging with",
          category: "Verb Phrases",
          explanation: "Multi-word action"
        },
        {
          text: "carefully interacting with",
          category: "Verb Phrases",
          explanation: "Alternative action"
        },
        {
          text: "thoughtfully working with",
          category: "Verb Phrases",
          explanation: "Another action phrase"
        }
      ];
    } else {
      // Longer verb phrase
      return [
        {
          text: "actively engaging with the subject in a deliberate manner",
          category: "Extended Verb Phrases",
          explanation: "Comprehensive action phrase"
        },
        {
          text: "carefully interacting through specific techniques and methods",
          category: "Extended Verb Phrases",
          explanation: "Another extended action"
        },
        {
          text: "thoughtfully working within the context of the scene",
          category: "Extended Verb Phrases",
          explanation: "Different extended action phrase"
        }
      ];
    }
  }

  /**
   * Generate adverb examples (UNIVERSAL)
   * @private
   */
  static _generateAdverbExamples(wordCount = 1) {
    if (wordCount === 1) {
      return [
        {
          text: "deliberately",
          category: "Manner Adverbs",
          explanation: "How the action is done"
        },
        {
          text: "carefully",
          category: "Manner Adverbs",
          explanation: "Different manner"
        },
        {
          text: "thoughtfully",
          category: "Manner Adverbs",
          explanation: "Alternative manner"
        }
      ];
    } else {
      // Multi-word adverbs are rare, but support them
      return [
        {
          text: "with great care",
          category: "Adverbial Phrases",
          explanation: "Multi-word manner expression"
        },
        {
          text: "in a deliberate way",
          category: "Adverbial Phrases",
          explanation: "Alternative manner phrase"
        },
        {
          text: "through careful attention",
          category: "Adverbial Phrases",
          explanation: "Another manner phrase"
        }
      ];
    }
  }

  /**
   * Generate generic examples for unknown contexts (UNIVERSAL)
   * @private
   */
  static _generateGenericExamples(wordCount = 1) {
    if (wordCount === 1) {
      // Single word
      return [
        {
          text: "alternative",
          category: "Generic Options",
          explanation: "Primary option"
        },
        {
          text: "variant",
          category: "Generic Options",
          explanation: "Different choice"
        },
        {
          text: "option",
          category: "Generic Options",
          explanation: "Another possibility"
        }
      ];
    } else if (wordCount <= 3) {
      // Short phrase
      return [
        {
          text: "alternative option",
          category: "Generic Phrases",
          explanation: "Multi-word alternative"
        },
        {
          text: "different variant",
          category: "Generic Phrases",
          explanation: "Another phrase option"
        },
        {
          text: "varied choice",
          category: "Generic Phrases",
          explanation: "Different phrase"
        }
      ];
    } else {
      // Longer phrase
      return [
        {
          text: "alternative option with specific characteristics",
          category: "Extended Generic Phrases",
          explanation: "Comprehensive alternative"
        },
        {
          text: "different variant featuring distinct qualities",
          category: "Extended Generic Phrases",
          explanation: "Another extended option"
        },
        {
          text: "varied choice showcasing unique attributes",
          category: "Extended Generic Phrases",
          explanation: "Different extended phrase"
        }
      ];
    }
  }
}
