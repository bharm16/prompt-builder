# PDF Enhancements Implementation

## Overview

This document details the implementation of two high-impact features from the research PDFs:
1. **Contrastive Decoding** - Enhanced diversity through iterative generation with negative constraints
2. **LLM-as-a-Judge** - Optional quality evaluation using research-backed rubrics

All features are based on peer-reviewed research and implement patterns recommended in the PDF documents.

## 1. Contrastive Decoding (PDF Section 6.3)

### What It Does

Prevents "visual collapse" where all suggestions cluster around similar concepts. Implements the PDF's 3-batch approach:
- **Batch 1**: 4 suggestions at temperature 0.7 (standard creativity)
- **Batch 2**: 4 suggestions at temperature 0.9 with negative constraint listing Batch 1
- **Batch 3**: 4 suggestions at temperature 1.0 with negative constraint listing Batches 1+2

### Why It Matters

From the PDF: "Standard temperature sampling is often insufficient for generating 12 truly distinct ideas; models tend to cluster around the most probable synonyms."

**Expected Impact**: 60%+ reduction in similar suggestion clusters (measured via Jaccard similarity).

### When It's Used

Automatically activated for:
- Video prompts (where visual diversity is critical)
- Placeholder generation (needing varied creative directions)
- Text over 20 characters (shorter text doesn't benefit)

### Configuration

```javascript
// server/src/services/enhancement/services/ContrastiveDiversityEnforcer.js
this.config = {
  batchSizes: [4, 4, 4],       // Total: 12 suggestions
  temperatures: [0.7, 0.9, 1.0], // Increasing creativity
  enabled: true,
};
```

### Implementation Files

- `server/src/services/enhancement/services/ContrastiveDiversityEnforcer.js` - Core service
- `server/src/services/enhancement/EnhancementService.js` - Integration point (line ~210-250)
- `tests/unit/server/services/ContrastiveDiversityEnforcer.test.js` - Test suite

### Performance Impact

- **Latency**: ~2-3x standard generation (3 batches vs 1)
- **Quality**: Significantly more diverse suggestions
- **Cost**: ~3x API calls (mitigated by caching)

### Telemetry

Logged metrics:
- `usedContrastiveDecoding`: Boolean flag
- `batch1Count`, `batch2Count`, `batch3Count`: Suggestions per batch
- `avgSimilarity`, `minSimilarity`, `maxSimilarity`: Diversity metrics

## 2. LLM-as-a-Judge (PDF Section 5.3)

### What It Does

Provides optional quality evaluation using a high-capability LLM (GPT-4o or Claude Sonnet-4) to score suggestions against research-backed rubrics.

### Why It Matters

From the PDF: "This tier evaluates the qualitative aspects: Does the prompt sound like a director wrote it? Is it safe?"

**Use Cases**:
- A/B testing different generation strategies
- Quality assurance for production systems
- User feedback correlation analysis
- Model comparison benchmarks

### Video Prompt Rubric (1-5 scale each)

1. **Cinematic Quality (30% weight)**: Uses technical lexicon (dolly, volumetric, rack focus)?
2. **Visual Grounding (30% weight)**: Concrete, camera-visible descriptions (no abstractions)?
3. **Safety (20% weight)**: Free from offensive/biased content?
4. **Diversity (20% weight)**: Options cover orthogonal visual directions?

### General Text Rubric (1-5 scale each)

1. **Coherence (30% weight)**: Maintains context and fits naturally?
2. **Specificity (25% weight)**: Concrete and precise vs. vague?
3. **Usefulness (25% weight)**: Genuinely improves the text?
4. **Diversity (20% weight)**: Explores different approaches?

### API Endpoints

#### POST /api/suggestions/evaluate
Evaluate a set of suggestions:

```javascript
// Request
{
  "suggestions": [
    { "text": "Wide shot, 35mm anamorphic lens" },
    { "text": "Close-up with shallow depth of field" }
  ],
  "context": {
    "highlightedText": "camera shot",
    "fullPrompt": "A cinematic scene...",
    "isVideoPrompt": true
  },
  "rubric": "video" // Optional: "video" or "general" (auto-detects if omitted)
}

// Response
{
  "evaluation": {
    "overallScore": 85,  // 0-100
    "rubricScores": {
      "cinematicQuality": 5,
      "visualGrounding": 4,
      "safety": 5,
      "diversity": 3
    },
    "feedback": ["Good technical terminology", "Consider more varied camera angles"],
    "strengths": ["Strong use of Director's Lexicon", "Concrete visual descriptions"],
    "weaknesses": ["Limited diversity in shot types"],
    "detailedNotes": "Suggestions demonstrate strong...",
    "metadata": {
      "rubricUsed": "video_prompt_evaluation",
      "evaluatedAt": "2025-11-23T10:30:00Z",
      "suggestionCount": 2,
      "evaluationTime": 1250
    }
  },
  "responseTime": 1250
}
```

#### POST /api/suggestions/evaluate/single
Evaluate a single suggestion in detail (same schema, single suggestion).

#### POST /api/suggestions/evaluate/compare
Compare two suggestion sets:

```javascript
// Request
{
  "setA": [{ "text": "..." }, ...],
  "setB": [{ "text": "..." }, ...],
  "context": { ... },
  "rubric": "video"
}

// Response
{
  "comparison": {
    "setA": { /* full evaluation */ },
    "setB": { /* full evaluation */ },
    "winner": "A",  // "A", "B", or "TIE"
    "scoreDifference": 12,
    "criteriaComparison": {
      "cinematicQuality": {
        "setA": 5,
        "setB": 4,
        "difference": 1,
        "winner": "A"
      },
      // ... other criteria
    }
  }
}
```

#### GET /api/suggestions/rubrics
Get rubric definitions for documentation/debugging.

### Implementation Files

- `server/src/services/quality-feedback/services/LLMJudgeService.js` - Core service
- `server/src/services/quality-feedback/config/judgeRubrics.js` - Rubric definitions
- `server/src/routes/suggestions.js` - API endpoints
- `server/src/config/routes.config.js` - Route registration
- `tests/unit/server/services/LLMJudgeService.test.js` - Test suite

### Configuration

```javascript
// server/src/config/modelConfig.js
llm_judge_video: {
  client: 'openai',
  model: 'gpt-4o',           // High-capability model
  temperature: 0.2,          // Low for consistent evaluation
  maxTokens: 2048,
  timeout: 45000,
  fallbackTo: 'anthropic',
},

llm_judge_general: {
  client: 'anthropic',
  model: 'claude-sonnet-4',  // Excellent for nuanced analysis
  temperature: 0.3,
  maxTokens: 2048,
  timeout: 45000,
  fallbackTo: 'openai',
}
```

### Performance Impact

- **Latency**: ~1-3 seconds per evaluation (GPT-4o/Claude Sonnet-4)
- **Cost**: ~$0.01-0.03 per evaluation (varies by model)
- **Accuracy**: High correlation with human evaluators (per LLM-as-a-Judge literature)

### When to Use

✅ **Good Use Cases**:
- A/B testing generation strategies
- Quality benchmarking across model versions
- Correlation analysis with user acceptance
- Production quality gates (async)

❌ **Avoid For**:
- Real-time user-facing suggestions (too slow)
- High-frequency calls (too expensive)
- Binary pass/fail decisions (overkill)

## Environment Variables

```bash
# Contrastive Decoding (uses existing enhance_suggestions operation)
# No new env vars needed

# LLM-as-a-Judge
JUDGE_PROVIDER=openai          # Provider for video evaluation
JUDGE_MODEL=gpt-4o             # Model for video evaluation
JUDGE_GENERAL_PROVIDER=anthropic  # Provider for general evaluation
JUDGE_GENERAL_MODEL=claude-sonnet-4  # Model for general evaluation
```

## Monitoring & Telemetry

Both features include comprehensive logging:

### Contrastive Decoding
```javascript
logger.info('Contrastive decoding completed', {
  totalSuggestions: 12,
  batch1Count: 4,
  batch2Count: 4,
  batch3Count: 4,
  totalTime: 2350,
  avgSimilarity: 0.23,  // Lower = more diverse
  minSimilarity: 0.05,
  maxSimilarity: 0.45
});
```

### LLM-as-a-Judge
```javascript
logger.info('LLM-as-a-Judge evaluation completed', {
  overallScore: 85,
  rubricScores: { cinematicQuality: 5, ... },
  evaluationTime: 1250
});
```

## Testing

Run all tests:
```bash
npm test -- ContrastiveDiversityEnforcer
npm test -- LLMJudgeService
```

## Success Metrics

### Contrastive Decoding
- ✅ Reduce similar suggestion clusters by 60%+ (Jaccard similarity metric)
- ✅ Maintain generation quality (no degradation in user acceptance)
- ✅ Telemetry shows diversity metrics improve across video prompts

### LLM-as-a-Judge
- ✅ Quality scores correlate with user acceptance rates (r > 0.7)
- ✅ Evaluation consistency (same input → similar scores)
- ✅ Useful feedback for model improvement

## Future Enhancements

### Deferred: CLIP Embeddings (PDF Metric 4)

**Why deferred**: 
- Requires Python microservice + CLIP model hosting
- PDF admits CLIP is a *proxy* for visual diversity, not ground truth
- Text-based diversity (Jaccard similarity) catches most issues

**When to implement**:
- User feedback shows text-based diversity insufficient
- Infrastructure for Python microservices exists
- Budget allows for CLIP API costs or model hosting

### Potential Improvements

1. **Contrastive Decoding**:
   - Adaptive batch sizes based on initial diversity
   - Temperature scheduling per criterion type
   - Semantic distance metrics beyond Jaccard

2. **LLM-as-a-Judge**:
   - Cached evaluations for identical inputs
   - Async evaluation queue for production
   - Custom rubrics per user/organization

## References

- **PDF Section 3.3**: High-entropy sampling and contrastive decoding
- **PDF Section 5.2**: Visual diversity via proxy (Vendi Score on CLIP)
- **PDF Section 5.3**: LLM-as-a-Judge paradigm
- **PDF Section 6.3**: Diversity sampling with contrastive penalty

## Support

For questions or issues:
1. Check logs for telemetry data
2. Review test suites for usage examples
3. Consult rubric definitions for evaluation criteria
4. See performance metrics in Sentry/monitoring dashboard
