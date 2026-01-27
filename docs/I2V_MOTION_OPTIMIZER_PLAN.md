# I2V Motion Optimizer Implementation Plan

> **Core insight:** In image-to-video, the image IS the scene description. The prompt should only describe motion.

---

## Table of Contents

1. [Problem Reframe](#problem-reframe)
2. [Design Principles](#design-principles)
3. [Architecture Overview](#architecture-overview)
4. [Phase 0: Shared Vocabulary](#phase-0-shared-vocabulary)
5. [Phase 1: Image Analysis Service](#phase-1-image-analysis-service)
6. [Phase 2: Motion Extraction](#phase-2-motion-extraction)
7. [Phase 3: Constraint Modes & Lock Maps](#phase-3-constraint-modes--lock-maps)
8. [Phase 4: UI Integration](#phase-4-ui-integration)
9. [Phase 5: Suggestion Filtering](#phase-5-suggestion-filtering)
10. [API Reference](#api-reference)
11. [Implementation Checklist](#implementation-checklist)

---

## Problem Reframe

### What We Originally Thought

> "We need to analyze the image, build a VisualGroundTruth, and construct an optimized prompt that describes the scene plus motion."

### What's Actually True

The image already conditions the model. Describing visible elements is:
- **Redundant** - the model sees grandma, why say "elderly woman"?
- **Risky** - if description doesn't match perfectly, model gets confused
- **Wasteful** - burns tokens on information already encoded in pixels

### The Real Job

| Image Analysis Purpose | Needed? |
|------------------------|---------|
| Building scene descriptions into prompt | ❌ No |
| Filtering UI suggestions to motion-only | ✅ Yes |
| Filtering camera moves to compatible ones | ✅ Yes |
| Warning users about conflicts | ✅ Yes |
| Skipping vision calls for known images | ✅ Yes |

**The prompt optimizer for i2v should output motion, not description.**

---

## Design Principles

### 1. Motion-Only Output

```
❌ "An elderly woman in a kitchen slowly reaches for her coffee cup, 
    warm indoor lighting, close-up shot, shallow depth of field"

✅ "She slowly reaches for the coffee cup, smooth natural movement"
```

### 2. Image Analysis for Filtering, Not Prompting

We analyze the image to know what suggestions to hide, not what text to generate.

### 3. User Prompt Pass-Through

Users write whatever they want. We:
- Extract motion intent
- Warn about conflicts (don't block)
- Expand motion with pacing hints
- Discard visual descriptions from optimizer output

### 4. Constraint Modes

| Mode | Behavior |
|------|----------|
| `strict` | Motion only. Visual descriptions silently dropped. |
| `flexible` | Motion primary. Visual conflicts shown as warnings. |
| `transform` | User wants style transfer. Minimal constraints. |

### 5. Lock Map for UI

The UI needs to know which categories are locked (for graying out, tooltips, suggestion filtering). This is derived from the constraint mode, not stored per-field.

---

## Architecture Overview

### What's New

```
server/src/services/
├── image-observation/                 # NEW: Image analysis
│   ├── ImageObservationService.ts     # Orchestrator (max 300 lines)
│   ├── types.ts                       # ImageObservation type
│   ├── ObservationCache.ts            # Cache by image hash
│   └── templates/
│       └── image-observation.md       # Vision prompt
│
├── i2v-optimization/                  # NEW: I2V-specific optimization
│   ├── I2VMotionOptimizer.ts          # Main service (max 250 lines)
│   ├── MotionExtractor.ts             # Extract motion from text (max 150 lines)
│   ├── ConflictDetector.ts            # Find text vs image conflicts (max 150 lines)
│   ├── CameraMoveFilter.ts            # Filter compatible moves (max 100 lines)
│   └── types.ts
│
└── shared/
    └── cinematography.ts              # NEW: Shared vocabulary constants
```

### What's Modified

```
server/src/services/
├── prompt-optimization/
│   └── PromptOptimizationService.ts   # Route to I2V optimizer when image present
│
├── enhancement/
│   └── EnhancementService.ts          # Use lock map to filter suggestions
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         I2V OPTIMIZATION FLOW                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────┐     ┌─────────────────────┐                               │
│  │  Image  │────▶│ ImageObservation    │──┐                            │
│  └─────────┘     │ Service             │  │                            │
│                  │ • Vision LLM        │  │  ImageObservation          │
│                  │ • Cache by hash     │  │  (for filtering only)      │
│                  │ • Metadata shortcut │  │                            │
│                  └─────────────────────┘  │                            │
│                                           ▼                            │
│  ┌─────────┐     ┌─────────────────────────────────────┐              │
│  │  User   │────▶│ I2VMotionOptimizer                  │              │
│  │  Prompt │     │                                     │              │
│  └─────────┘     │  1. Extract motion intent           │              │
│                  │  2. Detect conflicts (warn)         │              │
│                  │  3. Expand motion + pacing          │              │
│                  │  4. Return motion-only prompt       │              │
│                  │                                     │              │
│                  └──────────────┬──────────────────────┘              │
│                                 │                                      │
│                                 ▼                                      │
│                  ┌─────────────────────────────────────┐              │
│                  │ Output                              │              │
│                  │                                     │              │
│                  │ prompt: "She slowly reaches for     │              │
│                  │          the coffee cup, smooth     │              │
│                  │          natural movement"          │              │
│                  │                                     │              │
│                  │ conflicts: [                        │              │
│                  │   { field: 'lighting',              │              │
│                  │     userSaid: 'golden hour',        │              │
│                  │     imageSays: 'indoor fluorescent' │              │
│                  │   }                                 │              │
│                  │ ]                                   │              │
│                  │                                     │              │
│                  │ lockMap: { subject: 'hard',         │              │
│                  │           lighting: 'hard', ... }   │              │
│                  └─────────────────────────────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Shared Vocabulary

Create constants used by both `VideoPromptIR` and `ImageObservation` without coupling the types.

**File:** `server/src/services/shared/cinematography.ts`

```typescript
/**
 * Shared Cinematography Vocabulary
 * 
 * Constants used across video prompt analysis and image observation.
 * Keeps terminology consistent without forcing type unification.
 */

// Shot types (wide to tight)
export const SHOT_TYPES = [
  'extreme-wide',
  'wide', 
  'medium-wide',
  'medium',
  'medium-close-up',
  'close-up',
  'extreme-close-up',
] as const;
export type ShotType = typeof SHOT_TYPES[number];

// Camera angles
export const CAMERA_ANGLES = [
  'eye-level',
  'low-angle',
  'high-angle',
  'birds-eye',
  'worms-eye',
  'dutch',
  'over-shoulder',
] as const;
export type CameraAngle = typeof CAMERA_ANGLES[number];

// Camera movements
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
  'zoom-in',
  'zoom-out',
  'arc-left',
  'arc-right',
  'push-in',
  'pull-back',
] as const;
export type CameraMovement = typeof CAMERA_MOVEMENTS[number];

// Lighting qualities
export const LIGHTING_QUALITIES = [
  'natural',
  'artificial', 
  'mixed',
  'dramatic',
  'flat',
] as const;
export type LightingQuality = typeof LIGHTING_QUALITIES[number];

// Lighting directions
export const LIGHTING_DIRECTIONS = [
  'front',
  'side',
  'back',
  'top',
  'bottom',
  'ambient',
] as const;
export type LightingDirection = typeof LIGHTING_DIRECTIONS[number];

// Time of day
export const TIMES_OF_DAY = [
  'golden-hour',
  'blue-hour',
  'midday',
  'night',
  'overcast',
  'indoor',
] as const;
export type TimeOfDay = typeof TIMES_OF_DAY[number];

// Subject positions in frame
export const SUBJECT_POSITIONS = [
  'center',
  'left',
  'right',
  'top',
  'bottom',
  'left-third',
  'right-third',
] as const;
export type SubjectPosition = typeof SUBJECT_POSITIONS[number];

/**
 * Categories that can be "locked" by an image
 */
export const LOCKABLE_CATEGORIES = [
  'subject.identity',
  'subject.appearance', 
  'subject.position',
  'shot.type',
  'shot.angle',
  'lighting.quality',
  'lighting.direction',
  'lighting.time',
  'environment.setting',
  'environment.location',
  'color.palette',
  'style.visual',
] as const;
export type LockableCategory = typeof LOCKABLE_CATEGORIES[number];

/**
 * Categories that remain "free" (motion-related)
 */
export const FREE_CATEGORIES = [
  'action.movement',
  'action.gesture',
  'action.interaction',
  'camera.movement',
  'camera.speed',
  'subject.expression',
  'subject.emotion',
  'timing.pacing',
  'timing.duration',
] as const;
export type FreeCategory = typeof FREE_CATEGORIES[number];
```

---

## Phase 1: Image Analysis Service

Analyzes the image to extract observable properties. Used for filtering and warnings, NOT for prompt building.

### Types

**File:** `server/src/services/image-observation/types.ts`

```typescript
/**
 * Image Observation Types
 * 
 * These describe what we SEE in an image.
 * They're used for filtering and warnings, not prompt construction.
 */

import type {
  ShotType,
  CameraAngle,
  LightingQuality,
  LightingDirection,
  TimeOfDay,
  SubjectPosition,
  CameraMovement,
  LockableCategory,
} from '../shared/cinematography';

/**
 * What we observe in the image
 */
export interface ImageObservation {
  /** Hash for caching */
  imageHash: string;
  
  /** When analyzed */
  analyzedAt: Date;
  
  /** Subject info */
  subject: {
    description: string;       // "elderly woman with gray hair"
    type: 'person' | 'animal' | 'object' | 'scene' | 'abstract';
    position: SubjectPosition;
  };
  
  /** Framing info */
  framing: {
    shotType: ShotType;
    angle: CameraAngle;
  };
  
  /** Lighting info */
  lighting: {
    quality: LightingQuality;
    direction: LightingDirection;
    timeOfDay: TimeOfDay;
  };
  
  /** Environment */
  environment: {
    setting: 'interior' | 'exterior' | 'studio' | 'abstract';
    description: string;       // "residential kitchen"
  };
  
  /** Motion compatibility (derived) */
  compatibleCameraMoves: CameraMovement[];
  incompatibleCameraMoves: CameraMovement[];
  
  /** Analysis confidence */
  confidence: number;          // 0-1
}

/**
 * Request to analyze an image
 */
export interface ImageObservationRequest {
  /** Image URL or base64 */
  image: string;
  
  /** Skip vision call if we already have the source prompt */
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
  cached: boolean;
  fromSourcePrompt: boolean;
  durationMs: number;
}

/**
 * Lock status for a category
 */
export type LockStatus = 'hard' | 'soft' | 'unlocked';

/**
 * Map of category → lock status (derived from constraint mode)
 */
export type LockMap = Record<LockableCategory, LockStatus>;
```

### Service Implementation

**File:** `server/src/services/image-observation/ImageObservationService.ts`

```typescript
/**
 * ImageObservationService
 * 
 * Extracts observable properties from images for filtering and warnings.
 * Does NOT build prompts - just tells us what's in the image.
 * 
 * PATTERN: Single-purpose service
 * MAX LINES: 300
 */

import { logger } from '@infrastructure/Logger';
import { hashImageUrl, hashBase64Image } from '@utils/hash';
import { ObservationCache } from './ObservationCache';
import { deriveCompatibleCameraMoves } from './cameraMoveCompatibility';
import type {
  ImageObservation,
  ImageObservationRequest,
  ImageObservationResult,
} from './types';

interface VisionAIService {
  analyzeImage(params: {
    systemPrompt: string;
    imageUrl?: string;
    imageBase64?: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ text: string }>;
}

export class ImageObservationService {
  private readonly ai: VisionAIService;
  private readonly cache: ObservationCache;
  private readonly log = logger.child({ service: 'ImageObservationService' });

  constructor(aiService: VisionAIService, cacheTtlSeconds = 86400) {
    this.ai = aiService;
    this.cache = new ObservationCache(cacheTtlSeconds);
  }

  /**
   * Analyze an image and return observations
   */
  async analyze(request: ImageObservationRequest): Promise<ImageObservationResult> {
    const startTime = performance.now();
    
    const imageHash = request.image.startsWith('data:')
      ? hashBase64Image(request.image)
      : hashImageUrl(request.image);

    // Fast path: source prompt provided
    if (request.sourcePrompt) {
      this.log.debug('Using source prompt fast path', { imageHash });
      const observation = this.parseSourcePrompt(request.sourcePrompt, imageHash);
      return {
        success: true,
        observation,
        cached: false,
        fromSourcePrompt: true,
        durationMs: Math.round(performance.now() - startTime),
      };
    }

    // Check cache
    if (!request.skipCache) {
      const cached = await this.cache.get(imageHash);
      if (cached) {
        return {
          success: true,
          observation: cached,
          cached: true,
          fromSourcePrompt: false,
          durationMs: Math.round(performance.now() - startTime),
        };
      }
    }

    // Vision analysis
    try {
      const observation = await this.analyzeWithVision(request.image, imageHash);
      await this.cache.set(imageHash, observation);
      
      return {
        success: true,
        observation,
        cached: false,
        fromSourcePrompt: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    } catch (error) {
      this.log.error('Vision analysis failed', error as Error, { imageHash });
      return {
        success: false,
        error: (error as Error).message,
        cached: false,
        fromSourcePrompt: false,
        durationMs: Math.round(performance.now() - startTime),
      };
    }
  }

  /**
   * Parse source prompt into observation (fast path)
   */
  private parseSourcePrompt(prompt: string, imageHash: string): ImageObservation {
    // Simple heuristic extraction from known prompt
    // This is a best-effort parse - confidence will be lower
    const promptLower = prompt.toLowerCase();
    
    return {
      imageHash,
      analyzedAt: new Date(),
      subject: {
        description: this.extractSubjectFromPrompt(prompt),
        type: this.guessSubjectType(promptLower),
        position: 'center', // Default assumption
      },
      framing: {
        shotType: this.extractShotType(promptLower),
        angle: this.extractAngle(promptLower),
      },
      lighting: {
        quality: this.extractLightingQuality(promptLower),
        direction: 'front',
        timeOfDay: this.extractTimeOfDay(promptLower),
      },
      environment: {
        setting: promptLower.includes('indoor') || promptLower.includes('interior') 
          ? 'interior' : 'exterior',
        description: this.extractEnvironment(prompt),
      },
      compatibleCameraMoves: deriveCompatibleCameraMoves('medium', 'center'),
      incompatibleCameraMoves: [],
      confidence: 0.6, // Lower confidence for text-derived
    };
  }

  /**
   * Analyze image with vision LLM
   */
  private async analyzeWithVision(
    image: string, 
    imageHash: string
  ): Promise<ImageObservation> {
    const systemPrompt = this.getVisionPrompt();
    
    const isBase64 = image.startsWith('data:');
    const response = await this.ai.analyzeImage({
      systemPrompt,
      ...(isBase64 ? { imageBase64: image } : { imageUrl: image }),
      maxTokens: 1000,
      temperature: 0.1,
    });

    const parsed = this.parseVisionResponse(response.text);
    
    return {
      imageHash,
      analyzedAt: new Date(),
      ...parsed,
      compatibleCameraMoves: deriveCompatibleCameraMoves(
        parsed.framing.shotType,
        parsed.subject.position
      ),
      incompatibleCameraMoves: this.getIncompatibleMoves(
        parsed.framing.shotType,
        parsed.subject.position
      ),
      confidence: 0.85,
    };
  }

  private getVisionPrompt(): string {
    return `Analyze this image for video generation constraints.

Return ONLY valid JSON:
{
  "subject": {
    "description": "brief subject description",
    "type": "person|animal|object|scene|abstract",
    "position": "center|left|right|left-third|right-third"
  },
  "framing": {
    "shotType": "extreme-wide|wide|medium-wide|medium|medium-close-up|close-up|extreme-close-up",
    "angle": "eye-level|low-angle|high-angle|birds-eye|worms-eye|dutch|over-shoulder"
  },
  "lighting": {
    "quality": "natural|artificial|mixed|dramatic|flat",
    "direction": "front|side|back|top|ambient",
    "timeOfDay": "golden-hour|blue-hour|midday|night|overcast|indoor"
  },
  "environment": {
    "setting": "interior|exterior|studio|abstract",
    "description": "brief environment description"
  }
}

Be factual. Only describe what's visible.`;
  }

  private parseVisionResponse(text: string): Omit<ImageObservation, 'imageHash' | 'analyzedAt' | 'compatibleCameraMoves' | 'incompatibleCameraMoves' | 'confidence'> {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);
    
    // Validate and provide defaults
    return {
      subject: {
        description: parsed.subject?.description || 'subject',
        type: parsed.subject?.type || 'object',
        position: parsed.subject?.position || 'center',
      },
      framing: {
        shotType: parsed.framing?.shotType || 'medium',
        angle: parsed.framing?.angle || 'eye-level',
      },
      lighting: {
        quality: parsed.lighting?.quality || 'natural',
        direction: parsed.lighting?.direction || 'front',
        timeOfDay: parsed.lighting?.timeOfDay || 'midday',
      },
      environment: {
        setting: parsed.environment?.setting || 'exterior',
        description: parsed.environment?.description || 'scene',
      },
    };
  }

  // Helper extraction methods for source prompt parsing
  private extractSubjectFromPrompt(prompt: string): string {
    // Take first clause before any comma or action word
    const match = prompt.match(/^([^,]+)/);
    return match?.[1]?.trim() || 'subject';
  }

  private guessSubjectType(prompt: string): ImageObservation['subject']['type'] {
    if (/\b(man|woman|person|people|child|girl|boy)\b/.test(prompt)) return 'person';
    if (/\b(dog|cat|bird|animal)\b/.test(prompt)) return 'animal';
    if (/\b(landscape|scene|view|mountain|ocean)\b/.test(prompt)) return 'scene';
    return 'object';
  }

  private extractShotType(prompt: string): ImageObservation['framing']['shotType'] {
    if (/extreme close[- ]?up|ecu\b/.test(prompt)) return 'extreme-close-up';
    if (/close[- ]?up|cu\b/.test(prompt)) return 'close-up';
    if (/medium close/.test(prompt)) return 'medium-close-up';
    if (/medium wide/.test(prompt)) return 'medium-wide';
    if (/wide shot|wide angle|establishing/.test(prompt)) return 'wide';
    if (/extreme wide/.test(prompt)) return 'extreme-wide';
    return 'medium';
  }

  private extractAngle(prompt: string): ImageObservation['framing']['angle'] {
    if (/low angle/.test(prompt)) return 'low-angle';
    if (/high angle/.test(prompt)) return 'high-angle';
    if (/bird'?s[- ]eye/.test(prompt)) return 'birds-eye';
    if (/worm'?s[- ]eye/.test(prompt)) return 'worms-eye';
    if (/dutch|tilted/.test(prompt)) return 'dutch';
    return 'eye-level';
  }

  private extractLightingQuality(prompt: string): ImageObservation['lighting']['quality'] {
    if (/dramatic|chiaroscuro|noir/.test(prompt)) return 'dramatic';
    if (/flat|soft|diffuse/.test(prompt)) return 'flat';
    if (/artificial|neon|fluorescent/.test(prompt)) return 'artificial';
    return 'natural';
  }

  private extractTimeOfDay(prompt: string): ImageObservation['lighting']['timeOfDay'] {
    if (/golden hour|sunset|sunrise/.test(prompt)) return 'golden-hour';
    if (/blue hour|dusk|dawn/.test(prompt)) return 'blue-hour';
    if (/night|dark|moonlight/.test(prompt)) return 'night';
    if (/overcast|cloudy/.test(prompt)) return 'overcast';
    if (/indoor|interior/.test(prompt)) return 'indoor';
    return 'midday';
  }

  private extractEnvironment(prompt: string): string {
    // Simple: take location-like words
    const match = prompt.match(/(?:in|at|on)\s+(?:a\s+)?([^,]+)/i);
    return match?.[1]?.trim() || 'scene';
  }

  private getIncompatibleMoves(
    shotType: ImageObservation['framing']['shotType'],
    position: ImageObservation['subject']['position']
  ): ImageObservation['incompatibleCameraMoves'] {
    const incompatible: ImageObservation['incompatibleCameraMoves'] = [];
    
    // Close-ups: can't do big lateral moves
    if (shotType === 'close-up' || shotType === 'extreme-close-up') {
      incompatible.push('pan-left', 'pan-right', 'truck-left', 'truck-right', 'crane-up', 'crane-down');
    }
    
    // Subject off-center: risky to move toward the edge they're on
    if (position === 'left' || position === 'left-third') {
      incompatible.push('truck-left', 'pan-right');
    }
    if (position === 'right' || position === 'right-third') {
      incompatible.push('truck-right', 'pan-left');
    }
    
    return incompatible;
  }
}
```

### Camera Move Compatibility

**File:** `server/src/services/image-observation/cameraMoveCompatibility.ts`

```typescript
/**
 * Derive compatible camera movements from framing analysis
 */

import type { CameraMovement, ShotType, SubjectPosition } from '../shared/cinematography';

export function deriveCompatibleCameraMoves(
  shotType: ShotType,
  subjectPosition: SubjectPosition
): CameraMovement[] {
  const compatible: CameraMovement[] = ['static'];
  
  // Wide shots: most moves work
  if (shotType === 'wide' || shotType === 'extreme-wide' || shotType === 'medium-wide') {
    compatible.push(
      'pan-left', 'pan-right', 
      'tilt-up', 'tilt-down',
      'dolly-in', 'dolly-out',
      'crane-up', 'crane-down',
      'push-in', 'pull-back'
    );
  }
  
  // Medium shots: dolly and subtle pan work
  if (shotType === 'medium' || shotType === 'medium-close-up') {
    compatible.push('dolly-in', 'dolly-out', 'push-in', 'pull-back');
    
    // Subtle lateral if centered
    if (subjectPosition === 'center') {
      compatible.push('pan-left', 'pan-right');
    }
  }
  
  // Close-ups: only subtle push/pull
  if (shotType === 'close-up' || shotType === 'extreme-close-up') {
    compatible.push('push-in', 'zoom-in');
    
    // Centered close-ups can handle subtle dolly
    if (subjectPosition === 'center') {
      compatible.push('dolly-in');
    }
  }
  
  return [...new Set(compatible)]; // Dedupe
}
```

---

## Phase 2: Motion Extraction

Extracts motion intent from user prompts. Separates what they said about movement from what they said about visuals.

**File:** `server/src/services/i2v-optimization/MotionExtractor.ts`

```typescript
/**
 * MotionExtractor
 * 
 * Parses user prompt and separates motion intent from visual descriptions.
 * 
 * MAX LINES: 150
 */

import { logger } from '@infrastructure/Logger';

export interface ExtractedMotion {
  /** Motion-related text */
  motionText: string;
  
  /** Visual descriptions we extracted (for conflict checking) */
  visualDescriptions: Array<{
    category: string;
    text: string;
  }>;
  
  /** Detected camera movement keywords */
  cameraMovement: string | null;
  
  /** Pacing hints */
  pacing: 'slow' | 'medium' | 'fast' | null;
}

interface AIService {
  execute(taskType: string, params: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
    temperature?: number;
  }): Promise<{ text: string }>;
}

export class MotionExtractor {
  private readonly ai: AIService;
  private readonly log = logger.child({ service: 'MotionExtractor' });

  constructor(aiService: AIService) {
    this.ai = aiService;
  }

  /**
   * Extract motion intent from user prompt
   */
  async extract(userPrompt: string): Promise<ExtractedMotion> {
    // Try fast regex extraction first
    const fastResult = this.fastExtract(userPrompt);
    if (fastResult.motionText.length > 10) {
      return fastResult;
    }

    // Fall back to LLM extraction for complex prompts
    return this.llmExtract(userPrompt);
  }

  /**
   * Fast regex-based extraction for simple prompts
   */
  private fastExtract(prompt: string): ExtractedMotion {
    const motionVerbs = /\b(walks?|runs?|turns?|looks?|reaches?|moves?|stands?|sits?|smiles?|waves?|nods?|shakes?|dances?|jumps?|falls?|rises?|lifts?|drops?|opens?|closes?|speaks?|talks?|laughs?|cries?|breathes?)\b/gi;
    const cameraKeywords = /\b(pan(?:s|ning)?|tilt(?:s|ing)?|dolly|zoom(?:s|ing)?|track(?:s|ing)?|crane|push(?:es|ing)?|pull(?:s|ing)?)\b/gi;
    const pacingKeywords = /\b(slow(?:ly)?|fast|quick(?:ly)?|gradual(?:ly)?|sudden(?:ly)?|gentle|smooth)\b/gi;
    const visualKeywords = /\b(lighting|light|bright|dark|color|golden hour|sunset|sunrise|night|day|indoor|outdoor)\b/gi;

    const motionMatches = prompt.match(motionVerbs) || [];
    const cameraMatches = prompt.match(cameraKeywords) || [];
    const pacingMatches = prompt.match(pacingKeywords) || [];
    const visualMatches = prompt.match(visualKeywords) || [];

    // Extract sentences containing motion verbs
    const sentences = prompt.split(/[.!?]+/).filter(s => s.trim());
    const motionSentences = sentences.filter(s => 
      motionVerbs.test(s) || cameraKeywords.test(s)
    );

    return {
      motionText: motionSentences.join('. ').trim() || prompt,
      visualDescriptions: visualMatches.map(v => ({ 
        category: 'lighting',
        text: v 
      })),
      cameraMovement: cameraMatches[0] || null,
      pacing: this.detectPacing(pacingMatches),
    };
  }

  /**
   * LLM-based extraction for complex prompts
   */
  private async llmExtract(prompt: string): Promise<ExtractedMotion> {
    const systemPrompt = `Extract motion intent from this prompt.

Separate:
1. MOTION: Actions, movements, gestures, expressions, camera movements
2. VISUAL: Lighting, colors, environment descriptions, subject appearance

Return JSON:
{
  "motionText": "only motion-related text",
  "visualDescriptions": [{"category": "lighting|subject|environment", "text": "..."}],
  "cameraMovement": "detected camera move or null",
  "pacing": "slow|medium|fast|null"
}`;

    try {
      const response = await this.ai.execute('extract_motion', {
        systemPrompt,
        userPrompt: prompt,
        maxTokens: 500,
        temperature: 0.1,
      });

      const parsed = JSON.parse(
        response.text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      );

      return {
        motionText: parsed.motionText || prompt,
        visualDescriptions: parsed.visualDescriptions || [],
        cameraMovement: parsed.cameraMovement || null,
        pacing: parsed.pacing || null,
      };
    } catch (error) {
      this.log.warn('LLM extraction failed, using fast path', { error: (error as Error).message });
      return this.fastExtract(prompt);
    }
  }

  private detectPacing(matches: string[]): ExtractedMotion['pacing'] {
    const joined = matches.join(' ').toLowerCase();
    if (/slow|gentle|gradual|smooth/.test(joined)) return 'slow';
    if (/fast|quick|sudden/.test(joined)) return 'fast';
    return null;
  }
}
```

---

## Phase 3: Constraint Modes & Lock Maps

**File:** `server/src/services/i2v-optimization/types.ts`

```typescript
/**
 * I2V Optimization Types
 */

import type { ImageObservation, LockMap, LockStatus } from '../image-observation/types';
import type { LockableCategory, FreeCategory } from '../shared/cinematography';

/**
 * Constraint mode determines how strictly we enforce image reality
 */
export type I2VConstraintMode = 
  | 'strict'      // Motion only. Visual descriptions dropped silently.
  | 'flexible'    // Motion primary. Visual conflicts shown as warnings.
  | 'transform';  // User wants style transfer. Minimal constraints.

/**
 * A detected conflict between user prompt and image observation
 */
export interface I2VConflict {
  category: LockableCategory;
  userSaid: string;
  imageSays: string;
  severity: 'info' | 'warning' | 'error';
}

/**
 * Request to optimize for i2v
 */
export interface I2VOptimizationRequest {
  /** User's prompt */
  prompt: string;
  
  /** Image observation (from ImageObservationService) */
  observation: ImageObservation;
  
  /** Constraint mode */
  mode?: I2VConstraintMode;
}

/**
 * I2V optimization result
 */
export interface I2VOptimizationResult {
  /** Motion-focused prompt */
  prompt: string;
  
  /** Detected conflicts (for UI warnings) */
  conflicts: I2VConflict[];
  
  /** Lock map for UI (derived from mode) */
  lockMap: LockMap;
  
  /** Compatible camera movements */
  compatibleCameraMoves: string[];
  
  /** Mode that was applied */
  appliedMode: I2VConstraintMode;
}

/**
 * Derive lock map from constraint mode
 */
export function deriveLockMap(mode: I2VConstraintMode): LockMap {
  const lockMap = {} as LockMap;
  
  const strictLocked: LockableCategory[] = [
    'subject.identity',
    'subject.appearance',
    'subject.position',
    'shot.type',
    'shot.angle',
    'lighting.quality',
    'lighting.direction',
    'lighting.time',
    'environment.setting',
    'environment.location',
    'color.palette',
    'style.visual',
  ];

  const softLockable: LockableCategory[] = [
    'lighting.time',
    'color.palette',
    'style.visual',
  ];

  for (const category of strictLocked) {
    if (mode === 'strict') {
      lockMap[category] = 'hard';
    } else if (mode === 'flexible') {
      lockMap[category] = softLockable.includes(category) ? 'soft' : 'hard';
    } else {
      // transform mode
      lockMap[category] = 'unlocked';
    }
  }

  return lockMap;
}
```

### Conflict Detector

**File:** `server/src/services/i2v-optimization/ConflictDetector.ts`

```typescript
/**
 * ConflictDetector
 * 
 * Finds conflicts between user prompt and image observation.
 * 
 * MAX LINES: 150
 */

import type { ImageObservation } from '../image-observation/types';
import type { ExtractedMotion } from './MotionExtractor';
import type { I2VConflict } from './types';

export class ConflictDetector {
  /**
   * Detect conflicts between extracted visuals and image observation
   */
  detect(
    extracted: ExtractedMotion,
    observation: ImageObservation
  ): I2VConflict[] {
    const conflicts: I2VConflict[] = [];

    for (const visual of extracted.visualDescriptions) {
      const conflict = this.checkVisualConflict(visual, observation);
      if (conflict) {
        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  private checkVisualConflict(
    visual: { category: string; text: string },
    observation: ImageObservation
  ): I2VConflict | null {
    const textLower = visual.text.toLowerCase();

    // Time of day conflicts
    if (this.isTimeConflict(textLower, observation.lighting.timeOfDay)) {
      return {
        category: 'lighting.time',
        userSaid: visual.text,
        imageSays: observation.lighting.timeOfDay,
        severity: 'warning',
      };
    }

    // Lighting quality conflicts
    if (this.isLightingConflict(textLower, observation.lighting.quality)) {
      return {
        category: 'lighting.quality',
        userSaid: visual.text,
        imageSays: observation.lighting.quality,
        severity: 'warning',
      };
    }

    // Environment conflicts
    if (this.isEnvironmentConflict(textLower, observation.environment.setting)) {
      return {
        category: 'environment.setting',
        userSaid: visual.text,
        imageSays: observation.environment.setting,
        severity: 'warning',
      };
    }

    return null;
  }

  private isTimeConflict(text: string, observed: string): boolean {
    const dayTerms = ['day', 'daylight', 'midday', 'afternoon', 'morning'];
    const nightTerms = ['night', 'nighttime', 'dark', 'midnight'];
    const goldenTerms = ['golden hour', 'sunset', 'sunrise'];

    const userSaysDay = dayTerms.some(t => text.includes(t));
    const userSaysNight = nightTerms.some(t => text.includes(t));
    const userSaysGolden = goldenTerms.some(t => text.includes(t));

    if (userSaysNight && (observed === 'midday' || observed === 'golden-hour')) return true;
    if (userSaysDay && observed === 'night') return true;
    if (userSaysGolden && (observed === 'night' || observed === 'indoor')) return true;

    return false;
  }

  private isLightingConflict(text: string, observed: string): boolean {
    if (text.includes('dramatic') && observed === 'flat') return true;
    if (text.includes('flat') && observed === 'dramatic') return true;
    if (text.includes('natural') && observed === 'artificial') return true;
    return false;
  }

  private isEnvironmentConflict(text: string, observed: string): boolean {
    if (text.includes('outdoor') && observed === 'interior') return true;
    if (text.includes('indoor') && observed === 'exterior') return true;
    return false;
  }
}
```

---

## Phase 4: UI Integration

### Frontend Types

**File:** `client/src/features/prompt-optimizer/types/i2v.ts`

```typescript
/**
 * I2V Types for Frontend
 */

export type I2VConstraintMode = 'strict' | 'flexible' | 'transform';

export type LockStatus = 'hard' | 'soft' | 'unlocked';

export interface I2VConflict {
  category: string;
  userSaid: string;
  imageSays: string;
  severity: 'info' | 'warning' | 'error';
}

export interface I2VOptimizationResult {
  prompt: string;
  conflicts: I2VConflict[];
  lockMap: Record<string, LockStatus>;
  compatibleCameraMoves: string[];
  appliedMode: I2VConstraintMode;
}

export interface I2VContext {
  isI2VMode: boolean;
  constraintMode: I2VConstraintMode;
  imageUrl: string | null;
  optimizationResult: I2VOptimizationResult | null;
  isAnalyzing: boolean;
  error: string | null;
}
```

### useI2VMode Hook

**File:** `client/src/features/prompt-optimizer/hooks/useI2VMode.ts`

```typescript
/**
 * useI2VMode - Manages i2v optimization context
 * 
 * MAX LINES: 120
 */

import { useState, useCallback, useMemo } from 'react';
import { optimizeForI2V } from '../api/i2vApi';
import type { 
  I2VConstraintMode, 
  I2VOptimizationResult, 
  I2VContext 
} from '../types/i2v';

export function useI2VMode(startImageUrl: string | null) {
  const [constraintMode, setConstraintMode] = useState<I2VConstraintMode>('strict');
  const [optimizationResult, setOptimizationResult] = useState<I2VOptimizationResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isI2VMode = Boolean(startImageUrl);

  const optimize = useCallback(async (prompt: string) => {
    if (!startImageUrl) return null;

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await optimizeForI2V({
        prompt,
        imageUrl: startImageUrl,
        mode: constraintMode,
      });
      setOptimizationResult(result);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [startImageUrl, constraintMode]);

  const lockMap = useMemo(() => {
    return optimizationResult?.lockMap ?? {};
  }, [optimizationResult]);

  const conflicts = useMemo(() => {
    return optimizationResult?.conflicts ?? [];
  }, [optimizationResult]);

  const isCategoryLocked = useCallback((category: string): boolean => {
    const status = lockMap[category];
    return status === 'hard' || status === 'soft';
  }, [lockMap]);

  const getLockStatus = useCallback((category: string): LockStatus | null => {
    return lockMap[category] ?? null;
  }, [lockMap]);

  return {
    // State
    isI2VMode,
    constraintMode,
    optimizationResult,
    isAnalyzing,
    error,
    lockMap,
    conflicts,
    
    // Actions
    setConstraintMode,
    optimize,
    
    // Utilities
    isCategoryLocked,
    getLockStatus,
  };
}
```

### Conflict Warning Component

**File:** `client/src/features/prompt-optimizer/components/I2VConflictWarnings.tsx`

```typescript
/**
 * I2VConflictWarnings - Shows conflicts between user prompt and image
 * 
 * MAX LINES: 80
 */

import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import type { I2VConflict } from '../types/i2v';

interface I2VConflictWarningsProps {
  conflicts: I2VConflict[];
  className?: string;
}

export function I2VConflictWarnings({ 
  conflicts, 
  className 
}: I2VConflictWarningsProps): React.ReactElement | null {
  if (conflicts.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="text-xs font-medium text-amber-400 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        Potential conflicts detected
      </div>
      
      {conflicts.map((conflict, i) => (
        <div 
          key={i}
          className="text-xs p-2 rounded bg-amber-500/10 border border-amber-500/20"
        >
          <div className="flex items-start gap-2">
            {conflict.severity === 'warning' ? (
              <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
            ) : (
              <Info className="w-3 h-3 text-blue-400 mt-0.5 shrink-0" />
            )}
            <div>
              <span className="text-muted">You said </span>
              <span className="text-foreground">"{conflict.userSaid}"</span>
              <span className="text-muted"> but image shows </span>
              <span className="text-foreground">"{conflict.imageSays}"</span>
            </div>
          </div>
        </div>
      ))}
      
      <div className="text-xs text-muted">
        These may not render as expected. The video will follow the image.
      </div>
    </div>
  );
}
```

### Mode Selector Component

**File:** `client/src/features/prompt-optimizer/components/I2VModeSwitcher.tsx`

```typescript
/**
 * I2VModeSwitcher - Select constraint mode
 * 
 * MAX LINES: 100
 */

import React from 'react';
import { Lock, Unlock, Wand2 } from 'lucide-react';
import type { I2VConstraintMode } from '../types/i2v';

interface I2VModeSwitcherProps {
  mode: I2VConstraintMode;
  onChange: (mode: I2VConstraintMode) => void;
  className?: string;
}

const MODE_CONFIG = {
  strict: {
    icon: Lock,
    label: 'Strict',
    description: 'Motion only. Image defines the scene.',
  },
  flexible: {
    icon: Unlock,
    label: 'Flexible', 
    description: 'Motion primary. Warnings for conflicts.',
  },
  transform: {
    icon: Wand2,
    label: 'Transform',
    description: 'Style transfer. Minimal constraints.',
  },
} as const;

export function I2VModeSwitcher({ 
  mode, 
  onChange,
  className 
}: I2VModeSwitcherProps): React.ReactElement {
  return (
    <div className={`flex gap-1 ${className}`}>
      {(Object.keys(MODE_CONFIG) as I2VConstraintMode[]).map((key) => {
        const config = MODE_CONFIG[key];
        const Icon = config.icon;
        const isActive = mode === key;
        
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            title={config.description}
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded text-xs
              transition-colors
              ${isActive 
                ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30' 
                : 'bg-surface-1 text-muted border border-border hover:text-foreground'
              }
            `}
          >
            <Icon className="w-3 h-3" />
            {config.label}
          </button>
        );
      })}
    </div>
  );
}
```

---

## Phase 5: Suggestion Filtering

Modify EnhancementService to respect lock map when generating suggestions.

**File:** `server/src/services/enhancement/services/I2VSuggestionFilter.ts`

```typescript
/**
 * I2VSuggestionFilter
 * 
 * Filters enhancement suggestions based on i2v lock map.
 * 
 * MAX LINES: 100
 */

import type { LockMap, LockStatus } from '../../image-observation/types';
import type { Suggestion } from '../types';

export interface FilteredSuggestionResult {
  suggestions: Suggestion[];
  blocked: boolean;
  blockReason?: string;
  motionAlternatives?: Suggestion[];
}

export class I2VSuggestionFilter {
  /**
   * Filter suggestions based on lock map
   */
  filter(
    suggestions: Suggestion[],
    category: string,
    lockMap: LockMap
  ): FilteredSuggestionResult {
    const lockStatus = this.getLockStatus(category, lockMap);

    // Hard lock: no suggestions allowed
    if (lockStatus === 'hard') {
      return {
        suggestions: [],
        blocked: true,
        blockReason: this.getBlockReason(category),
        motionAlternatives: this.getMotionAlternatives(category),
      };
    }

    // Soft lock: suggestions allowed but with warning
    if (lockStatus === 'soft') {
      return {
        suggestions: suggestions.map(s => ({
          ...s,
          warning: 'This may not render as expected - image provides this element',
        })),
        blocked: false,
      };
    }

    // Unlocked: normal suggestions
    return {
      suggestions,
      blocked: false,
    };
  }

  private getLockStatus(category: string, lockMap: LockMap): LockStatus {
    // Direct match
    if (category in lockMap) {
      return lockMap[category as keyof LockMap];
    }

    // Parent category match (e.g., "subject.identity" matches "subject")
    const parent = category.split('.')[0];
    const parentKey = Object.keys(lockMap).find(k => k.startsWith(parent + '.'));
    if (parentKey) {
      return lockMap[parentKey as keyof LockMap];
    }

    return 'unlocked';
  }

  private getBlockReason(category: string): string {
    const reasons: Record<string, string> = {
      'subject.identity': 'Subject is defined by the image',
      'subject.appearance': 'Appearance is fixed by the image',
      'shot.type': 'Shot type is determined by the image framing',
      'shot.angle': 'Camera angle is fixed by the image',
      'lighting.quality': 'Lighting is defined by the image',
      'environment.setting': 'Environment is shown in the image',
    };
    return reasons[category] || 'This element is defined by your source image';
  }

  private getMotionAlternatives(category: string): Suggestion[] {
    // Suggest motion-related alternatives when visual is blocked
    return [
      { text: 'Try describing motion instead', category: 'action.movement', confidence: 0.9 },
      { text: 'Add camera movement', category: 'camera.movement', confidence: 0.8 },
    ];
  }
}
```

---

## API Reference

### New Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/i2v/analyze` | Analyze image, return observation |
| POST | `/api/i2v/optimize` | Optimize prompt for i2v |

### POST /api/i2v/analyze

**Request:**
```json
{
  "image": "https://example.com/image.jpg",
  "sourcePrompt": "optional - skip vision if provided"
}
```

**Response:**
```json
{
  "success": true,
  "observation": {
    "subject": { "description": "...", "type": "person", "position": "center" },
    "framing": { "shotType": "close-up", "angle": "eye-level" },
    "lighting": { "quality": "natural", "direction": "side", "timeOfDay": "golden-hour" },
    "environment": { "setting": "exterior", "description": "beach" },
    "compatibleCameraMoves": ["push-in", "static", "dolly-in"],
    "confidence": 0.85
  },
  "cached": false,
  "durationMs": 2100
}
```

### POST /api/i2v/optimize

**Request:**
```json
{
  "prompt": "she slowly turns and smiles, golden hour light",
  "imageUrl": "https://example.com/image.jpg",
  "mode": "strict"
}
```

**Response:**
```json
{
  "prompt": "she slowly turns and smiles, smooth natural movement",
  "conflicts": [
    {
      "category": "lighting.time",
      "userSaid": "golden hour light",
      "imageSays": "indoor",
      "severity": "warning"
    }
  ],
  "lockMap": {
    "subject.identity": "hard",
    "subject.appearance": "hard",
    "lighting.quality": "hard",
    ...
  },
  "compatibleCameraMoves": ["push-in", "static"],
  "appliedMode": "strict"
}
```

---

## Implementation Checklist

### Phase 0: Shared Vocabulary (Day 1)
- [ ] Create `server/src/services/shared/cinematography.ts`
- [ ] Define all constants (shot types, angles, movements, etc.)
- [ ] Export types for use across services

### Phase 1: Image Observation Service (Days 2-3)
- [ ] Create `server/src/services/image-observation/` directory
- [ ] Implement `types.ts`
- [ ] Implement `ObservationCache.ts`
- [ ] Implement `cameraMoveCompatibility.ts`
- [ ] Implement `ImageObservationService.ts`
- [ ] Add vision prompt template
- [ ] Write unit tests
- [ ] Add routes

### Phase 2: Motion Extraction (Day 4)
- [ ] Create `server/src/services/i2v-optimization/` directory
- [ ] Implement `types.ts`
- [ ] Implement `MotionExtractor.ts`
- [ ] Implement `ConflictDetector.ts`
- [ ] Write unit tests

### Phase 3: I2V Optimizer (Days 5-6)
- [ ] Implement `I2VMotionOptimizer.ts` (main orchestrator)
- [ ] Add lock map derivation
- [ ] Wire up routes
- [ ] Integration tests

### Phase 4: Frontend (Days 7-8)
- [ ] Create `client/src/features/prompt-optimizer/types/i2v.ts`
- [ ] Implement `hooks/useI2VMode.ts`
- [ ] Implement `api/i2vApi.ts`
- [ ] Implement `components/I2VConflictWarnings.tsx`
- [ ] Implement `components/I2VModeSwitcher.tsx`
- [ ] Integrate into PromptCanvas

### Phase 5: Suggestion Filtering (Day 9)
- [ ] Implement `I2VSuggestionFilter.ts`
- [ ] Modify `EnhancementService` to use filter
- [ ] Update UI to show blocked categories with lock icons

### Polish (Day 10)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Error handling
- [ ] Documentation

---

## File Summary

### New Files

```
server/src/services/
├── shared/
│   └── cinematography.ts              # Shared vocabulary
│
├── image-observation/
│   ├── ImageObservationService.ts     # Main service
│   ├── ObservationCache.ts            # Caching
│   ├── cameraMoveCompatibility.ts     # Move filtering
│   ├── types.ts                       # Types
│   └── index.ts                       # Exports
│
└── i2v-optimization/
    ├── I2VMotionOptimizer.ts          # Main optimizer
    ├── MotionExtractor.ts             # Extract motion from text
    ├── ConflictDetector.ts            # Find conflicts
    ├── types.ts                       # Types
    └── index.ts                       # Exports

client/src/features/prompt-optimizer/
├── types/i2v.ts                       # Frontend types
├── hooks/useI2VMode.ts                # Main hook
├── api/i2vApi.ts                      # API calls
└── components/
    ├── I2VConflictWarnings.tsx        # Warning display
    └── I2VModeSwitcher.tsx            # Mode selector

server/src/routes/
└── i2v/
    ├── i2v.routes.ts                  # Route definitions
    └── handlers/
        ├── analyze.ts
        └── optimize.ts
```

### Modified Files

```
server/src/services/
├── prompt-optimization/
│   └── PromptOptimizationService.ts   # Route to i2v when image present
│
└── enhancement/
    └── EnhancementService.ts          # Use I2VSuggestionFilter
```

---

## Key Differences from Original Plan

| Original Plan | This Plan |
|---------------|-----------|
| Build descriptive prompts from image analysis | Output motion only - image IS the description |
| `VisualGroundTruth` with 15+ fields | `ImageObservation` - minimal fields for filtering |
| Complex prompt construction | Simple motion extraction + pacing expansion |
| Strategy pattern with IR merging | Direct optimization with conflict detection |
| Per-field lock metadata | Lock map derived from 3 modes |
| Heavy integration with span labeling | Focus on suggestion filtering |

**Result:** ~60% less code, clearer purpose, easier to maintain.
