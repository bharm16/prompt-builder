// phraseExtractor.js
import nlp from 'compromise'
import { PromptContext } from '../../utils/PromptContext'

const PROTECTED_PHRASES = [
  'elderly street musician',
  'ambient street sounds',
  'soft guitar music',
  'shallow depth of field'
]

/**
 * Extract video prompt phrases with optional context awareness
 *
 * Priority order:
 * 1. Known elements from user context (highest confidence)
 * 2. Semantically related terms from context
 * 3. NLP-extracted phrases (fallback)
 *
 * @param {string} text - The text to analyze
 * @param {PromptContext|null} context - Optional context from Creative Brainstorm
 * @returns {Array} Array of phrase objects with text, category, color, confidence, and source
 */
export function extractVideoPromptPhrases(text, context = null) {
  if (!text) return []

  const phrases = []

  // Priority 1: Extract known elements from context
  if (context && context.hasContext()) {
    phrases.push(...extractKnownElements(text, context))
  }

  // Priority 2: Extract semantically related terms
  if (context && context.hasContext()) {
    phrases.push(...extractSemanticMatches(text, context))
  }

  // Priority 3: Fallback to NLP extraction for remaining content
  phrases.push(...performNLPExtraction(text, context))

  // Smart deduplication with priority weighting
  return smartDeduplicate(phrases, context)
}

/**
 * Extract phrases that match user-provided context elements
 */
function extractKnownElements(text, context) {
  const phrases = []
  const lowerText = text.toLowerCase()

  Object.entries(context.elements).forEach(([category, value]) => {
    if (!value) return

    const variations = context.generateVariations(value)
    const matchedPhrases = new Set()

    variations.forEach(variant => {
      // Use word boundaries to avoid partial matches
      const regex = new RegExp(`\\b${escapeRegex(variant)}\\b`, 'gi')
      const matches = text.match(regex)

      if (matches) {
        matches.forEach(match => {
          const normalized = match.toLowerCase().trim()
          if (!matchedPhrases.has(normalized) && match.trim().length > 0) {
            matchedPhrases.add(normalized)
            phrases.push({
              text: match.trim(),
              category,
              confidence: 1.0,
              source: 'user-input',
              color: PromptContext.getCategoryColor(category),
              originalValue: value
            })
          }
        })
      }
    })
  })

  return phrases
}

/**
 * Extract phrases that semantically match context
 */
function extractSemanticMatches(text, context) {
  const phrases = []
  const lowerText = text.toLowerCase()

  Object.entries(context.semanticGroups).forEach(([groupName, terms]) => {
    terms.forEach(term => {
      const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi')
      const matches = text.match(regex)

      if (matches) {
        const category = context.mapGroupToCategory(groupName)
        if (!category) return

        matches.forEach(match => {
          if (match.trim().length > 0) {
            phrases.push({
              text: match.trim(),
              category,
              confidence: 0.8,
              source: 'semantic-match',
              color: PromptContext.getCategoryColor(category),
              originalValue: context.elements[category]
            })
          }
        })
      }
    })
  })

  return phrases
}

/**
 * Perform NLP-based phrase extraction
 */
function performNLPExtraction(text, context) {
  const { text: protectedText, map: protectedMap } = protectPhrases(text)
  const doc = nlp(text)
  const phrases = []
  const seen = new Set()

  const pushMatches = (matches, category, confidence, options = {}) => {
    const { skipCompletenessCheck = false } = options

    matches
      .map(match => (typeof match === 'string' ? match : String(match)))
      .map(match => restoreProtectedSegments(match.trim(), protectedMap))
      .map(match => match.trim())
      .filter(Boolean)
      .forEach(match => {
        if (!skipCompletenessCheck && !isCompletePhrase(match, text)) return

        const resolvedCategory = categorizeWithContext(match, text, category, context)
        const key = `${resolvedCategory}|${match.toLowerCase()}`
        if (seen.has(key)) return
        seen.add(key)

        phrases.push({
          text: match,
          category: resolvedCategory,
          confidence,
          source: 'nlp-extracted',
          color: PromptContext.getCategoryColor(resolvedCategory)
        })
      })
  }

  const pushRegexMatches = (patterns, category, confidence, options = {}) => {
    const targetText = options.useProtectedText ? protectedText : text

    patterns
      .filter(Boolean)
      .forEach(pattern => {
        const regex =
          pattern instanceof RegExp
            ? new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`)
            : new RegExp(pattern, 'gi')

        const matches = Array.from(targetText.matchAll(regex)).map(match => match[0])
        pushMatches(matches, category, confidence, options)
      })
  }

  // Multi-word descriptive phrases (golden hour lighting, soft shadows)
  const descriptive = doc.match('#Adjective+ #Noun+').out('array')
  pushMatches(descriptive, 'descriptive', 0.6)

  // Lighting qualities (golden hour light, rim light, neon glow)
  const lightingPatterns = [
    /\b(?:soft|dramatic|golden(?: hour)?|magic(?: hour)?|blue hour|ambient|diffused|natural|studio|back|rim|neon|candlelit|moonlit|sunlit|warm|cool|harsh|dappled) (?:light|lighting|glow)\b/gi,
    /\b(?:low-key|high-key|chiaroscuro) lighting\b/gi,
    /\b(?:rim[- ]?light|back[- ]?light|backlit|silhouetted lighting|practical lights?)\b/gi
  ]
  pushRegexMatches(lightingPatterns, 'lighting', 0.75)

  // Shot framing and angles (wide shot, low-angle shot, over-the-shoulder shot)
  const framingPatterns = [
    /\b(?:wide|medium|establishing|tight|extreme close[- ]?up|close[- ]?up|point[- ]?of[- ]?view|pov|over[- ]?the[- ]?shoulder|ots|low-angle|low angle|high-angle|high angle|birds[- ]?eye|bird's-eye|dutch) (?:shot|frame|angle)\b/gi,
    /\b(?:locked[- ]?off|static|handheld) shot\b/gi
  ]
  pushRegexMatches(framingPatterns, 'framing', 0.7)

  // Camera movements (camera pans, dolly in, tilt up)
  const cameraPhraseMatches = doc.match('camera #Adverb? #Verb').out('array')
  pushMatches(cameraPhraseMatches, 'cameraMove', 0.8)

  const cameraPatterns = [
    /\bdolly (?:in|out)\b/gi,
    /\b(?:push|pull|truck) (?:in|out|forward|back)\b/gi,
    /\b(?:pan|panning) (?:left|right|across)\b/gi,
    /\b(?:tilt|tilting) (?:up|down)\b/gi,
    /\btracking (?:shot|forward|back|around)\b/gi,
    /\b(?:crane|jib|steadicam|gimbal) (?:shot|move|sweep)\b/gi,
    /\b(?:whip|swish) pan\b/gi
  ]
  pushRegexMatches(cameraPatterns, 'cameraMove', 0.8)

  // Color palettes and grading (neon color palette, teal and orange)
  const colorPatterns = [
    /\b(?:monochrome|desaturated|muted|pastel|vibrant|neon|earthy|warm|cool|cinematic|moody) (?:color )?(?:palette|tones|scheme|grading)\b/gi,
    /\b(?:teal and orange|black and white|black-and-white|sepia tone|duotone|dual-tone|technicolor-inspired)\b/gi,
    /\b(?:rich|deep|icy|warm|cool|saturated) (?:blues|oranges|reds|greens|purples|yellows)\b/gi
  ]
  pushRegexMatches(colorPatterns, 'color', 0.7)

  // Environment descriptors (rain-soaked alley, frozen tundra)
  const environmentKeywords = [
    'forest',
    'jungle',
    'desert',
    'cave',
    'alley',
    'street',
    'market',
    'rooftop',
    'temple',
    'ruins',
    'swamp',
    'tundra',
    'ocean',
    'reef',
    'hangar',
    'warehouse',
    'factory',
    'laboratory',
    'facility',
    'station',
    'harbor',
    'dockyard',
    'subway',
    'tunnel',
    'bunker',
    'canyon',
    'oasis',
    'beach',
    'shoreline',
    'cliff',
    'mountain',
    'glacier',
    'volcano',
    'cathedral',
    'castle',
    'plaza',
    'bridge'
  ]
  const environmentPhrases = new Set()
  const singlePattern = new RegExp(
    `\\b(?:[\\w-]+\\s){0,2}(?:${environmentKeywords.map(escapeRegex).join('|')})\\b`,
    'gi'
  )
  const singleMatches = Array.from(protectedText.matchAll(singlePattern)).map(match => match[0])
  singleMatches.forEach(match => environmentPhrases.add(match.trim()))

  const multiWordLocations = [
    'space station',
    'moon base',
    'starship hangar',
    'underground bunker',
    'ice cave',
    'rain-soaked alley',
    'snow-covered forest',
    'futuristic city',
    'cyberpunk street',
    'abandoned warehouse',
    'ancient temple',
    'storm-lashed coast',
    'frozen tundra',
    'neon-lit alley'
  ]
  multiWordLocations.forEach(location => {
    const regex = new RegExp(`\\b(?:[\\w-]+\\s){0,2}${escapeRegex(location)}\\b`, 'gi')
    const matches = Array.from(protectedText.matchAll(regex)).map(match => match[0])
    matches.forEach(match => environmentPhrases.add(match.trim()))
  })
  pushMatches(Array.from(environmentPhrases), 'environment', 0.65)

  // Depth of field and focus (shallow depth of field, creamy bokeh)
  const depthPatterns = [
    /\bshallow depth of field\b/gi,
    /\bdeep focus\b/gi,
    /\b(?:creamy|soft|dreamy) bokeh\b/gi,
    /\bbokeh-heavy\b/gi
  ]
  pushRegexMatches(depthPatterns, 'depthOfField', 0.75)

  // Compound nouns (frock coat, battlefield cemetery)
  const compounds = doc.match('#Noun #Noun+').out('array')
  pushMatches(compounds, 'subject', 0.6)

  // Technical specs (35mm film, 24fps, ambient sound cues)
  const technicalPatterns = [
    /\b\d+mm\s+(?:film|lens)\b/gi,
    /\bshallow depth of field\b/gi,
    /\b(?:ambient|soft|loud)\s+(?:\w+\s+)?(?:sound|audio|music)\b/gi,
    /\b\d+fps\b/gi,
    /\b\d+:\d+\b/gi
  ]
  pushRegexMatches(technicalPatterns, 'technical', 1.0, { skipCompletenessCheck: true })

  const technicalDocMatches = doc.match('/[0-9]+mm|[0-9]+fps|[0-9]+:[0-9]+/').out('array')
  pushMatches(technicalDocMatches, 'technical', 1.0, { skipCompletenessCheck: true })

  return phrases
}

/**
 * Smart deduplication that preserves highest priority/confidence phrases
 */
function smartDeduplicate(phrases, context) {
  // Score each phrase for importance
  const scored = phrases.map(phrase => ({
    ...phrase,
    score: scorePhraseImportance(phrase, context)
  }))

  // Sort by score (descending) and length (descending)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.text.length - a.text.length
  })

  const kept = []
  const maxHighlights = 15 // Limit to avoid clutter

  for (const phrase of scored) {
    if (kept.length >= maxHighlights) break

    // Check for overlaps with already kept phrases
    const overlaps = kept.some(existing => {
      const phraseNorm = phrase.text.toLowerCase()
      const existingNorm = existing.text.toLowerCase()
      return phraseNorm.includes(existingNorm) || existingNorm.includes(phraseNorm)
    })

    if (!overlaps) {
      kept.push(phrase)
    }
  }

  return kept
}

/**
 * Score phrase importance for prioritization
 */
function scorePhraseImportance(phrase, context) {
  let score = 0

  // User-provided elements get highest priority
  if (phrase.source === 'user-input') score += 100

  // Semantic matches are important
  if (phrase.source === 'semantic-match') score += 80

  // Technical specifications are important
  if (phrase.category === 'technical') score += 50

  const categoryBoosts = {
    cameraMove: 35,
    lighting: 35,
    environment: 30,
    framing: 25,
    depthOfField: 25,
    color: 20,
    descriptive: 15
  }
  if (categoryBoosts[phrase.category]) {
    score += categoryBoosts[phrase.category]
  }

  // Confidence boost
  score += phrase.confidence * 30

  // Longer, more specific phrases score higher
  const wordCount = phrase.text.split(' ').length
  score += Math.min(wordCount * 10, 40) // Cap at 40 points

  // Category-specific bonuses
  if (phrase.category === 'subject') score += 15
  if (phrase.category === 'action') score += 15
  if (phrase.category === 'style') score += 10

  return score
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function categorizeWithContext(phrase, fullText, defaultCategory, context) {
  const baseCategory = defaultCategory || 'descriptive'
  if (!phrase) return baseCategory

  const lowerPhrase = phrase.toLowerCase()

  if (lowerPhrase.includes('depth of field')) {
    return 'depthOfField'
  }

  const lowerText = fullText.toLowerCase()
  const position = lowerText.indexOf(lowerPhrase)
  const radius = 50
  const contextStart = position === -1 ? 0 : Math.max(0, position - radius)
  const contextEnd =
    position === -1 ? Math.min(lowerText.length, lowerPhrase.length + radius) : Math.min(lowerText.length, position + lowerPhrase.length + radius)
  const surrounding =
    position === -1 ? lowerPhrase : lowerText.slice(contextStart, contextEnd)

  const audioSignals = ['sound', 'sounds', 'audio', 'music', 'musician', 'melody', 'mix', 'score', 'guitar', 'piano', 'instrument']
  if (
    baseCategory !== 'technical' &&
    (audioSignals.some(signal => lowerPhrase.includes(signal)) ||
      audioSignals.some(signal => surrounding.includes(signal)))
  ) {
    return 'technical'
  }

  const subjectSignals = ['musician', 'character', 'person', 'woman', 'man', 'child', 'people', 'artist', 'performer', 'elderly', 'kid', 'boy', 'girl', 'crowd']
  if (baseCategory !== 'subject' && subjectSignals.some(signal => surrounding.includes(signal))) {
    return 'subject'
  }

  if (context && typeof context.findCategoryForPhrase === 'function') {
    const contextMatch = context.findCategoryForPhrase(phrase)
    if (contextMatch?.category) {
      return contextMatch.category
    }
  }

  return baseCategory
}

function protectPhrases(text) {
  if (!text) {
    return { text: '', map: new Map() }
  }

  let processed = text
  const placeholderMap = new Map()
  let counter = 0

  PROTECTED_PHRASES.forEach(phrase => {
    const regex = new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'gi')
    processed = processed.replace(regex, match => {
      const placeholder = `__PROTECTED_${counter++}__`
      placeholderMap.set(placeholder, match)
      return placeholder
    })
  })

  return { text: processed, map: placeholderMap }
}

function restoreProtectedSegments(value, placeholderMap) {
  if (!value || !placeholderMap || placeholderMap.size === 0) {
    return value
  }

  let restored = value
  placeholderMap.forEach((original, placeholder) => {
    const regex = new RegExp(escapeRegex(placeholder), 'g')
    restored = restored.replace(regex, original)
  })

  return restored
}

function isCompletePhrase(phrase, fullText) {
  const candidate = phrase.trim()
  if (!candidate) return false

  const incompletePatterns = [/^(an?|the)\s+\w+$/i, /^ambient\s+\w+$/i, /^soft\s+\w+$/i]
  if (incompletePatterns.some(pattern => pattern.test(candidate))) {
    return false
  }

  const lowerText = fullText.toLowerCase()
  const lowerPhrase = candidate.toLowerCase()

  let index = lowerText.indexOf(lowerPhrase)
  if (index === -1) {
    return true
  }

  while (index !== -1) {
    const beforeChar = index > 0 ? lowerText[index - 1] : ''
    const afterPos = index + lowerPhrase.length
    const afterChar = afterPos < lowerText.length ? lowerText[afterPos] : ''

    const beforeOk = !beforeChar || !/\w/.test(beforeChar)
    const afterOk = !afterChar || !/\w/.test(afterChar)

    if (beforeOk && afterOk) {
      return true
    }

    index = lowerText.indexOf(lowerPhrase, index + 1)
  }

  return false
}

/**
 * Legacy function for backwards compatibility
 * @deprecated Use extractVideoPromptPhrases with context parameter instead
 */
function removeDuplicates(phrases) {
  phrases.sort((a, b) => b.text.length - a.text.length)
  const kept = []

  for (const phrase of phrases) {
    const overlaps = kept.some(existing =>
      phrase.text.includes(existing.text) || existing.text.includes(phrase.text)
    )
    if (!overlaps) kept.push(phrase)
  }

  return kept
}
