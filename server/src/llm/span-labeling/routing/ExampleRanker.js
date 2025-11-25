import { logger } from '@infrastructure/Logger.ts';

/**
 * ExampleRanker - Intelligent Example Selection
 * 
 * Scores and ranks few-shot examples by relevance to the input text.
 * Implements multiple scoring factors to find the most contextually appropriate
 * examples from domain-specific example banks.
 * 
 * From PDF: "Role-Aware Semantic Router" - intelligent example selection
 * improves accuracy by 20-30% on complex inputs.
 * 
 * Scoring Factors:
 * 1. Keyword overlap (exact matches)
 * 2. Domain match (technical vs casual vs academic)
 * 3. Structural similarity (length, complexity)
 * 4. Ambiguity presence (does example address similar ambiguity?)
 */
export class ExampleRanker {
  constructor() {
    // Weights for different scoring factors
    this.weights = {
      keywordOverlap: 0.35,
      domainMatch: 0.25,
      structuralSimilarity: 0.20,
      ambiguityMatch: 0.20,
    };
  }

  /**
   * Rank examples by relevance to input text
   * 
   * @param {string} text - Input text to match against
   * @param {Array} exampleBank - Array of example objects
   * @param {number} maxResults - Maximum number of examples to return
   * @returns {Array} Top-ranked examples with scores
   */
  rankExamples(text, exampleBank, maxResults = 4) {
    if (!text || !exampleBank || exampleBank.length === 0) {
      return [];
    }

    const textLower = text.toLowerCase();
    const textWords = this._extractWords(textLower);
    const textLength = text.length;
    const detectedDomains = this._detectDomains(textLower, textWords);
    const detectedAmbiguity = this._detectAmbiguity(textLower, textWords);

    // Score each example
    const scoredExamples = exampleBank.map(example => {
      const scores = {
        keywordOverlap: this._scoreKeywordOverlap(textWords, example.keywords || []),
        domainMatch: this._scoreDomainMatch(detectedDomains, example.domains || []),
        structuralSimilarity: this._scoreStructuralSimilarity(
          textLength,
          example.input.length,
          textWords.length,
          this._extractWords(example.input).length
        ),
        ambiguityMatch: this._scoreAmbiguityMatch(detectedAmbiguity, example.ambiguity),
      };

      const totalScore =
        scores.keywordOverlap * this.weights.keywordOverlap +
        scores.domainMatch * this.weights.domainMatch +
        scores.structuralSimilarity * this.weights.structuralSimilarity +
        scores.ambiguityMatch * this.weights.ambiguityMatch;

      return {
        example,
        totalScore,
        scores, // Include breakdown for debugging
      };
    });

    // Sort by score (descending) and take top results
    const ranked = scoredExamples
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, maxResults);

    logger.debug('Example ranking completed', {
      totalExamples: exampleBank.length,
      topScore: ranked[0]?.totalScore.toFixed(3),
      selectedCount: ranked.length,
      detectedDomains,
    });

    return ranked;
  }

  /**
   * Score keyword overlap between input and example
   * @private
   */
  _scoreKeywordOverlap(textWords, exampleKeywords) {
    if (exampleKeywords.length === 0) return 0;

    const textWordSet = new Set(textWords);
    const matchingKeywords = exampleKeywords.filter(keyword =>
      textWordSet.has(keyword.toLowerCase())
    );

    return matchingKeywords.length / exampleKeywords.length;
  }

  /**
   * Score domain match between input and example
   * @private
   */
  _scoreDomainMatch(detectedDomains, exampleDomains) {
    if (exampleDomains.length === 0) return 0.5; // Neutral score

    const matchingDomains = exampleDomains.filter(domain =>
      detectedDomains.includes(domain)
    );

    if (matchingDomains.length === 0) return 0;

    return matchingDomains.length / exampleDomains.length;
  }

  /**
   * Score structural similarity (length and complexity)
   * @private
   */
  _scoreStructuralSimilarity(textLength, exampleLength, textWords, exampleWords) {
    // Normalize length difference (closer = higher score)
    const lengthDiff = Math.abs(textLength - exampleLength);
    const maxLength = Math.max(textLength, exampleLength);
    const lengthScore = 1 - Math.min(lengthDiff / maxLength, 1);

    // Normalize word count difference
    const wordDiff = Math.abs(textWords - exampleWords);
    const maxWords = Math.max(textWords, exampleWords);
    const wordScore = 1 - Math.min(wordDiff / maxWords, 1);

    // Average the two scores
    return (lengthScore + wordScore) / 2;
  }

  /**
   * Score ambiguity match (does example address similar confusion?)
   * @private
   */
  _scoreAmbiguityMatch(detectedAmbiguity, exampleAmbiguity) {
    if (!exampleAmbiguity) return 0.5; // Neutral score

    // Check for exact match
    if (detectedAmbiguity.includes(exampleAmbiguity)) {
      return 1.0;
    }

    // Check for related ambiguity patterns
    const ambiguityFamilies = {
      movement: ['camera_vs_subject_movement', 'shot_type_vs_movement', 'focus_technique'],
      terminology: ['technical_terminology', 'director_lexicon', 'equipment_and_technique'],
      figurative: ['figurative_language', 'metaphor', 'simile', 'personification'],
      homonym: ['homonym_disambiguation', 'ambiguous_terms'],
    };

    for (const [family, members] of Object.entries(ambiguityFamilies)) {
      if (
        members.includes(exampleAmbiguity) &&
        detectedAmbiguity.some(amb => members.includes(amb))
      ) {
        return 0.7; // Related ambiguity
      }
    }

    return 0;
  }

  /**
   * Detect domains present in input text
   * @private
   */
  _detectDomains(textLower, textWords) {
    const domains = [];

    // Technical/cinematography indicators
    const technicalTerms = [
      'camera',
      'shot',
      'lens',
      'lighting',
      'dolly',
      'pan',
      'tilt',
      'zoom',
      'focus',
      'frame',
      'angle',
      'bokeh',
      'aperture',
      'f-stop',
      'crane',
      'tracking',
      'steadicam',
    ];
    if (technicalTerms.some(term => textLower.includes(term))) {
      domains.push('cinematography', 'technical');
    }

    // Academic indicators
    const academicTerms = [
      'hypothesis',
      'methodology',
      'analysis',
      'study',
      'research',
      'participants',
      'significant',
      'correlation',
      'theory',
      'findings',
      'literature',
    ];
    if (academicTerms.some(term => textLower.includes(term))) {
      domains.push('academic', 'research');
    }

    // Creative/poetic indicators
    const creativeIndicators = [
      'like',
      'as if',
      'metaphor',
      'painted',
      'danced',
      'whispered',
      'trembled',
      'breathed',
    ];
    const hasMetaphor = creativeIndicators.some(term => textLower.includes(term));
    const hasVividImagery = textWords.some(
      word =>
        ['crimson', 'amber', 'velvet', 'obsidian', 'azure'].includes(word) ||
        textLower.match(/\b(sun|moon|star|sky|ocean|storm|wind|rain)\b/)
    );
    if (hasMetaphor || hasVividImagery) {
      domains.push('creative', 'poetic');
    }

    // Conversational indicators
    const informalTerms = [
      'gonna',
      'wanna',
      'kinda',
      'lemme',
      'yeah',
      'dude',
      "y'know",
      'totally',
      'super',
      'awesome',
    ];
    if (informalTerms.some(term => textLower.includes(term))) {
      domains.push('conversational', 'informal');
    }

    // Default to general if no specific domain detected
    if (domains.length === 0) {
      domains.push('general');
    }

    return domains;
  }

  /**
   * Detect ambiguity patterns in input text
   * @private
   */
  _detectAmbiguity(textLower, textWords) {
    const ambiguities = [];

    // Homonym detection (words with multiple meanings)
    const homonyms = ['pan', 'light', 'shot', 'frame', 'focus', 'move'];
    if (homonyms.some(word => textWords.includes(word))) {
      ambiguities.push('homonym_disambiguation');
    }

    // Camera vs subject movement
    const cameraTerms = ['camera', 'lens', 'shot'];
    const movementTerms = ['moves', 'moving', 'follows', 'tracks', 'pans', 'tilts', 'dollies'];
    if (
      cameraTerms.some(term => textLower.includes(term)) &&
      movementTerms.some(term => textLower.includes(term))
    ) {
      ambiguities.push('camera_vs_subject_movement');
    }

    // Figurative language
    if (textLower.includes('like ') || textLower.includes(' as ') || textLower.includes('as if')) {
      ambiguities.push('figurative_language');
    }

    // Technical terminology
    const technicalIndicators = [
      'mm',
      'aperture',
      'iso',
      'shutter',
      'f/',
      'dof',
      'bokeh',
      'anamorphic',
    ];
    if (technicalIndicators.some(term => textLower.includes(term))) {
      ambiguities.push('technical_terminology');
    }

    return ambiguities;
  }

  /**
   * Extract words from text (lowercase, alphanumeric)
   * @private
   */
  _extractWords(text) {
    return text
      .toLowerCase()
      .match(/\b[a-z0-9]+\b/g) || [];
  }

  /**
   * Get ranking explanation for debugging
   * 
   * @param {Object} rankedExample - Ranked example with scores
   * @returns {string} Human-readable explanation
   */
  explainRanking(rankedExample) {
    const { scores, totalScore } = rankedExample;
    
    return `Score: ${totalScore.toFixed(3)} | Keyword: ${(scores.keywordOverlap * 100).toFixed(0)}% | Domain: ${(scores.domainMatch * 100).toFixed(0)}% | Structure: ${(scores.structuralSimilarity * 100).toFixed(0)}% | Ambiguity: ${(scores.ambiguityMatch * 100).toFixed(0)}%`;
  }
}

