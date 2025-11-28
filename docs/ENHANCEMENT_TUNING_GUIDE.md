# Enhancement Suggestion Tuning Guide

A practical guide to tweaking the enhancement suggestion system for better results.

---

## Quick Reference: Key Files

| File | What It Controls |
|------|------------------|
| `server/src/config/modelConfig.ts` | Model, temperature, timeout |
| `server/src/services/enhancement/services/CleanPromptBuilder.ts` | Prompt templates |
| `server/src/services/enhancement/services/ContrastiveDiversityEnforcer.ts` | Batch temperatures, diversity |
| `server/src/services/enhancement/config/EnhancementExamples.ts` | Few-shot examples |
| `server/src/utils/StructuredOutputEnforcer.ts` | JSON parsing instructions |

---

## 1. Temperature Tuning

### Location: `server/src/config/modelConfig.ts`

```typescript
enhance_suggestions: {
  client: 'groq',
  model: 'llama-3.1-8b-instant',
  temperature: 0.5,  // <-- TUNE THIS
  // ...
}
```

### Temperature Guide

| Value | Effect | Use When |
|-------|--------|----------|
| 0.2-0.3 | Very consistent, less creative | JSON parsing fails often |
| 0.4-0.5 | Balanced (current) | Default starting point |
| 0.6-0.7 | More creative, less reliable | Suggestions feel too similar |
| 0.8+ | High creativity, may break JSON | Not recommended for 8B models |

### Testing Temperature

```bash
# In your test environment, temporarily override:
ENHANCE_TEMPERATURE=0.3 npm run dev

# Or edit modelConfig.ts directly and restart
```

---

## 2. Prompt Template Tuning

### Location: `server/src/services/enhancement/services/CleanPromptBuilder.ts`

### Key Sections to Modify

#### A. Context Window Size (Line ~215)

```typescript
// Current: 600 chars for full prompt, 150 for surrounding text
const promptPreview = this._trim(fullPrompt, 600);  // Try 400-800
const prefix = this._trim(contextBefore, 150, true); // Try 100-200
const suffix = this._trim(contextAfter, 150);        // Try 100-200
```

**Trade-offs:**
- Longer context → More relevant suggestions, but slower + more tokens
- Shorter context → Faster, but may miss important details

#### B. Number of Rules

Each design has 4 rules. You can:
- Add a 5th rule for specific guidance
- Remove rules if model seems confused
- Make rules more/less specific

```typescript
'RULES:',
'1. Keep the SAME SUBJECT/TOPIC - just vary HOW it is described',
'2. Add visual details: textures, materials, lighting, colors',
'3. Each option should look different but stay contextually appropriate',
'4. Return ONLY the replacement phrase (2-20 words)',
// Add: '5. Avoid abstract concepts - be concrete and filmable',
```

#### C. The "Stay On Topic" Line

This is critical for preventing wild suggestions:

```typescript
// Current (end of _buildVisualPrompt):
`IMPORTANT: If replacing "${ctx.highlightedText}", suggestions should still be about "${ctx.highlightedText}" with different visual details.`,
```

**Variations to test:**

```typescript
// More explicit:
`CRITICAL: You are describing variations of "${ctx.highlightedText}" - NOT replacing it with something else entirely.`,

// With examples:
`Example: If replacing "wooden table", good suggestions are "oak dining table", "weathered farm table" - NOT "metal chair" or "glass desk".`,

// Shorter:
`Stay on topic: variations of "${ctx.highlightedText}" only.`,
```

---

## 3. Contrastive Decoding Tuning

### Location: `server/src/services/enhancement/services/ContrastiveDiversityEnforcer.ts`

### Batch Temperatures (Line ~30)

```typescript
this.config = {
  batchSizes: [4, 4, 4],           // 12 total suggestions
  temperatures: [0.4, 0.5, 0.6],   // <-- TUNE THESE
  enabled: true,
};
```

**Options:**

```typescript
// More consistent (if JSON breaks):
temperatures: [0.3, 0.4, 0.5],

// More diverse (if suggestions too similar):
temperatures: [0.5, 0.6, 0.7],

// Flat (same temp for all):
temperatures: [0.5, 0.5, 0.5],
```

### Disable Contrastive Decoding Entirely

```typescript
this.config = {
  // ...
  enabled: false,  // Uses single-shot generation instead
};
```

This can help debug if contrastive decoding is causing issues.

---

## 4. Testing Workflow

### Step 1: Enable Verbose Logging

In your terminal:

```bash
LOG_LEVEL=debug npm run dev
```

Or in code, temporarily add:

```typescript
// In CleanPromptBuilder._buildVisualPrompt():
console.log('=== GENERATED PROMPT ===');
console.log(prompt);
console.log('========================');
```

### Step 2: Test Specific Inputs

Create a test script:

```javascript
// scripts/test-enhancement.js
const { EnhancementService } = require('../server/src/services/enhancement');

async function test() {
  const service = new EnhancementService(/* deps */);
  
  const result = await service.getEnhancementSuggestions({
    highlightedText: 'log',
    contextBefore: 'A ',
    contextAfter: ' with detailed bark texture rolls down a steep forest hill',
    fullPrompt: 'Action Shot: A log with detailed bark texture and natural imperfections rolls down a steep forest hill...',
  });
  
  console.log('Suggestions:', result.suggestions);
}

test();
```

### Step 3: Check What's Sent to the LLM

Add logging in `SuggestionGenerationService.ts`:

```typescript
// Before the AI call:
console.log('=== SYSTEM PROMPT ===');
console.log(params.systemPrompt);
console.log('=====================');
```

### Step 4: Evaluate Results

For each test, check:

| Check | Pass | Fail |
|-------|------|------|
| JSON parsed successfully? | ✅ | Retry needed |
| All 12 suggestions returned? | ✅ | Some filtered |
| Suggestions are on-topic? | ✅ | Wild tangents |
| Suggestions are diverse? | ✅ | Too similar |
| Grammar fits context? | ✅ | Doesn't flow |

---

## 5. Common Issues & Fixes

### Issue: Suggestions are completely off-topic

**Symptom:** "log" → "obsidian monolith"

**Fixes:**
1. Increase `promptPreview` length (try 800)
2. Add stronger "stay on topic" instruction
3. Remove few-shot examples (they can mislead)

### Issue: JSON parsing fails frequently

**Symptom:** "Missing required field 'explanation'"

**Fixes:**
1. Lower temperature to 0.3-0.4
2. Simplify the output format instruction
3. Add explicit example in prompt:
```typescript
'Example output: [{"text":"phrase here","category":"subject","explanation":"why"}]',
```

### Issue: All suggestions are too similar

**Symptom:** "oak log", "pine log", "birch log" (synonym collapse)

**Fixes:**
1. Increase temperature slightly (0.6)
2. Add diversity instruction:
```typescript
'Each suggestion must differ in MORE than just the wood type - vary texture, condition, lighting, etc.',
```
3. Enable contrastive decoding if disabled

### Issue: Suggestions are too long/short

**Symptom:** Single words or full sentences

**Fixes:**
1. Be explicit about length:
```typescript
'Return phrases of 3-8 words (not single words, not full sentences)',
```
2. Check `videoConstraints.minWords` / `maxWords` values

### Issue: Wrong category assigned

**Symptom:** Camera suggestions labeled as "subject"

**Fixes:**
1. Check `_resolveSlot()` logic
2. Verify `highlightedCategory` is passed correctly from frontend
3. Check taxonomy mapping in `@shared/taxonomy`

---

## 6. A/B Testing Different Prompts

### Create Prompt Variants

```typescript
// In CleanPromptBuilder.ts, add a variant flag:

private _buildVisualPrompt(ctx: SharedPromptContext): string {
  const variant = process.env.PROMPT_VARIANT || 'A';
  
  if (variant === 'B') {
    return this._buildVisualPromptVariantB(ctx);
  }
  return this._buildVisualPromptVariantA(ctx);
}
```

### Test with Environment Variable

```bash
# Test variant A
PROMPT_VARIANT=A npm run dev

# Test variant B  
PROMPT_VARIANT=B npm run dev
```

### Log Results for Comparison

```typescript
logger.info('Enhancement result', {
  variant: process.env.PROMPT_VARIANT,
  highlightedText: params.highlightedText,
  suggestionsCount: result.suggestions.length,
  sampleSuggestions: result.suggestions.slice(0, 3).map(s => s.text),
});
```

---

## 7. Model Alternatives

If Llama 3.1 8B continues to struggle:

### Option A: Use Llama 3.3 70B (still on Groq)

```typescript
// modelConfig.ts
enhance_suggestions: {
  client: 'groq',
  model: 'llama-3.3-70b-versatile',  // More capable
  temperature: 0.7,  // Can handle higher temp
  // ...
}
```

**Trade-off:** Slower (~500ms vs ~150ms) but much more reliable.

### Option B: Use GPT-4o-mini (your fallback)

```typescript
enhance_suggestions: {
  client: 'openai',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  // ...
}
```

**Trade-off:** ~300ms, costs money, but very reliable.

### Option C: Hybrid Approach

Use 8B for simple replacements, fall back to 70B for complex ones:

```typescript
// In EnhancementService
const isComplexReplacement = highlightedText.split(' ').length > 3;
const operation = isComplexReplacement ? 'enhance_suggestions_complex' : 'enhance_suggestions_simple';
```

---

## 8. Monitoring & Metrics

### Key Metrics to Track

Add to your logging/monitoring:

```typescript
// In EnhancementService
const metrics = {
  // Timing
  totalTime: endTime - startTime,
  llmCallTime: groqCallTime,
  
  // Quality
  suggestionsRequested: 12,
  suggestionsReturned: result.suggestions.length,
  jsonRetries: retryCount,
  
  // Context
  highlightedText,
  highlightedCategory,
  promptLength: fullPrompt.length,
  
  // Model
  model: 'llama-3.1-8b-instant',
  temperature: 0.5,
  usedContrastiveDecoding: true,
};

logger.info('Enhancement metrics', metrics);
```

### Dashboard Queries (if using Prometheus/Grafana)

```
# Success rate
sum(rate(enhancement_success_total[5m])) / sum(rate(enhancement_requests_total[5m]))

# Average suggestions per request
avg(enhancement_suggestions_returned)

# JSON retry rate
sum(rate(enhancement_json_retries_total[5m])) / sum(rate(enhancement_requests_total[5m]))
```

---

## 9. Quick Experiments to Try

### Experiment 1: Minimal Prompt

Strip everything down to see baseline behavior:

```typescript
private _buildVisualPromptMinimal(ctx: SharedPromptContext): string {
  return `
Generate 12 variations of "${ctx.highlightedText}" that fit this context:
"${ctx.promptPreview}"

Return JSON: [{"text":"variation","category":"${ctx.slotLabel}","explanation":"why"}]
`.trim();
}
```

### Experiment 2: Chain-of-Thought

Ask the model to reason first:

```typescript
'First, identify what "${ctx.highlightedText}" represents in this scene.',
'Then, generate 12 variations that maintain the same role but add visual variety.',
```

### Experiment 3: Negative Examples

Tell the model what NOT to do:

```typescript
'BAD examples (do NOT do this):',
'- Changing "log" to "boulder" (wrong subject)',
'- Changing "log" to "log" (no change)',
'- Single word answers like "timber"',
'',
'GOOD examples:',
'- "moss-covered fallen oak"',
'- "rotting birch log with peeling bark"',
```

---

## 10. Checklist for Changes

Before deploying prompt changes:

- [ ] Test with 5+ different highlight types (subject, action, camera, style)
- [ ] Verify JSON parsing works consistently (no retries needed)
- [ ] Check suggestions are on-topic for all test cases
- [ ] Measure response time (should be <500ms for Groq)
- [ ] Review logs for any warnings/errors
- [ ] Test fallback path (disable Groq, verify OpenAI works)

---

## Quick Commands

```bash
# Run with debug logging
LOG_LEVEL=debug npm run dev

# Test specific prompt variant
PROMPT_VARIANT=B npm run dev

# Use fallback model
ENHANCE_PROVIDER=openai npm run dev

# Lower temperature for testing
ENHANCE_TEMPERATURE=0.3 npm run dev

# Check current config
grep -A 10 'enhance_suggestions' server/src/config/modelConfig.ts
```

---

## Need Help?

1. Check logs for the exact prompt being sent
2. Compare with examples in `EnhancementExamples.ts`
3. Test with a known-good input first
4. Try disabling contrastive decoding to isolate issues
5. Fall back to GPT-4o-mini to verify the issue is model-specific
