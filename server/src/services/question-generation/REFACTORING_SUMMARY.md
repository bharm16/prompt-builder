# QuestionGenerationService Refactoring Summary

## Original File
- **Path:** `server/src/services/QuestionGenerationService.js`
- **Size:** 459 lines
- **Type:** Service (Class-based)

## Problems Identified

### 1. Unclear Purpose from Location
- Single file in `/services/` with no context about what feature it serves
- File name doesn't indicate it's part of the "Improve Prompt" feature
- Hard to discover or understand without reading the code

### 2. Mixed Responsibilities
- **Prompt Analysis:** 4 methods for analyzing complexity and ambiguity (85 lines)
- **Question Scoring:** 6 methods for relevance scoring (130 lines)
- **System Prompt Building:** Large template string construction (90 lines)
- **Question Generation:** Main orchestration and API calls (60 lines)
- **Follow-up Generation:** Additional question generation logic (40 lines)

### 3. Hardcoded Configuration
- Ambiguous terms list hardcoded in method (line 235-239)
- Technical patterns hardcoded in method (line 267-271)
- Vague patterns inline (line 241-242)
- Complexity weights scattered (line 221-225)
- Scoring weights embedded in calculation (line 343-347)
- Question count thresholds inline (line 203-205)

### 4. Monolithic Structure
- 459 lines in a single file made it hard to:
  - Navigate to specific functionality
  - Test individual components
  - Reuse analysis logic elsewhere
  - Modify configuration without touching logic

## Refactoring Solution

### New Structure
```
server/src/services/question-generation/
├── QuestionGenerationService.js  (119 lines) - Main orchestrator
├── services/
│   ├── PromptAnalyzer.js         (107 lines) - Complexity & ambiguity analysis
│   └── QuestionScorer.js         (177 lines) - Relevance scoring & ranking
├── config/
│   ├── analysisPatterns.js       (100 lines) - Detection patterns & weights
│   └── promptTemplate.js         (127 lines) - System prompt templates
├── index.js                      (14 lines)  - Barrel exports
└── REFACTORING_SUMMARY.md        - This document
```

### Metrics
- **Before:** 459 lines (single file)
- **After:** 644 lines (7 files)
- **Main Orchestrator:** 119 lines (74% reduction from original)
- **Net Increase:** 185 lines (+40%)

The size increase is justified by:
- Clear separation of concerns
- Extracted configuration
- Comprehensive documentation
- Better testability

## Extracted Components

### Configuration Files (2 files, 227 lines)

#### 1. analysisPatterns.js (100 lines)
**Purpose:** Centralize all prompt analysis configuration

**Exports:**
- `AMBIGUOUS_TERMS` - List of vague/ambiguous words
- `TECHNICAL_PATTERNS` - Regex patterns for technical content
- `VAGUE_PATTERNS` - Patterns for incomplete phrases
- `COMPLEXITY_WEIGHTS` - Weights for complexity calculation
- `QUESTION_COUNT_THRESHOLDS` - Rules for question count determination
- `AMBIGUITY_SCORES` - Scoring parameters
- `NORMALIZATION_FACTORS` - Normalization baselines

**Benefits:**
- Easy to tune detection without touching code
- Clear documentation of what gets detected
- Can be imported by other services

#### 2. promptTemplate.js (127 lines)
**Purpose:** Isolate prompt engineering from business logic

**Exports:**
- `buildQuestionGenerationPrompt(prompt, count)` - Main prompt template
- `buildFollowUpPrompt(prompt, answers)` - Follow-up prompt template
- `QUESTION_SCHEMA` - JSON schema for validation

**Benefits:**
- Prompt engineers can modify templates independently
- Templates are versioned and documented
- Easy to A/B test different prompt strategies

### Service Files (2 files, 284 lines)

#### 1. PromptAnalyzer.js (107 lines)
**Purpose:** Analyze prompt characteristics

**Public Methods:**
- `determineQuestionCount(prompt)` - Returns optimal question count
- `assessComplexity(prompt)` - Calculates complexity score (0-1)
- `measureAmbiguity(prompt)` - Calculates ambiguity score (0-1)
- `countTechnicalTerms(prompt)` - Counts technical terms

**Benefits:**
- Can be used by other services needing prompt analysis
- Pure, testable methods
- Clear single responsibility

#### 2. QuestionScorer.js (177 lines)
**Purpose:** Score and rank questions by relevance

**Public Methods:**
- `scoreQuestionRelevance(question, prompt)` - Composite relevance score
- `measureAmbiguityReduction(question, prompt)` - Sub-score
- `calculateInfoGain(question, prompt)` - Sub-score
- `estimateAnswerEffort(question)` - Sub-score
- `assessCriticality(question, prompt)` - Sub-score
- `rankQuestionsByRelevance(questions, prompt)` - Sorts questions

**Static Configuration:**
- `RELEVANCE_WEIGHTS` - Scoring factor weights
- `SPECIFICITY_KEYWORDS` - Keywords indicating specificity
- `CRITICAL_TERMS` - Terms indicating critical questions

**Benefits:**
- Scoring logic isolated and testable
- Easy to adjust scoring weights
- Can be reused for other ranking needs

### Main Orchestrator (119 lines)

**QuestionGenerationService.js**
- Imports and coordinates specialized services
- Manages caching layer
- Handles API calls to Claude
- Orchestrates question generation flow
- Includes follow-up generation

**Key Improvements:**
- ✅ **Clean orchestration:** ~60 lines of core logic
- ✅ **Clear dependencies:** Explicitly declares what it needs
- ✅ **Single responsibility:** Coordinates, doesn't implement
- ✅ **Easy to test:** Dependencies can be mocked

## Migration Guide

### For Existing Code

**Old Import:**
```javascript
import { QuestionGenerationService } from '../services/QuestionGenerationService.js';
```

**New Import (recommended):**
```javascript
import { QuestionGenerationService } from '../services/question-generation/index.js';
```

**Backward Compatible (still works):**
```javascript
import { QuestionGenerationService } from '../services/QuestionGenerationService.js';
// This now points to a shim that re-exports from the new location
```

### For New Code

Import from the modular structure:

```javascript
// Main service
import { QuestionGenerationService } from '../services/question-generation/index.js';

// Individual services (for testing or advanced usage)
import { PromptAnalyzer } from '../services/question-generation/services/PromptAnalyzer.js';
import { QuestionScorer } from '../services/question-generation/services/QuestionScorer.js';

// Configuration (for customization)
import { COMPLEXITY_WEIGHTS } from '../services/question-generation/config/analysisPatterns.js';
import { buildQuestionGenerationPrompt } from '../services/question-generation/config/promptTemplate.js';
```

## Benefits

### Clarity
- ✅ **Folder name** immediately indicates purpose (question-generation)
- ✅ **File names** clearly describe contents
- ✅ **Separation** of configuration, logic, and orchestration

### Testability
- ✅ Test `PromptAnalyzer` independently with various prompts
- ✅ Test `QuestionScorer` with mock questions and prompts
- ✅ Test templates without needing API calls
- ✅ Mock services when testing orchestrator

### Maintainability
- ✅ Tune scoring weights in `config/analysisPatterns.js`
- ✅ Modify prompts in `config/promptTemplate.js`
- ✅ Update detection patterns without touching business logic
- ✅ Main orchestrator is just ~119 lines (vs 459)

### Reusability
- ✅ `PromptAnalyzer` can be used by other services
- ✅ Scoring algorithms can be adapted for other use cases
- ✅ Configuration can be shared or overridden

### Consistency
- ✅ Matches pattern of other refactored services
  - `quality-feedback/` (556 → 870 lines, 12 files)
  - `enhancement/` (582 → ~1400 lines, folder structure)
  - `video-prompt/` (563 → folder structure)

## Files Changed

### Created
- `server/src/services/question-generation/QuestionGenerationService.js`
- `server/src/services/question-generation/services/PromptAnalyzer.js`
- `server/src/services/question-generation/services/QuestionScorer.js`
- `server/src/services/question-generation/config/analysisPatterns.js`
- `server/src/services/question-generation/config/promptTemplate.js`
- `server/src/services/question-generation/index.js`
- `server/src/services/question-generation/REFACTORING_SUMMARY.md`

### Modified
- `server/src/config/services.config.js` (updated import path)
- `server/src/services/QuestionGenerationService.js` (converted to shim)

### Deleted
- Original 459-line `QuestionGenerationService.js` (replaced by shim)

## Testing Recommendations

### Unit Tests to Add

1. **PromptAnalyzer.js**
   - Test complexity scoring with various prompt types
   - Test ambiguity detection with edge cases
   - Test technical term counting
   - Test question count determination thresholds

2. **QuestionScorer.js**
   - Test individual scoring factors
   - Test composite relevance calculation
   - Test ranking with multiple questions
   - Test edge cases (empty questions, missing fields)

3. **promptTemplate.js**
   - Test template rendering with various inputs
   - Test question count variations
   - Test follow-up prompt generation

4. **QuestionGenerationService.js** (Integration)
   - Test end-to-end flow with mocked Claude API
   - Test caching behavior
   - Test error handling
   - Test follow-up generation

## Future Enhancements

### Potential Improvements
1. **Machine Learning:** Use actual acceptance rates to tune scoring weights
2. **A/B Testing:** Compare different prompt templates
3. **Analytics:** Track which questions lead to better outcomes
4. **Personalization:** Adapt question style to user preferences
5. **Domain-Specific:** Create specialized analyzers for different domains

### Easy to Add Now
- New scoring factors (just add methods to `QuestionScorer`)
- New ambiguity patterns (just update config)
- Alternative prompt templates (just export new function)
- Additional analyzers (just create new service file)

## Related Documentation
- `server/src/services/quality-feedback/REFACTORING_SUMMARY.md`
- `server/src/services/enhancement/REFACTORING_SUMMARY.md`
- `server/src/services/video-prompt/REFACTORING_SUMMARY.md`
- `REFACTORING_PROJECT.md` (main project tracker)

