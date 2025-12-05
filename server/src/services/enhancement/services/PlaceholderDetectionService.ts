import { logger } from '@infrastructure/Logger';

/**
 * PlaceholderDetectionService
 * 
 * Responsible for detecting if highlighted text is a placeholder/parameter
 * and determining the semantic type of placeholders.
 * 
 * Single Responsibility: Placeholder identification and categorization
 */
export class PlaceholderDetectionService {
  private readonly log = logger.child({ service: 'PlaceholderDetectionService' });

  constructor() {
    // No dependencies - pure logic
  }

  /**
   * Detect if highlighted text is a placeholder/parameter
   * @param highlightedText - The highlighted text
   * @param contextBefore - Text before highlight
   * @param contextAfter - Text after highlight
   * @param fullPrompt - Full prompt text
   * @returns True if text is a placeholder
   */
  detectPlaceholder(
    highlightedText: string,
    contextBefore: string,
    contextAfter: string,
    fullPrompt: string
  ): boolean {
    const operation = 'detectPlaceholder';
    
    this.log.debug('Starting placeholder detection', {
      operation,
      highlightedTextLength: highlightedText?.length || 0,
      contextBeforeLength: contextBefore.length,
      contextAfterLength: contextAfter.length,
    });

    if (!highlightedText || typeof highlightedText !== 'string') {
      this.log.debug('Invalid highlighted text, returning false', { operation });
      return false;
    }

    const text = highlightedText.toLowerCase().trim();

    // Enhanced Pattern 1: Material/substance detection
    const materialKeywords = [
      'wooden', 'wood', 'metal', 'metallic', 'glass', 'plastic',
      'stone', 'marble', 'granite', 'concrete', 'brick', 'ceramic',
      'fabric', 'leather', 'steel', 'iron', 'copper', 'brass',
      'aluminum', 'chrome', 'gold', 'silver', 'bronze'
    ];

    // Enhanced Pattern 2: Style/aesthetic detection
    const styleKeywords = [
      'modern', 'vintage', 'rustic', 'industrial', 'minimalist',
      'ornate', 'classic', 'contemporary', 'traditional', 'art deco',
      'gothic', 'baroque', 'victorian', 'scandinavian', 'bohemian'
    ];

    // Enhanced Pattern 3: Single word that's commonly a placeholder
    const placeholderKeywords = [
      'location',
      'place',
      'venue',
      'setting',
      'where',
      'person',
      'character',
      'who',
      'speaker',
      'audience',
      'time',
      'when',
      'date',
      'period',
      'era',
      'occasion',
      'style',
      'tone',
      'mood',
      'atmosphere',
      'event',
      'action',
      'activity',
      'scene',
      'color',
      'texture',
      'material',
      'angle',
      'perspective',
      'viewpoint',
    ];

    // Check if it's a material or style (very likely to be a placeholder value)
    if (materialKeywords.includes(text) || styleKeywords.includes(text)) {
      const matchedPattern = materialKeywords.includes(text) ? 'material' : 'style';
      this.log.info('Placeholder detected via material/style pattern', {
        operation,
        matchedPattern,
        text,
      });
      return true;
    }

    if (text.split(/\s+/).length <= 2 && placeholderKeywords.includes(text)) {
      this.log.info('Placeholder detected via keyword pattern', {
        operation,
        matchedKeyword: text,
      });
      return true;
    }

    // Pattern 4: Text in parentheses or brackets
    if (
      contextBefore.includes('(') ||
      contextAfter.startsWith(')') ||
      contextBefore.includes('[') ||
      contextAfter.startsWith(']')
    ) {
      this.log.info('Placeholder detected via parentheses/brackets pattern', {
        operation,
        text,
      });
      return true;
    }

    // Pattern 5: Preceded by phrases like "such as", "like", "e.g."
    const precedingPhrases = [
      'such as',
      'like',
      'e.g.',
      'for example',
      'including',
      'specify',
    ];
    const matchedPhrase = precedingPhrases.find((phrase) =>
      contextBefore.toLowerCase().includes(phrase)
    );
    if (matchedPhrase) {
      this.log.info('Placeholder detected via preceding phrase pattern', {
        operation,
        matchedPhrase,
        text,
      });
      return true;
    }

    // Pattern 6: In a list or comma-separated context
    // Exclude technical spec patterns common in video prompts (e.g., "**Camera:**", "**Shot Type:**")
    const technicalSpecPattern = /\*\*(Camera|Shot|Lighting|Audio|Style|Environment|Technical|Duration|Aspect|Frame|Subject|Action|Motion)\b[^:]*:\*\*\s*$/i;
    const isAfterTechnicalSpec = technicalSpecPattern.test(contextBefore);
    
    if (
      !isAfterTechnicalSpec &&
      (contextBefore.includes(':') || contextBefore.includes('-')) &&
      text.split(/\s+/).length <= 3
    ) {
      this.log.info('Placeholder detected via list/colon pattern', {
        operation,
        text,
      });
      return true;
    }

    // Pattern 7: Part of "include [word]" or "set [word]" pattern
    const includePattern =
      /\b(include|set|choose|specify|add|provide|give)\s+[^,\n]{0,20}$/i;
    if (includePattern.test(contextBefore)) {
      this.log.info('Placeholder detected via include/set pattern', {
        operation,
        text,
      });
      return true;
    }

    // Pattern 8: Adjective describing a physical property
    const physicalPropertyContext = /\b(desk|table|chair|wall|floor|surface|object|item|piece|structure)\b/i;
    if (physicalPropertyContext.test(contextAfter) && text.split(/\s+/).length <= 2) {
      this.log.info('Placeholder detected via physical property pattern', {
        operation,
        text,
      });
      return true;
    }

    this.log.debug('No placeholder patterns matched', { operation, text });
    return false;
  }

  /**
   * Detect the semantic type of a placeholder for better categorization
   * @param highlightedText - The highlighted text
   * @param contextBefore - Text before highlight
   * @param contextAfter - Text after highlight
   * @returns Placeholder type (material, style, location, time, person, general)
   */
  detectPlaceholderType(
    highlightedText: string,
    contextBefore: string,
    contextAfter: string
  ): 'material' | 'style' | 'location' | 'time' | 'person' | 'general' {
    const operation = 'detectPlaceholderType';
    const text = highlightedText.toLowerCase();
    const combinedContext = (contextBefore + ' ' + contextAfter).toLowerCase();

    this.log.debug('Detecting placeholder type', {
      operation,
      highlightedText,
    });

    // Material context
    if (/\b(desk|table|chair|furniture|surface|made of|constructed|built)\b/.test(combinedContext)) {
      this.log.debug('Placeholder type detected: material', { operation });
      return 'material';
    }

    // Style context
    if (/\b(style|design|aesthetic|look|appearance|decorated|themed)\b/.test(combinedContext)) {
      this.log.debug('Placeholder type detected: style', { operation });
      return 'style';
    }

    // Location context
    if (/\b(location|place|venue|setting|room|space|area|environment)\b/.test(combinedContext)) {
      this.log.debug('Placeholder type detected: location', { operation });
      return 'location';
    }

    // Time context
    if (/\b(time|when|period|era|age|century|year|season)\b/.test(combinedContext)) {
      this.log.debug('Placeholder type detected: time', { operation });
      return 'time';
    }

    // Person context
    if (/\b(person|character|individual|speaker|audience|role)\b/.test(combinedContext)) {
      this.log.debug('Placeholder type detected: person', { operation });
      return 'person';
    }

    // Default to analyzing the text itself
    const materialWords = ['wooden', 'metal', 'glass', 'stone', 'plastic', 'fabric'];
    const styleWords = ['modern', 'vintage', 'classic', 'rustic', 'minimalist'];
    const locationWords = ['location', 'place', 'venue', 'room'];

    if (materialWords.some(w => text.includes(w))) {
      this.log.debug('Placeholder type detected via text analysis: material', { operation });
      return 'material';
    }
    if (styleWords.some(w => text.includes(w))) {
      this.log.debug('Placeholder type detected via text analysis: style', { operation });
      return 'style';
    }
    if (locationWords.some(w => text.includes(w))) {
      this.log.debug('Placeholder type detected via text analysis: location', { operation });
      return 'location';
    }

    this.log.debug('Placeholder type detected: general (default)', { operation });
    return 'general';
  }
}

