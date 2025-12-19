# Algorithmic Prompt Builder - Usage Examples

## Quick Start

### 1. Enable the Feature

Add to your `.env` file or export in your terminal:

```bash
USE_ALGORITHMIC_PROMPT_BUILDER=true
```

### 2. Start the Server

```bash
npm start
```

That's it! The system will now use algorithmic analysis for placeholder suggestions.

## Example Input → Analysis → Output Flow

### Example 1: Simple Technical Term

**Input**:
- Highlighted text: `"wooden"`
- Context: "A wooden table in the corner"
- Existing spans: 3 objects, 2 locations (low diversity)

**Algorithmic Analysis**:
```javascript
{
  complexity: 0.2,           // Simple word
  lexicalDiversity: 0.45,    // Moderate diversity
  entropy: 1.2,              // Low entropy
  repetitionRate: 0.3        // Some repetition
}
```

**Translation Layer Output**:
```javascript
{
  persona: "Creative Novelist",
  directives: [
    "Add descriptive depth. The current text is too simple.",
    "Use sensory details (texture, light, sound).",
    "Maximize categorical diversity in your suggestions."
  ],
  negativeConstraints: [
    "🚫 Avoid jargon and complex sentence structures."
  ]
}
```

**Generated Prompt** (excerpt):
```
You are a Creative Novelist specializing in placeholder value suggestion...

<CONTEXT_ANALYSIS>
The writing style is detected as: **Narrative/Casual**
Current lexical diversity: **45%**
Information density: **increase_moderately**
Semantic entropy: **1.20** (low - need more variety)
</CONTEXT_ANALYSIS>

<ALGORITHMIC_DIRECTIVES>
- Add descriptive depth. The current text is too simple.
- Use sensory details (texture, light, sound).
- Maximize categorical diversity in your suggestions.
</ALGORITHMIC_DIRECTIVES>

Generate 12-15 suggestions organized into 4-5 CATEGORIES...
```

**Expected Output** (more diverse than baseline):
```json
[
  {"text": "weathered oak", "category": "Materials", "explanation": "Adds texture"},
  {"text": "reclaimed pine", "category": "Materials", "explanation": "Eco-friendly"},
  {"text": "industrial metal", "category": "Materials", "explanation": "Modern contrast"},
  {"text": "vintage marble", "category": "Materials", "explanation": "Elegant feel"},
  {"text": "minimalist glass", "category": "Styles", "explanation": "Contemporary"},
  {"text": "rustic farmhouse", "category": "Styles", "explanation": "Cozy aesthetic"},
  {"text": "smooth polished", "category": "Textures", "explanation": "Tactile quality"},
  {"text": "rough hewn", "category": "Textures", "explanation": "Artisanal feel"}
]
```

### Example 2: Complex Technical Phrase

**Input**:
- Highlighted text: `"utilizing advanced machine learning algorithms"`
- Context: Technical documentation
- Existing spans: 8 technical terms (high repetition)

**Algorithmic Analysis**:
```javascript
{
  complexity: 0.8,           // Complex phrase
  lexicalDiversity: 0.3,     // Low diversity (repetitive)
  entropy: 2.1,              // Good entropy
  repetitionRate: 0.6,       // High repetition
  dominantTokens: ["using", "advanced", "machine", "learning"]
}
```

**Translation Layer Output**:
```javascript
{
  persona: "Clarity Expert",
  directives: [
    "Simplify the phrasing. The current text is too dense.",
    "Inject lexical variety."
  ],
  negativeConstraints: [
    "🚫 Avoid jargon and complex sentence structures.",
    "🚫 Strictly avoid repeating these dominant words: using, advanced, machine"
  ]
}
```

**Generated Prompt** (excerpt):
```
You are a Clarity Expert specializing in placeholder value suggestion...

<CONTEXT_ANALYSIS>
The writing style is detected as: **Academic/Technical**
Current lexical diversity: **30%**
Information density: **maintain**
Semantic entropy: **2.10** (good diversity)
</CONTEXT_ANALYSIS>

<ALGORITHMIC_DIRECTIVES>
- Simplify the phrasing. The current text is too dense.
- Inject lexical variety.
</ALGORITHMIC_DIRECTIVES>

<NEGATIVE_CONSTRAINTS>
🚫 Avoid jargon and complex sentence structures.
🚫 Strictly avoid repeating these dominant words: using, advanced, machine
</NEGATIVE_CONSTRAINTS>

Generate 12-15 suggestions organized into 4-5 CATEGORIES...
```

**Expected Output** (simpler, more varied):
```json
[
  {"text": "applying AI models", "category": "Simplified Technical", "explanation": "Clearer phrasing"},
  {"text": "leveraging neural networks", "category": "Specific Methods", "explanation": "More specific"},
  {"text": "deploying classification systems", "category": "Functional Focus", "explanation": "Action-oriented"},
  {"text": "implementing deep learning", "category": "Specific Methods", "explanation": "Technical but clear"}
]
```

## Comparison: Baseline vs Algorithmic

### Scenario: Replace "car" in "driving a car"

**Baseline PromptBuilderService**:
- Uses generic prompt
- May suggest: sedan, SUV, coupe, hatchback, wagon (all same category)
- Limited diversity

**AlgorithmicPromptBuilder**:
1. **Analyzes context**: Low complexity (0.1), low diversity
2. **Computes directives**: "Maximize categorical diversity"
3. **Generates varied suggestions**:
   ```json
   [
     {"text": "electric vehicle", "category": "Technology"},
     {"text": "vintage convertible", "category": "Style"},
     {"text": "luxury sedan", "category": "Class"},
     {"text": "compact hatchback", "category": "Size"},
     {"text": "rugged off-roader", "category": "Capability"}
   ]
   ```

## Testing Different Content Types

### Test 1: Video Prompt (Cinematic)
```javascript
{
  highlightedText: "camera dollies in",
  context: "Cinematic shot where camera dollies in on subject",
  isVideoPrompt: true
}
```

**Analysis**: Moderate complexity, technical domain
**Expected**: Suggestions for camera movements with variety

### Test 2: Narrative Prompt (Creative)
```javascript
{
  highlightedText: "ancient forest",
  context: "They wandered through an ancient forest",
  isVideoPrompt: false
}
```

**Analysis**: Low complexity, creative domain
**Expected**: Sensory, descriptive alternatives

### Test 3: Repetitive Context
```javascript
{
  highlightedText: "modern",
  context: "modern design with modern aesthetics and modern principles",
  allLabeledSpans: [/* many "modern" spans */]
}
```

**Analysis**: High repetition rate (0.8)
**Expected**: Strong negative constraints against "modern", push for synonyms

## Monitoring Effectiveness

### Metrics to Track

1. **Categorical Diversity**:
   - Baseline: ~2-3 categories average
   - Algorithmic: Target 4-5 categories

2. **Lexical Variety**:
   - Measure unique words in suggestions
   - Algorithmic should have higher TTR

3. **User Acceptance**:
   - Track which suggestions users select
   - Compare acceptance rate vs baseline

4. **Generation Time**:
   - Algorithmic adds ~50-100ms for analysis
   - Still well within acceptable latency

### A/B Testing Setup

```javascript
// In your test harness
const testCases = [
  { text: "wooden", context: "...", expectedCategories: 4 },
  { text: "advanced ML", context: "...", expectedSimplification: true },
  // ... more test cases
];

// Compare results
for (const testCase of testCases) {
  const baselineResult = await getEnhancementWithBaseline(testCase);
  const algorithmicResult = await getEnhancementWithAlgorithmic(testCase);
  
  console.log('Baseline categories:', countCategories(baselineResult));
  console.log('Algorithmic categories:', countCategories(algorithmicResult));
}
```

## Troubleshooting

### Issue: Suggestions are too simple

**Cause**: Input complexity too low, triggering simplification
**Solution**: The algorithm adapts to input - this is expected for simple inputs

### Issue: Not enough diversity

**Check**:
1. Verify `USE_ALGORITHMIC_PROMPT_BUILDER=true` is set
2. Check logs for which builder is being used
3. Inspect the generated prompt to see directives

### Issue: Unexpected persona/directives

**Debug**: Add logging in `translateToNaturalLanguage()`:
```javascript
console.log('Analysis:', analysis);
console.log('Translation:', { persona, directives, negativeConstraints });
```

## Advanced Configuration (Future)

Potential configuration options (not yet implemented):

```javascript
enhancement: {
  useAlgorithmicPromptBuilder: true,
  algorithmicSettings: {
    complexityThresholds: { high: 0.7, low: 0.3 },
    diversityTarget: 0.6,
    entropyWeight: 1.0
  }
}
```

## Rollback Plan

If issues arise:

1. **Immediate**: Set `USE_ALGORITHMIC_PROMPT_BUILDER=false`
2. **Restart**: Server automatically uses baseline `PromptBuilderService`
3. **No code changes needed**: Feature flag handles everything

## Summary

The AlgorithmicPromptBuilder provides:
- ✅ Automatic adaptation to content characteristics
- ✅ Increased categorical diversity
- ✅ Reduced repetition through negative constraints
- ✅ Better LLM comprehension via natural language translation
- ✅ Zero-downtime feature flag control
- ✅ Full backward compatibility

Enable it with one environment variable and compare results!

