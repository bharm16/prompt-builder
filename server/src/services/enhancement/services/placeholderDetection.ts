import { logger } from '@infrastructure/Logger';

const log = logger.child({ service: 'PlaceholderDetectionService' });

/**
 * Detect if highlighted text is a placeholder/parameter.
 */
export function detectPlaceholder(
  highlightedText: string,
  contextBefore: string,
  contextAfter: string,
  fullPrompt: string
): boolean {
  const operation = 'detectPlaceholder';

  log.debug('Starting placeholder detection', {
    operation,
    highlightedTextLength: highlightedText?.length || 0,
    contextBeforeLength: contextBefore.length,
    contextAfterLength: contextAfter.length,
    fullPromptLength: fullPrompt?.length || 0,
  });

  if (!highlightedText || typeof highlightedText !== 'string') {
    log.debug('Invalid highlighted text, returning false', { operation });
    return false;
  }

  const text = highlightedText.toLowerCase().trim();

  const materialKeywords = [
    'wooden',
    'wood',
    'metal',
    'metallic',
    'glass',
    'plastic',
    'stone',
    'marble',
    'granite',
    'concrete',
    'brick',
    'ceramic',
    'fabric',
    'leather',
    'steel',
    'iron',
    'copper',
    'brass',
    'aluminum',
    'chrome',
    'gold',
    'silver',
    'bronze',
  ];

  const styleKeywords = [
    'modern',
    'vintage',
    'rustic',
    'industrial',
    'minimalist',
    'ornate',
    'classic',
    'contemporary',
    'traditional',
    'art deco',
    'gothic',
    'baroque',
    'victorian',
    'scandinavian',
    'bohemian',
  ];

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

  if (materialKeywords.includes(text) || styleKeywords.includes(text)) {
    const matchedPattern = materialKeywords.includes(text) ? 'material' : 'style';
    log.info('Placeholder detected via material/style pattern', {
      operation,
      matchedPattern,
      text,
    });
    return true;
  }

  if (text.split(/\s+/).length <= 2 && placeholderKeywords.includes(text)) {
    log.info('Placeholder detected via keyword pattern', {
      operation,
      matchedKeyword: text,
    });
    return true;
  }

  if (
    contextBefore.includes('(') ||
    contextAfter.startsWith(')') ||
    contextBefore.includes('[') ||
    contextAfter.startsWith(']')
  ) {
    log.info('Placeholder detected via parentheses/brackets pattern', {
      operation,
      text,
    });
    return true;
  }

  const precedingPhrases = ['such as', 'like', 'e.g.', 'for example', 'including', 'specify'];
  const matchedPhrase = precedingPhrases.find((phrase) =>
    contextBefore.toLowerCase().includes(phrase)
  );
  if (matchedPhrase) {
    log.info('Placeholder detected via preceding phrase pattern', {
      operation,
      matchedPhrase,
      text,
    });
    return true;
  }

  const technicalSpecPattern =
    /\*\*(Camera|Shot|Lighting|Audio|Style|Environment|Technical|Duration|Aspect|Frame|Subject|Action|Motion)\b[^:]*:\*\*\s*$/i;
  const isAfterTechnicalSpec = technicalSpecPattern.test(contextBefore);

  if (
    !isAfterTechnicalSpec &&
    (contextBefore.includes(':') || contextBefore.includes('-')) &&
    text.split(/\s+/).length <= 3
  ) {
    log.info('Placeholder detected via list/colon pattern', {
      operation,
      text,
    });
    return true;
  }

  const includePattern = /\b(include|set|choose|specify|add|provide|give)\s+[^,\n]{0,20}$/i;
  if (includePattern.test(contextBefore)) {
    log.info('Placeholder detected via include/set pattern', {
      operation,
      text,
    });
    return true;
  }

  const physicalPropertyContext =
    /\b(desk|table|chair|wall|floor|surface|object|item|piece|structure)\b/i;
  if (physicalPropertyContext.test(contextAfter) && text.split(/\s+/).length <= 2) {
    log.info('Placeholder detected via physical property pattern', {
      operation,
      text,
    });
    return true;
  }

  log.debug('No placeholder patterns matched', { operation, text });
  return false;
}
