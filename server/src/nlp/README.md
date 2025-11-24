# Symbolic NLP System for Video Prompt Understanding

## Overview

This directory contains a **deterministic, rule-based NLP pipeline** designed to extract semantic information from video generation prompts without relying on expensive LLM calls. The system implements a multi-stage linguistic analysis approach inspired by traditional computational linguistics.

## Architecture

```
Text Input
    ↓
[Phase 1] POS Tagging (Penn Treebank) + Brill Transformation
    ↓
[Phase 2] Chunking (NP/VP/PP Extraction) → IOB Format
    ↓
[Phase 3] Frame Semantics (Motion/Cinematography/Lighting)
    ↓
[Phase 4] Semantic Role Labeling (Arg0/Arg1/ArgM)
    ↓
[Phase 5] Taxonomy Mapping (Video Prompt Categories)
    ↓
Labeled Spans → Frontend Highlights
```

## Implementation Status

### ✅ **IMPLEMENTED** (Phase 1)

#### 1. POS Tagging (`pos-tagging/PosTagger.js`)
- **Status**: ✅ Working
- **Implementation**: Uses `compromise.js` for tokenization and tag assignment
- **Output**: Penn Treebank (PTB) tags for each token
- **Test Coverage**: Unit tests passing
- **Performance**: ~5ms per prompt

**Example:**
```javascript
Input: "The camera slowly pans left"
Output: [
  { word: "The", tag: "DT" },      // Determiner
  { word: "camera", tag: "NN" },   // Noun
  { word: "slowly", tag: "RB" },   // Adverb
  { word: "pans", tag: "VB" },     // Verb
  { word: "left", tag: "RB" }      // Adverb
]
```

#### 2. Brill Transformation (`pos-tagging/BrillTransformer.js`)
- **Status**: ✅ Working
- **Implementation**: Rule-based tag refinement for domain-specific disambiguation
- **Key Rules**:
  - "pan" + directional → VB (camera movement, not cooking)
  - "truck" + directional → VB (camera movement, not vehicle)
  - Gazetteer terms frozen to prevent retagging
- **Test Coverage**: Unit tests passing
- **Performance**: <1ms per prompt

#### 3. Frame Definitions (`frames/`)
- **Status**: ✅ Defined
- **Frames Implemented**:
  - `MotionFrame.js`: Physical movement (run, walk, fly)
  - `CinematographyFrame.js`: Camera operations (pan, tilt, dolly)
  - `LightingFrame.js`: Illumination (soft, hard, golden hour)
- **Frame Elements**: Defined for each frame (Theme, Goal, Manner, etc.)

#### 4. Gazetteer Integration
- **Status**: ✅ Working
- **Files**: 
  - `gazetteers/cameraMovements.js`
  - `gazetteers/lightingTerms.js`
- **Integration**: Terms are recognized and protected from misclassification

---

### ⚠️ **PARTIALLY WORKING**

#### 5. Chunking (`chunking/ChunkParser.js`)
- **Status**: ⚠️ **Partially Working** - Major Issues
- **Implementation**: Regex-based pattern matching over POS sequences
- **Supported Chunks**: NP (Noun Phrase), VP (Verb Phrase), PP (Prepositional Phrase)

**PROBLEM**: The chunker is still **too greedy** and creates oversized NPs that absorb verbs.

**Example of Current Behavior:**
```javascript
Input: "vibrant green gloves carrying a canvas bag filled with fallen leaves"
Expected: [
  NP: "vibrant green gloves",
  VP: "carrying",
  NP: "a canvas bag",
  VP: "filled",
  PP: "with fallen leaves"
]

Actual: [
  NP: "vibrant green gloves carrying a canvas bag filled"  // ❌ Absorbs verbs!
]
```

**Root Cause**: 
- The `isNPStart()` check returns true for determiners/adjectives/nouns
- Once an NP starts, it consumes **all consecutive nouns** including gerunds (VBG)
- The stopping logic checks the NEXT token but doesn't recognize gerunds as verb boundaries
- "carrying" (VBG) and "filled" (VBN) are tagged as adjectives/nouns in some contexts

**Evidence from Logs:**
```
[DEBUG] Extracted 24 chunks: 
  NP:"vibrant green gloves carrying a canvas bag filled"
  NP:"with fallen leaves as they stroll down a"
```
Only 1 VP extracted out of 24 chunks (96% NPs!)

#### 6. Frame Matching (`frames/FrameMatcher.js`)
- **Status**: ⚠️ **Severely Limited**
- **Implementation**: Searches VP chunks for frame-evoking verbs
- **PROBLEM**: Since VPs aren't being extracted, frames can't be matched

**Evidence from Logs:**
```
[DEBUG] Matched 1 frames   // Out of dozens of potential actions
[Symbolic NLP] Extracted 9 spans with 1 frames
```

**Why Only 1 Frame?**
- Only found 1 VP: "dolly"
- All other verbs ("carrying", "stroll", "filled", "brushing", "creates") are trapped in NPs
- Frame matcher only looks at VPs, so it misses 95% of actions

#### 7. Semantic Role Labeling (`srl/SimplifiedSRL.js`)
- **Status**: ⚠️ **Not Effective**
- **Implementation**: Heuristic-based arg extraction (Arg0, Arg1, ArgM)
- **PROBLEM**: Relies on VP chunks being correctly identified
- **Current Output**: Minimal role labeling due to missing VPs

---

### ❌ **NOT WORKING / BLOCKED**

#### 8. LLM Fallback Prevention
- **Status**: ❌ **FAILING** - LLM is still being called
- **Threshold**: `MIN_SEMANTIC_SPANS = 2` (too low)
- **Current Performance**: 
  - Symbolic NLP: 9 spans extracted
  - LLM called: Yes (2086ms API time in logs)
  - Total spans: 34 (9 semantic + 25 LLM)

**Why LLM is Still Called:**
1. Symbolic NLP produces 9 spans (above threshold of 2)
2. But validation fails or span quality is insufficient
3. System falls back to LLM for comprehensive coverage

#### 9. Chunk Merger (`chunking/ChunkMerger.js`)
- **Status**: ⚠️ **Implemented but Ineffective**
- **Purpose**: Merge adjacent chunks (e.g., NP + PP for complex entities)
- **PROBLEM**: Can't fix what's already broken in ChunkParser
- **Evidence**: Logs show "Merged to 24 chunks" = no actual merging occurred

---

## Performance Analysis

### Current Metrics (from logs)

```
Prompt: "Low-angle shot of a young botanist in vibrant green gloves..."
- Tokens: 178
- POS Tagged: ✅ 178 tokens (success)
- Brill Transformed: ✅ 178 tokens (success)
- Chunks Extracted: ⚠️ 24 chunks (96% NPs, 4% VPs)
- Frames Matched: ❌ 1 frame (should be ~5-10)
- Semantic Spans: ⚠️ 9 spans (insufficient)
- LLM Called: ❌ YES (2086ms)
- Total Spans: 34 (73% from LLM)
```

### Expected vs. Actual

| Metric | Expected | Actual | Status |
|--------|----------|--------|--------|
| VP Extraction Rate | 15-20% | 4% | ❌ POOR |
| Frame Detection | 5-10 per prompt | 1 per prompt | ❌ POOR |
| Semantic Spans | 20-30 | 9 | ❌ POOR |
| LLM Bypass Rate | 80%+ | 0% | ❌ FAIL |
| Latency | <50ms | 2100ms (w/ LLM) | ❌ FAIL |

---

## Root Cause Analysis

### Primary Issue: Gerund/Participle Misclassification

**The Core Problem**: English gerunds (VBG) and past participles (VBN) can function as:
1. **Verbs**: "The camera is **panning** left" (progressive aspect)
2. **Adjectives**: "A **panning** shot" (modifies "shot")
3. **Nouns**: "**Panning** is a technique" (gerund as subject)

**Current Behavior**:
- `compromise.js` often tags gerunds as adjectives or nouns in descriptive contexts
- ChunkParser's NP pattern: `<DT>? <JJ.*>* <NN.*>+` **includes gerunds tagged as JJ or NN**
- Result: "carrying a bag" becomes one NP instead of VP + NP

**Example Breakdown**:
```javascript
Text: "gloves carrying a bag"

Current POS Tags:
  gloves → NN
  carrying → VBG (but treated as JJ in context)
  a → DT
  bag → NN

Current Chunking:
  NP: "gloves carrying a bag"  ❌

Desired Chunking:
  NP: "gloves"
  VP: "carrying"
  NP: "a bag"  ✅
```

### Secondary Issues

1. **No Verb Detection in NP Tagging**
   - `tagNP()` checks for nouns but doesn't check if next token is a verb
   - Stopping logic only looks for `isVerbTag()` but gerunds aren't consistently verb-tagged

2. **Greedy Noun Consumption**
   - Max length of 8 tokens is still too high for video prompts
   - Should be 3-4 tokens max for typical NPs

3. **Order of Chunk Type Checks**
   - NP is checked first (line 168 in `ChunkParser.js`)
   - VPs are only checked if NP check fails
   - This means determiners always start NPs, even if followed by verbs

4. **Compromise.js Limitations**
   - Lightweight library optimized for speed, not linguistic accuracy
   - Context-dependent tagging is limited
   - No access to dependency parsing or syntax trees

---

## Critical Fixes Needed

### Priority 1: Fix VP Extraction (CRITICAL)

**Current Code (ChunkParser.js:237)**:
```javascript
while (i < tokens.length && isNounTag(tokens[i].tag)) {
  // ... consumes all nouns including gerunds
}
```

**Problem**: `isNounTag()` returns true for VBG/VBN in many cases

**Solution Options**:

#### Option A: Explicit VBG/VBN Detection
```javascript
// Check if token is a gerund or participle that should be a verb
function isVerbForm(token) {
  return token.tag === 'VBG' || 
         token.tag === 'VBN' || 
         token.tag === 'VBZ' ||
         isVerbTag(token.tag);
}

// In tagNP(), stop before verb forms:
if (i < tokens.length && isVerbForm(tokens[i])) {
  break; // Don't absorb verb into NP
}
```

#### Option B: Two-Pass Parsing
```javascript
// Pass 1: Extract all VPs first (priority)
// Pass 2: Extract NPs from remaining tokens
// Pass 3: Extract PPs

static assignIOBTags(tokens) {
  const iobTokens = tokens.map(t => ({ ...t, iobTag: IOB_TAGS.O }));
  
  // VP FIRST (prioritize verb extraction)
  let i = 0;
  while (i < iobTokens.length) {
    if (ChunkParser.isVPStart(iobTokens, i)) {
      i = ChunkParser.tagVP(iobTokens, i);
    } else {
      i++;
    }
  }
  
  // Then NPs
  i = 0;
  while (i < iobTokens.length) {
    if (iobTokens[i].iobTag === IOB_TAGS.O && ChunkParser.isNPStart(iobTokens, i)) {
      i = ChunkParser.tagNP(iobTokens, i);
    } else {
      i++;
    }
  }
  
  // Finally PPs
  // ...
}
```

#### Option C: Reduce NP Max Length
```javascript
// Current: MAX_NP_LENGTH = 8
const MAX_NP_LENGTH = 3; // Much more restrictive

// This forces NPs to break at verb boundaries naturally
```

### Priority 2: Improve isVPStart() (HIGH)

**Current Code**:
```javascript
static isVPStart(tokens, i) {
  if (i >= tokens.length) return false;
  return isVerbTag(tokens[i].tag);
}
```

**Problem**: Only checks for explicit verb tags, misses gerunds

**Solution**:
```javascript
static isVPStart(tokens, i) {
  if (i >= tokens.length) return false;
  
  const token = tokens[i];
  
  // Explicit verb tags
  if (isVerbTag(token.tag)) return true;
  
  // Gerunds/participles in verb context
  if (token.tag === 'VBG' || token.tag === 'VBN') {
    // Check if preceded by auxiliary or followed by object
    const prevToken = i > 0 ? tokens[i - 1] : null;
    const nextToken = i < tokens.length - 1 ? tokens[i + 1] : null;
    
    // "is carrying", "was filled" → VP
    if (prevToken && isAuxiliaryVerb(prevToken.word)) return true;
    
    // "carrying a bag" (followed by determiner) → VP
    if (nextToken && nextToken.tag === 'DT') return true;
  }
  
  return false;
}
```

### Priority 3: Increase MIN_SEMANTIC_SPANS Threshold (MEDIUM)

**Current Config (SpanLabelingConfig.js)**:
```javascript
SYMBOLIC_NLP: {
  ENABLED: true,
  MIN_SEMANTIC_SPANS: 2, // ❌ TOO LOW
}
```

**Problem**: System extracts 9 spans but still calls LLM

**Solution**:
```javascript
SYMBOLIC_NLP: {
  ENABLED: true,
  MIN_SEMANTIC_SPANS: 15, // Should extract 15-20 spans for typical prompt
  MIN_FRAMES: 3, // NEW: Require at least 3 frames matched
  MIN_VP_RATIO: 0.1, // NEW: At least 10% of chunks should be VPs
}
```

### Priority 4: Add VP Ratio Validation (MEDIUM)

Add quality check to prevent LLM fallback when chunking is poor:

```javascript
// In NlpSpanService.js after chunking:
const vpCount = chunks.filter(c => c.type === 'VP').length;
const vpRatio = vpCount / chunks.length;

if (vpRatio < 0.1) {
  console.warn(`[Symbolic NLP] Poor VP extraction (${vpRatio*100}%). Needs fixing!`);
  // Still try to extract what we can, but log the issue
}
```

---

## Testing Strategy

### Unit Tests Needed

1. **Gerund Detection Tests** (`pos-tagging/__tests__/PosTagger.test.js`)
```javascript
it('should correctly identify gerunds as verbs in action contexts', () => {
  const text = 'A person carrying a bag';
  const tokens = PosTagger.tagPOS(text);
  const carryingToken = tokens.find(t => t.word === 'carrying');
  
  expect(carryingToken.tag).toMatch(/VB/); // Should be VBG or similar
});
```

2. **VP Extraction Tests** (`chunking/__tests__/ChunkParser.test.js`)
```javascript
it('should extract VPs from gerund forms', () => {
  const tokens = [
    { word: 'person', tag: 'NN' },
    { word: 'carrying', tag: 'VBG' },
    { word: 'a', tag: 'DT' },
    { word: 'bag', tag: 'NN' }
  ];
  
  const chunks = ChunkParser.extractChunks(tokens);
  
  expect(chunks).toContainEqual(
    expect.objectContaining({ type: 'VP', text: 'carrying' })
  );
});
```

3. **End-to-End Tests** (`nlp/__tests__/integration.test.js`)
```javascript
it('should extract semantic spans without LLM fallback', async () => {
  const text = 'The camera slowly pans left over a lush green forest';
  const result = await extractSemanticSpans(text);
  
  expect(result.stats.phase).toBe('semantic'); // Not 'fallback-dictionary'
  expect(result.spans.length).toBeGreaterThan(10);
  expect(result.semantic.frames.length).toBeGreaterThan(2);
});
```

---

## Performance Targets

### After Fixes

| Metric | Target | Rationale |
|--------|--------|-----------|
| VP Extraction Rate | 15-20% | Typical sentence has 1-2 verbs per 10 words |
| Frame Detection | 3-5 per prompt | Motion + Camera + Lighting |
| Semantic Spans | 15-25 | Should cover most semantic elements |
| LLM Bypass Rate | 85%+ | Only complex/ambiguous prompts need LLM |
| Latency | <100ms | Symbolic should be 10-20x faster than LLM |
| Accuracy | 90%+ | For known patterns and technical terms |

---

## Usage

### Current Integration

**Entry Point**: `server/src/llm/span-labeling/services/NlpSpanService.js`

```javascript
import { extractSemanticSpans } from './NlpSpanService.js';

const result = await extractSemanticSpans(promptText);

console.log(result);
// {
//   spans: [...],           // Extracted spans with taxonomy roles
//   semantic: {
//     tokens: [...],        // POS-tagged tokens
//     chunks: [...],        // NP/VP/PP chunks
//     frames: [...],        // Matched semantic frames
//     srlStructures: [...], // Semantic role labels
//   },
//   stats: {
//     phase: 'semantic',    // or 'fallback-dictionary'
//     latency: 67,          // ms
//     spanCount: 9,
//     frames: 1,
//   }
// }
```

### Debug Mode

Enable debug logging to see the pipeline stages:

```javascript
// Already enabled in NlpSpanService.js
console.log(`[DEBUG] POS Tagged ${tokens.length} tokens`);
console.log(`[DEBUG] Extracted ${chunks.length} chunks:`, ...);
console.log(`[DEBUG] Matched ${frames.length} frames`);
```

---

## Next Steps

### Immediate (Week 1)
1. ✅ Fix VP extraction with gerund/participle handling (Priority 1A)
2. ✅ Implement two-pass chunking (Priority 1B)
3. ✅ Reduce MAX_NP_LENGTH to 3 tokens (Priority 1C)
4. ✅ Add VP ratio validation (Priority 4)
5. 📝 Write unit tests for new VP logic

### Short-term (Week 2)
6. 🔄 Improve frame matching to handle embedded verbs
7. 🔄 Enhance SRL to work with corrected chunks
8. 🔄 Increase MIN_SEMANTIC_SPANS to 15
9. 📝 Add integration tests
10. 📊 Benchmark against LLM baseline

### Medium-term (Month 1)
11. 🎯 Add dependency parsing (optional: use Stanza/spaCy via Python subprocess)
12. 🎯 Implement coreference resolution ("the camera" → "it")
13. 🎯 Add temporal reasoning (sequence of actions)
14. 🎯 Build scene graph construction
15. 📊 A/B test symbolic vs LLM in production

### Long-term (Quarter 1)
16. 🚀 Train domain-specific POS tagger on video prompt corpus
17. 🚀 Add multi-sentence prompt support
18. 🚀 Implement style transfer understanding
19. 🚀 Build video timeline reconstruction
20. 📊 Achieve 95%+ LLM bypass rate

---

## Files Structure

```
server/src/nlp/
├── README.md                          # This file
│
├── pos-tagging/
│   ├── PosTagger.js                   # ✅ Penn Treebank POS tagging
│   ├── BrillTransformer.js            # ✅ Rule-based tag refinement
│   └── __tests__/
│       └── PosTagger.test.js          # ✅ Unit tests
│
├── chunking/
│   ├── ChunkParser.js                 # ⚠️ NP/VP/PP extraction (NEEDS FIX)
│   ├── ChunkMerger.js                 # ⚠️ Chunk merging (limited effect)
│   └── __tests__/
│       └── ChunkParser.test.js        # ✅ Unit tests (need updates)
│
├── frames/
│   ├── MotionFrame.js                 # ✅ Motion semantics
│   ├── CinematographyFrame.js         # ✅ Camera operations
│   ├── LightingFrame.js               # ✅ Illumination
│   └── FrameMatcher.js                # ⚠️ Frame matching (limited by chunking)
│
├── srl/
│   ├── SimplifiedSRL.js               # ⚠️ Semantic role labeling (blocked)
│   └── RoleMapper.js                  # ✅ Taxonomy mapping
│
├── gazetteers/
│   ├── cameraMovements.js             # ✅ Camera term dictionary
│   └── lightingTerms.js               # ✅ Lighting term dictionary
│
└── utils/
    └── PennTreebankTags.js            # ✅ PTB tagset definitions
```

---

## Conclusion

The symbolic NLP system has a **solid foundation** with POS tagging, Brill transformation, and frame definitions all working correctly. However, the **chunking layer is critically broken**, causing a cascade of failures in frame matching and semantic role labeling.

**The good news**: The architecture is sound and the problem is isolated to VP extraction. Once fixed, the system should achieve 85%+ LLM bypass rate and provide fast, deterministic semantic understanding.

**Status**: 🟡 **Phase 1 Complete** | 🔴 **Chunking Critical Fix Needed** | 🟢 **Architecture Validated**

---

## References

- Penn Treebank POS Tags: https://www.ling.upenn.edu/courses/Fall_2003/ling001/penn_treebank_pos.html
- Brill Tagger: Brill, E. (1992). "A simple rule-based part of speech tagger"
- IOB Format: Ramshaw & Marcus (1995). "Text Chunking using Transformation-Based Learning"
- FrameNet: https://framenet.icsi.berkeley.edu/
- PropBank: https://propbank.github.io/
- compromise.js: https://github.com/spencermountain/compromise

---

**Last Updated**: November 23, 2025
**Version**: 0.1.0-alpha
**Status**: Development / Debugging Phase

