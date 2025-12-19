# Provider-Specific Schema Optimization

## Overview

This implementation uses **different strategies for OpenAI vs Groq** based on how each provider processes schemas and prompts.

## Key Difference

| Aspect | OpenAI/GPT-4o | Groq/Llama 3 |
|--------|---------------|--------------|
| Schema mode | Grammar-constrained (strict) | Validation-only |
| Description processing | **During generation** | Post-hoc validation |
| Where rules live | Schema descriptions | System prompt |
| Prompt size | Minimal (~400 tokens) | Full (~1000 tokens) |
| Schema size | Rich (~600 tokens) | Basic (~200 tokens) |

## OpenAI/GPT-4o Strategy

**Research basis**: OpenAI documentation confirms schema descriptions ARE processed during token generation.

**Implementation**:
```
┌─────────────────────────────────────────┐
│ SYSTEM PROMPT (~400 tokens)             │
│ - Security preamble                     │
│ - One example                           │
│ - Format reminder                       │
└─────────────────────────────────────────┘
                 +
┌─────────────────────────────────────────┐
│ JSON SCHEMA (~600 tokens)               │
│ - role.description: Full disambiguation│
│ - text.description: Exact match rules  │
│ - spans.description: What to label     │
│ - confidence.description: Guidelines   │
│ - analysis_trace.description: CoT      │
│ - strict: true (grammar-constrained)   │
└─────────────────────────────────────────┘
```

**Why this works**: 
- Grammar-constrained decoding guarantees structural compliance
- Descriptions guide semantic decisions during generation
- Model "reads" descriptions when deciding values

**Files**: `schemas/OpenAISchema.ts`

## Groq/Llama 3 Strategy

**Research basis**: Llama 3 PDF Section 1.2 (GAtt mechanism), Section 3.1 (system prompt rules)

**Implementation**:
```
┌─────────────────────────────────────────┐
│ SYSTEM PROMPT (~1000 tokens)            │
│ - Security preamble                     │
│ - TypeScript interface                  │
│ - Valid taxonomy IDs list               │
│ - "What TO Label" guidance              │
│ - Category mapping table                │
│ - Disambiguation decision tree          │
│ - Critical rules                        │
│ - Adversarial detection                 │
│ - Full example                          │
└─────────────────────────────────────────┘
                 +
┌─────────────────────────────────────────┐
│ JSON SCHEMA (~200 tokens)               │
│ - role enum: [valid IDs]                │
│ - confidence: min 0, max 1              │
│ - required fields                       │
│ - Minimal descriptions                  │
└─────────────────────────────────────────┘
                 +
┌─────────────────────────────────────────┐
│ LLAMA 3 OPTIMIZATIONS                   │
│ - Sandwich prompting (Section 3.2)      │
│ - Pre-fill assistant "{" (Section 3.3)  │
│ - XML wrapping (Section 5.1)            │
│ - Temperature 0.1 (Section 4.1)         │
│ - top_p 0.95 (Section 4.1)              │
└─────────────────────────────────────────┘
```

**Why this works**:
- GAtt attention mechanism maintains focus on system prompt
- Full rules ensure accurate disambiguation
- Schema validates output but doesn't guide generation
- Pre-fill guarantees JSON start without preamble

**Files**: `schemas/GroqSchema.ts`

## Usage

```typescript
import { 
  buildSystemPrompt, 
  getSchema, 
  getAdapterOptions,
  buildSpanLabelingMessages 
} from './utils/promptBuilder';

// For OpenAI
const openaiPrompt = buildSystemPrompt(text, false, 'openai');
const openaiSchema = getSchema('openai');
const openaiOptions = getAdapterOptions('openai');

// For Groq
const groqPrompt = buildSystemPrompt(text, false, 'groq');
const groqSchema = getSchema('groq');
const groqOptions = getAdapterOptions('groq');

// Or use complete message builder
const messages = buildSpanLabelingMessages(text, true, 'openai');
```

## Token Comparison

| Component | OpenAI | Groq |
|-----------|--------|------|
| Prompt | 400 | 1000 |
| Schema | 600 | 200 |
| Few-shot (2 examples) | 300 | 450 |
| **Total** | **1300** | **1650** |

OpenAI saves ~350 tokens per request while maintaining accuracy through schema-embedded rules.

## What Each Schema Enforces

### OpenAI Schema (Enriched)
| Field | Structural | Semantic |
|-------|-----------|----------|
| analysis_trace | Required string | CoT instruction in description |
| spans[].text | Required string | Exact match rule in description |
| spans[].role | Enum constraint | Full disambiguation in description |
| spans[].confidence | Number 0-1 | Guidelines in description |
| meta | Required object | Version hint in description |
| isAdversarial | Required boolean | Detection rules in description |

### Groq Schema (Validation)
| Field | Structural | Semantic |
|-------|-----------|----------|
| analysis_trace | Required string | Minimal description |
| spans[].text | Required string | Minimal description |
| spans[].role | Enum constraint | Validated post-hoc |
| spans[].confidence | Number 0-1 | Minimal description |
| meta | Required object | Minimal description |
| isAdversarial | Required boolean | Minimal description |

## Files Structure

```
schemas/
├── OpenAISchema.ts       # Enriched schema + minimal prompt
├── GroqSchema.ts         # Basic schema + full prompt  
├── SpanLabelingSchema.ts # Shared types and taxonomy IDs
└── DescriptionEnrichedSchema.ts  # [DEPRECATED - use OpenAISchema.ts]

utils/
└── promptBuilder.ts      # Provider-aware builder
```

## Testing Recommendations

1. **A/B Test Accuracy**
   - Same inputs to both providers
   - Compare span accuracy, category assignment
   - Measure disambiguation correctness

2. **Token Usage**
   - OpenAI should use ~350 fewer input tokens
   - Validate with actual API responses

3. **Error Rates**
   - Monitor JSON parse failures
   - Track invalid taxonomy ID rates
   - Compare retry rates

4. **Latency**
   - OpenAI may be faster (smaller prompt)
   - Groq already fast due to LPU architecture
