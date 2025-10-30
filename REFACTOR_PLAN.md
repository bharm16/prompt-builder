# Refactoring EnhancementService.js - Implementation Guide

## Overview
Split the 1600-line EnhancementService into 8 focused services following single responsibility principle.

## Phase 1: Create New Service Files

### 1.1 Create PlaceholderDetectionService
**Location:** `src/services/enhancement/PlaceholderDetectionService.js`

**Extract these methods:**
- `detectPlaceholder()`
- `detectPlaceholderType()`

**Dependencies:**
- None (pure logic)

**Implementation:**
```javascript
export class PlaceholderDetectionService {
  constructor() {}
  
  detectPlaceholder(highlightedText, contextBefore, contextAfter, fullPrompt) {
    // Move existing logic
  }
  
  detectPlaceholderType(highlightedText, contextBefore, contextAfter) {
    // Move existing logic
  }
}
```

---

### 1.2 Create VideoPromptService
**Location:** `src/services/enhancement/VideoPromptService.js`

**Extract these methods:**
- `isVideoPrompt()`
- `detectVideoPhraseRole()`
- `countWords()`
- `getVideoReplacementConstraints()`
- `getVideoFallbackConstraints()`
- `getCategoryFocusGuidance()`

**Dependencies:**
- `logger`

**Implementation:**
```javascript
import { logger } from '../../infrastructure/Logger.js';

export class VideoPromptService {
  countWords(text) { ... }
  
  isVideoPrompt(fullPrompt) { ... }
  
  detectVideoPhraseRole(highlightedText, contextBefore, contextAfter, explicitCategory) { ... }
  
  getVideoReplacementConstraints(details = {}, options = {}) { ... }
  
  getVideoFallbackConstraints(currentConstraints, details = {}, attemptedModes = new Set()) { ... }
  
  getCategoryFocusGuidance(phraseRole, categoryHint) { ... }
}
```

---

### 1.3 Create BrainstormContextBuilder
**Location:** `src/services/enhancement/BrainstormContextBuilder.js`

**Extract these methods:**
- `buildBrainstormSignature()`
- `buildBrainstormContextSection()`
- `formatBrainstormKey()`
- `formatBrainstormValue()`

**Dependencies:**
- None (pure logic)

**Implementation:**
```javascript
export class BrainstormContextBuilder {
  buildBrainstormSignature(brainstormContext) { ... }
  
  buildBrainstormContextSection(brainstormContext, options = {}) { ... }
  
  formatBrainstormKey(key) { ... }
  
  formatBrainstormValue(value) { ... }
}
```

---

### 1.4 Create PromptBuilderService
**Location:** `src/services/enhancement/PromptBuilderService.js`

**Extract these methods:**
- `buildPlaceholderPrompt()`
- `buildRewritePrompt()`
- `buildCustomPrompt()`

**Dependencies:**
- `BrainstormContextBuilder`
- `VideoPromptService`
- `detectSubcategory` from CategoryConstraints
- `CATEGORY_CONSTRAINTS` from CategoryConstraints

**Implementation:**
```javascript
import { BrainstormContextBuilder } from './BrainstormContextBuilder.js';
import { CATEGORY_CONSTRAINTS, detectSubcategory } from '../CategoryConstraints.js';

export class PromptBuilderService {
  constructor(brainstormBuilder, videoService) {
    this.brainstormBuilder = brainstormBuilder;
    this.videoService = videoService;
  }
  
  buildPlaceholderPrompt(params) { ... }
  
  buildRewritePrompt(params) { ... }
  
  buildCustomPrompt(params) { ... }
}
```

---

### 1.5 Create SuggestionValidationService
**Location:** `src/services/enhancement/SuggestionValidationService.js`

**Extract these methods:**
- `sanitizeSuggestions()`
- `validateSuggestions()`
- `groupSuggestionsByCategory()`

**Dependencies:**
- `VideoPromptService` (for countWords)
- `validateAgainstVideoTemplate` from CategoryConstraints

**Implementation:**
```javascript
import { validateAgainstVideoTemplate } from '../CategoryConstraints.js';

export class SuggestionValidationService {
  constructor(videoService) {
    this.videoService = videoService;
  }
  
  sanitizeSuggestions(suggestions, context) { ... }
  
  validateSuggestions(suggestions, highlightedText, category) { ... }
  
  groupSuggestionsByCategory(suggestions) { ... }
}
```

---

### 1.6 Create SuggestionDiversityEnforcer
**Location:** `src/services/enhancement/SuggestionDiversityEnforcer.js`

**Extract these methods:**
- `ensureDiverseSuggestions()`
- `ensureCategoricalDiversity()`
- `calculateSimilarity()`
- `generateDiverseAlternative()`

**Dependencies:**
- `logger`
- `claudeClient` (for regeneration)

**Implementation:**
```javascript
import { logger } from '../../infrastructure/Logger.js';

export class SuggestionDiversityEnforcer {
  constructor(claudeClient) {
    this.claudeClient = claudeClient;
  }
  
  async ensureDiverseSuggestions(suggestions) { ... }
  
  ensureCategoricalDiversity(suggestions) { ... }
  
  async calculateSimilarity(text1, text2) { ... }
  
  async generateDiverseAlternative(suggestions, indexToReplace) { ... }
}
```

---

### 1.7 Create CategoryAlignmentService
**Location:** `src/services/enhancement/CategoryAlignmentService.js`

**Extract these methods:**
- `enforceCategoryAlignment()`
- `shouldUseFallback()`
- `getCategoryFallbacks()`
- `validateSuggestions()` (coordinate with SuggestionValidationService)

**Dependencies:**
- `logger`
- `CATEGORY_CONSTRAINTS`, `detectSubcategory` from CategoryConstraints
- `detectDescriptorCategory`, `getCategoryFallbacks` from DescriptorCategories

**Implementation:**
```javascript
import { logger } from '../../infrastructure/Logger.js';
import { CATEGORY_CONSTRAINTS, detectSubcategory } from '../CategoryConstraints.js';
import { detectDescriptorCategory, getCategoryFallbacks as getDescriptorFallbacks } from '../DescriptorCategories.js';

export class CategoryAlignmentService {
  constructor(validationService) {
    this.validationService = validationService;
  }
  
  enforceCategoryAlignment(suggestions, params) { ... }
  
  shouldUseFallback(suggestions, highlightedText, category) { ... }
  
  getCategoryFallbacks(highlightedText, category) { ... }
}
```

---

### 1.8 Create EnsembleGenerationService
**Location:** `src/services/enhancement/EnsembleGenerationService.js`

**Extract these methods:**
- `generateEnsembleSuggestions()`
- `generateWithHighTemperature()`
- `generateWithExamples()`
- `generateWithConstraints()`
- `generateWithReasoning()`
- `removeDuplicates()`
- `rankByCriteria()`
- `scoreDiversity()`
- `scoreQuality()`
- `scoreRelevance()`

**Dependencies:**
- `logger`
- `claudeClient`
- `PromptBuilderService`

**Implementation:**
```javascript
import { logger } from '../../infrastructure/Logger.js';

export class EnsembleGenerationService {
  constructor(claudeClient, promptBuilder) {
    this.claudeClient = claudeClient;
    this.promptBuilder = promptBuilder;
  }
  
  async generateEnsembleSuggestions(params) { ... }
  
  // ... other methods
}
```

---

## Phase 2: Refactor Main EnhancementService

**Location:** `src/services/EnhancementService.js`

**Keep only:**
- Constructor (with injected services)
- `getEnhancementSuggestions()` (orchestration)
- `getCustomSuggestions()` (orchestration)
- `transferStyle()` (unless used elsewhere - consider moving)

**New constructor:**
```javascript
export class EnhancementService {
  constructor(
    claudeClient,
    placeholderDetector,
    videoService,
    brainstormBuilder,
    promptBuilder,
    validationService,
    diversityEnforcer,
    categoryAligner
  ) {
    this.claudeClient = claudeClient;
    this.placeholderDetector = placeholderDetector;
    this.videoService = videoService;
    this.brainstormBuilder = brainstormBuilder;
    this.promptBuilder = promptBuilder;
    this.validationService = validationService;
    this.diversityEnforcer = diversityEnforcer;
    this.categoryAligner = categoryAligner;
    this.cacheConfig = cacheService.getConfig('enhancement');
  }
  
  async getEnhancementSuggestions(params) {
    // Orchestrate using injected services
    
    const isVideoPrompt = this.videoService.isVideoPrompt(fullPrompt);
    const isPlaceholder = this.placeholderDetector.detectPlaceholder(...);
    const phraseRole = this.videoService.detectVideoPhraseRole(...);
    const systemPrompt = this.promptBuilder.buildPlaceholderPrompt(...);
    
    // ... etc
  }
}
```

---

## Phase 3: Update Dependency Injection

**Location:** `src/services/index.js` (or wherever services are instantiated)

```javascript
import { EnhancementService } from './EnhancementService.js';
import { PlaceholderDetectionService } from './enhancement/PlaceholderDetectionService.js';
import { VideoPromptService } from './enhancement/VideoPromptService.js';
import { BrainstormContextBuilder } from './enhancement/BrainstormContextBuilder.js';
import { PromptBuilderService } from './enhancement/PromptBuilderService.js';
import { SuggestionValidationService } from './enhancement/SuggestionValidationService.js';
import { SuggestionDiversityEnforcer } from './enhancement/SuggestionDiversityEnforcer.js';
import { CategoryAlignmentService } from './enhancement/CategoryAlignmentService.js';

// Instantiate in dependency order
const placeholderDetector = new PlaceholderDetectionService();
const videoService = new VideoPromptService();
const brainstormBuilder = new BrainstormContextBuilder();
const promptBuilder = new PromptBuilderService(brainstormBuilder, videoService);
const validationService = new SuggestionValidationService(videoService);
const diversityEnforcer = new SuggestionDiversityEnforcer(claudeClient);
const categoryAligner = new CategoryAlignmentService(validationService);

const enhancementService = new EnhancementService(
  claudeClient,
  placeholderDetector,
  videoService,
  brainstormBuilder,
  promptBuilder,
  validationService,
  diversityEnforcer,
  categoryAligner
);

export { enhancementService };
```

---

## Phase 4: Update Tests

**For each new service, create:**
- `tests/services/enhancement/PlaceholderDetectionService.test.js`
- `tests/services/enhancement/VideoPromptService.test.js`
- etc.

**Update existing:**
- `tests/services/EnhancementService.test.js` (now tests orchestration only)

**Test structure:**
```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { PlaceholderDetectionService } from '../../../src/services/enhancement/PlaceholderDetectionService.js';

describe('PlaceholderDetectionService', () => {
  let service;
  
  beforeEach(() => {
    service = new PlaceholderDetectionService();
  });
  
  describe('detectPlaceholder', () => {
    it('detects material keywords', () => {
      const result = service.detectPlaceholder('wooden', '', '', '');
      expect(result).toBe(true);
    });
    
    // ... more tests
  });
});
```

---

## Phase 5: Verification Checklist

### ✅ Code Quality
- [ ] Each service < 300 lines
- [ ] Each service has single clear responsibility
- [ ] No circular dependencies
- [ ] All imports resolve correctly

### ✅ Functionality
- [ ] All existing tests pass
- [ ] New unit tests for each service
- [ ] Integration test for EnhancementService orchestration
- [ ] No breaking changes to API

### ✅ Documentation
- [ ] JSDoc comments on public methods
- [ ] README in `/enhancement` folder explaining architecture
- [ ] Update main service documentation

---

## Execution Order

1. **Create directory:** `src/services/enhancement/`
2. **Phase 1:** Create all new service files (can be done in parallel)
3. **Phase 2:** Refactor main EnhancementService (depends on Phase 1)
4. **Phase 3:** Update dependency injection (depends on Phase 2)
5. **Phase 4:** Create/update tests (can be done incrementally)
6. **Phase 5:** Verify and document

---

## Rollback Plan

If issues arise:
1. Keep original `EnhancementService.js` as `EnhancementService.backup.js`
2. Git branch: `refactor/enhancement-service-split`
3. Can revert by restoring backup and removing new files

---

## Expected Benefits

- **Testability:** Each service independently testable
- **Maintainability:** Changes isolated to single service
- **Reusability:** Services can be used by other features
- **Clarity:** Clear separation of concerns
- **Performance:** No performance impact (same logic, better organization)

---

## Breaking Changes

**None expected** - This is an internal refactor. The public API of `EnhancementService` remains unchanged.
