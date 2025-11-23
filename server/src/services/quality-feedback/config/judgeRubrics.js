/**
 * LLM-as-a-Judge Rubric Definitions
 * 
 * From PDF Section 5.3: "LLM-as-a-Judge (Semantic Alignment)"
 * 
 * These rubrics define the evaluation criteria for different contexts:
 * - Video prompts: Full PDF rubric (cinematic, grounding, safety, diversity)
 * - General text: Adapted rubric for non-video content
 */

/**
 * Video Prompt Rubric (from PDF)
 * 
 * PDF Section 5.3 specifies:
 * 1. Cinematic Quality (1-5): Does phrase use technical lexicon (e.g., "dolly," "volumetric")?
 * 2. Visual Grounding (1-5): Is the description concrete and camera-visible? No abstractions?
 * 3. Safety (1-5): Is it free from offensive, biased, or inappropriate content?
 * 4. Diversity (1-5): Do the 12 options cover orthogonal visual directions?
 */
export const VIDEO_RUBRIC = {
  name: 'video_prompt_evaluation',
  description: 'Evaluates video prompt suggestions using PDF-defined criteria',
  criteria: [
    {
      name: 'cinematicQuality',
      weight: 0.30,
      scale: '1-5',
      description: 'Does the phrase use technical lexicon from the Director\'s Lexicon?',
      examples: {
        high: 'Uses terms like "dolly," "volumetric fog," "rack focus," "35mm anamorphic"',
        low: 'Uses vague terms like "nice lighting," "good shot," "pretty scene"'
      },
      questions: [
        'Does it use professional cinematography terminology?',
        'Are camera movements specified precisely (dolly, pan, tilt vs. "moves")?',
        'Are lighting terms concrete (Rembrandt lighting vs. "dramatic")?',
        'Is film stock or style referenced specifically?'
      ]
    },
    {
      name: 'visualGrounding',
      weight: 0.30,
      scale: '1-5',
      description: 'Is the description concrete and camera-visible? No abstractions?',
      examples: {
        high: 'Describes visible details: "trembling hands," "furrowed brow," "rain-soaked pavement"',
        low: 'Abstract concepts: "feeling anxious," "seems worried," "tense atmosphere"'
      },
      questions: [
        'Can everything described be seen by a camera?',
        'Are emotions translated into visible cues (facial expressions, posture, actions)?',
        'Are abstract concepts avoided in favor of concrete visuals?',
        'Does it specify what appears in frame rather than what\'s implied?'
      ]
    },
    {
      name: 'safety',
      weight: 0.20,
      scale: '1-5',
      description: 'Is it free from offensive, biased, or inappropriate content?',
      examples: {
        high: 'Professional, respectful, appropriate for general audiences',
        low: 'Contains stereotypes, offensive language, inappropriate themes'
      },
      questions: [
        'Is the content appropriate for professional use?',
        'Are there any stereotypes or biased representations?',
        'Is it free from offensive or inappropriate language?',
        'Does it respect cultural sensitivity?'
      ]
    },
    {
      name: 'diversity',
      weight: 0.20,
      scale: '1-5',
      description: 'Do the suggestions cover orthogonal visual directions?',
      examples: {
        high: 'Each option explores different: camera angle, lighting mood, visual focus, or stylistic approach',
        low: 'All options are minor synonyms or variations of the same concept'
      },
      questions: [
        'Do suggestions explore different camera angles/movements?',
        'Is there variety in lighting approaches?',
        'Do options cover different visual focal points?',
        'Are the suggestions semantically orthogonal (not just synonyms)?'
      ]
    }
  ],
  scoringGuide: `
**Scoring Guide:**
- 5: Excellent - Fully meets criterion with professional quality
- 4: Good - Meets criterion with minor improvements possible
- 3: Acceptable - Partially meets criterion, some issues
- 2: Poor - Minimal adherence to criterion, major issues
- 1: Unacceptable - Does not meet criterion at all
`
};

/**
 * General Text Rubric
 * 
 * Adapted from video rubric for general text enhancement
 */
export const GENERAL_RUBRIC = {
  name: 'general_text_evaluation',
  description: 'Evaluates general text suggestions for coherence and quality',
  criteria: [
    {
      name: 'coherence',
      weight: 0.30,
      scale: '1-5',
      description: 'Does the suggestion maintain context and fit naturally?',
      examples: {
        high: 'Maintains tone, style, and logical flow with surrounding text',
        low: 'Clashes with context, breaks flow, or introduces inconsistencies'
      },
      questions: [
        'Does it match the tone of the original text?',
        'Does it fit naturally with surrounding context?',
        'Is the style consistent with the document?',
        'Does it maintain logical flow?'
      ]
    },
    {
      name: 'specificity',
      weight: 0.25,
      scale: '1-5',
      description: 'Is the suggestion concrete and precise rather than vague?',
      examples: {
        high: 'Specific details, precise language, concrete examples',
        low: 'Vague generalities, abstract concepts, unclear references'
      },
      questions: [
        'Does it provide specific details rather than generalities?',
        'Is the language precise and clear?',
        'Are examples concrete when appropriate?',
        'Is terminology used accurately?'
      ]
    },
    {
      name: 'usefulness',
      weight: 0.25,
      scale: '1-5',
      description: 'Does the suggestion genuinely improve the text?',
      examples: {
        high: 'Adds clarity, impact, or precision; enhances communication',
        low: 'Trivial change, redundant, or degrades quality'
      },
      questions: [
        'Does it improve clarity or impact?',
        'Is it a meaningful improvement over the original?',
        'Does it add value rather than just changing words?',
        'Would most readers prefer this version?'
      ]
    },
    {
      name: 'diversity',
      weight: 0.20,
      scale: '1-5',
      description: 'Do the suggestions explore different approaches?',
      examples: {
        high: 'Each option takes a genuinely different approach or angle',
        low: 'All options are synonyms or minor variations'
      },
      questions: [
        'Do suggestions explore different stylistic approaches?',
        'Is there variety in tone or emphasis?',
        'Are options semantically distinct (not just synonyms)?',
        'Do they give the user real choices?'
      ]
    }
  ],
  scoringGuide: `
**Scoring Guide:**
- 5: Excellent - Fully meets criterion, high quality
- 4: Good - Meets criterion with minor room for improvement
- 3: Acceptable - Partially meets criterion, some issues
- 2: Poor - Minimal adherence to criterion, significant issues
- 1: Unacceptable - Does not meet criterion
`
};

/**
 * Get rubric by context
 * 
 * @param {string} context - 'video' or 'general'
 * @returns {Object} Appropriate rubric
 */
export function getRubric(context) {
  return context === 'video' ? VIDEO_RUBRIC : GENERAL_RUBRIC;
}

/**
 * Calculate weighted total score from rubric scores
 * 
 * @param {Object} rubricScores - Scores for each criterion (1-5)
 * @param {Object} rubric - Rubric definition
 * @returns {number} Weighted total score (0-100)
 */
export function calculateTotalScore(rubricScores, rubric) {
  let totalScore = 0;
  
  for (const criterion of rubric.criteria) {
    const score = rubricScores[criterion.name] || 0;
    const normalizedScore = (score / 5) * 100; // Convert 1-5 to 0-100
    totalScore += normalizedScore * criterion.weight;
  }
  
  return Math.round(totalScore);
}

