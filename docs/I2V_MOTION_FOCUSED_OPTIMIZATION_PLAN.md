# I2V Motion-Focused Optimization Plan

> **Core insight:** The image IS the prompt. We don't describe it - we just say what happens.

---

## Table of Contents

1. [The Problem](#the-problem)
2. [The Solution](#the-solution)
3. [Architecture Overview](#architecture-overview)
4. [Phase 0: Shared Vocabulary + Constraint Modes](#phase-0-shared-vocabulary--constraint-modes)
5. [Phase 1: Image Analysis Service](#phase-1-image-analysis-service)
6. [Phase 2: Motion-Focused Optimization](#phase-2-motion-focused-optimization)
7. [Phase 3: Constrained Suggestions + UI](#phase-3-constrained-suggestions--ui)
8. [Phase 4: Span Labeling for I2V](#phase-4-span-labeling-for-i2v)
9. [API Reference](#api-reference)
10. [Implementation Checklist](#implementation-checklist)

---

## The Problem

Current prompt optimizer assumes a blank canvas. For text-to-video, that's correct - everything gets generated from nothing.

For image-to-video, the image already defines:
- Who/what the subject is
- The framing (close-up, wide shot, angle)
- The lighting conditions
- The environment/setting
- The color palette

Our optimizer might suggest: *"A young woman in a sunlit forest, wide establishing shot, golden hour backlight..."*

But the uploaded image shows: an elderly man in a kitchen, close-up, fluorescent lighting.

**The optimizer's suggestions are useless or actively harmful.**

---

## The Solution

### Key Insight

**I2V models don't need description - they need direction.**

The image is the visual conditioning. Describing it in text is:
- Redundant at best
- Confusing at worst (if description doesn't match)
- Wasteful of token budget

**What i2v prompts should look like:**

| ❌ Over-described | ✅ Motion-focused |
|-------------------|-------------------|
| "An elderly woman with gray hair sitting in a kitchen with fluorescent lighting in a close-up shot slowly reaches for her coffee cup with warm natural movement" | "She slowly reaches for the coffee cup, gentle smooth movement" |

### What We Actually Need

Image analysis is **not** for building prompts. It's for:

| Purpose | Why |
|---------|-----|
| **Filter suggestions** | Don't offer "young woman" alternatives when image shows elderly man |
| **Filter camera moves** | Don't suggest "pan left" when subject is at left edge |
| **Conflict warnings** | "You said 'night scene' but image shows daylight" |
| **Skip redundant analysis** | If image came from our platform, we know the source prompt |

### The Output

I2V optimization produces a **motion-focused prompt**, not a scene description:

```
Input:  "she reaches for her coffee, warm morning light"
         └─ motion ─┘           └─ visual (conflict) ─┘

Output: "She slowly reaches for the coffee cup, smooth natural movement"
        └─────────────── motion only ───────────────┘
```

---

## Architecture Overview

### What Changes

```
CURRENT (t2v):
User Prompt → Full Optimization → Descriptive Prompt → Video Gen

NEW (i2v):
                    ┌─────────────────────────────┐
                    │   Image Analysis Service    │
                    │   (for filtering/warnings)  │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
User Prompt → Motion Extraction → Motion Prompt → Video Gen
              └─ strip visuals ─┘
```

### Service Structure

```
server/src/services/
├── image-observation/                    # NEW
│   ├── ImageObservationService.ts        # Main service (max 300 lines)
│   ├── types.ts                          # ImageObservation type
│   ├── cache/
│   │   └── ObservationCache.ts           # Cache by image hash
│   └── templates/
│       └── image-observation-prompt.md   # Vision LLM prompt
│
├── prompt-optimization/
│   └── strategies/
│       └── I2VMotionStrategy.ts          # NEW: Motion-only optimization
│
├── enhancement/
│   └── services/
│       └── I2VConstrainedSuggestions.ts  # NEW: Filter by observation
│
└── shared/
    └── cinematography.ts                  # NEW: Shared vocabulary
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        I2V PIPELINE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌─────────────────────┐                       │
│  │  Source  │───▶│ ImageObservation    │                       │
│  │  Image   │    │ Service             │                       │
│  └──────────┘    │                     │                       │
│                  │ Extracts:           │                       │
│                  │ • subject type      │    ┌───────────────┐  │
│                  │ • framing           │───▶│ Lock Map      │  │
│                  │ • lighting          │    │ (for UI)      │  │
│                  │ • motion compat     │    └───────┬───────┘  │
│                  └─────────────────────┘            │          │
│                                                     │          │
│  ┌──────────┐    ┌─────────────────────┐           │          │
│  │  User    │───▶│ I2VMotionStrategy   │◀──────────┘          │
│  │  Prompt  │    │                     │                       │
│  └──────────┘    │ 1. Extract motion   │    ┌───────────────┐  │
│                  │ 2. Detect conflicts │───▶│ Motion Prompt │  │
│                  │ 3. Expand pacing    │    │ + Warnings    │  │
│                  │ 4. Output motion    │    └───────────────┘  │
│                  └─────────────────────┘                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Shared Vocabulary + Constraint Modes

### 0.1 Cinematography Vocabulary

**File:** `server/src/shared/cinematography.ts`

```typescript
/**
 * Shared cinematography vocabulary
 * Used by VideoPromptIR, ImageObservation, and UI components
 */

export const SHOT_TYPES = [
  'extreme-close-up',
  'close-up', 
  'medium-close-up',
  'medium',
  'medium-wide',
  'wide',
  'extreme-wide',
] as const;

export const CAMERA_ANGLES = [
  'eye-level',
  'low-angle',
  'high-angle',
  'birds-eye',
  'worms-eye',
  'dutch',
  'over-shoulder',
] as const;

export const CAMERA_MOVEMENTS = [
  'static',
  'pan-left',
  'pan-right',
  'tilt-up',
  'tilt-down',
  'dolly-in',
  'dolly-out',
  'truck-left',
  'truck-right',
  'crane-up',
  'crane-down',
  'arc-left',
  'arc-right',
  'zoom-in',
  'zoom-out',
] as const;

export const LIGHTING_QUALITIES = [
  'natural',
  'artificial', 
  'dramatic',
  'flat',
  'mixed',
] as const;

export const SUBJECT_POSITIONS = [
  'center',
  'left',
  'right',
  'top',
  'bottom',
  'left-third',
  'right-third',
] as const;

export type ShotType = typeof SHOT_TYPES[number];
export type CameraAngle = typeof CAMERA_ANGLES[number];
export type CameraMovement = typeof CAMERA_MOVEMENTS[number];
export type LightingQuality = typeof LIGHTING_QUALITIES[number];
export type SubjectPosition = typeof SUBJECT_POSITIONS[number];

/**
 * Camera movements that work well with each shot type
 */
export const SHOT_MOVEMENT_COMPATIBILITY: Record<ShotType, CameraMovement[]> = {
  'extreme-close-up': ['static', 'dolly-out'],
  'close-up': ['static', 'dolly-in', 'dolly-out'],
  'medium-close-up': ['static', 'dolly-in', 'dolly-out', 'pan-left', 'pan-right'],
  'medium': ['static', 'dolly-in', 'dolly-out', 'pan-left', 'pan-right', 'truck-left', 'truck-right'],
  'medium-wide': CAMERA_MOVEMENTS.filter(m => m !== 'zoom-in'), // Most work
  'wide': [...CAMERA_MOVEMENTS], // All work
  'extreme-wide': [...CAMERA_MOVEMENTS], // All work
};

/**
 * Camera movements to avoid based on subject position
 */
export const POSITION_MOVEMENT_RISKS: Record<SubjectPosition, CameraMovement[]> = {
  'center': [], // No risks
  'left': ['pan-right', 'truck-left'],
  'right': ['pan-left', 'truck-right'],
  'top': ['tilt-down', 'crane-up'],
  'bottom': ['tilt-up', 'crane-down'],
  'left-third': ['pan-right', 'truck-left'],
  'right-third': ['pan-left', 'truck-right'],
};
```

### 0.2 Constraint Modes

**File:** `server/src/services/prompt-optimization/types/i2v.ts`

```typescript
/**
 * I2V Constraint Modes
 * 
 * Controls how strictly the optimizer respects image-derived constraints.
 */

/**
 * strict: Image is truth. Visual descriptions stripped. Motion only.
 * flexible: Warnings for conflicts, but user input preserved.
 * transform: Minimal constraints. For style transfer / artistic use.
 */
export type I2VConstraintMode = 'strict' | 'flexible' | 'transform';

/**
 * Lock status for UI display
 */
export type LockStatus = 'hard' | 'soft' | 'unlocked';

/**
 * Categories that can be locked
 */
export type LockableCategory = 
  | 'subject.identity'
  | 'subject.appearance'
  | 'shot.type'
  | 'shot.angle'
  | 'lighting'
  | 'environment'
  | 'color';

/**
 * Lock map derived from constraint mode
 */
export type LockMap = Record<LockableCategory, LockStatus>;

/**
 * Derive lock map from constraint mode
 */
export function deriveLockMap(mode: I2VConstraintMode): LockMap {
  switch (mode) {
    case 'strict':
      return {
        'subject.identity': 'hard',
        'subject.appearance': 'hard',
        'shot.type': 'hard',
        'shot.angle': 'hard',
        'lighting': 'hard',
        'environment': 'hard',
        'color': 'hard',
      };
    case 'flexible':
      return {
        'subject.identity': 'hard',
        'subject.appearance': 'soft',
        'shot.type': 'hard',
        'shot.angle': 'soft',
        'lighting': 'soft',
        'environment': 'soft',
        'color': 'soft',
      };
    case 'transform':
      return {
        'subject.identity': 'soft',
        'subject.appearance': 'unlocked',
        'shot.type': 'soft',
        'shot.angle': 'unlocked',
        'lighting': 'unlocked',
        'environment': 'unlocked',
        'color': 'unlocked',
      };
  }
}

/**
 * Conflict warning
 */
export interface ConflictWarning {
  category: LockableCategory;
  userSaid: string;
  imageshows: string;
  severity: 'info' | 'warning' | 'blocked';
}

/**
 * I2V optimization result
 */
export interface I2VOptimizationResult {
  /** Motion-focused prompt */
  prompt: string;
  /** Conflicts detected between user input and image */
  conflicts: ConflictWarning[];
  /** The mode that was applied */
  appliedMode: I2VConstraintMode;
  /** Lock map for UI (derived from mode) */
  lockMap: LockMap;
  /** What motion elements we extracted */
  extractedMotion: {
    subjectAction: string | null;
    cameraMovement: string | null;
    pacing: string | null;
  };
}
```

---

## Phase 1: Image Analysis Service

### 1.1 Image Observation Types

**File:** `server/src/services/image-observation/types.ts`

```typescript
/**
 * Image Observation Types
 * 
 * Lightweight observation data extracted from images.
 * NOT a full scene description - just enough to filter/warn.
 */

import type { 
  ShotType, 
  CameraAngle, 
  LightingQuality,
  SubjectPosition,
  CameraMovement,
} from '@shared/cinematography';

/**
 * What we observe about the subject
 */
export interface SubjectObservation {
  /** What type of subject */
  type: 'person' | 'animal' | 'object' | 'scene' | 'abstract';
  /** Brief identifier (for conflict warnings) */
  description: string;
  /** Where in frame */
  position: SubjectPosition;
  /** Confidence 0-1 */
  confidence: number;
}

/**
 * What we observe about framing
 */
export interface FramingObservation {
  shotType: ShotType;
  angle: CameraAngle;
  confidence: number;
}

/**
 * What we observe about lighting
 */
export interface LightingObservation {
  quality: LightingQuality;
  timeOfDay: 'day' | 'night' | 'golden-hour' | 'blue-hour' | 'indoor' | 'unknown';
  confidence: number;
}

/**
 * Motion compatibility derived from observations
 */
export interface MotionCompatibility {
  /** Camera movements that work well */
  recommended: CameraMovement[];
  /** Camera movements that are risky */
  risky: CameraMovement[];
  /** Why certain moves are risky */
  risks: Array<{ movement: CameraMovement; reason: string }>;
}

/**
 * Complete observation from an image
 */
export interface ImageObservation {
  /** Hash for caching */
  imageHash: string;
  /** When analyzed */
  observedAt: Date;
  
  /** What we see */
  subject: SubjectObservation;
  framing: FramingObservation;
  lighting: LightingObservation;
  
  /** What motion works */
  motion: MotionCompatibility;
  
  /** Overall confidence */
  confidence: number;
}

/**
 * Request to analyze an image
 */
export interface ImageObservationRequest {
  /** Image URL or base64 */
  image: string;
  /** Skip vision call if we have the source prompt */
  sourcePrompt?: string;
  /** Skip cache */
  skipCache?: boolean;
}

/**
 * Analysis result
 */
export interface ImageObservationResult {
  success: boolean;
  observation?: ImageObservation;
  error?: string;
  /** Was this from cache? */
  cached: boolean;
  /** Did we use sourcePrompt fast-path? */
  usedFastPath: boolean;
  /** Analysis time */
  durationMs: number;
}
```

### 1.2 Image Observation Service

**File:** `server/src/services/image-observation/ImageObservationService.ts`

```typescript
/**
 * ImageObservationService
 * 
 * Extracts lightweight observations from images for i2v filtering/warnings.
 * NOT for building prompts - just for constraining suggestions.
 * 
 * PATTERN: Single-responsibility service
 * MAX LINES: 300
 */

import { logger } from '@infrastructure/Logger';
import { hashImageUrl, hashBase64Image } from '@utils/hash';
import { ObservationCache } from './cache/ObservationCache';
import { 
  SHOT_MOVEMENT_COMPATIBILITY,
  POSITION_MOVEMENT_RISKS,
  type CameraMovement,
} from '@shared/cinematography';
import type {
  ImageObservation,
  ImageObservationRequest,
  ImageObservationResult,
  SubjectObservation,
  FramingObservation,
  LightingObservation,
  MotionCompatibility,
} from './types';

interface VisionAIService {
  analyzeImage(params: {
    image: string;
    prompt: string;
    maxTokens?: number;
  }): Promise<{ text: string }>;
}

export class ImageObservationService {
  private readonly ai: VisionAIService;
  private readonly cache: ObservationCache;
  private readonly log = logger.child({ service: 'ImageObservationService' });

  constructor(aiService: VisionAIService) {
    this.ai = aiService;
    this.cache = new ObservationCache();
  }

  /**
   * Observe an image and extract filtering/warning data
   */
  async observe(request: ImageObservationRequest): Promise<ImageObservationResult> {
    const startTime = performance.now();
    
    // Generate hash for caching
    const imageHash = request.image.startsWith('data:')
      ? hashBase64Image(request.image)
      : hashImageUrl(request.image);

    // Check cache
    if (!request.skipCache) {
      const cached = await this.cache.get(imageHash);
      if (cached) {
        return {
          success: true,
          observation: cached,
          cached: true,
          usedFastPath: false,
          durationMs: Math.round(performance.now() - startTime),
        };
      }
    }

    // Fast path: if we have the source prompt, parse it instead of vision
    if (request.sourcePrompt) {
      const observation = this.parseSourcePrompt(request.sourcePrompt, imageHash);
      await this.cache.set(imageHash, observation);
      return {
        success: true,
        observation,
        cached: false,
        usedFastPath: true,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    // Full path: vision analysis
    try {
      const observation = await this.analyzeWithVision(request.image, imageHash);
      await this.cache.set(imageHash, observation);
      
      return {
        success: true,
        observation,
        cached: false,
        usedFastPath: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (error) {
      this.log.error('Image observation failed', error as Error);
      return {
        success: false,
        error: (error as Error).message,
        cached: false,
        usedFastPath: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  /**
   * Fast path: parse observation from source prompt (no vision call)
   */
  private parseSourcePrompt(prompt: string, imageHash: string): ImageObservation {
    const lower = prompt.toLowerCase();
    
    // Basic heuristics - good enough for filtering
    const subject: SubjectObservation = {
      type: this.detectSubjectType(lower),
      description: this.extractSubjectDescription(prompt),
      position: 'center', // Assume center unless we know better
      confidence: 0.7,
    };

    const framing: FramingObservation = {
      shotType: this.detectShotType(lower),
      angle: this.detectAngle(lower),
      confidence: 0.6,
    };

    const lighting: LightingObservation = {
      quality: this.detectLightingQuality(lower),
      timeOfDay: this.detectTimeOfDay(lower),
      confidence: 0.6,
    };

    const motion = this.deriveMotionCompatibility(framing, subject.position);

    return {
      imageHash,
      observedAt: new Date(),
      subject,
      framing,
      lighting,
      motion,
      confidence: 0.6, // Lower confidence for text-derived
    };
  }

  /**
   * Full path: analyze with vision LLM
   */
  private async analyzeWithVision(image: string, imageHash: string): Promise<ImageObservation> {
    const prompt = `Analyze this image for video generation constraints. Return JSON only:

{
  "subject": {
    "type": "person|animal|object|scene|abstract",
    "description": "brief description (10 words max)",
    "position": "center|left|right|top|bottom|left-third|right-third"
  },
  "framing": {
    "shotType": "extreme-close-up|close-up|medium-close-up|medium|medium-wide|wide|extreme-wide",
    "angle": "eye-level|low-angle|high-angle|birds-eye|worms-eye|dutch|over-shoulder"
  },
  "lighting": {
    "quality": "natural|artificial|dramatic|flat|mixed",
    "timeOfDay": "day|night|golden-hour|blue-hour|indoor|unknown"
  },
  "confidence": 0.0-1.0
}

Be precise. Only describe what you clearly see.`;

    const response = await this.ai.analyzeImage({
      image,
      prompt,
      maxTokens: 500,
    });

    const parsed = this.parseJsonResponse(response.text);
    
    const subject: SubjectObservation = {
      type: parsed.subject?.type || 'object',
      description: parsed.subject?.description || 'subject',
      position: parsed.subject?.position || 'center',
      confidence: parsed.confidence || 0.8,
    };

    const framing: FramingObservation = {
      shotType: parsed.framing?.shotType || 'medium',
      angle: parsed.framing?.angle || 'eye-level',
      confidence: parsed.confidence || 0.8,
    };

    const lighting: LightingObservation = {
      quality: parsed.lighting?.quality || 'natural',
      timeOfDay: parsed.lighting?.timeOfDay || 'unknown',
      confidence: parsed.confidence || 0.8,
    };

    const motion = this.deriveMotionCompatibility(framing, subject.position);

    return {
      imageHash,
      observedAt: new Date(),
      subject,
      framing,
      lighting,
      motion,
      confidence: parsed.confidence || 0.8,
    };
  }

  /**
   * Derive motion compatibility from framing and position
   */
  private deriveMotionCompatibility(
    framing: FramingObservation,
    position: SubjectObservation['position']
  ): MotionCompatibility {
    const compatible = SHOT_MOVEMENT_COMPATIBILITY[framing.shotType] || [];
    const positionRisks = POSITION_MOVEMENT_RISKS[position] || [];

    const recommended = compatible.filter(m => !positionRisks.includes(m));
    const risky = positionRisks.filter(m => compatible.includes(m));

    const risks = risky.map(movement => ({
      movement,
      reason: `Subject is positioned ${position}, ${movement} may cut off subject`,
    }));

    return { recommended, risky, risks };
  }

  // Helper methods for fast-path parsing
  private detectSubjectType(text: string): SubjectObservation['type'] {
    if (/\b(man|woman|person|boy|girl|child|people)\b/.test(text)) return 'person';
    if (/\b(dog|cat|bird|animal|horse)\b/.test(text)) return 'animal';
    if (/\b(landscape|mountain|ocean|forest|city)\b/.test(text)) return 'scene';
    return 'object';
  }

  private extractSubjectDescription(text: string): string {
    // Extract first noun phrase (simplified)
    const match = text.match(/^[^,\.]+/);
    return match ? match[0].slice(0, 50) : 'subject';
  }

  private detectShotType(text: string): FramingObservation['shotType'] {
    if (/extreme close[- ]?up|ecu\b/.test(text)) return 'extreme-close-up';
    if (/close[- ]?up|cu\b/.test(text)) return 'close-up';
    if (/medium close/.test(text)) return 'medium-close-up';
    if (/medium wide|mws/.test(text)) return 'medium-wide';
    if (/\bwide\b|ws\b|establishing/.test(text)) return 'wide';
    if (/extreme wide|ews/.test(text)) return 'extreme-wide';
    if (/\bmedium\b|ms\b/.test(text)) return 'medium';
    return 'medium';
  }

  private detectAngle(text: string): FramingObservation['angle'] {
    if (/low angle|worm/.test(text)) return 'low-angle';
    if (/high angle|bird/.test(text)) return 'high-angle';
    if (/dutch|tilted/.test(text)) return 'dutch';
    if (/over.?shoulder|ots/.test(text)) return 'over-shoulder';
    return 'eye-level';
  }

  private detectLightingQuality(text: string): LightingObservation['quality'] {
    if (/dramatic|chiaroscuro|contrast/.test(text)) return 'dramatic';
    if (/flat|soft|diffuse/.test(text)) return 'flat';
    if (/artificial|neon|fluorescent/.test(text)) return 'artificial';
    if (/natural|sun/.test(text)) return 'natural';
    return 'natural';
  }

  private detectTimeOfDay(text: string): LightingObservation['timeOfDay'] {
    if (/golden hour|sunset|sunrise/.test(text)) return 'golden-hour';
    if (/blue hour|dusk|dawn/.test(text)) return 'blue-hour';
    if (/night|dark|moon/.test(text)) return 'night';
    if (/indoor|interior|room/.test(text)) return 'indoor';
    if (/day|bright|sunny|midday/.test(text)) return 'day';
    return 'unknown';
  }

  private parseJsonResponse(text: string): Record<string, unknown> {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return {};
    }
  }
}
```

### 1.3 Observation Cache

**File:** `server/src/services/image-observation/cache/ObservationCache.ts`

```typescript
/**
 * ObservationCache - Simple cache for image observations
 * 
 * PATTERN: Repository
 * MAX LINES: 100
 */

import { cacheService } from '@services/cache/CacheService';
import type { ImageObservation } from '../types';

const NAMESPACE = 'image-observation';
const TTL_SECONDS = 86400; // 24 hours

export class ObservationCache {
  private memory = new Map<string, { data: ImageObservation; expires: number }>();

  async get(imageHash: string): Promise<ImageObservation | null> {
    // Memory first
    const mem = this.memory.get(imageHash);
    if (mem && mem.expires > Date.now()) {
      return mem.data;
    }

    // Redis fallback
    try {
      const cached = await cacheService.get<ImageObservation>(`${NAMESPACE}:${imageHash}`);
      if (cached) {
        this.memory.set(imageHash, { data: cached, expires: Date.now() + TTL_SECONDS * 1000 });
        return cached;
      }
    } catch {
      // Redis unavailable, continue
    }

    return null;
  }

  async set(imageHash: string, observation: ImageObservation): Promise<void> {
    this.memory.set(imageHash, { data: observation, expires: Date.now() + TTL_SECONDS * 1000 });
    
    try {
      await cacheService.set(`${NAMESPACE}:${imageHash}`, observation, TTL_SECONDS);
    } catch {
      // Redis unavailable, memory-only
    }
  }
}
```

---

## Phase 2: Motion-Focused Optimization

### 2.1 I2V Motion Strategy

**File:** `server/src/services/prompt-optimization/strategies/I2VMotionStrategy.ts`

```typescript
/**
 * I2VMotionStrategy
 * 
 * Optimizes prompts for image-to-video by:
 * 1. Extracting motion intent from user text
 * 2. Discarding/warning about visual descriptions
 * 3. Outputting motion-focused prompt (no scene description)
 * 
 * PATTERN: Strategy
 * MAX LINES: 300
 */

import { logger } from '@infrastructure/Logger';
import { deriveLockMap, type I2VConstraintMode, type ConflictWarning, type I2VOptimizationResult } from '../types/i2v';
import type { ImageObservation } from '@services/image-observation/types';

interface AIService {
  execute(task: string, params: { systemPrompt: string; userPrompt: string; maxTokens?: number }): Promise<{ text: string }>;
}

interface I2VOptimizeParams {
  /** User's prompt */
  prompt: string;
  /** Observation from image (for conflict detection) */
  observation: ImageObservation;
  /** Constraint mode */
  mode?: I2VConstraintMode;
}

export class I2VMotionStrategy {
  private readonly ai: AIService;
  private readonly log = logger.child({ service: 'I2VMotionStrategy' });

  constructor(aiService: AIService) {
    this.ai = aiService;
  }

  /**
   * Optimize prompt for i2v - extract and enhance motion only
   */
  async optimize(params: I2VOptimizeParams): Promise<I2VOptimizationResult> {
    const { prompt, observation, mode = 'strict' } = params;
    const lockMap = deriveLockMap(mode);

    this.log.debug('Starting i2v optimization', { mode, promptLength: prompt.length });

    // Step 1: Parse user prompt to separate motion from visual
    const parsed = await this.parsePrompt(prompt);

    // Step 2: Detect conflicts between user visual descriptions and image
    const conflicts = this.detectConflicts(parsed.visual, observation, mode);

    // Step 3: Build motion-focused output
    const outputPrompt = this.buildMotionPrompt(parsed.motion, observation, mode);

    return {
      prompt: outputPrompt,
      conflicts,
      appliedMode: mode,
      lockMap,
      extractedMotion: {
        subjectAction: parsed.motion.subjectAction,
        cameraMovement: parsed.motion.cameraMovement,
        pacing: parsed.motion.pacing,
      },
    };
  }

  /**
   * Parse prompt into motion vs visual components
   */
  private async parsePrompt(prompt: string): Promise<ParsedPrompt> {
    const systemPrompt = `You separate video prompts into motion vs visual components.

Motion = actions, movements, camera moves, pacing, emotional changes
Visual = subject descriptions, lighting, environment, colors, shot types

Return JSON:
{
  "motion": {
    "subjectAction": "what the subject does (or null)",
    "cameraMovement": "camera movement (or null)", 
    "pacing": "slow/medium/fast/null",
    "emotional": "emotional change (or null)"
  },
  "visual": {
    "subjectDescription": "visual description of subject (or null)",
    "lighting": "lighting description (or null)",
    "environment": "environment description (or null)",
    "shotType": "shot type mentioned (or null)",
    "timeOfDay": "time of day mentioned (or null)"
  }
}`;

    const response = await this.ai.execute('parse_i2v_prompt', {
      systemPrompt,
      userPrompt: prompt,
      maxTokens: 400,
    });

    try {
      const parsed = JSON.parse(response.text.replace(/```json\s*/g, '').replace(/```/g, '').trim());
      return {
        motion: {
          subjectAction: parsed.motion?.subjectAction || null,
          cameraMovement: parsed.motion?.cameraMovement || null,
          pacing: parsed.motion?.pacing || null,
          emotional: parsed.motion?.emotional || null,
        },
        visual: {
          subjectDescription: parsed.visual?.subjectDescription || null,
          lighting: parsed.visual?.lighting || null,
          environment: parsed.visual?.environment || null,
          shotType: parsed.visual?.shotType || null,
          timeOfDay: parsed.visual?.timeOfDay || null,
        },
      };
    } catch {
      // Fallback: treat entire prompt as motion
      return {
        motion: {
          subjectAction: prompt,
          cameraMovement: null,
          pacing: null,
          emotional: null,
        },
        visual: {},
      };
    }
  }

  /**
   * Detect conflicts between user visual descriptions and image observation
   */
  private detectConflicts(
    visual: ParsedPrompt['visual'],
    observation: ImageObservation,
    mode: I2VConstraintMode
  ): ConflictWarning[] {
    const conflicts: ConflictWarning[] = [];

    // Time of day conflict
    if (visual.timeOfDay && observation.lighting.timeOfDay !== 'unknown') {
      const userTime = visual.timeOfDay.toLowerCase();
      const imageTime = observation.lighting.timeOfDay;
      
      const isConflict = 
        (userTime.includes('night') && imageTime !== 'night') ||
        (userTime.includes('day') && imageTime === 'night') ||
        (userTime.includes('golden') && imageTime !== 'golden-hour');
      
      if (isConflict) {
        conflicts.push({
          category: 'lighting',
          userSaid: visual.timeOfDay,
          imageshows: imageTime,
          severity: mode === 'strict' ? 'blocked' : 'warning',
        });
      }
    }

    // Shot type conflict
    if (visual.shotType) {
      const userShot = visual.shotType.toLowerCase();
      const imageShot = observation.framing.shotType;
      
      const isConflict =
        (userShot.includes('wide') && imageShot.includes('close')) ||
        (userShot.includes('close') && imageShot.includes('wide'));
      
      if (isConflict) {
        conflicts.push({
          category: 'shot.type',
          userSaid: visual.shotType,
          imageshows: imageShot,
          severity: mode === 'strict' ? 'blocked' : 'warning',
        });
      }
    }

    // Subject description conflict (basic check)
    if (visual.subjectDescription && observation.subject.description) {
      // Very basic conflict detection - could be enhanced
      const userSubject = visual.subjectDescription.toLowerCase();
      const imageSubject = observation.subject.description.toLowerCase();
      
      const genderConflict =
        (userSubject.includes('woman') && imageSubject.includes('man')) ||
        (userSubject.includes('man') && imageSubject.includes('woman'));
      
      const ageConflict =
        (userSubject.includes('young') && imageSubject.includes('elder')) ||
        (userSubject.includes('child') && imageSubject.includes('adult'));
      
      if (genderConflict || ageConflict) {
        conflicts.push({
          category: 'subject.identity',
          userSaid: visual.subjectDescription,
          imageshows: observation.subject.description,
          severity: 'blocked', // Always hard block identity conflicts
        });
      }
    }

    return conflicts;
  }

  /**
   * Build the final motion-focused prompt
   */
  private buildMotionPrompt(
    motion: ParsedPrompt['motion'],
    observation: ImageObservation,
    mode: I2VConstraintMode
  ): string {
    const parts: string[] = [];

    // Subject action (primary)
    if (motion.subjectAction) {
      parts.push(motion.subjectAction);
    }

    // Camera movement (if compatible)
    if (motion.cameraMovement) {
      const requested = motion.cameraMovement.toLowerCase();
      const isRisky = observation.motion.risky.some(m => 
        requested.includes(m.replace('-', ' '))
      );
      
      if (!isRisky || mode !== 'strict') {
        parts.push(motion.cameraMovement);
      }
    }

    // Pacing
    if (motion.pacing) {
      const pacingMap: Record<string, string> = {
        slow: 'smooth gentle movement',
        medium: 'natural pacing',
        fast: 'dynamic energetic motion',
      };
      parts.push(pacingMap[motion.pacing] || '');
    }

    // Emotional arc
    if (motion.emotional) {
      parts.push(motion.emotional);
    }

    // Default if nothing extracted
    if (parts.filter(Boolean).length === 0) {
      parts.push('subtle natural movement');
    }

    return parts.filter(Boolean).join(', ');
  }
}

interface ParsedPrompt {
  motion: {
    subjectAction: string | null;
    cameraMovement: string | null;
    pacing: string | null;
    emotional: string | null;
  };
  visual: {
    subjectDescription?: string | null;
    lighting?: string | null;
    environment?: string | null;
    shotType?: string | null;
    timeOfDay?: string | null;
  };
}
```

### 2.2 Integration with PromptOptimizationService

**File:** `server/src/services/prompt-optimization/PromptOptimizationService.ts` (modifications)

```typescript
// Add to imports
import { ImageObservationService } from '@services/image-observation';
import { I2VMotionStrategy } from './strategies/I2VMotionStrategy';
import type { I2VConstraintMode, I2VOptimizationResult } from './types/i2v';

// Add to constructor dependencies
private readonly imageObservation: ImageObservationService | null;
private readonly i2vStrategy: I2VMotionStrategy;

// Add to OptimizationRequest
interface OptimizationRequest {
  prompt: string;
  mode?: 'video' | 'image';
  // I2V-specific
  startImage?: string;
  sourcePrompt?: string; // For fast-path
  constraintMode?: I2VConstraintMode;
}

// Add i2v detection in optimize()
async optimize(request: OptimizationRequest): Promise<string | I2VOptimizationResult> {
  // Detect i2v mode
  if (request.startImage) {
    return this.optimizeI2V(request);
  }
  
  // ... existing t2v logic
}

// Add i2v method
private async optimizeI2V(request: OptimizationRequest): Promise<I2VOptimizationResult> {
  if (!this.imageObservation) {
    throw new Error('Image observation service not configured');
  }

  // Get image observation
  const observationResult = await this.imageObservation.observe({
    image: request.startImage!,
    sourcePrompt: request.sourcePrompt,
  });

  if (!observationResult.success || !observationResult.observation) {
    throw new Error(`Image analysis failed: ${observationResult.error}`);
  }

  // Run motion-focused optimization
  return this.i2vStrategy.optimize({
    prompt: request.prompt,
    observation: observationResult.observation,
    mode: request.constraintMode,
  });
}
```

---

## Phase 3: Constrained Suggestions + UI

### 3.1 I2V Constrained Suggestions

**File:** `server/src/services/enhancement/services/I2VConstrainedSuggestions.ts`

```typescript
/**
 * I2VConstrainedSuggestions
 * 
 * Filters enhancement suggestions based on image observation.
 * 
 * PATTERN: Strategy
 * MAX LINES: 200
 */

import type { ImageObservation } from '@services/image-observation/types';
import type { LockMap, LockableCategory } from '@services/prompt-optimization/types/i2v';

interface Suggestion {
  text: string;
  category: string;
  confidence: number;
}

interface FilteredSuggestionResult {
  suggestions: Suggestion[];
  blockedReason?: string;
  motionAlternatives?: Suggestion[];
}

/**
 * Map taxonomy categories to lockable categories
 */
const CATEGORY_MAPPING: Record<string, LockableCategory | null> = {
  'subject.identity': 'subject.identity',
  'subject.age': 'subject.identity',
  'subject.gender': 'subject.identity',
  'subject.appearance': 'subject.appearance',
  'subject.clothing': 'subject.appearance',
  'shot.type': 'shot.type',
  'shot.framing': 'shot.type',
  'shot.angle': 'shot.angle',
  'lighting.type': 'lighting',
  'lighting.quality': 'lighting',
  'lighting.direction': 'lighting',
  'environment.setting': 'environment',
  'environment.location': 'environment',
  'color.palette': 'color',
  'style.visual': 'color',
  // Motion categories - not locked
  'action.movement': null,
  'action.gesture': null,
  'camera.movement': null,
  'camera.speed': null,
  'timing.pacing': null,
  'subject.expression': null,
  'subject.emotion': null,
};

export class I2VConstrainedSuggestions {
  /**
   * Filter suggestions based on lock map
   */
  filterSuggestions(
    suggestions: Suggestion[],
    category: string,
    lockMap: LockMap,
    observation: ImageObservation
  ): FilteredSuggestionResult {
    const lockableCategory = CATEGORY_MAPPING[category];
    
    // Motion categories - not locked, return all
    if (lockableCategory === null) {
      return { suggestions };
    }

    const lockStatus = lockMap[lockableCategory];

    // Hard locked - no suggestions
    if (lockStatus === 'hard') {
      return {
        suggestions: [],
        blockedReason: this.getBlockedReason(lockableCategory, observation),
        motionAlternatives: this.getMotionAlternatives(observation),
      };
    }

    // Soft locked - return suggestions with warning
    if (lockStatus === 'soft') {
      return {
        suggestions: suggestions.map(s => ({
          ...s,
          confidence: s.confidence * 0.5, // Reduce confidence
        })),
      };
    }

    // Unlocked - return all
    return { suggestions };
  }

  /**
   * Get explanation for why category is blocked
   */
  private getBlockedReason(category: LockableCategory, observation: ImageObservation): string {
    const reasons: Record<LockableCategory, string> = {
      'subject.identity': `Subject is fixed: ${observation.subject.description}`,
      'subject.appearance': `Subject appearance is defined by the image`,
      'shot.type': `Shot type is ${observation.framing.shotType} (fixed by image)`,
      'shot.angle': `Camera angle is ${observation.framing.angle} (fixed by image)`,
      'lighting': `Lighting is ${observation.lighting.quality} ${observation.lighting.timeOfDay} (fixed by image)`,
      'environment': `Environment is defined by the image`,
      'color': `Color palette is defined by the image`,
    };
    return reasons[category];
  }

  /**
   * Get motion-related suggestions as alternatives
   */
  private getMotionAlternatives(observation: ImageObservation): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Recommend compatible camera movements
    for (const movement of observation.motion.recommended.slice(0, 3)) {
      suggestions.push({
        text: `camera ${movement.replace('-', ' ')}`,
        category: 'camera.movement',
        confidence: 0.9,
      });
    }

    // Generic motion suggestions
    suggestions.push(
      { text: 'subtle natural movement', category: 'action.movement', confidence: 0.85 },
      { text: 'gentle motion', category: 'action.movement', confidence: 0.8 },
    );

    return suggestions;
  }

  /**
   * Check if a category is motion-related (never locked)
   */
  isMotionCategory(category: string): boolean {
    return CATEGORY_MAPPING[category] === null;
  }
}
```

### 3.2 Frontend Types

**File:** `client/src/features/prompt-optimizer/types/i2v.ts`

```typescript
/**
 * I2V Types for Frontend
 */

export type I2VConstraintMode = 'strict' | 'flexible' | 'transform';

export type LockStatus = 'hard' | 'soft' | 'unlocked';

export interface LockMap {
  'subject.identity': LockStatus;
  'subject.appearance': LockStatus;
  'shot.type': LockStatus;
  'shot.angle': LockStatus;
  'lighting': LockStatus;
  'environment': LockStatus;
  'color': LockStatus;
}

export interface ConflictWarning {
  category: string;
  userSaid: string;
  imageShows: string;
  severity: 'info' | 'warning' | 'blocked';
}

export interface ImageObservation {
  subject: {
    type: string;
    description: string;
    position: string;
  };
  framing: {
    shotType: string;
    angle: string;
  };
  lighting: {
    quality: string;
    timeOfDay: string;
  };
  motion: {
    recommended: string[];
    risky: string[];
  };
}

export interface I2VOptimizationResult {
  prompt: string;
  conflicts: ConflictWarning[];
  appliedMode: I2VConstraintMode;
  lockMap: LockMap;
  extractedMotion: {
    subjectAction: string | null;
    cameraMovement: string | null;
    pacing: string | null;
  };
}

export interface I2VContext {
  isI2VMode: boolean;
  observation: ImageObservation | null;
  lockMap: LockMap | null;
  constraintMode: I2VConstraintMode;
  isAnalyzing: boolean;
  error: string | null;
}
```

### 3.3 useI2VContext Hook

**File:** `client/src/features/prompt-optimizer/hooks/useI2VContext.ts`

```typescript
/**
 * useI2VContext - Manages i2v state
 * 
 * PATTERN: Custom hook
 * MAX LINES: 120
 */

import { useState, useCallback, useEffect } from 'react';
import { observeImage } from '../api/i2vApi';
import type { I2VContext, I2VConstraintMode, ImageObservation, LockMap } from '../types/i2v';

const DEFAULT_LOCK_MAP: LockMap = {
  'subject.identity': 'hard',
  'subject.appearance': 'hard',
  'shot.type': 'hard',
  'shot.angle': 'hard',
  'lighting': 'hard',
  'environment': 'hard',
  'color': 'hard',
};

export function useI2VContext(startImageUrl: string | null, sourcePrompt?: string) {
  const [observation, setObservation] = useState<ImageObservation | null>(null);
  const [constraintMode, setConstraintMode] = useState<I2VConstraintMode>('strict');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isI2VMode = Boolean(startImageUrl);

  // Derive lock map from mode
  const lockMap: LockMap | null = isI2VMode ? deriveLockMap(constraintMode) : null;

  // Analyze image when URL changes
  useEffect(() => {
    if (!startImageUrl) {
      setObservation(null);
      setError(null);
      return;
    }

    let cancelled = false;

    async function analyze() {
      setIsAnalyzing(true);
      setError(null);

      try {
        const result = await observeImage(startImageUrl, sourcePrompt);
        if (!cancelled) {
          if (result.success && result.observation) {
            setObservation(result.observation);
          } else {
            setError(result.error || 'Analysis failed');
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) {
          setIsAnalyzing(false);
        }
      }
    }

    analyze();
    return () => { cancelled = true; };
  }, [startImageUrl, sourcePrompt]);

  const changeMode = useCallback((mode: I2VConstraintMode) => {
    setConstraintMode(mode);
  }, []);

  return {
    isI2VMode,
    observation,
    lockMap,
    constraintMode,
    isAnalyzing,
    error,
    changeMode,
  };
}

function deriveLockMap(mode: I2VConstraintMode): LockMap {
  switch (mode) {
    case 'strict':
      return DEFAULT_LOCK_MAP;
    case 'flexible':
      return {
        'subject.identity': 'hard',
        'subject.appearance': 'soft',
        'shot.type': 'hard',
        'shot.angle': 'soft',
        'lighting': 'soft',
        'environment': 'soft',
        'color': 'soft',
      };
    case 'transform':
      return {
        'subject.identity': 'soft',
        'subject.appearance': 'unlocked',
        'shot.type': 'soft',
        'shot.angle': 'unlocked',
        'lighting': 'unlocked',
        'environment': 'unlocked',
        'color': 'unlocked',
      };
  }
}
```

### 3.4 Locked Span Indicator

**File:** `client/src/features/prompt-optimizer/components/LockedSpanIndicator.tsx`

```typescript
/**
 * LockedSpanIndicator - Shows lock status on spans
 * 
 * PATTERN: UI Component
 * MAX LINES: 80
 */

import React from 'react';
import { Lock, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@components/ui/tooltip';
import type { LockStatus } from '../types/i2v';

interface Props {
  status: LockStatus;
  reason: string;
  children: React.ReactNode;
}

export function LockedSpanIndicator({ status, reason, children }: Props) {
  if (status === 'unlocked') {
    return <>{children}</>;
  }

  const isHard = status === 'hard';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`
            inline-flex items-center gap-1 px-1 rounded
            ${isHard 
              ? 'bg-zinc-700/50 text-zinc-400 cursor-not-allowed' 
              : 'bg-amber-500/10 text-amber-400 cursor-help'
            }
          `}
        >
          {isHard ? (
            <Lock className="w-3 h-3" />
          ) : (
            <AlertTriangle className="w-3 h-3" />
          )}
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="text-xs">
          <div className="font-medium mb-1">
            {isHard ? 'Fixed by image' : 'May not work as expected'}
          </div>
          <div className="text-muted">{reason}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
```

### 3.5 Constraint Mode Selector

**File:** `client/src/features/prompt-optimizer/components/ConstraintModeSelector.tsx`

```typescript
/**
 * ConstraintModeSelector - Toggle between i2v constraint modes
 * 
 * PATTERN: UI Component
 * MAX LINES: 100
 */

import React from 'react';
import { Lock, AlertTriangle, Sparkles } from 'lucide-react';
import type { I2VConstraintMode } from '../types/i2v';

interface Props {
  mode: I2VConstraintMode;
  onChange: (mode: I2VConstraintMode) => void;
}

const MODES: Array<{
  value: I2VConstraintMode;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'strict',
    label: 'Strict',
    description: 'Motion only. Visual descriptions ignored.',
    icon: <Lock className="w-4 h-4" />,
  },
  {
    value: 'flexible',
    label: 'Flexible',
    description: 'Warnings for conflicts. Your input preserved.',
    icon: <AlertTriangle className="w-4 h-4" />,
  },
  {
    value: 'transform',
    label: 'Transform',
    description: 'Minimal constraints. For style transfer.',
    icon: <Sparkles className="w-4 h-4" />,
  },
];

export function ConstraintModeSelector({ mode, onChange }: Props) {
  return (
    <div className="flex gap-1 p-1 bg-zinc-800 rounded-lg">
      {MODES.map((m) => (
        <button
          key={m.value}
          onClick={() => onChange(m.value)}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded text-sm transition
            ${mode === m.value 
              ? 'bg-violet-600 text-white' 
              : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
            }
          `}
          title={m.description}
        >
          {m.icon}
          {m.label}
        </button>
      ))}
    </div>
  );
}
```

---

## Phase 4: Span Labeling for I2V

### 4.1 I2V Span Labeling Prompt

**File:** `server/src/llm/span-labeling/templates/i2v-span-labeling-prompt.md`

```markdown
# I2V Span Labeling

Label spans in a prompt that will be used with an existing image.

**Only label motion/action elements. Skip visual descriptions.**

## Valid Categories (Label These)

- `action.movement` - Physical motion (walking, turning)
- `action.gesture` - Hand/body gestures
- `camera.movement` - Pan, dolly, zoom, crane
- `camera.speed` - Slow, fast
- `timing.pacing` - Rhythm, duration
- `subject.expression` - Facial expressions
- `subject.emotion` - Emotional changes

## Skip These (Fixed by Image)

- Subject descriptions
- Lighting descriptions
- Environment descriptions
- Shot type/framing
- Color/style descriptions

## Output

```json
{
  "spans": [
    {"text": "slowly turns", "role": "action.movement", "confidence": 0.9}
  ],
  "skipped": ["golden hour lighting", "young woman"],
  "i2vMode": true
}
```

Be conservative. Only label clear motion elements.
```

### 4.2 Modify SpanLabelingService

Add i2v mode detection that uses the simplified template and focuses on motion categories.

---

## API Reference

### New Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/image/observe` | Analyze image for i2v constraints |

### Modified Endpoints

| Method | Path | Changes |
|--------|------|---------|
| POST | `/api/optimize` | Add `startImage`, `sourcePrompt`, `constraintMode` |
| POST | `/api/enhance` | Add `lockMap` for filtering |
| POST | `/api/span-label` | Add `isI2VMode` for motion-focused labeling |

### Request Examples

**Observe Image:**
```json
POST /api/image/observe
{
  "image": "https://...",
  "sourcePrompt": "optional - skip vision if provided"
}
```

**I2V Optimize:**
```json
POST /api/optimize
{
  "prompt": "she reaches for her coffee, warm morning light",
  "startImage": "https://...",
  "constraintMode": "strict"
}

Response:
{
  "prompt": "She slowly reaches for the coffee cup, smooth natural movement",
  "conflicts": [
    {
      "category": "lighting",
      "userSaid": "warm morning light",
      "imageShows": "indoor",
      "severity": "blocked"
    }
  ],
  "appliedMode": "strict",
  "lockMap": { ... },
  "extractedMotion": {
    "subjectAction": "reaches for her coffee",
    "cameraMovement": null,
    "pacing": null
  }
}
```

---

## Implementation Checklist

### Phase 0: Foundation (Week 1)
- [ ] Create `server/src/shared/cinematography.ts`
- [ ] Create `server/src/services/prompt-optimization/types/i2v.ts`
- [ ] Add shared vocabulary constants
- [ ] Add constraint mode types and deriveLockMap function

### Phase 1: Image Observation (Week 1)
- [ ] Create `server/src/services/image-observation/` directory
- [ ] Implement `types.ts`
- [ ] Implement `ObservationCache.ts`
- [ ] Implement `ImageObservationService.ts`
- [ ] Add vision analysis prompt
- [ ] Add fast-path for sourcePrompt
- [ ] Add route `/api/image/observe`
- [ ] Write tests

### Phase 2: Motion Strategy (Week 2)
- [ ] Implement `I2VMotionStrategy.ts`
- [ ] Add prompt parsing (motion vs visual separation)
- [ ] Add conflict detection
- [ ] Add motion-focused prompt building
- [ ] Integrate with `PromptOptimizationService`
- [ ] Write tests

### Phase 3: Suggestions + UI (Week 2-3)
- [ ] Implement `I2VConstrainedSuggestions.ts`
- [ ] Create frontend types
- [ ] Implement `useI2VContext` hook
- [ ] Implement `LockedSpanIndicator` component
- [ ] Implement `ConstraintModeSelector` component
- [ ] Integrate with PromptCanvas
- [ ] Write tests

### Phase 4: Span Labeling (Week 3)
- [ ] Create i2v span labeling prompt
- [ ] Add i2v mode to SpanLabelingService
- [ ] Filter to motion categories
- [ ] Test labeling accuracy

### Polish (Week 4)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Error handling
- [ ] Documentation
- [ ] Beta testing

---

## File Summary

### New Files

```
server/src/
├── shared/
│   └── cinematography.ts
│
├── services/
│   ├── image-observation/
│   │   ├── ImageObservationService.ts
│   │   ├── types.ts
│   │   ├── index.ts
│   │   └── cache/
│   │       └── ObservationCache.ts
│   │
│   ├── prompt-optimization/
│   │   ├── types/
│   │   │   └── i2v.ts
│   │   └── strategies/
│   │       └── I2VMotionStrategy.ts
│   │
│   └── enhancement/
│       └── services/
│           └── I2VConstrainedSuggestions.ts
│
└── llm/
    └── span-labeling/
        └── templates/
            └── i2v-span-labeling-prompt.md

client/src/features/prompt-optimizer/
├── types/
│   └── i2v.ts
├── api/
│   └── i2vApi.ts
├── hooks/
│   └── useI2VContext.ts
└── components/
    ├── LockedSpanIndicator.tsx
    └── ConstraintModeSelector.tsx
```

### Modified Files

```
server/src/services/prompt-optimization/PromptOptimizationService.ts
server/src/services/enhancement/EnhancementService.ts
server/src/llm/span-labeling/SpanLabelingService.ts
client/src/features/prompt-optimizer/PromptCanvas.tsx
```

---

## Key Differences from Original Plan

| Original | Revised |
|----------|---------|
| Full VisualGroundTruth with 6+ analysis types | Lightweight ImageObservation with 3 core types |
| Scene description in output prompt | Motion-only output prompt |
| Complex ground truth → IR conversion | Simple observation for filtering/warnings |
| ~2000 line ImageAnalysisService | ~300 line ImageObservationService |
| Heavy per-field lock configuration | Three constraint modes with derived lock map |
| Always run vision analysis | Fast-path with sourcePrompt |

**Result:** Simpler architecture, clearer purpose, lower cost, faster implementation.
