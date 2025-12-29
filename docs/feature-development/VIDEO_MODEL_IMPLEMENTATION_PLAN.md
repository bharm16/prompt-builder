# Video Model Prompt Optimization Implementation Plan (Dec 2025)

## 1. Executive Summary
This document outlines the implementation strategy for integrating advanced prompt optimization for **Runway Gen-4.5**, **Luma Ray-3**, **Kling AI 2.6**, **OpenAI Sora 2**, and **Google Veo 4**.

Based on the *AI Video Model Prompting Report (Dec 2025)*, we are shifting from a generic "magic word" injection strategy to a **polymorphic middleware architecture**. This architecture will treat user intent as a "source" signal that must be compiled into model-specific "bytecode" (structured prompts, JSON objects, or causal chains).

## 2. Architecture: The Prompt Optimization Engine (POE)

The POE will be implemented as a pipeline with three distinct phases:
1.  **Normalization (The "Strip" Phase):** Cleaning input of incompatible tokens.
2.  **Transformation (The "Translation" Phase):** Reordering and restructuring based on model architecture (A2D vs. Reasoning vs. MDT).
3.  **Augmentation (The "Inject" Phase):** Adding model-specific triggers and physics compliance.

### Core Interface
**Target File:** `server/src/services/video-prompt-analysis/types.ts` (Update or Create `strategies/types.ts`)

```typescript
export interface PromptOptimizationStrategy {
  modelId: string;
  /**
   * Phase 1: Strip incompatible tokens and normalize input
   */
  normalize(input: string): string; 
  
  /**
   * Phase 2: Translate intent into model-native structure (Text, JSON, or Chain)
   */
  transform(input: string, context?: PromptContext): string | object; 
  
  /**
   * Phase 3: Inject model-specific triggers and enforce physics/consistency
   */
  augment(input: string | object): string | object;
}

export interface PromptContext {
    userIntent: string;
    detectedSection?: string;
    constraints?: ConstraintConfig;
    history?: EditHistoryEntry[];
}
```

---

## 3. Model-Specific Implementation Specs

### 3.1 Runway Gen-4.5 Alpha ("Whisper Thunder")
**File:** `server/src/services/video-prompt-analysis/strategies/RunwayStrategy.ts`
**Architecture:** Autoregressive-to-Diffusion (A2D)
**Goal:** Structural-Literalism via "CSAE" Protocol.

*   **Transformation Logic (The "S.A.E. Sort"):**
    *   **Parser:** Use Regex/NLP to extract camera terms (pan, tilt, truck, pedestal).
    *   **Reorder:** Move Camera terms to the absolute start.
    *   **Structure:** `[Camera Vectors] -> [Subject (Invariant)] -> [Action (Temporal)] -> [Environment]`
*   **Injection Rules:**
    *   **Inject:** "Single continuous shot" (Prevents hallucinated cuts).
    *   **Inject:** "Fluid motion", "Consistent geometry" (Reinforces A2D stability).
    *   **Camera Mapping:**
        *   "Depth" / "3D feel" -> `camera_motion: "dolly"`
        *   "Vertigo" / "Compression" -> `camera_motion: "zoom"`
*   **Stripping Rules:**
    *   **Strip:** Emotional/Abstract terms ("vibe", "sad") unless translatable to lighting ("blue hour").
    *   **Strip:** "Morphing", "Blur" (unless requested as style).

### 3.2 Luma Ray-3
**File:** `server/src/services/video-prompt-analysis/strategies/LumaStrategy.ts`
**Architecture:** Reasoning-Based Diffusion Transformer
**Goal:** Causal Reasoning & HDR Pipeline.

*   **Transformation Logic (Causal Expansion):**
    *   **LLM Step:** Use an intermediate LLM call to expand static descriptions into causal chains.
        *   *Input:* "Car crash."
        *   *Output:* "A speeding car loses traction... skidding sideways... colliding with barrier... metal crumples."
*   **Injection Rules:**
    *   **Trigger:** "High Dynamic Range", "16-bit color", "ACES colorspace", "Linear EXR" (Forces HDR pipeline).
    *   **Motion:** "Slow motion", "High-speed camera" (Triggers interpolation weights).
*   **Stripping Rules:**
    *   **Strip:** "Loop", "Seamless" if `loop: true` API parameter is active.
    *   **Strip:** "4k", "8k" (Redundant tokens for this architecture).

### 3.3 Kling AI 2.6
**File:** `server/src/services/video-prompt-analysis/strategies/KlingStrategy.ts`
**Architecture:** Multimodal Diffusion Transformer (MDT) with MemFlow
**Goal:** Audio-Visual Script & Narrative Consistency.

*   **Transformation Logic (The Screenplay Formatter):**
    *   **Parser:** Identify dialogue patterns `Name: "Text"`.
    *   **Format:** `[Character] ([Emotion]): "[Line]"`
    *   **Audio Separation:** Extract sound effects to specific `Audio:` blocks if the API supports it, or append as "Audio: [SFX]" to the text prompt.
*   **Injection Rules:**
    *   **Audio:** "Synced lips", "natural speech", "high fidelity audio".
    *   **Consistency:** Use `@Element` syntax if reference images are present.
*   **Stripping Rules:**
    *   **Strip:** Generic "sound" or "noise" (prevents white noise generation).
    *   **Strip:** Visual quality tokens ("4k") from the *audio* description section.

### 3.4 OpenAI Sora 2
**File:** `server/src/services/video-prompt-analysis/strategies/SoraStrategy.ts`
**Architecture:** Spacetime Patch-based Transformer
**Goal:** Physics Simulation & Temporal Segmentation.

*   **Transformation Logic (Physical Grounding):**
    *   **Analyzer:** Scan for interactions (collisions, gravity).
    *   **Segmentation:** Break complex prompts into `Sequence: Shot 1 (0-4s) -> Cut to Shot 2`.
*   **Injection Rules:**
    *   **Physics:** "Newtonian physics", "momentum conservation", "surface friction", "elastic collision".
    *   **Meta:** Inject `response_format: { type: "json_object" }` in API wrapper for metadata.
*   **Stripping Rules:**
    *   **Safety:** Aggressively strip public figure names (unless "Cameo" authorized) to prevent API rejections.

### 3.5 Google Veo 4
**File:** `server/src/services/video-prompt-analysis/strategies/VeoStrategy.ts`
**Architecture:** Transformer-based Latent Diffusion (Gemini-integrated)
**Goal:** Structured Data Object (JSON).

*   **Transformation Logic (The JSON Serializer):**
    *   **Serializer:** Convert natural language input into a structured JSON schema.
    *   **Schema Target:**
        ```json
        {
          "subject": { "description": "...", "action": "..." },
          "camera": { "type": "...", "movement": "..." },
          "environment": { "lighting": "...", "weather": "..." },
          "audio": { "dialogue": "...", "ambience": "..." }
        }
        ```
*   **Injection Rules:**
    *   **Style:** `style_preset: "cinematic"` (or based on keyword).
    *   **RAG:** (Future) Inject hex codes from brand guidelines if available.
*   **Stripping Rules:**
    *   **Strip:** Markdown, conversational filler ("Can you make...").

---

## 4. Shared Middleware Components

### 4.1 The "TechStripper"
**File:** `server/src/services/video-prompt-analysis/utils/TechStripper.ts`
A shared utility to remove "placebo tokens" that degrade performance in modern models.
*   **Targets:** "4k", "8k", "trending on artstation", "award winning".
*   **Logic:**
    *   *Keep* for Kling/Veo (act as boosters).
    *   *Remove* for Runway/Luma (waste context/confuse architecture).

### 4.2 The "SafetySanitizer"
**File:** `server/src/services/video-prompt-analysis/utils/SafetySanitizer.ts`
Pre-flight check to prevent account bans.
*   **Blocklist:** NSFW terms, unauthorized celebrity names (Taylor Swift, etc.), violent acts.
*   **Action:** Replace with generic descriptors (e.g., "Taylor Swift" -> "Pop star with blonde hair").

### 4.3 Multimodal Asset Manager (MAM)
**File:** `server/src/services/video-prompt-analysis/services/MultimodalAssetManager.ts`
*   **Function:** Handles `@Image`, `@Element`, and `@Cameo` references.
*   **Workflow:** Upload to model specific storage -> Get Token/UUID -> Inject Token into text prompt.

---

## 5. Implementation Roadmap

### Phase 1: Text-Based Optimization (The "Translator")
1.  **Update Model Detection:**
    *   Update `server/src/services/video-prompt-analysis/services/detection/ModelDetectionService.ts` to include patterns for Gen-4.5, Ray-3, Kling 2.6, Sora 2, and Veo 4.
2.  **Define Strategy Interface:**
    *   Create `PromptOptimizationStrategy` interface in `server/src/services/video-prompt-analysis/types.ts`.
3.  **Implement Strategies:**
    *   Create basic `normalize`, `transform`, `augment` implementations for all 5 strategies in `server/src/services/video-prompt-analysis/strategies/`.
4.  **Integrate with VideoPromptService:**
    *   Update `VideoPromptService.ts` to use the new strategies based on detected model.

### Phase 2: Structured & JSON Control
*   Implement `VeoJsonBuilder` in `VeoStrategy.ts` to map text to Veo's JSON schema.
*   Implement Sora's temporal segmentation logic (`Shot 1` -> `Shot 2`) in `SoraStrategy.ts`.

### Phase 3: Advanced Pipeline Features
*   Integrate **Multimodal Asset Manager** for handling image references.
*   Implement **Cross-Model Translation** (One prompt -> 5 optimized outputs).
