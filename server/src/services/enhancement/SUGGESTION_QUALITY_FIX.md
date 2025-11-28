# Enhancement Suggestion Quality Fix

## Summary of Changes

This document summarizes the changes made to fix poor suggestion quality from the enhancement system, which uses Llama 3.1 8B (via Groq).

## Root Cause Analysis

### 1. Prompts Too Complex for 8B Model
Meta explicitly states: "Llama 8B-Instruct can not reliably maintain a conversation alongside tool calling definitions."

Our prompts were 25-40 lines with:
- Multiple context fields
- 6-8 rules per design
- Complex constraint lines
- Verbose guidance sections

### 2. Temperature Too High
- Was: 0.8 for structured JSON output
- Problem: High temperature causes unreliable JSON formatting
- Groq recommends: Lower temperature for structured output

### 3. No Few-Shot Examples
Groq explicitly recommends: "Include examples: add sample outputs or specific formats to guide the model into specific output structures"

Our examples existed in `EnhancementExamples.ts` but were never injected into prompts.

### 4. Contrastive Decoding Made It Worse
Temperatures were [0.7, 0.9, 1.0] - each batch got less reliable.

---

## Files Changed

### 1. `server/src/config/modelConfig.ts`
- Changed `enhance_suggestions` temperature from 0.8 → 0.5
- Added documentation explaining 8B model requirements

### 2. `server/src/services/enhancement/services/CleanPromptBuilder.ts`
**Complete rewrite** - simplified for 8B models:
- Reduced prompt length from 25-40 lines → ~15 lines
- Added few-shot examples from `EnhancementExamples.ts`
- Reduced rules from 6-8 → 4 per design
- Simplified constraint building
- Trimmed context windows (100 chars vs 220 chars)

### 3. `server/src/services/enhancement/services/ContrastiveDiversityEnforcer.ts`
- Changed temperatures from [0.7, 0.9, 1.0] → [0.4, 0.5, 0.6]
- Simplified constraint injection (was verbose multi-paragraph → single line)

### 4. `server/src/utils/StructuredOutputEnforcer.ts`
- Simplified JSON enforcement instructions
- Reduced verbose multi-line instructions to single-line directives

### 5. `server/src/services/enhancement/services/types.ts`
- Added documentation to `SharedPromptContext` interface

---

## Before/After Prompt Comparison

### BEFORE (Visual Decomposition - ~30 lines)
```
You are a Visual Director translating abstract descriptors into grounded, camera-visible details.

CRITICAL: You are replacing ONLY the highlighted phrase.
Your output must be ONLY the replacement phrase (2-25 words), NOT the entire sentence or prompt.
Return ONLY the replacement text that will be inserted in place of the highlighted phrase.

HIGHLIGHTED PHRASE TO REPLACE: "scary monster"

Context sentence: "A scary monster lurking in the shadows"

Prefix to preserve: "A "

Suffix to preserve: " lurking in the shadows"

Full prompt snapshot: "A scary monster lurking in the shadows of an abandoned warehouse..."

Target model: Sora.

Prompt section: subject.

Maintain the grammatical flow and style of the surrounding sentence.

Slot: subject. This is Design 2 (Visual Decomposition Expander).

Rules:
- REPLACE ONLY the highlighted phrase above. Return ONLY the replacement phrase, NOT the full sentence.
- Provide 12 replacements that fit grammatically in the sentence.
- Show, don't tell: convert abstract terms into physical cues (materials, silhouette, lighting, movement).
- Ensure visual variance across style, mood, composition, and texture; avoid synonym collapse.
- Keep replacements as noun/adjective phrases when the original span is not a verb.
- Do not introduce new subjects or actions unless the span is a placeholder.

Constraints: Length: 2-25 words | Max sentences: 1.

Context notes: Creative anchors: mood: dark, setting: warehouse | Avoid previously rejected: horrifying beast; terrifying creature

Output JSON array only: [{"text":"REPLACEMENT PHRASE ONLY (not full sentence)","category":"subject","explanation":"visual rationale"}].

Make explanations clear: what the viewer sees change on screen.
```

### AFTER (Visual Decomposition - ~15 lines)
```
You are a visual director. Generate 12 descriptive phrase replacements.

REPLACE THIS: "scary monster"
IN CONTEXT: "A [REPLACE] lurking in the shadows"

EXAMPLE OUTPUT FORMAT:
[
  {"text":"towering obsidian golem in harsh rim lighting","category":"subject","explanation":"Focus on texture and lighting to create fear"},
  {"text":"blurred streak of crimson chrome","category":"subject","explanation":"Emphasize speed through motion blur and color streaks"}
]

RULES:
1. Return ONLY the replacement phrase (not full sentence)
2. Convert abstract words into concrete visual details
3. Include materials, textures, lighting, colors
4. Each option must look different on screen

CONSTRAINTS: 2-25 words; aim for ~2 words

Output JSON array with 12 items. Category: "subject"

Respond with ONLY valid JSON. Start with [ - no other text.
```

---

## Expected Improvements

1. **Reliability**: Lower temperature + simpler prompts = more consistent JSON output
2. **Quality**: Few-shot examples guide the model toward desired output format
3. **Diversity**: Negative constraints provide diversity without high temperature
4. **Speed**: Shorter prompts = faster processing

---

## Testing Recommendations

1. Run the enhancement system and compare:
   - JSON parse success rate (should improve)
   - Suggestion diversity (should remain similar)
   - Suggestion quality (should improve)

2. Monitor logs for:
   - "Failed to parse JSON response" errors (should decrease)
   - "Contrastive decoding diversity metrics" (avgSimilarity should be reasonable)

3. A/B test with users if possible

---

## Rollback Plan

If issues occur, revert these files:
- `server/src/config/modelConfig.ts` (temperature change)
- `server/src/services/enhancement/services/CleanPromptBuilder.ts` (complete rewrite)
- `server/src/services/enhancement/services/ContrastiveDiversityEnforcer.ts` (temperature + constraint changes)
- `server/src/utils/StructuredOutputEnforcer.ts` (instruction simplification)

---

## Future Considerations

1. **Model Upgrade**: Consider upgrading to Llama 3.3 70B for complex tasks (Groq also offers this)
2. **Structured Outputs**: Groq notes "Constrained decoding is currently only available on a limited-access Llama 3.1 8B model" - request access if available
3. **Prompt Caching**: Groq offers prompt caching which could speed up repeated few-shot examples
