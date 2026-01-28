# Prompt Optimization Workflow - Complete Technical Documentation

**Last Updated:** 2025-01-XX  
**Status:** Production  
**Complexity:** High (40+ processing steps across 25+ files)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Frontend Flow](#frontend-flow)
4. [Backend Flow](#backend-flow)
5. [Two-Stage Optimization](#two-stage-optimization)
6. [Optimization Strategies](#optimization-strategies)
7. [File Inventory](#file-inventory)
8. [Key Algorithms](#key-algorithms)
9. [Performance Optimizations](#performance-optimizations)
10. [Error Handling](#error-handling)
11. [Metrics & Monitoring](#metrics--monitoring)

---

## Overview

The Prompt Optimization workflow transforms raw user input into production-ready prompts optimized for specific AI models and use cases. It supports multiple optimization modes and implements a two-stage optimization strategy for fast initial results with background refinement.

### Key Features

- **Multi-Mode Support**: Video, Reasoning, Research, Socratic, Standard
- **Two-Stage Optimization**: Fast draft (1-3s) + background refinement
- **Model-Specific Compilation**: Compiles prompts for Runway, Luma, Veo, etc.
- **Chain-of-Thought Reasoning**: Video mode uses CoT for cinematographic analysis
- **Shot Plan Interpretation**: Pre-interprets concepts into flexible shot plans
- **Quality Scoring**: Calculates quality scores for optimization results
- **Streaming Support**: Server-Sent Events (SSE) for real-time updates

### Optimization Modes

- **Video**: Cinematic prompt generation with CoT reasoning
- **Reasoning**: Deep thinking prompts for o1/o3 models
- **Research**: Comprehensive research plans
- **Socratic**: Question-based learning sequences
- **Standard**: General-purpose optimization

---

## Architecture

### System Layers

```
User Input (Raw Text)
    ↓
Frontend Input Component
    ↓
Optimization Hook (usePromptOptimization)
    ↓
State Management (usePromptOptimizer)
    ↓
API Layer (PromptOptimizationApi)
    ↓
Backend Route Handler (/api/optimize or /api/optimize-stream)
    ↓
PromptOptimizationService (Orchestrator)
    ↓
Strategy Factory → Mode-Specific Strategy
    ↓
AI Service (LLM Calls)
    ↓
Model Compilation (Video Mode Only)
    ↓
Response (Optimized Prompt + Metadata)
    ↓
Frontend State Update
    ↓
Typewriter Animation Display
```

### Component Hierarchy

```
PromptOptimizerContainer
  └─ usePromptOptimization (orchestrator)
      └─ usePromptOptimizer (core hook)
          ├─ usePromptOptimizerState (state management)
          ├─ usePromptOptimizerApi (API calls)
          └─ promptOptimizationFlow (two-stage/single-stage)
              ├─ runTwoStageOptimization
              └─ runSingleStageOptimization
```

---

## Frontend Flow

### 1. User Input

**Entry Point:** `PromptInputSection` component

**Files:**
- `client/src/features/prompt-optimizer/components/PromptInputSection.tsx`
- `client/src/features/prompt-optimizer/PromptInput.tsx`

**Steps:**
1. User enters text in textarea
2. User selects mode (video, reasoning, research, socratic, standard)
3. User selects target model (video mode only: Runway, Luma, Veo, etc.)
4. User clicks "Optimize" button or presses Enter

### 2. Optimization Hook

**File:** `client/src/features/prompt-optimizer/PromptOptimizerContainer/hooks/usePromptOptimization.ts`

**Steps:**
1. **Extract Input**: Get prompt from `promptOptimizer.inputPrompt` or parameter
2. **Serialize Context**: Convert `promptContext` to JSON format
3. **Call Optimize**: `promptOptimizer.optimize(prompt, context, brainstormContext, targetModel)`
4. **Save to History**: Save result to prompt history with UUID
5. **Update State**: Set displayed prompt, show results section
6. **Navigate**: Navigate to `/prompt/{uuid}` URL

### 3. Core Optimizer Hook

**File:** `client/src/hooks/usePromptOptimizer.ts`

**Steps:**
1. **Validation**: Check prompt is not empty
2. **Cancellation**: Abort previous request if in-flight
3. **Request ID**: Increment request ID for deduplication
4. **Start Optimization**: Set `isProcessing = true`
5. **Performance Tracking**: Start timer, mark optimization start
6. **Choose Flow**: 
   - Two-stage: `runTwoStageOptimization()` (default)
   - Single-stage: `runSingleStageOptimization()`
7. **Error Handling**: Handle abort errors, network errors
8. **Cleanup**: Set `isProcessing = false` on completion

### 4. Two-Stage Optimization Flow

**File:** `client/src/hooks/utils/promptOptimizationFlow.ts`

**Function:** `runTwoStageOptimization()`

**Steps:**
1. **Call API**: `optimizeWithFallback()` with callbacks
2. **Draft Callback** (`onDraft`):
   - Set draft prompt in state
   - Set displayed prompt to draft
   - Mark draft as ready
   - Set refining state
   - Calculate quality score
   - Show toast: "Draft ready! Refining in background..."
3. **Spans Callback** (`onSpans`):
   - Normalize spans data
   - Store draft spans or refined spans
   - Track span source (draft/refined)
4. **Refined Callback** (`onRefined`):
   - Set optimized prompt to refined version
   - Update displayed prompt (if no refined spans)
   - Set preview prompt and aspect ratio
   - Calculate refined quality score
   - Show success toast with score
5. **Error Callback** (`onError`):
   - Log error
   - Reset refining state
6. **Return Result**: `{ optimized, score }`

### 5. Single-Stage Optimization Flow

**File:** `client/src/hooks/utils/promptOptimizationFlow.ts`

**Function:** `runSingleStageOptimization()`

**Steps:**
1. **Call API**: `analyzeAndOptimize()` (non-streaming)
2. **Set State**: Set optimized prompt, quality score
3. **Set Preview**: Set preview prompt and aspect ratio if available
4. **Show Toast**: Display quality score message
5. **Return Result**: `{ optimized, score }`

### 6. API Layer

**File:** `client/src/services/PromptOptimizationApi.ts`

**Two Methods:**

**A. Legacy (Non-Streaming):**
- `optimizeLegacy()`: POST to `/api/optimize`
- Returns: `{ optimizedPrompt, metadata }`

**B. Streaming (Two-Stage):**
- `optimizeWithStreaming()`: POST to `/api/optimize-stream`
- Uses Server-Sent Events (SSE)
- Parses events: `draft`, `spans`, `refined`, `done`, `error`
- Calls callbacks for each event type

---

## Backend Flow

### 1. Route Handler

**File:** `server/src/routes/optimize.routes.ts`

**Two Endpoints:**

**A. POST /api/optimize** (Single-Stage)
1. Validate request (`promptSchema`)
2. Extract: `prompt`, `mode`, `targetModel`, `context`, `brainstormContext`
3. Call: `promptOptimizationService.optimize()`
4. Return: `{ optimizedPrompt, metadata }`

**B. POST /api/optimize-stream** (Two-Stage)
1. Validate request (`promptSchema`)
2. Set up SSE headers
3. Create internal abort controller
4. Call: `promptOptimizationService.optimizeTwoStage()`
5. Stream events:
   - `draft`: Fast draft version
   - `spans`: Span labels (parallel)
   - `refined`: Final optimized version
   - `done`: Completion signal
   - `error`: Error handling

### 2. PromptOptimizationService Orchestration

**File:** `server/src/services/prompt-optimization/PromptOptimizationService.ts`

**Main Method: `optimize()`**

**Steps:**
1. **Mode Validation**: Default to 'video' if not specified
2. **Shot Plan Interpretation**: Pre-interpret concept into flexible shot plan
3. **Cache Check**: Check Redis/memory cache (1-hour TTL)
4. **Strategy Selection**: Get mode-specific strategy from `StrategyFactory`
5. **Domain Content Generation**: Generate domain-specific content if supported
6. **Optimization**: Call `strategy.optimize()`
7. **Constitutional AI**: Apply constitutional review if requested
8. **Model Compilation**: Compile for target model (video mode only)
9. **Caching**: Store result in cache
10. **Metrics Logging**: Log performance metrics
11. **Return**: Optimized prompt string

**Two-Stage Method: `optimizeTwoStage()`**

**Steps:**
1. **Mode Validation**: Default to 'video'
2. **Shot Plan Interpretation**: Pre-interpret concept
3. **Streaming Check**: Verify ChatGPT available for draft
4. **Stage 1 - Draft Generation**:
   - Build draft system prompt
   - Call ChatGPT (`optimize_draft` operation)
   - Return draft in ~1-3 seconds
   - Call `onDraft` callback
5. **Stage 2 - Refinement**:
   - Use draft as input for refinement
   - Call `optimize()` with draft prompt
   - Return refined version
   - Call `onRefined` callback
6. **Fallback**: If streaming unavailable, fall back to single-stage
7. **Return**: `{ draft, refined, metadata }`

### 3. Strategy Factory

**File:** `server/src/services/prompt-optimization/services/StrategyFactory.ts`

**Purpose:** Creates mode-specific optimization strategies

**Strategies:**
- `VideoStrategy`: Video prompt optimization with CoT
- `ReasoningStrategy`: Deep thinking prompts
- `ResearchStrategy`: Research plan generation
- `SocraticStrategy`: Question sequences
- `StandardStrategy`: General optimization

### 4. Video Strategy (Example)

**File:** `server/src/services/prompt-optimization/strategies/VideoStrategy.ts`

**Process:**
1. **Template Selection**: Get video prompt template
2. **Shot Plan Integration**: Merge interpreted shot plan
3. **Domain Content**: Generate cinematographic context
4. **System Prompt**: Build CoT system prompt
5. **AI Call**: Execute with structured JSON schema
6. **JSON Parsing**: Parse structured output
7. **Reassembly**: Convert JSON back to formatted text
8. **Return**: Optimized prompt string

**Template Features:**
- Chain-of-Thought reasoning
- Cinematographic analysis (subject scale, motion, emotional tone)
- Shot selection logic
- Structured JSON output
- Technical specs generation
- Variations generation

### 5. Shot Interpreter Service

**File:** `server/src/services/prompt-optimization/services/ShotInterpreterService.ts`

**Purpose:** Pre-interprets raw concepts into flexible shot plans

**Process:**
1. **AI Call**: Call LLM with shot interpretation prompt
2. **Structured Output**: Parse JSON shot plan
3. **Validation**: Validate shot plan structure
4. **Return**: `ShotPlan` object with:
   - `shot_type`: Type of shot
   - `core_intent`: Main intent
   - `subject`: Subject description
   - `action`: Action description
   - `setting`: Setting description

### 6. Model Compilation (Video Mode)

**File:** `server/src/services/video-prompt-analysis/VideoPromptService.ts`

**Method:** `optimizeForModel()`

**Process:**
1. **Model Detection**: Detect target model (Runway, Luma, Veo, etc.)
2. **Strategy Pipeline**:
   - **Analyzer**: Analyzes prompt structure
   - **IR (Intermediate Representation)**: Converts to IR
   - **Synthesizer**: Generates model-specific syntax
3. **Compilation**: Applies:
   - CSAE (Cinematic Shot Analysis Engine)
   - JSON schemas (for Veo)
   - Physics tokens
   - Model-specific constraints
4. **Return**: Compiled prompt + metadata

---

## Two-Stage Optimization

### Architecture

**Stage 1: Fast Draft (1-3 seconds)**
- **Model**: ChatGPT (gpt-4o-mini)
- **Purpose**: Quick initial result
- **Temperature**: 0.7 (creative)
- **Max Tokens**: 200-300 (mode-dependent)
- **Timeout**: 15 seconds

**Stage 2: Refinement (Background)**
- **Model**: Primary model (Groq/OpenAI)
- **Purpose**: High-quality refinement
- **Input**: Draft from Stage 1
- **Temperature**: Mode-specific (0.3-0.7)
- **Max Tokens**: 2500-4000 (mode-dependent)
- **Timeout**: 30-90 seconds (mode-dependent)

### Benefits

1. **Fast Initial Feedback**: Users see results in 1-3 seconds
2. **Progressive Enhancement**: Background refinement improves quality
3. **Better UX**: Users can start editing while refinement completes
4. **Fallback Support**: Falls back to single-stage if streaming unavailable

### Event Flow

```
Client Request
    ↓
Server: SSE Connection Established
    ↓
Server: Stage 1 (Draft) → Event: "draft"
    ↓
Client: Update UI with draft
    ↓
Server: Stage 2 (Refinement) → Event: "refined"
    ↓
Client: Update UI with refined version
    ↓
Server: Event: "done"
    ↓
Client: Complete
```

---

## Optimization Strategies

### Video Strategy

**Template:** `videoPromptOptimizationTemplate.js`

**Features:**
- Chain-of-Thought reasoning
- Cinematographic analysis
- Shot selection logic
- Structured JSON output
- Technical specs
- Variations

**Output Format:**
```
[Main Prompt Paragraph]

**TECHNICAL SPECS**
- Duration: 4-8s
- Aspect Ratio: 16:9
- Frame Rate: 24fps
- Audio: [description]

**ALTERNATIVE APPROACHES**
- Variation 1: [description]
- Variation 2: [description]
```

### Reasoning Strategy

**Purpose:** Deep thinking prompts for o1/o3 models

**Features:**
- Multi-step reasoning
- Chain-of-thought structure
- Explicit thinking steps

### Research Strategy

**Purpose:** Comprehensive research plans

**Features:**
- Research questions
- Methodology suggestions
- Resource recommendations

### Socratic Strategy

**Purpose:** Question-based learning

**Features:**
- Progressive questions
- Guided discovery
- Educational structure

### Standard Strategy

**Purpose:** General-purpose optimization

**Features:**
- Clarity improvement
- Structure enhancement
- Completeness checks

---

## File Inventory

### Frontend (15+ files)

**Core Hooks:**
- `usePromptOptimization.ts` - Orchestration hook
- `usePromptOptimizer.ts` - Core optimizer hook
- `usePromptOptimizerState.ts` - State management
- `usePromptOptimizerApi.ts` - API layer

**Flow Management:**
- `promptOptimizationFlow.ts` - Two-stage/single-stage flows
- `performanceMetrics.ts` - Performance tracking

**Components:**
- `PromptInputSection.tsx` - Input component
- `PromptInput.tsx` - Input form
- `PromptResultsSection.tsx` - Results display
- `PromptCanvas.tsx` - Canvas editor

**API:**
- `PromptOptimizationApi.ts` - API service

### Backend (20+ files)

**Core Services:**
- `PromptOptimizationService.ts` - Main orchestrator
- `StrategyFactory.ts` - Strategy factory
- `ContextInferenceService.ts` - Context inference
- `ModeDetectionService.ts` - Mode detection
- `QualityAssessmentService.ts` - Quality assessment
- `ShotInterpreterService.ts` - Shot interpretation
- `TemplateService.ts` - Template management

**Strategies:**
- `VideoStrategy.ts` - Video optimization
- `ReasoningStrategy.ts` - Reasoning optimization
- `ResearchStrategy.ts` - Research optimization
- `SocraticStrategy.ts` - Socratic optimization
- `StandardStrategy.ts` - Standard optimization

**Templates:**
- `videoPromptOptimizationTemplate.js` - Video template
- `reasoningPromptOptimizationTemplate.js` - Reasoning template
- `researchPromptOptimizationTemplate.js` - Research template
- `socraticPromptOptimizationTemplate.js` - Socratic template

**Routes:**
- `optimize.routes.ts` - Express routes

**Configuration:**
- `OptimizationConfig.ts` - Configuration

---

## Key Algorithms

### 1. Chain-of-Thought Reasoning (Video Mode)

**File:** `server/src/services/prompt-optimization/strategies/videoPromptOptimizationTemplate.js`

**Algorithm:**
1. **Analysis Phase**: Analyze cinematographic requirements
   - Subject Scale (landscape vs. detail)
   - Motion (static vs. dynamic)
   - Emotional Tone (power, vulnerability, etc.)
2. **Shot Selection**: Map analysis to shot types
   - Intimacy → Close-up
   - Scale → Wide Shot
   - Power → Low Angle
   - Speed → Tracking Shot
3. **Generation Phase**: Generate prompt components
   - Main prompt paragraph
   - Technical specs
   - Variations

### 2. Shot Plan Interpretation

**File:** `server/src/services/prompt-optimization/services/ShotInterpreterService.ts`

**Purpose:** Pre-interpret concepts into flexible shot plans

**Process:**
1. **AI Call**: Call LLM with interpretation prompt
2. **Structured Output**: Parse JSON shot plan
3. **Validation**: Validate required fields
4. **Return**: `ShotPlan` object

### 3. Model Compilation

**File:** `server/src/services/video-prompt-analysis/VideoPromptService.ts`

**Pipeline:**
1. **Analyzer**: Analyzes prompt structure
2. **IR Generation**: Converts to intermediate representation
3. **Synthesizer**: Generates model-specific syntax
4. **Validation**: Validates against model constraints

### 4. Quality Scoring

**File:** `client/src/services/PromptOptimizationApi.ts`

**Method:** `calculateQualityScore()`

**Factors:**
- Clarity
- Specificity
- Structure
- Completeness
- Actionability

**Score Range:** 0-100

---

## Performance Optimizations

### 1. Caching

- **Server Cache**: 1-hour TTL for optimization results
- **Cache Key**: Includes prompt, mode, context, target model
- **Metadata Cache**: Separate cache for metadata

### 2. Two-Stage Optimization

- **Fast Draft**: 1-3 second initial response
- **Background Refinement**: Non-blocking refinement
- **Progressive Enhancement**: Users see results immediately

### 3. Streaming

- **Server-Sent Events**: Real-time updates
- **Parallel Processing**: Draft + span labeling in parallel
- **Early Returns**: Send draft before refinement completes

### 4. Request Deduplication

- **Request ID**: Tracks in-flight requests
- **Abort Controller**: Cancels previous requests
- **State Checks**: Validates request ID before state updates

### 5. Shot Plan Caching

- **Pre-interpretation**: Shot plans cached per concept
- **Reuse**: Reused across optimization stages

---

## Error Handling

### Frontend

**Abort Errors:**
- Silent return (no state update)
- User cancelled request

**Network Errors:**
- Show error toast
- Reset processing state
- Allow retry

**Streaming Errors:**
- Handle `error` event
- Reset refining state
- Show error message

### Backend

**Validation Errors:**
- Return 400 with error message
- Logged with request ID

**AI Service Errors:**
- Fallback to single-stage if two-stage fails
- Log error but continue
- Return partial results if possible

**Compilation Errors:**
- Revert to generic optimization
- Log error
- Continue with uncompiled version

---

## Metrics & Monitoring

### Frontend Metrics

- **Optimization Time**: Total time from start to completion
- **Draft Time**: Time to first draft
- **Refinement Time**: Time for refinement stage
- **Quality Score**: Calculated quality score
- **Request ID**: Tracks request lifecycle

### Backend Metrics

- **Total Time**: End-to-end optimization time
- **Cache Hit Rate**: Percentage of cached requests
- **Stage Durations**: Draft and refinement times
- **Model Usage**: Which models were used
- **Compilation Time**: Model compilation duration
- **Token Usage**: Input/output token counts

**Logging:**
- Request/response logging
- Performance metrics
- Error tracking
- Quality scores
- Model selection

---

## Future Improvements

1. **Parallel Draft Generation**: Generate multiple draft variations
2. **Adaptive Refinement**: Adjust refinement based on draft quality
3. **User Feedback Loop**: Learn from user edits
4. **A/B Testing**: Test different optimization strategies
5. **Progressive Loading**: Stream tokens as they're generated
6. **Multi-Model Drafts**: Generate drafts with multiple models

---

## Related Documentation

- [Enhancement Suggestions Workflow](./ENHANCEMENT_SUGGESTIONS_WORKFLOW.md)
- [Workflow Documentation](../workflow_documentation.md)
- [Architecture Guide](../architecture/README.md)
- [Video CoT Developer Guide](../architecture/VIDEO_COT_DEVELOPER_GUIDE.md)
- [API Documentation](../API.md)

