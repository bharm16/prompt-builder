/**
 * Gemini Span Labeling Schema
 *
 * Matches the test script prompt format exactly for consistency.
 */

import { VALID_CATEGORIES, TAXONOMY } from '#shared/taxonomy.ts';

/**
 * Build simple system prompt for Gemini span labeling
 * Matches the test script's SYSTEM_INSTRUCTION format
 */
function buildGeminiSystemPrompt(): string {
  // Build taxonomy categories list matching test script format
  const categories: string[] = [];
  
  // shot.type
  if (TAXONOMY.SHOT.attributes?.TYPE) {
    categories.push(`- ${TAXONOMY.SHOT.attributes.TYPE} (e.g., "Medium Shot", "Close-up")`);
  }
  
  // subject.*
  if (TAXONOMY.SUBJECT.attributes?.IDENTITY) {
    categories.push(`- ${TAXONOMY.SUBJECT.attributes.IDENTITY} (e.g., "woman", "basketball")`);
  }
  if (TAXONOMY.SUBJECT.attributes?.APPEARANCE) {
    categories.push(`- ${TAXONOMY.SUBJECT.attributes.APPEARANCE} (e.g., "black braided hair")`);
  }
  if (TAXONOMY.SUBJECT.attributes?.WARDROBE) {
    categories.push(`- ${TAXONOMY.SUBJECT.attributes.WARDROBE} (e.g., "bright blue sports jersey", "white high-top sneakers")`);
  }
  
  // action.movement
  if (TAXONOMY.ACTION.attributes?.MOVEMENT) {
    categories.push(`- ${TAXONOMY.ACTION.attributes.MOVEMENT} (e.g., "dribbling a basketball")`);
  }
  
  // environment.*
  if (TAXONOMY.ENVIRONMENT.attributes?.LOCATION) {
    categories.push(`- ${TAXONOMY.ENVIRONMENT.attributes.LOCATION} (e.g., "outdoor basketball court")`);
  }
  if (TAXONOMY.ENVIRONMENT.attributes?.CONTEXT) {
    categories.push(`- ${TAXONOMY.ENVIRONMENT.attributes.CONTEXT} (e.g., "painted lines")`);
  }
  
  // lighting.*
  if (TAXONOMY.LIGHTING.attributes?.SOURCE) {
    categories.push(`- ${TAXONOMY.LIGHTING.attributes.SOURCE} (e.g., "natural daylight", "sun")`);
  }
  if (TAXONOMY.LIGHTING.attributes?.QUALITY) {
    categories.push(`- ${TAXONOMY.LIGHTING.attributes.QUALITY} (e.g., "soft shadows", "high CRI")`);
  }
  if (TAXONOMY.LIGHTING.attributes?.TIME) {
    categories.push(`- ${TAXONOMY.LIGHTING.attributes.TIME} (e.g., "mid-morning")`);
  }
  
  // camera.*
  if (TAXONOMY.CAMERA.attributes?.MOVEMENT) {
    categories.push(`- ${TAXONOMY.CAMERA.attributes.MOVEMENT} (e.g., "handheld tracking")`);
  }
  if (TAXONOMY.CAMERA.attributes?.ANGLE) {
    categories.push(`- ${TAXONOMY.CAMERA.attributes.ANGLE} (e.g., "low angle")`);
  }
  if (TAXONOMY.CAMERA.attributes?.LENS) {
    categories.push(`- ${TAXONOMY.CAMERA.attributes.LENS} (e.g., "50mm lens")`);
  }
  if (TAXONOMY.CAMERA.attributes?.FOCUS) {
    categories.push(`- ${TAXONOMY.CAMERA.attributes.FOCUS} (e.g., "selective focus", "f/4-f/5.6", "f/2.8")`);
  }
  
  // style.aesthetic
  if (TAXONOMY.STYLE.attributes?.AESTHETIC) {
    categories.push(`- ${TAXONOMY.STYLE.attributes.AESTHETIC} (e.g., "sports photography clarity", "Dynamic sports photography")`);
  }
  
  // technical.*
  if (TAXONOMY.TECHNICAL.attributes?.DURATION) {
    categories.push(`- ${TAXONOMY.TECHNICAL.attributes.DURATION} (e.g., "6s")`);
  }
  if (TAXONOMY.TECHNICAL.attributes?.ASPECT_RATIO) {
    categories.push(`- ${TAXONOMY.TECHNICAL.attributes.ASPECT_RATIO} (e.g., "16:9")`);
  }
  if (TAXONOMY.TECHNICAL.attributes?.FPS) {
    categories.push(`- ${TAXONOMY.TECHNICAL.attributes.FPS} (e.g., "60fps")`);
  }
  
  // audio.soundEffect
  if (TAXONOMY.AUDIO.attributes?.SFX) {
    categories.push(`- ${TAXONOMY.AUDIO.attributes.SFX} (e.g., "Sound of sneakers on court")`);
  }

  return `You are an expert video prompt analyzer. 
Your goal is to extract specific text spans from the user's prompt and categorize them according to the following taxonomy.

Taxonomy Categories:
${categories.join('\n')}

**CRITICAL EXTRACTION RULES:**
1.  **Extract EXACT text**: Do NOT paraphrase, summarize, or change a single character.
2.  **No Labels**: Do NOT include field labels like "Duration:", "Aspect Ratio:", "Camera:", "Lighting:". Extract ONLY the value (e.g., "6s", "16:9").
3.  **Semantic Categorization**: In "TECHNICAL SPECS" sections, categorize items by their *meaning*, not just their location.
    *   "50mm lens" -> \`camera.lens\` (NOT technical)
    *   "Low-angle" -> \`camera.angle\` (NOT technical)
    *   "Natural daylight" -> \`lighting.source\` (NOT technical)
    *   "60fps" -> \`technical.frameRate\` (YES technical)

Output Format:
You must return a valid JSON object with EXACTLY ONE key: "spans".
The "spans" key must be an array of objects.
Each object in the "spans" array must have:
- "text": The exact substring from the input.
- "category": The taxonomy category ID.
- "confidence": A number between 0.0 and 1.0.

Do NOT nest specific attributes like "shot_type" or "subject" at the top level.
Do NOT create your own schema. Use ONLY the "spans" array.

Example JSON Output:
{
  "spans": [
    { "text": "Medium Shot", "category": "shot.type", "confidence": 1.0 },
    { "text": "woman", "category": "subject.identity", "confidence": 1.0 }
  ]
}`;
}

/**
 * Comprehensive Gemini system prompt
 * Generated dynamically from shared taxonomy for consistency
 */
export const GEMINI_SIMPLE_SYSTEM_PROMPT = buildGeminiSystemPrompt();

/**
 * Build streaming-optimized system prompt for Gemini
 * Requests NDJSON output for faster parsing and lower TTFT
 */
function buildGeminiStreamingSystemPrompt(): string {
  const validRoles = [...VALID_CATEGORIES].sort();

  const categoryDescriptions = Object.entries(TAXONOMY)
    .map(([key, config]) => {
      const attrs = config.attributes
        ? Object.entries(config.attributes)
            .map(([attrKey, attrId]) => `    - ${attrId}`)
            .join('\n')
        : '    (no sub-attributes)';
      return `  ${config.id} (${config.label}): ${config.description}\n${attrs}`;
    })
    .join('\n\n');

  return `You are an expert video prompt analyzer. Your task is to extract "visual control point" spans from video prompts.

A span is a phrase that, if changed, would produce a visually different video output.

## Taxonomy (Valid Roles)

Use ONLY these exact role IDs when labeling spans:

${categoryDescriptions}

## Valid Role IDs (for reference)
${validRoles.join(', ')}

## Extraction Guidelines

1. **What to Extract:**
   - Shot types: "Medium shot", "Close-up", "Wide angle"
   - Subjects: "woman", "cowboy", "astronaut"
   - Subject attributes: "bright blue jersey", "weathered face", "black braided hair"
   - Actions: "dribbling a basketball", "running", "gazing at the horizon"
   - Environments: "outdoor basketball court", "desert landscape", "neon-lit alley"
   - Lighting: "natural daylight", "golden hour", "soft shadows", "mid-day sun"
   - Camera: "handheld tracking", "dolly shot", "low angle", "f/11", "Tracking Shot"
   - Style: "cinematic", "documentary style", "Kodak Portra", "Shot on Fujifilm"
   - Technical specs: "6s", "60fps", "16:9", "4K"
   - Audio: "sound of sneakers", "ambient wind", "orchestral score"

2. **What NOT to Extract:**
   - **Section headers**: "TECHNICAL SPECS", "ALTERNATIVE APPROACHES", "**Camera:**", "**Lighting:**", "**Style:**"
   - **Label names**: "Duration:", "Aspect Ratio:", "Frame Rate:", "Style reference:", "Lighting :"
   - **Punctuation**: Do not include periods, commas, colons, or parentheses in the span text.
   - **Variation labels**: "Variation 1 (Different Camera):", "Variation 2 (Different Lighting):"

3. **Precision Rules (CRITICAL):**
   - **Exclude Articles & Prepositions**: Do NOT include leading "a", "an", "the", "of", "with", "in", "on", "at", "by", "from", "for".
     - INCORRECT: "a woman", "with athletic wear", "on 35mm"
     - CORRECT: "woman", "athletic wear", "35mm"
   - **Exclude Verbs from Noun Phrases**:
     - INCORRECT: "uses Tracking Shot"
     - CORRECT: "Tracking Shot"

4. **Splitting Rules (Prevent Merging):**
   - **Shot + Subject**: Split "Full Shot of a woman" -> "Full Shot" (shot.type) AND "woman" (subject.identity).
   - **Subject + Action**: Split "woman with athletic wear and basketball dribbling" -> "woman" (subject), "athletic wear" (wardrobe), "basketball" (subject/object), "dribbling" (action).
   - **Listing**: Split lists. "vibrant colors and contrast" -> "vibrant colors" AND "contrast".
   - **Lighting**: Split source from quality if distinct. "Natural daylight with soft shadows" -> "Natural daylight" (lighting.source) AND "soft shadows" (lighting.quality).

5. **Categorization Rules:**
   - "Tracking Shot" is ALWAYS \`camera.movement\`.
   - "f/11", "f/4", "f-stop" are \`camera.focus\` or \`camera.lens\`, NOT \`style\`.
   - "Shot on [Camera/Film]" is \`style.filmStock\` or \`style.aesthetic\`.
   - "Natural daylight", "sun" are \`lighting.source\`.
   - "shadows" is \`lighting.quality\`.
   - "colors", "contrast" are \`style.aesthetic\`.

6. **Semantic Categorization (Technical Specs Section):**
   - Items in the "TECHNICAL SPECS" section must be categorized by their *meaning*, not just their location.
   - Example: "50mm lens" listed under "Camera:" is \`camera.lens\`, NOT \`technical\`.

## Output Format

Return a stream of JSON objects, ONE PER LINE (NDJSON).
Do NOT wrap in a list or array.
Do NOT use markdown code blocks.
Each line must be a valid JSON object:
{"text": "...", "role": "...", "confidence": ...}

Extract ALL visual control points. Do not skip technical specs, alternative approaches content, or audio descriptions.
`;
}

export const GEMINI_STREAMING_SYSTEM_PROMPT = buildGeminiStreamingSystemPrompt();

/**
 * JSON Schema for Gemini structured output
 * Enforces the "spans" array structure and valid categories
 */
export const GEMINI_JSON_SCHEMA = {
  type: "object",
  properties: {
    spans: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          category: { 
            type: "string", 
            enum: [...VALID_CATEGORIES].sort() 
          },
          confidence: { type: "number" }
        },
        required: ["text", "category", "confidence"]
      }
    }
  },
  required: ["spans"]
};