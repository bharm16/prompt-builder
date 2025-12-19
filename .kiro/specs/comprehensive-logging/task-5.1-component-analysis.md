# Task 5.1: Component Logging Analysis

## Overview
This document identifies React components that need logging based on the following criteria:
1. Components with API calls
2. Components with complex state management
3. Components with error boundaries
4. Components with significant user interactions

## Components Requiring Logging

### 1. Components with API Calls

#### ✅ PromptEnhancementEditor.tsx
- **Location**: `client/src/components/PromptEnhancementEditor.tsx`
- **Status**: Already has logging via useDebugLogger
- **API Calls**: 
  - `fetchEnhancementSuggestions()` - fetches suggestions from `/api/get-enhancement-suggestions`
- **Current Logging**: Uses `useDebugLogger` with logAction, startTimer, endTimer, logError
- **Action**: Verify logging is complete (already implemented in task 2.1)

#### ✅ SharedPrompt.tsx
- **Location**: `client/src/components/SharedPrompt.tsx`
- **Status**: Already has logging via useDebugLogger
- **API Calls**:
  - `fetchPrompt()` - fetches shared prompt data via PromptRepository
- **Current Logging**: Uses `useDebugLogger` with logEffect, startTimer, endTimer
- **Action**: Verify logging is complete (already implemented in task 2.2)

#### ✅ VideoConceptBuilder.tsx
- **Location**: `client/src/components/VideoConceptBuilder.tsx`
- **Status**: Already has logging via useDebugLogger
- **API Calls**:
  - Multiple API calls through hooks (useCompatibilityScores, useRefinements, etc.)
- **Current Logging**: Uses `useDebugLogger`
- **Action**: Verify logging is complete (already implemented in task 2.4)

### 2. Components with Complex State Management

#### 🔴 PromptOptimizerContainer.tsx
- **Location**: `client/src/features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerContainer.tsx`
- **Status**: Has useDebugLogger but needs comprehensive logging
- **Complexity**:
  - Main orchestrator component
  - Coordinates multiple specialized hooks (usePromptLoader, useHighlightsPersistence, useUndoRedo, etc.)
  - Manages complex state via PromptStateContext
  - Handles authentication, history, optimization, improvement flows
  - Multiple modal states (settings, shortcuts, history, improver, brainstorm)
- **State Management**:
  - selectedMode, showResults, showSettings, showShortcuts, showHistory, showImprover, showBrainstorm
  - suggestionsData, promptContext, currentPromptUuid, currentPromptDocId
  - Undo/redo stacks, history refs
- **User Interactions**:
  - Mode switching, creating new prompts, loading history
  - Undo/redo operations, optimization, improvement flows
- **Action**: Add comprehensive logging for:
  - Component lifecycle (mount, unmount)
  - State changes (mode switches, modal toggles)
  - User actions (create new, load history, undo/redo)
  - Hook coordination and data flow
  - Error handling

#### 🔴 PromptCanvas.tsx
- **Location**: `client/src/features/prompt-optimizer/PromptCanvas.tsx`
- **Status**: Needs logging
- **Complexity**:
  - Core editor component with ML highlighting
  - Manages span labeling, text selection, clipboard operations
  - Coordinates multiple hooks (useSpanLabeling, useClipboard, useShareLink, etc.)
  - Handles export functionality
- **State Management**:
  - Editor content, highlights, suggestions panel visibility
  - Draft/refined spans, labeling results
  - Clipboard and share states
- **User Interactions**:
  - Text editing, highlighting, copying, sharing
  - Export operations, suggestion interactions
- **Action**: Add logging for:
  - Component lifecycle
  - Span labeling operations (start, completion, errors)
  - Text selection and editing
  - Export operations with timing
  - Clipboard and share actions
  - Error handling

#### 🔴 HistorySidebar.tsx
- **Location**: `client/src/features/history/HistorySidebar.tsx`
- **Status**: Has useDebugLogger but needs comprehensive logging
- **Complexity**:
  - Manages prompt history display and interactions
  - Handles authentication state
  - Delete confirmation flow
- **State Management**:
  - History entries, authentication state
  - Delete confirmation state
  - Sidebar position (left/right)
- **User Interactions**:
  - Load history entry, delete entry, authentication
  - Sidebar positioning, create new prompt
- **Action**: Add logging for:
  - History loading and display
  - Delete operations (confirmation, execution)
  - Authentication actions
  - Error handling

#### 🟡 VideoConceptBuilder.tsx
- **Location**: `client/src/components/VideoConceptBuilder.tsx`
- **Status**: Already has useDebugLogger (implemented in task 2.4)
- **Complexity**:
  - Complex video concept building with multiple elements
  - Template generation, suggestion handling
  - Mode switching (element/concept)
- **Action**: Verify comprehensive logging is in place

### 3. Components with Error Boundaries

#### ✅ ErrorBoundary.tsx
- **Location**: `client/src/components/ErrorBoundary/ErrorBoundary.tsx`
- **Status**: Already has logging
- **Current Logging**: Uses logger.error in componentDidCatch
- **Action**: Verify logging is complete (already implemented in task 2.8)

#### ✅ FeatureErrorBoundary.tsx
- **Location**: `client/src/components/ErrorBoundary/FeatureErrorBoundary.tsx`
- **Status**: Wraps ErrorBoundary (inherits logging)
- **Action**: No additional logging needed

#### 🟡 HighlightingErrorBoundary.tsx
- **Location**: `client/src/features/span-highlighting/components/HighlightingErrorBoundary.tsx`
- **Status**: Uses console.log/console.error (needs replacement)
- **Action**: Replace console statements with logger (should be covered in task 2)

### 4. Components with Significant User Interactions

#### 🟡 SuggestionsPanel.tsx
- **Location**: `client/src/components/SuggestionsPanel/SuggestionsPanel.tsx`
- **Status**: Needs logging
- **User Interactions**:
  - Category switching, suggestion selection
  - Custom request submission, refresh
  - Panel open/close
- **Action**: Add logging for:
  - Panel open/close events
  - Category changes
  - Suggestion selections
  - Custom request submissions
  - Error handling

#### 🟡 PromptInput.tsx
- **Location**: `client/src/features/prompt-optimizer/PromptInput.tsx`
- **Status**: Needs logging
- **User Interactions**:
  - Text input, mode selection
  - Dropdown interactions
  - Form submission
- **Action**: Add logging for:
  - Input changes (debounced)
  - Mode selections
  - Form submissions
  - Error handling

#### 🟡 QualityScore.tsx
- **Location**: `client/src/components/QualityScore.tsx`
- **Status**: Needs logging
- **User Interactions**:
  - Score display, tooltip interactions
  - Animated score updates
- **Action**: Add logging for:
  - Score updates
  - Tooltip interactions
  - Animation events

#### 🟡 Toast.tsx
- **Location**: `client/src/components/Toast.tsx`
- **Status**: Needs logging
- **User Interactions**:
  - Toast display, dismissal
  - Auto-dismiss timing
- **Action**: Add logging for:
  - Toast creation
  - Toast dismissal (user vs auto)
  - Error handling

## Priority Classification

### High Priority (Complex + Critical)
1. **PromptOptimizerContainer.tsx** - Main orchestrator, complex state, multiple hooks
2. **PromptCanvas.tsx** - Core editor, ML highlighting, complex operations
3. **HistorySidebar.tsx** - History management, authentication, delete operations

### Medium Priority (Significant Interactions)
4. **SuggestionsPanel.tsx** - User interactions, API calls via hooks
5. **PromptInput.tsx** - Form input, mode selection
6. **QualityScore.tsx** - Score display, user interactions

### Low Priority (Simple Interactions)
7. **Toast.tsx** - Simple notifications

### Already Implemented (Verify Only)
- PromptEnhancementEditor.tsx ✅
- SharedPrompt.tsx ✅
- VideoConceptBuilder.tsx ✅
- ErrorBoundary.tsx ✅
- FeatureErrorBoundary.tsx ✅

## Implementation Strategy

### Phase 1: High Priority Components
Focus on the three most complex components that orchestrate major functionality:
1. PromptOptimizerContainer.tsx
2. PromptCanvas.tsx
3. HistorySidebar.tsx

### Phase 2: Medium Priority Components
Add logging to components with significant user interactions:
4. SuggestionsPanel.tsx
5. PromptInput.tsx
6. QualityScore.tsx

### Phase 3: Low Priority Components
Complete remaining components:
7. Toast.tsx

### Phase 4: Verification
Verify all previously implemented components have complete logging.

## Logging Patterns to Use

### For Complex Orchestrator Components (PromptOptimizerContainer)
```typescript
const debug = useDebugLogger('ComponentName', { initialProps });

// Component lifecycle
useEffect(() => {
  debug.logEffect('Component mounted');
  return () => debug.logEffect('Component unmounted');
}, []);

// State changes
useEffect(() => {
  debug.logEffect('Mode changed', { mode: selectedMode });
}, [selectedMode]);

// User actions
const handleAction = () => {
  debug.logAction('actionName', { context });
  debug.startTimer('operation');
  try {
    // ... operation
    debug.endTimer('operation', 'Success message');
  } catch (error) {
    debug.logError('Operation failed', error);
  }
};
```

### For Editor Components (PromptCanvas)
```typescript
const debug = useDebugLogger('ComponentName');

// Operation start/end with timing
const handleOperation = async () => {
  debug.logAction('operationStart', { params });
  debug.startTimer('operation');
  
  try {
    const result = await performOperation();
    debug.endTimer('operation', `Completed with ${result.count} items`);
  } catch (error) {
    debug.endTimer('operation');
    debug.logError('Operation failed', error);
  }
};

// State changes
useEffect(() => {
  debug.logEffect('State updated', { 
    highlightCount: highlights.length,
    isLoading 
  });
}, [highlights, isLoading]);
```

### For Interaction Components (SuggestionsPanel, PromptInput)
```typescript
const debug = useDebugLogger('ComponentName');

// User interactions
const handleClick = (item) => {
  debug.logAction('itemClick', { itemId: item.id, itemType: item.type });
};

const handleSubmit = async (data) => {
  debug.logAction('formSubmit', { dataSize: JSON.stringify(data).length });
  debug.startTimer('submit');
  
  try {
    await submitData(data);
    debug.endTimer('submit', 'Submission successful');
  } catch (error) {
    debug.endTimer('submit');
    debug.logError('Submission failed', error);
  }
};
```

## Requirements Coverage

This analysis addresses the following requirements:

- **3.1**: Complex components with significant actions (API calls, form submissions) will log info messages
- **3.2**: Components will log debug messages on mount using useDebugLogger
- **3.3**: Components will log errors with Error object and component state
- **10.3**: Comprehensive logging coverage for React components with side effects

## Summary

**Total Components Identified**: 14
- **Already Implemented**: 5 (PromptEnhancementEditor, SharedPrompt, VideoConceptBuilder, ErrorBoundary, FeatureErrorBoundary)
- **Need Logging**: 7 (PromptOptimizerContainer, PromptCanvas, HistorySidebar, SuggestionsPanel, PromptInput, QualityScore, Toast)
- **Need Console Replacement**: 1 (HighlightingErrorBoundary - covered in task 2)

**Next Steps**: Proceed to task 5.2 to implement logging for the identified components, starting with high-priority components.
