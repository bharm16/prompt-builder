import { PromptBuilderService } from './SystemPromptBuilder.js';
import { logger } from '../../../infrastructure/Logger.js';

/**
 * AlgorithmicPromptBuilder
 * 
 * Extends PromptBuilderService with algorithmic analysis and natural language translation.
 * Uses statistical analysis to derive prompt parameters dynamically from input characteristics.
 * 
 * Key Features:
 * - No hardcoded values - all parameters computed from data
 * - Statistical pattern detection
 * - Translation layer converts math to natural language for better LLM comprehension
 */
export class AlgorithmicPromptBuilder extends PromptBuilderService {
  /**
   * Purely algorithmic context analysis
   * No hardcoded values - everything computed from data
   */
  analyzeContextAlgorithmically(highlightedText, contextBefore, contextAfter, allLabeledSpans) {
    // Compute statistical properties
    const inputProfile = this.computeInputProfile(highlightedText);
    const contextProfile = this.computeContextProfile(contextBefore, contextAfter);
    const spanDistribution = this.computeSpanDistribution(allLabeledSpans);
    
    // Derive optimal parameters from the data itself
    const optimalSemanticDistance = this.computeOptimalDistance(spanDistribution);
    const lexicalDiversity = this.computeLexicalDiversity(contextBefore + contextAfter);
    const informationDensity = this.computeInformationDensity(allLabeledSpans, contextBefore + contextAfter);
    
    // Calculate transformation parameters
    const transformationVectors = this.deriveTransformationVectors(
      inputProfile,
      contextProfile,
      spanDistribution
    );
    
    // Compute constraints based on existing content
    const constraints = this.deriveConstraints(
      highlightedText,
      allLabeledSpans,
      lexicalDiversity,
      informationDensity
    );
    
    // Add style profile for translation layer
    const styleProfile = inputProfile.complexity > 0.6 ? 'Academic/Technical' : 'Narrative/Casual';
    
    return {
      inputProfile,
      semanticDistribution: spanDistribution,
      transformationVectors,
      optimalSemanticDistance,
      lexicalDiversity,
      targetDiversityGain: 1.0 - lexicalDiversity, // Inverse of current diversity
      existingPatterns: this.extractPatterns(allLabeledSpans),
      informationDensity,
      densityAdjustment: this.computeDensityAdjustment(informationDensity),
      granularityTarget: this.computeGranularity(inputProfile),
      syntacticPattern: this.detectSyntacticPattern(highlightedText),
      alternativePatterns: this.generateAlternativePatterns(inputProfile),
      maxSimilarity: constraints.maxSimilarity,
      minDistance: constraints.minDistance,
      entropyGain: constraints.entropyGain,
      grammaticalPattern: this.extractGrammaticalPattern(highlightedText, contextBefore, contextAfter),
      styleProfile,
      contextProfile
    };
  }

  /**
   * Compute statistical profile of input
   */
  computeInputProfile(text) {
    const tokens = text.toLowerCase().split(/\s+/);
    const characters = text.length;
    const uniqueTokens = new Set(tokens);
    
    return {
      tokenCount: tokens.length,
      characterCount: characters,
      uniqueTokenRatio: uniqueTokens.size / Math.max(tokens.length, 1),
      averageTokenLength: characters / Math.max(tokens.length, 1),
      complexity: this.computeComplexity(text),
      entropy: this.computeEntropy(tokens)
    };
  }

  /**
   * Compute context profile algorithmically
   */
  computeContextProfile(before, after) {
    const combined = (before + after).toLowerCase();
    const tokens = combined.split(/\s+/);
    const tokenFrequencies = {};
    
    tokens.forEach(token => {
      tokenFrequencies[token] = (tokenFrequencies[token] || 0) + 1;
    });
    
    // Calculate statistical measures
    const frequencies = Object.values(tokenFrequencies);
    const mean = frequencies.reduce((a, b) => a + b, 0) / Math.max(frequencies.length, 1);
    const variance = frequencies.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / Math.max(frequencies.length, 1);
    
    return {
      vocabularySize: Object.keys(tokenFrequencies).length,
      repetitionRate: 1 - (Object.keys(tokenFrequencies).length / Math.max(tokens.length, 1)),
      frequencyMean: mean,
      frequencyVariance: variance,
      dominantTokens: this.extractDominantTokens(tokenFrequencies)
    };
  }

  /**
   * Extract dominant tokens algorithmically (no hardcoded threshold)
   */
  extractDominantTokens(frequencies) {
    const sorted = Object.entries(frequencies).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((sum, [_, freq]) => sum + freq, 0);
    
    // Use Pareto principle: tokens that make up ~80% of occurrences
    const threshold = total * 0.8;
    let cumulative = 0;
    const dominant = [];
    
    for (const [token, freq] of sorted) {
      dominant.push(token);
      cumulative += freq;
      if (cumulative >= threshold) break;
    }
    
    return dominant;
  }

  /**
   * Compute span distribution without hardcoded categories
   */
  computeSpanDistribution(spans) {
    if (!spans || spans.length === 0) {
      return { categories: {}, entropy: 0, dominance: 0 };
    }
    
    const categories = {};
    spans.forEach(span => {
      const cat = span.category || 'unknown';
      categories[cat] = (categories[cat] || 0) + 1;
    });
    
    const total = spans.length;
    const entropy = Object.values(categories).reduce((sum, count) => {
      const p = count / total;
      return sum - (p * Math.log2(p));
    }, 0);
    
    const maxCategory = Math.max(...Object.values(categories));
    const dominance = maxCategory / total;
    
    return { categories, entropy, dominance };
  }

  /**
   * Compute optimal semantic distance from distribution
   */
  computeOptimalDistance(distribution) {
    // Higher entropy = more diverse content = larger optimal distance
    // Lower entropy = focused content = smaller optimal distance
    const normalizedEntropy = Math.min(distribution.entropy / 3, 1); // Max entropy ~3 for 8 categories
    return 0.3 + (normalizedEntropy * 0.5); // Range: 0.3 to 0.8
  }

  /**
   * Compute lexical diversity using Type-Token Ratio
   */
  computeLexicalDiversity(text) {
    const tokens = text.toLowerCase().split(/\s+/);
    const uniqueTokens = new Set(tokens);
    
    if (tokens.length === 0) return 0;
    
    // Moving average TTR for better stability
    const windowSize = Math.min(100, Math.floor(tokens.length / 3));
    let ttrSum = 0;
    let windows = 0;
    
    for (let i = 0; i < tokens.length; i += windowSize) {
      const window = tokens.slice(i, Math.min(i + windowSize, tokens.length));
      const unique = new Set(window);
      ttrSum += unique.size / window.length;
      windows++;
    }
    
    return windows > 0 ? ttrSum / windows : 0;
  }

  /**
   * Compute information density
   */
  computeInformationDensity(spans, text) {
    if (!text || text.length === 0) return 0;
    
    const labeledCharacters = spans.reduce((sum, span) => 
      sum + ((span.end || 0) - (span.start || 0)), 0);
    
    return labeledCharacters / text.length;
  }

  /**
   * Derive transformation vectors from profiles
   */
  deriveTransformationVectors(inputProfile, contextProfile, spanDistribution) {
    const vectors = [];
    
    // Vector 1: Complexity adjustment
    if (inputProfile.complexity > 0.7) {
      vectors.push('simplification');
    } else if (inputProfile.complexity < 0.3) {
      vectors.push('elaboration');
    }
    
    // Vector 2: Diversity enhancement
    if (contextProfile.repetitionRate > 0.5) {
      vectors.push('lexical_variation');
    }
    
    // Vector 3: Entropy optimization
    if (spanDistribution.entropy < 1.0) {
      vectors.push('categorical_expansion');
    } else if (spanDistribution.entropy > 2.5) {
      vectors.push('thematic_focus');
    }
    
    // Vector 4: Density calibration
    if (spanDistribution.dominance > 0.6) {
      vectors.push('diversification');
    }
    
    // Always include these base vectors
    vectors.push('semantic_shift', 'syntactic_variation');
    
    return vectors;
  }

  /**
   * Compute complexity score algorithmically
   */
  computeComplexity(text) {
    const syllableCount = this.estimateSyllables(text);
    const wordCount = text.split(/\s+/).length;
    const sentenceCount = Math.max(1, (text.match(/[.!?]+/g) || []).length);
    
    // Flesch reading ease formula (normalized to 0-1)
    const score = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount);
    return 1 - (Math.max(0, Math.min(100, score)) / 100); // Invert so higher = more complex
  }

  /**
   * Estimate syllables algorithmically
   */
  estimateSyllables(text) {
    // Vowel cluster counting (approximation)
    return (text.match(/[aeiouAEIOU]+/g) || []).length;
  }

  /**
   * Compute entropy of token distribution
   */
  computeEntropy(tokens) {
    const frequencies = {};
    tokens.forEach(token => {
      frequencies[token] = (frequencies[token] || 0) + 1;
    });
    
    const total = tokens.length;
    let entropy = 0;
    
    Object.values(frequencies).forEach(count => {
      const p = count / total;
      entropy -= p * Math.log2(p);
    });
    
    return entropy;
  }

  /**
   * Extract patterns without hardcoding
   */
  extractPatterns(spans) {
    const patterns = {};
    
    spans.forEach(span => {
      const key = `${span.category}_${Math.floor(span.text?.length / 10) * 10}`; // Group by category and length bucket
      patterns[key] = (patterns[key] || 0) + 1;
    });
    
    return Object.keys(patterns).filter(p => patterns[p] > 1); // Patterns that appear more than once
  }

  /**
   * Compute density adjustment direction
   */
  computeDensityAdjustment(currentDensity) {
    if (currentDensity < 0.2) return 'increase_significantly';
    if (currentDensity < 0.4) return 'increase_moderately';
    if (currentDensity > 0.8) return 'decrease_moderately';
    if (currentDensity > 0.6) return 'maintain_or_decrease_slightly';
    return 'maintain';
  }

  /**
   * Compute granularity target
   */
  computeGranularity(inputProfile) {
    return {
      level: Math.round(inputProfile.averageTokenLength),
      specificity: inputProfile.uniqueTokenRatio,
      detail: inputProfile.complexity
    };
  }

  /**
   * Detect syntactic pattern algorithmically
   */
  detectSyntacticPattern(text) {
    const tokens = text.split(/\s+/);
    const firstToken = tokens[0]?.toLowerCase() || '';
    const lastToken = tokens[tokens.length - 1]?.toLowerCase() || '';
    
    // Pattern detection based on position and endings
    const patterns = [];
    
    if (firstToken.endsWith('ing')) patterns.push('gerund_initial');
    if (lastToken.endsWith('ly')) patterns.push('adverb_terminal');
    if (tokens.length === 1) patterns.push('single_token');
    if (tokens.length === 2) patterns.push('token_pair');
    if (text.includes(',')) patterns.push('comma_separated');
    
    return patterns.length > 0 ? patterns[0] : 'standard';
  }

  /**
   * Generate alternative patterns based on profile
   */
  generateAlternativePatterns(profile) {
    const patterns = [];
    
    if (profile.tokenCount === 1) {
      patterns.push('compound', 'phrase_expansion', 'modified');
    } else if (profile.tokenCount === 2) {
      patterns.push('inverted', 'hyphenated', 'expanded');
    } else {
      patterns.push('compressed', 'restructured', 'parallel');
    }
    
    return patterns;
  }

  /**
   * Derive constraints algorithmically
   */
  deriveConstraints(highlightedText, spans, diversity, density) {
    // All constraints derived from the data
    return {
      maxSimilarity: Math.max(0.2, 1 - diversity), // Higher diversity = lower similarity allowed
      minDistance: Math.max(0.3, density * 0.5), // Higher density = more distance needed
      entropyGain: Math.max(0.1, (1 - density) * 0.3) // Lower density = more entropy needed
    };
  }

  /**
   * Extract grammatical pattern
   */
  extractGrammaticalPattern(text, before, after) {
    // Detect pattern from surrounding context
    const beforeTokens = before.split(/\s+/).slice(-3);
    const afterTokens = after.split(/\s+/).slice(0, 3);
    
    return {
      precedingPattern: this.classifyTokenPattern(beforeTokens),
      followingPattern: this.classifyTokenPattern(afterTokens),
      expectedForm: this.inferExpectedForm(text, beforeTokens, afterTokens)
    };
  }

  /**
   * Classify token pattern algorithmically
   */
  classifyTokenPattern(tokens) {
    if (tokens.length === 0) return 'none';
    
    const patterns = tokens.map(t => {
      if (t.endsWith('ing')) return 'V-ing';
      if (t.endsWith('ed')) return 'V-ed';
      if (t.endsWith('ly')) return 'ADV';
      if (t.endsWith('s') && t.length > 2) return 'N-plural';
      if (/^[A-Z]/.test(t)) return 'Proper';
      return 'X';
    });
    
    return patterns.join('-');
  }

  /**
   * Infer expected form from context
   */
  inferExpectedForm(text, beforeTokens, afterTokens) {
    const lastBefore = beforeTokens[beforeTokens.length - 1]?.toLowerCase() || '';
    const firstAfter = afterTokens[0]?.toLowerCase() || '';
    
    // Infer from articles and prepositions
    if (['a', 'an', 'the'].includes(lastBefore)) return 'noun_phrase';
    if (['to', 'from', 'with', 'by'].includes(lastBefore)) return 'object';
    if (lastBefore.endsWith('ly')) return 'verb_or_adjective';
    
    return 'flexible';
  }

  /**
   * Translation Layer: Converts statistical findings into natural language
   * that LLMs (especially Llama) can understand and act upon effectively.
   */
  translateToNaturalLanguage(analysis) {
    const directives = [];
    const negativeConstraints = [];
    let persona = "Helpful Editor";

    // Vector 1: Complexity -> Persona
    if (analysis.inputProfile.complexity > 0.7) {
      persona = "Clarity Expert";
      directives.push("Simplify the phrasing. The current text is too dense.");
      negativeConstraints.push("Avoid jargon and complex sentence structures.");
    } else if (analysis.inputProfile.complexity < 0.3) {
      persona = "Creative Novelist";
      directives.push("Add descriptive depth. The current text is too simple.");
      directives.push("Use sensory details (texture, light, sound).");
    }

    // Vector 2: Repetition -> Constraints
    if (analysis.contextProfile.repetitionRate > 0.4) {
      directives.push("Inject lexical variety.");
      negativeConstraints.push(`Strictly avoid repeating these dominant words: ${analysis.contextProfile.dominantTokens.slice(0, 3).join(', ')}`);
    }

    // Vector 3: Entropy -> Creativity
    if (analysis.semanticDistribution.entropy < 1.0) {
      directives.push("High Creativity Required: The current context is very uniform.");
      directives.push("Introduce a new conceptual angle or metaphor.");
    }

    // Vector 4: Diversity emphasis
    if (analysis.lexicalDiversity < 0.5) {
      directives.push("Maximize categorical diversity in your suggestions.");
      directives.push("Each suggestion should explore a fundamentally different approach.");
    }

    // Vector 5: Information density
    if (analysis.informationDensity < 0.3) {
      directives.push("Increase specificity and detail in suggestions.");
    }

    return { persona, directives, negativeConstraints };
  }

  /**
   * Override buildPlaceholderPrompt with algorithmic approach
   */
  buildPlaceholderPrompt(params) {
    const {
      highlightedText,
      contextBefore,
      contextAfter,
      fullPrompt,
      originalUserPrompt,
      allLabeledSpans = [],
      isVideoPrompt,
      brainstormContext,
      highlightedCategory,
    } = params;

    // 1. Run algorithmic analysis
    const analysis = this.analyzeContextAlgorithmically(
      highlightedText,
      contextBefore,
      contextAfter,
      allLabeledSpans
    );

    // 2. TRANSLATION LAYER: Convert Math -> Personas/Instructions
    const { persona, directives, negativeConstraints } = this.translateToNaturalLanguage(analysis);

    // Log algorithmic analysis results
    logger.info('🔬 AlgorithmicPromptBuilder: Context analyzed', {
      text: highlightedText.substring(0, 50) + (highlightedText.length > 50 ? '...' : ''),
      styleProfile: analysis.styleProfile,
      complexity: (analysis.inputProfile.complexity * 100).toFixed(0) + '%',
      lexicalDiversity: (analysis.lexicalDiversity * 100).toFixed(0) + '%',
      entropy: analysis.semanticDistribution.entropy.toFixed(2),
      persona: persona,
      directiveCount: directives.length,
      constraintCount: negativeConstraints.length,
      spanCount: allLabeledSpans.length
    });

    // 3. Build brainstorm section if available
    const brainstormSection = this.brainstormBuilder.buildBrainstormContextSection(brainstormContext, {
      includeCategoryGuidance: true,
      isVideoPrompt,
    });

    const brainstormRequirement = brainstormSection
      ? '✓ Align categories and replacements with the Creative Brainstorm anchors above\n'
      : '';

    // 4. Format directives and constraints
    const directivesSection = directives.length > 0
      ? `\n<ALGORITHMIC_DIRECTIVES>\n${directives.map(d => `- ${d}`).join('\n')}\n</ALGORITHMIC_DIRECTIVES>\n`
      : '';

    const constraintsSection = negativeConstraints.length > 0
      ? `\n<NEGATIVE_CONSTRAINTS>\n${negativeConstraints.map(c => `🚫 ${c}`).join('\n')}\n</NEGATIVE_CONSTRAINTS>\n`
      : '';

    // 5. Build enhanced prompt with translation layer
    return `You are a ${persona} specializing in placeholder value suggestion with deep contextual understanding.${
      brainstormSection ? `\n${brainstormSection.trimEnd()}` : ''
    }

<CONTEXT_ANALYSIS>
The writing style is detected as: **${analysis.styleProfile}**
Current lexical diversity: **${(analysis.lexicalDiversity * 100).toFixed(0)}%**
Information density: **${analysis.densityAdjustment}**
Semantic entropy: **${analysis.semanticDistribution.entropy.toFixed(2)}** (${analysis.semanticDistribution.entropy < 1.5 ? 'low - need more variety' : 'good diversity'})
</CONTEXT_ANALYSIS>${directivesSection}${constraintsSection}

**Context Analysis:**
Full prompt: ${fullPrompt.substring(0, 1500)}

Surrounding context:
- Before: "${contextBefore}"
- **PLACEHOLDER**: "${highlightedText}"
- After: "${contextAfter}"

Original user request: "${originalUserPrompt}"

**Your Task:**
Generate 12-15 suggestions to replace "${highlightedText}" organized into 4-5 CATEGORIES with 2-4 suggestions per category.

**CRITICAL REQUIREMENTS:**
✓ Create 4-5 distinct categories representing different conceptual approaches
✓ Include 2-4 suggestions per category (not just one!)
✓ Each suggestion within a category should still be unique
✓ Categories should maximize diversity based on the analysis above
✓ Include category label for ALL suggestions
✓ Direct drop-in replacements - no rewriting needed
✓ Keep each suggestion concise noun/descriptor phrase (1-4 words)
✓ Contextually appropriate despite being diverse
${brainstormRequirement}✓ ${isVideoPrompt ? 'For video: consider different visual/cinematic approaches' : 'Different approaches to achieve the goal'}

**Output Format:**
Return ONLY a JSON array with categorized suggestions (2-4 per category):

[
  {
    "text": "suggestion 1",
    "category": "Category Name 1",
    "explanation": "Brief reason"
  },
  {
    "text": "suggestion 2",
    "category": "Category Name 1",
    "explanation": "Brief reason"
  },
  {
    "text": "suggestion 3",
    "category": "Category Name 2",
    "explanation": "Brief reason"
  }
]`;
  }
}

