import nlp from 'compromise';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * NLP Span Service - PRAGMATIC VERSION
 * * 1. Uses Regex for "Closed Vocabulary" (Technical terms like '4k', 'pan left') - 100% precision
 * 2. Uses Compromise for "Open Vocabulary" (Subjects, Actions) - Good enough heuristics
 */

// --- SETUP: Load Vocab ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const vocabPath = join(__dirname, '../data/vocab.json');
let VOCAB = {};
try {
  VOCAB = JSON.parse(readFileSync(vocabPath, 'utf-8'));
} catch (e) {
  console.warn("⚠️ NLP Service: Could not load vocab.json. Technical tagging will fail.");
}

// --- PLUGIN: Teach Compromise your Taxonomy ---
nlp.plugin((Doc, world) => {
  const words = {};
  
  // Flatten vocab for Compromise: { "pan left": "CameraMove", "kodak portra": "FilmStock" }
  Object.entries(VOCAB).forEach(([taxonomyId, terms]) => {
    // Create a simpler internal tag (e.g. 'camera.movement' -> 'CameraMove')
    // We use a suffix to avoid collision with native tags
    const tag = taxonomyId.replace('.', '_'); // e.g. "camera_movement"
    
    terms.forEach(term => {
      words[term.toLowerCase()] = tag;
    });

    // Register the tag
    world.addTags({
      [tag]: { isA: 'Noun' } // Default to noun to prevent verb conjugation mess
    });
  });

  world.addWords(words);
});

// --- MAIN FUNCTION ---

export function extractSemanticSpans(text) {
  if (!text || typeof text !== 'string') return { spans: [] };

  const doc = nlp(text);
  const spans = [];

  // Helper to add span
  const addSpan = (match, role, confidence) => {
    match.forEach(m => {
      // Get raw offsets
      const json = m.json({ offset: true })[0]; 
      if (!json) return;
      
      spans.push({
        text: m.text(),
        role: role,
        confidence: confidence,
        start: json.offset.start,
        end: json.offset.start + json.text.length
      });
    });
  };

  // 1. CLOSED VOCABULARY (Technical Terms)
  // We use our loaded vocab list. High confidence.
  Object.keys(VOCAB).forEach(taxonomyId => {
    const tag = taxonomyId.replace('.', '_');
    const matches = doc.match(`#${tag}`);
    
    // HEURISTIC: Context Checks
    // Don't tag "pan" if it's "frying pan"
    if (taxonomyId === 'camera.movement') {
        matches.notIf('(frying|sauté|sauce|iron) .'); 
    }

    // Ensure only exact word matches or safe inflections
    // Fix for "span" matching inside "spans" (which is fine) but avoiding partial matches if possible
    // compromise .match() handles words, but let's be safe.
    
    addSpan(matches, taxonomyId, 1.0);
    
    // Tag these as #Technical so we ignore them in the next step
    matches.tag('Technical'); 
  });

  // 2. OPEN VOCABULARY (Subjects & Actions)
  // We use grammar rules to guess these. Lower confidence.

  // A. ACTIONS (Verbs that are not technical terms)
  // Rule: Verbs ending in -ing (Gerunds) are very likely actions in prompts
  // "A dog [running] in the park"
  const actions = doc.verbs().if('#Gerund').not('#Technical');
  addSpan(actions, 'action.movement', 0.85);

  // B. SUBJECTS (Nouns that are not technical terms)
  // Rule: Nouns that aren't technical, not pronouns, not part of a prepositional phrase
  // "A [cyborg] holding a gun"
  const subjects = doc.nouns()
    .not('#Technical')
    .not('#Pronoun')
    .notIf('(in|at|on) .'); // Ignore "park" in "in the park" (that's location)
  
  addSpan(subjects, 'subject.identity', 0.80);

  // C. LOCATIONS (Prepositional Phrases)
  // Rule: "in the [Location]"
  const locations = doc.match('(in|at|on|inside) (the|a|an)? #Noun+')
                       .not('#Technical');
  // We want to capture the noun part of the location
  addSpan(locations.match('#Noun+'), 'environment.location', 0.75);

  // 3. CLEANUP
  const uniqueSpans = deduplicateSpans(spans);

  return {
    spans: uniqueSpans,
    stats: {
      phase: 'compromise-native',
      totalSpans: uniqueSpans.length
    }
  };
}

// --- UTILS ---

function deduplicateSpans(spans) {
  // Sort by confidence (high to low), then length (long to short)
  spans.sort((a, b) => b.confidence - a.confidence || b.text.length - a.text.length);

  const accepted = [];
  const occupied = new Set();

  for (const span of spans) {
    let overlap = false;
    for (let i = span.start; i < span.end; i++) {
      if (occupied.has(i)) overlap = true;
    }
    
    if (!overlap) {
      accepted.push(span);
      for (let i = span.start; i < span.end; i++) occupied.add(i);
    }
  }
  
  return accepted.sort((a, b) => a.start - b.start);
}

// Keep for compatibility if needed, but extractSemanticSpans covers it
export function extractKnownSpans(text) {
    return extractSemanticSpans(text).spans;
}

export function getVocabStats() {
  const stats = {};
  let totalTerms = 0;
  
  Object.entries(VOCAB).forEach(([taxonomyId, terms]) => {
    totalTerms += terms.length;
    stats[taxonomyId] = {
      termCount: terms.length,
      sampleTerms: terms.slice(0, 5)
    };
  });
  
  return {
    totalCategories: Object.keys(VOCAB).length,
    totalTerms: totalTerms,
    categories: stats
  };
}

export function estimateCoverage(text) {
  if (!text) return 0;
  
  const { spans } = extractSemanticSpans(text);
  const words = text.split(/\s+/).length;
  const coveredWords = spans.reduce((sum, span) => {
    return sum + span.text.split(/\s+/).length;
  }, 0);
  
  return Math.min(100, Math.round((coveredWords / words) * 100));
}
