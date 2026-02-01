# PromptCanvas: Current Capabilities Reference

> **Last Updated:** February 1, 2026  
> **Purpose:** Accurate inventory of implemented features and their locations

---

## Overview

PromptCanvas is a video prompt optimization platform with semantic span labeling, multi-provider LLM routing, and model-specific guidance. This document catalogs what's **actually implemented** to prevent duplicate work and inform roadmap decisions.

---

## Core Systems

### 1. Semantic Taxonomy

**Location:** `shared/taxonomy.ts`

**9 Categories, 23 Attributes:**

| Category | Attributes | Color |
|----------|------------|-------|
| **SHOT** | `shot.type` | cyan |
| **SUBJECT** | `subject.identity`, `subject.appearance`, `subject.wardrobe`, `action.movement`, `subject.emotion` | orange |
| **ACTION** | `action.movement`, `action.state`, `action.gesture` | rose |
| **ENVIRONMENT** | `environment.location`, `environment.weather`, `environment.context` | emerald |
| **LIGHTING** | `lighting.source`, `lighting.quality`, `lighting.timeOfDay`, `lighting.colorTemp` | yellow |
| **CAMERA** | `shot.type`, `camera.movement`, `camera.lens`, `camera.angle`, `camera.focus` | sky |
| **STYLE** | `style.aesthetic`, `style.filmStock`, `style.colorGrade` | violet |
| **TECHNICAL** | `technical.aspectRatio`, `technical.frameRate`, `technical.resolution`, `technical.duration` | slate |
| **AUDIO** | `audio.score`, `audio.soundEffect`, `audio.ambient` | fuchsia |

**Helper Functions:**
- `isValidCategory(id)` - O(1) validation
- `parseCategoryId(id)` - Parse parent/attribute
- `getParentCategory(id)` - Get parent from attribute
- `getColorForCategory(id)` - Get color theme

---

### 2. Model Detection Service

**Location:** `server/src/services/video-prompt-analysis/services/detection/ModelDetectionService.ts`

**Supported Models:**
- Sora (OpenAI)
- Veo3 (Google)
- Runway (Gen-3)
- Kling (Kuaishou)
- Luma (Dream Machine)

**Capabilities per model:**
```typescript
getModelCapabilities(model)     // { primary, secondary, weaknesses }
getModelOptimalParams(model)    // { duration, motion, camera, lighting, style }
getModelSpecificGuidance(model, category)  // Category-specific tips
formatModelContext(model)       // Formatted context for prompts
detectTargetModel(prompt)       // Auto-detect from prompt text
```

**Example - Sora capabilities:**
- Primary: Realistic motion, Physics simulation, Long takes (up to 60s)
- Weaknesses: Stylized content, Text rendering, Fast cuts

---

### 3. Video Prompt Linter

**Location:** `server/src/services/prompt-optimization/strategies/videoPromptLinter.ts`

**Validates:**
- ✅ `shot_framing` - Required, must not contain angle/view terms
- ✅ `camera_angle` - Required
- ✅ `camera_move` - Cinematographic vocabulary (dolly, pan, crane, tracking, handheld, steadicam, rack focus, etc.)
- ✅ `subject` / `subject_details` - 2-3 visible identifiers, 1-6 words each
- ✅ `action` - Single present-participle verb, no comma lists or "and" sequences
- ✅ `style` - Blocks generic terms ("cinematic", "stunning", "beautiful")
- ✅ All fields - Blocks viewer/audience language

**Key constraints enforced:**
- One clip, one action principle
- Camera-visible details only
- Specific over generic language

---

### 4. LLM Judge Service (Quality Scoring)

**Location:** `server/src/services/quality-feedback/services/LLMJudgeService.ts`

**Capabilities:**
- Rubric-based evaluation (video vs general)
- Multi-criteria scoring (1-5 per criterion)
- Batch evaluation for A/B testing
- Comparative analysis between suggestion sets

**⚠️ Integration Status:** Backend exists but is **NOT wired to the frontend UI**. The visible `QualityScore.tsx` component uses simple heuristics (length, keywords) instead.

---

### 5. Span Labeling Pipeline

**Location:** `server/src/llm/span-labeling/`

**Architecture:**
- `SpanLabelingService.ts` - Main orchestrator
- Multi-provider routing (Groq for speed, OpenAI for quality)
- Aho-Corasick pattern matching for technical terms
- Semantic entity extraction

**Performance:** Sub-1 second processing (optimized from 22s)

---

### 6. Prompt History & Versioning

**Location:** `client/src/hooks/usePromptHistory/`

**Features:**
- ✅ Firestore persistence for authenticated users
- ✅ LocalStorage fallback for anonymous users
- ✅ Search/filter history
- ✅ UUID-based sharing
- ✅ Highlight cache storage

**⚠️ Missing:** Visual diff view between versions (storage exists, UI doesn't)

---

### 7. Template Library

**Location:** `client/src/components/VideoConceptBuilder/config/templates.ts`

**Current Templates (3 total):**
1. Product Demo
2. Nature Doc  
3. Urban Action

**Backend:** `VideoTemplateRepository.ts` exists for storage

**⚠️ Status:** Infrastructure exists but library is minimal. No community contribution system.

---

### 8. Keyboard Shortcuts

**Location:** `client/src/components/KeyboardShortcuts/shortcuts.config.ts`

**Implemented:**
| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Open keyboard shortcuts |
| `Cmd+,` | Open settings |
| `Cmd+N` | Create new prompt |
| `Cmd+Enter` | Optimize prompt |
| `Cmd+C` | Copy optimized prompt |
| `Cmd+E` | Export prompt |
| `Cmd+S` | Save to history |
| `Cmd+B` | Toggle history sidebar |
| `Alt+1-9` | Apply suggestion |

**⚠️ Missing:** Span navigation (Tab between spans, arrow keys within suggestions)

---

### 9. Request Batching (Internal)

**Location:** `server/src/middleware/requestBatching.js`

Collects span labeling requests within 50ms window for parallel processing. **Internal optimization only** - not user-facing batch optimization.

---

### 10. Caching Infrastructure

**Locations:**
- `server/src/services/cache/CacheService.ts` - Main cache
- `server/src/services/cache/SemanticCacheService.ts` - Semantic similarity caching
- `server/src/services/cache/SpanLabelingCacheService.ts` - Span-specific caching

**Tiers:** Memory → Redis

---

### 11. Face-Swap Preprocessing (Character + Composition)

**Locations:**
- `server/src/services/generation/FaceSwapService.ts`
- `server/src/services/generation/providers/FalFaceSwapProvider.ts`
- `server/src/routes/preview/handlers/videoGenerate.ts`

**Capabilities:**
- ✅ When both `startImage` and `characterAssetId` are provided, the system performs a face-swap before i2v.
- ✅ Uses Easel AI (fal.ai `easel-ai/advanced-face-swap`) to composite the character's face onto the composition.
- ✅ Preserves the original composition while applying the character identity.
- ✅ Charges 2 credits for face-swap preprocessing and returns `faceSwapApplied`/`faceSwapUrl` in the response.

---

## Frontend Components

### VideoConceptBuilder
**Location:** `client/src/components/VideoConceptBuilder/`

Wizard-style prompt builder with:
- Element-by-element input
- Template selector (3 templates)
- Real-time preview via Replicate/Flux

### PromptCanvas (Span Highlighting)
**Location:** `client/src/features/prompt-optimizer/PromptCanvas.tsx`

Interactive span highlighting with:
- Click-to-enhance interface
- Category color coding
- Suggestion panel integration

### SuggestionsPanel
**Location:** `client/src/components/SuggestionsPanel/`

Context-aware suggestions for selected spans with:
- Multiple alternatives per category
- One-click application

---

## What Does NOT Exist

To prevent confusion, these are explicitly **not implemented**:

| Feature | Status |
|---------|--------|
| Negative prompt support | ❌ Not in schema or UI |
| Batch optimization (user-facing) | ❌ Only internal request batching |
| Version diff view | ❌ Storage exists, no UI |
| Span keyboard navigation | ❌ Only global shortcuts |
| Community templates | ❌ No submission system |
| A/B variation generator | ❌ Not implemented |
| Model-specific export UI | ❌ Backend exists, no UI |
| LLM quality scoring in UI | ❌ Service exists, not wired |

---

## File Quick Reference

| System | Primary Location |
|--------|------------------|
| Taxonomy | `shared/taxonomy.ts` |
| Model Detection | `server/src/services/video-prompt-analysis/services/detection/ModelDetectionService.ts` |
| Video Linter | `server/src/services/prompt-optimization/strategies/videoPromptLinter.ts` |
| LLM Judge | `server/src/services/quality-feedback/services/LLMJudgeService.ts` |
| Span Labeling | `server/src/llm/span-labeling/SpanLabelingService.ts` |
| Prompt History | `client/src/hooks/usePromptHistory/` |
| Templates | `client/src/components/VideoConceptBuilder/config/templates.ts` |
| Keyboard Shortcuts | `client/src/components/KeyboardShortcuts/shortcuts.config.ts` |
| Quality Score UI | `client/src/components/QualityScore.tsx` |
