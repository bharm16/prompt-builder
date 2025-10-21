// phraseExtractor.js
import nlp from 'compromise'
import { PromptContext } from '../../utils/PromptContext'

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
  const doc = nlp(text)
  const phrases = []

  // Multi-word descriptive phrases (golden hour lighting, soft shadows)
  const descriptive = doc.match('#Adjective+ #Noun+').out('array')
  phrases.push(...descriptive.map(p => ({
    text: p,
    category: 'descriptive',
    confidence: 0.6,
    source: 'nlp-extracted',
    color: PromptContext.getCategoryColor('descriptive')
  })))

  // Camera movements (slowly dollies, camera pans)
  const cameraMovement = doc.match('camera #Adverb? #Verb').out('array')
  phrases.push(...cameraMovement.map(p => ({
    text: p,
    category: 'camera',
    confidence: 0.7,
    source: 'nlp-extracted',
    color: PromptContext.getCategoryColor('camera')
  })))

  // Compound nouns (frock coat, battlefield cemetery)
  const compounds = doc.match('#Noun #Noun+').out('array')
  phrases.push(...compounds.map(p => ({
    text: p,
    category: 'subject',
    confidence: 0.6,
    source: 'nlp-extracted',
    color: PromptContext.getCategoryColor('subject')
  })))

  // Technical specs (35mm, 24fps)
  const technical = doc.match('/[0-9]+mm|[0-9]+fps|[0-9]+:[0-9]+/').out('array')
  phrases.push(...technical.map(p => ({
    text: p,
    category: 'technical',
    confidence: 1.0,
    source: 'nlp-extracted',
    color: PromptContext.getCategoryColor('technical')
  })))

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
