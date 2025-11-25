/**
 * PlaceholderDetectionService
 * 
 * Responsible for detecting if highlighted text is a placeholder/parameter
 * and determining the semantic type of placeholders.
 * 
 * Single Responsibility: Placeholder identification and categorization
 */
export class PlaceholderDetectionService {
  constructor() {
    // No dependencies - pure logic
  }

  /**
   * Detect if highlighted text is a placeholder/parameter
   * @param {string} highlightedText - The highlighted text
   * @param {string} contextBefore - Text before highlight
   * @param {string} contextAfter - Text after highlight
   * @param {string} fullPrompt - Full prompt text
   * @returns {boolean} True if text is a placeholder
   */
  detectPlaceholder(highlightedText, contextBefore, contextAfter, fullPrompt) {
    if (!highlightedText || typeof highlightedText !== 'string') {
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
      return true;
    }

    if (text.split(/\s+/).length <= 2 && placeholderKeywords.includes(text)) {
      return true;
    }

    // Pattern 4: Text in parentheses or brackets
    if (
      contextBefore.includes('(') ||
      contextAfter.startsWith(')') ||
      contextBefore.includes('[') ||
      contextAfter.startsWith(']')
    ) {
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
    if (
      precedingPhrases.some((phrase) =>
        contextBefore.toLowerCase().includes(phrase)
      )
    ) {
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
      return true;
    }

    // Pattern 7: Part of "include [word]" or "set [word]" pattern
    const includePattern =
      /\b(include|set|choose|specify|add|provide|give)\s+[^,\n]{0,20}$/i;
    if (includePattern.test(contextBefore)) {
      return true;
    }

    // Pattern 8: Adjective describing a physical property
    const physicalPropertyContext = /\b(desk|table|chair|wall|floor|surface|object|item|piece|structure)\b/i;
    if (physicalPropertyContext.test(contextAfter) && text.split(/\s+/).length <= 2) {
      return true;
    }

    return false;
  }

  /**
   * Detect the semantic type of a placeholder for better categorization
   * @param {string} highlightedText - The highlighted text
   * @param {string} contextBefore - Text before highlight
   * @param {string} contextAfter - Text after highlight
   * @returns {string} Placeholder type (material, style, location, time, person, general)
   */
  detectPlaceholderType(highlightedText, contextBefore, contextAfter) {
    const text = highlightedText.toLowerCase();
    const combinedContext = (contextBefore + ' ' + contextAfter).toLowerCase();

    // Material context
    if (/\b(desk|table|chair|furniture|surface|made of|constructed|built)\b/.test(combinedContext)) {
      return 'material';
    }

    // Style context
    if (/\b(style|design|aesthetic|look|appearance|decorated|themed)\b/.test(combinedContext)) {
      return 'style';
    }

    // Location context
    if (/\b(location|place|venue|setting|room|space|area|environment)\b/.test(combinedContext)) {
      return 'location';
    }

    // Time context
    if (/\b(time|when|period|era|age|century|year|season)\b/.test(combinedContext)) {
      return 'time';
    }

    // Person context
    if (/\b(person|character|individual|speaker|audience|role)\b/.test(combinedContext)) {
      return 'person';
    }

    // Default to analyzing the text itself
    const materialWords = ['wooden', 'metal', 'glass', 'stone', 'plastic', 'fabric'];
    const styleWords = ['modern', 'vintage', 'classic', 'rustic', 'minimalist'];
    const locationWords = ['location', 'place', 'venue', 'room'];

    if (materialWords.some(w => text.includes(w))) return 'material';
    if (styleWords.some(w => text.includes(w))) return 'style';
    if (locationWords.some(w => text.includes(w))) return 'location';

    return 'general';
  }
}
