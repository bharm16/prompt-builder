/**
 * Conversational Example Bank - Casual and Informal Language
 * 
 * Examples focused on everyday speech, slang, informal phrases, colloquialisms,
 * and casual communication. Helps the model correctly identify informal language
 * patterns, contractions, and conversational structures.
 * 
 * From PDF: Context-aware example selection for different linguistic registers.
 */

export const conversationalExamples = [
  {
    input: "I'm gonna grab some coffee before the meeting kicks off at noon",
    output: {
      spans: [
        { text: "I'm gonna", role: "informal.contraction", confidence: 0.9 },
        { text: "grab some coffee", role: "action.casual", confidence: 0.85 },
        { text: "meeting", role: "event.business", confidence: 0.8 },
        { text: "kicks off", role: "informal.phrasal_verb", confidence: 0.9 },
        { text: "at noon", role: "time.specific", confidence: 0.85 }
      ],
      meta: {
        version: "v3.0",
        notes: "Casual speech with contractions and informal verbs"
      }
    },
    domains: ['conversational', 'informal'],
    keywords: ['gonna', 'grab', 'coffee', 'meeting', 'kicks off'],
    ambiguity: 'informal_contractions'
  },

  {
    input: "That movie was totally awesome, but the ending kinda fell flat, you know?",
    output: {
      spans: [
        { text: "That movie", role: "subject.media", confidence: 0.85 },
        { text: "totally awesome", role: "informal.intensifier", confidence: 0.9 },
        { text: "ending", role: "subject.part", confidence: 0.8 },
        { text: "kinda", role: "informal.hedge", confidence: 0.9 },
        { text: "fell flat", role: "informal.idiom", confidence: 0.9 },
        { text: "you know", role: "informal.discourse_marker", confidence: 0.85 }
      ],
      meta: {
        version: "v3.0",
        notes: "Casual evaluation with intensifiers and discourse markers"
      }
    },
    domains: ['conversational', 'informal', 'opinion'],
    keywords: ['totally', 'awesome', 'kinda', 'fell flat', 'you know'],
    ambiguity: 'discourse_markers'
  },

  {
    input: "Wanna hang out later? Maybe we could hit up that new taco place downtown",
    output: {
      spans: [
        { text: "Wanna", role: "informal.contraction", confidence: 0.9 },
        { text: "hang out", role: "informal.phrasal_verb", confidence: 0.9 },
        { text: "later", role: "time.vague", confidence: 0.8 },
        { text: "hit up", role: "informal.phrasal_verb", confidence: 0.9 },
        { text: "that new taco place", role: "location.restaurant", confidence: 0.85 },
        { text: "downtown", role: "location.area", confidence: 0.8 }
      ],
      meta: {
        version: "v3.0",
        notes: "Casual invitation with multiple informal phrasal verbs"
      }
    },
    domains: ['conversational', 'social'],
    keywords: ['wanna', 'hang out', 'later', 'hit up', 'taco place'],
    ambiguity: 'phrasal_verb_clusters'
  },

  {
    input: "The wifi's been acting up all day, it's driving me nuts",
    output: {
      spans: [
        { text: "wifi", role: "subject.technology", confidence: 0.85 },
        { text: "been acting up", role: "informal.malfunction", confidence: 0.9 },
        { text: "all day", role: "time.duration", confidence: 0.8 },
        { text: "driving me nuts", role: "informal.idiom", confidence: 0.95 }
      ],
      meta: {
        version: "v3.0",
        notes: "Tech complaint with informal idioms"
      }
    },
    domains: ['conversational', 'complaint'],
    keywords: ['wifi', 'acting up', 'all day', 'driving nuts'],
    ambiguity: 'malfunction_idioms'
  },

  {
    input: "She's super into photography these days, like really obsessed with it",
    output: {
      spans: [
        { text: "She's", role: "subject.person", confidence: 0.8 },
        { text: "super into", role: "informal.intensifier", confidence: 0.9 },
        { text: "photography", role: "activity.hobby", confidence: 0.85 },
        { text: "these days", role: "time.recent", confidence: 0.85 },
        { text: "like really obsessed", role: "informal.emphasis", confidence: 0.9 }
      ],
      meta: {
        version: "v3.0",
        notes: "Casual description with intensifiers and filler words"
      }
    },
    domains: ['conversational', 'description'],
    keywords: ['super', 'into', 'photography', 'these days', 'obsessed', 'like'],
    ambiguity: 'intensity_modifiers'
  },

  {
    input: "My bad, I totally spaced on our lunch plans yesterday",
    output: {
      spans: [
        { text: "My bad", role: "informal.apology", confidence: 0.95 },
        { text: "totally spaced", role: "informal.idiom", confidence: 0.95 },
        { text: "lunch plans", role: "event.social", confidence: 0.8 },
        { text: "yesterday", role: "time.past", confidence: 0.8 }
      ],
      meta: {
        version: "v3.0",
        notes: "Casual apology with slang expression"
      }
    },
    domains: ['conversational', 'apology'],
    keywords: ['my bad', 'totally', 'spaced', 'lunch', 'plans'],
    ambiguity: 'slang_apology'
  },

  {
    input: "The traffic was insane this morning, took me forever to get here",
    output: {
      spans: [
        { text: "traffic", role: "subject.transportation", confidence: 0.85 },
        { text: "insane", role: "informal.hyperbole", confidence: 0.9 },
        { text: "this morning", role: "time.recent", confidence: 0.85 },
        { text: "took me forever", role: "informal.exaggeration", confidence: 0.95 }
      ],
      meta: {
        version: "v3.0",
        notes: "Casual complaint with hyperbole"
      }
    },
    domains: ['conversational', 'complaint'],
    keywords: ['traffic', 'insane', 'this morning', 'forever'],
    ambiguity: 'hyperbole_time'
  },

  {
    input: "Dude, that's sick! How'd you manage to pull that off?",
    output: {
      spans: [
        { text: "Dude", role: "informal.address", confidence: 0.95 },
        { text: "that's sick", role: "informal.praise", confidence: 0.95 },
        { text: "How'd you", role: "informal.contraction", confidence: 0.9 },
        { text: "pull that off", role: "informal.phrasal_verb", confidence: 0.9 }
      ],
      meta: {
        version: "v3.0",
        notes: "Slang praise with casual address and phrasal verb"
      }
    },
    domains: ['conversational', 'praise', 'slang'],
    keywords: ['dude', 'sick', 'howd', 'pull off'],
    ambiguity: 'slang_praise'
  },

  {
    input: "I'm not really feeling it today, maybe we can rain check?",
    output: {
      spans: [
        { text: "I'm not really feeling it", role: "informal.decline", confidence: 0.9 },
        { text: "today", role: "time.current", confidence: 0.8 },
        { text: "maybe", role: "informal.hedge", confidence: 0.85 },
        { text: "rain check", role: "informal.idiom", confidence: 0.95 }
      ],
      meta: {
        version: "v3.0",
        notes: "Casual decline with idiomatic postponement"
      }
    },
    domains: ['conversational', 'social', 'decline'],
    keywords: ['not feeling it', 'today', 'maybe', 'rain check'],
    ambiguity: 'postponement_idiom'
  },

  {
    input: "Yeah, I'm down for whatever, just lemme know what time works best",
    output: {
      spans: [
        { text: "Yeah", role: "informal.affirmation", confidence: 0.85 },
        { text: "I'm down", role: "informal.agreement", confidence: 0.95 },
        { text: "for whatever", role: "informal.flexibility", confidence: 0.85 },
        { text: "lemme", role: "informal.contraction", confidence: 0.95 },
        { text: "what time works best", role: "question.logistics", confidence: 0.8 }
      ],
      meta: {
        version: "v3.0",
        notes: "Casual agreement with extreme contraction"
      }
    },
    domains: ['conversational', 'agreement'],
    keywords: ['yeah', 'down', 'whatever', 'lemme', 'works best'],
    ambiguity: 'extreme_contraction'
  }
];

