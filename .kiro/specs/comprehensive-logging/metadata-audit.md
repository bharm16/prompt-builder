# Metadata Audit Report

## Overview
This document identifies logging calls that are missing standard metadata fields according to Requirements 9.1-9.7.

## Standard Metadata Fields Required

1. **operation**: Method/function name (ALWAYS required)
2. **duration**: Milliseconds for timed operations
3. **requestId**: For HTTP request-scoped logs
4. **userId**: Where user context exists
5. **service/component**: Via child logger (already implemented via child loggers)
6. **traceId**: For distributed tracing (where applicable)
7. **Domain-specific fields**: Business context (promptId, suggestionCount, etc.)

## Audit Findings

### Backend Services - Missing Metadata

#### 1. CacheKeyGenerator.ts
- ✅ Has `operation` field
- ❌ Missing `duration` for operations
- Status: Needs duration tracking

#### 2. SemanticCacheService.ts
- ✅ Has `operation` field
- ❌ Missing `duration` for async operations (calculateSimilarity, generateRecommendations)
- Status: Needs duration tracking for async methods

#### 3. CacheService.ts
- ✅ Has `operation` field
- ❌ Missing `duration` for async operations (set, delete, flush, isHealthy)
- Status: Needs duration tracking

#### 4. CacheStatisticsTracker.ts
- ✅ Has `operation` field
- ✅ Synchronous operations don't need duration
- Status: Complete

#### 5. CacheServiceWithStatistics.ts
- ✅ Has `operation` field
- ❌ Missing `duration` for async operations (get, set, delete)
- Status: Needs duration tracking

#### 6. TextCategorizerService.ts
- ✅ Has `operation` field
- ✅ Has `duration` field
- Status: Complete ✓

#### 7. FeedbackRepository.ts
- ✅ Has `operation` field
- ❌ Missing `duration` for async operations
- Status: Needs duration tracking

#### 8. SceneChangeDetectionService.ts
- ✅ Has `operation` field
- Need to verify duration tracking

### Backend Routes - Missing Metadata

#### 1. roleClassifyRoute.ts
- ✅ Has `operation` field
- ✅ Has `requestId` field
- ✅ Has `duration` field
- Status: Complete ✓

### Frontend Components - Missing Metadata

#### 1. LoggingInterceptors.ts
- ❌ Missing `operation` field in some logs
- ✅ Has `duration` field
- ❌ Missing `requestId` (should use traceId)
- Status: Needs operation field, requestId mapping

#### 2. usePromptDebugger.ts
- ✅ Has `operation` field
- ✅ Has `duration` field (via timer)
- ❌ Missing `userId` where applicable
- Status: Needs userId context

#### 3. usePromptHistory.ts
- ✅ Has `operation` field
- ✅ Has `duration` field (via timer)
- ❌ Missing `userId` in some logs (has it in some, missing in others)
- Status: Needs consistent userId

#### 4. PromptEnhancementEditor.tsx
- ✅ Has `operation` field
- ✅ Has `duration` field (via debug.endTimer)
- ❌ Missing `userId` where applicable
- Status: Needs userId context

#### 5. SharedPrompt.tsx
- ✅ Has `operation` field
- ✅ Has `duration` field (via debug.endTimer)
- ❌ Missing `userId` where applicable
- Status: Needs userId context

#### 6. Icon components
- ✅ Has `component` field
- ✅ Synchronous operations don't need duration
- Status: Complete ✓

#### 7. useCustomRequest.ts
- ✅ Has `operation` field
- ❌ Missing `duration` field
- ❌ Missing `userId` where applicable
- Status: Needs duration and userId

#### 8. VideoConceptBuilder hooks
- ✅ Has `operation` field
- ❌ Missing `duration` field in some
- ❌ Missing `userId` where applicable
- Status: Needs duration and userId

## Implementation Plan

### Phase 1: Add Duration to Backend Services
Files to update:
1. `server/src/services/cache/CacheKeyGenerator.ts`
2. `server/src/services/cache/SemanticCacheService.ts`
3. `server/src/services/cache/CacheService.ts`
4. `server/src/services/cache/CacheServiceWithStatistics.ts`
5. `server/src/services/quality-feedback/services/FeedbackRepository.ts`

Pattern:
```typescript
async operation() {
  const startTime = performance.now();
  const operation = 'operationName';
  
  this.log.debug(`Starting ${operation}`, { operation });
  
  try {
    const result = await doWork();
    const duration = Math.round(performance.now() - startTime);
    
    this.log.info(`${operation} completed`, {
      operation,
      duration,
      // other metadata
    });
    
    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    this.log.error(`${operation} failed`, error as Error, {
      operation,
      duration,
    });
    throw error;
  }
}
```

### Phase 2: Add Missing Metadata to Frontend
Files to update:
1. `client/src/services/http/LoggingInterceptors.ts` - Add operation field, map traceId to requestId
2. `client/src/hooks/usePromptDebugger.ts` - Add userId
3. `client/src/hooks/usePromptHistory.ts` - Add userId consistently
4. `client/src/components/PromptEnhancementEditor.tsx` - Add userId
5. `client/src/components/SharedPrompt.tsx` - Add userId
6. `client/src/components/SuggestionsPanel/hooks/useCustomRequest.ts` - Add duration and userId
7. VideoConceptBuilder hooks - Add duration and userId

Pattern for userId:
```typescript
// In hooks/components with auth context
const { user } = useAuth(); // or however user is accessed

logger.info('Operation completed', {
  operation: 'operationName',
  duration,
  userId: user?.uid,
  // other metadata
});
```

### Phase 3: Add Domain-Specific Fields
Review each logging call and add relevant business context:
- `promptId` for prompt-related operations
- `suggestionCount` for suggestion operations
- `cacheType` for cache operations
- `spanCount` for span operations
- etc.

## Success Criteria
- [ ] All async operations log duration
- [ ] All request-scoped logs include requestId
- [ ] All user-related operations include userId where context exists
- [ ] All logs include operation field
- [ ] Domain-specific fields added where relevant
