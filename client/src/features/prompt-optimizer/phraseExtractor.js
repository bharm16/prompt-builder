// phraseExtractor.js
import nlp from 'compromise'

export function extractVideoPromptPhrases(text) {
  if (!text) return []

  const doc = nlp(text)
  const phrases = []

  // Multi-word descriptive phrases (golden hour lighting, soft shadows)
  const descriptive = doc.match('#Adjective+ #Noun+').out('array')
  phrases.push(...descriptive.map(p => ({
    text: p,
    category: 'descriptive',
    color: { bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.5)' }
  })))

  // Camera movements (slowly dollies, camera pans)
  const cameraMovement = doc.match('camera #Adverb? #Verb').out('array')
  phrases.push(...cameraMovement.map(p => ({
    text: p,
    category: 'camera',
    color: { bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.5)' }
  })))

  // Compound nouns (frock coat, battlefield cemetery)
  const compounds = doc.match('#Noun #Noun+').out('array')
  phrases.push(...compounds.map(p => ({
    text: p,
    category: 'subject',
    color: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.5)' }
  })))

  // Technical specs (35mm, 24fps)
  const technical = doc.match('/[0-9]+mm|[0-9]+fps|[0-9]+:[0-9]+/').out('array')
  phrases.push(...technical.map(p => ({
    text: p,
    category: 'technical',
    color: { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.5)' }
  })))

  // Remove overlaps, keep longer phrases
  return removeDuplicates(phrases)
}

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
