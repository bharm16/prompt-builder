# Visual Convergence Implementation Plan

> **Goal:** Transform PromptCanvas from a text optimization tool into a visual-first video creation platform where users pick from options rather than write prompts.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Phase 1: Backend - Convergence Service](#phase-1-backend---convergence-service)
4. [Phase 2: Backend - Depth & Camera Motion](#phase-2-backend---depth--camera-motion)
5. [Phase 3: Frontend - Convergence Flow](#phase-3-frontend---convergence-flow)
6. [Phase 4: Frontend - Camera Motion Renderer](#phase-4-frontend---camera-motion-renderer)
7. [Phase 5: Integration & Polish](#phase-5-integration--polish)
8. [Database Schema](#database-schema)
9. [API Reference](#api-reference)
10. [Testing Strategy](#testing-strategy)

---

## Overview

### The User Flow

```
1. USER INPUT
   "a woman walking on a beach"
              ↓
2. DIRECTION FORK (4 images)
   [Cinematic] [Social] [Artistic] [Documentary]
              ↓ user picks Cinematic
3. MOOD (4 images, all cinematic)
   [Dramatic] [Peaceful] [Mysterious] [Nostalgic]
              ↓ user picks Dramatic
4. FRAMING (4 images, dramatic mood locked)
   [Wide] [Medium] [Close-up] [Extreme Close-up]
              ↓ user picks Wide
5. LIGHTING (4 images, dramatic+wide locked)
   [Golden Hour] [Blue Hour] [High Key] [Low Key]
              ↓ user picks Golden Hour
6. CAMERA MOTION (4 videos via depth parallax - FREE)
   [Static] [Pan Left] [Push In] [Pull Back]
              ↓ user picks Push In
7. SUBJECT MOTION (text input → Wan preview)
   "she walks slowly toward the water"
              ↓ generate 1 Wan preview
8. FINAL GENERATION
   [Generate with Sora] [Generate with Veo] [Generate with Kling]
```

### Cost Breakdown Per Session

| Step | Images/Videos | Model | Cost |
|------|---------------|-------|------|
| Direction Fork | 4 images | Flux Schnell | $0.012 |
| Mood | 4 images | Flux Schnell | $0.012 |
| Framing | 4 images | Flux Schnell | $0.012 |
| Lighting | 4 images | Flux Schnell | $0.012 |
| Camera Motion | 4 videos | Depth + Three.js | ~$0.01 (depth only) |
| Subject Motion | 1 video | Wan 2.2 | $0.15-0.30 |
| **Total Preview** | | | **$0.21-0.36** |
| Final Generation | 1 video | Sora/Veo/Kling | $2-10 |

---

## Architecture

### Backend Structure

```
server/src/services/convergence/
├── ConvergenceService.ts          # Main orchestrator (max 500 lines)
├── types.ts                       # Type definitions
├── index.ts                       # Exports
│
├── session/
│   ├── SessionManager.ts          # Session CRUD & state (max 300 lines)
│   ├── SessionStore.ts            # Firestore persistence (max 200 lines)
│   └── types.ts
│
├── prompt-builder/
│   ├── PromptBuilderService.ts    # Builds prompts from locked dimensions (max 300 lines)
│   ├── DimensionFragments.ts      # Prompt fragments per dimension (data file)
│   └── types.ts
│
├── depth/
│   ├── DepthEstimationService.ts  # Depth Anything v2 integration (max 200 lines)
│   └── types.ts
│
└── camera-motion/
    ├── CameraMotionService.ts     # Camera path definitions (max 200 lines)
    └── CameraPaths.ts             # Path data (data file)
```

### Frontend Structure

```
client/src/features/convergence/
├── ConvergenceFlow.tsx            # Main orchestrator (max 500 lines)
├── index.ts                       # Exports
│
├── hooks/
│   ├── useConvergenceSession.ts   # Session state management
│   ├── useImageGeneration.ts      # Image generation polling
│   └── useCameraMotionRenderer.ts # Three.js camera rendering
│
├── api/
│   └── convergenceApi.ts          # All API calls
│
├── components/
│   ├── IntentInput.tsx            # Initial text input (max 150 lines)
│   ├── DirectionFork.tsx          # Direction selection (max 150 lines)
│   ├── DimensionSelector.tsx      # Generic dimension picker (max 200 lines)
│   ├── CameraMotionPicker.tsx     # Camera motion with video previews (max 200 lines)
│   ├── SubjectMotionInput.tsx     # Subject motion text + preview (max 200 lines)
│   ├── ConvergencePreview.tsx     # Final preview before generation (max 150 lines)
│   └── ImageOption.tsx            # Single selectable image (max 100 lines)
│
├── utils/
│   ├── cameraMotionRenderer.ts    # Three.js depth parallax renderer
│   └── videoEncoder.ts            # Canvas frames → video blob
│
├── config/
│   ├── dimensions.ts              # Dimension definitions
│   ├── directions.ts              # Direction definitions
│   └── cameraMotions.ts           # Camera motion definitions
│
└── types.ts
```

### Routes

```
server/src/routes/convergence/
├── convergence.routes.ts          # Route definitions
├── handlers/
│   ├── startSession.ts
│   ├── selectOption.ts
│   ├── refineText.ts
│   ├── generateCameraMotion.ts
│   ├── generateSubjectMotion.ts
│   └── finalizeSession.ts
└── types.ts
```

---

## Phase 1: Backend - Convergence Service

### 1.1 Types Definition

**File:** `server/src/services/convergence/types.ts`

```typescript
/**
 * Convergence Service Types
 */

export type Direction = 'cinematic' | 'social' | 'artistic' | 'documentary';

export type DimensionType = 'mood' | 'framing' | 'lighting' | 'camera_motion';

export interface DimensionOption {
  id: string;
  label: string;
  promptFragments: string[];
}

export interface DimensionConfig {
  type: DimensionType;
  options: DimensionOption[];
}

export interface LockedDimension {
  type: DimensionType;
  optionId: string;
  label: string;
  promptFragments: string[];
}

export interface ConvergenceSession {
  id: string;
  userId: string;
  intent: string;
  direction: Direction | null;
  lockedDimensions: LockedDimension[];
  currentDimension: DimensionType | 'direction' | 'subject_motion' | 'complete';
  generatedImages: GeneratedImage[];
  depthMapUrl: string | null;
  cameraMotion: string | null;
  subjectMotion: string | null;
  finalPrompt: string | null;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'completed' | 'abandoned';
}

export interface GeneratedImage {
  id: string;
  url: string;
  dimension: DimensionType | 'direction';
  optionId: string;
  prompt: string;
  generatedAt: Date;
}

export interface StartSessionRequest {
  intent: string;
  userId: string;
}

export interface StartSessionResponse {
  sessionId: string;
  images: GeneratedImage[];
  currentDimension: 'direction';
  options: Array<{ id: Direction; label: string }>;
}

export interface SelectOptionRequest {
  sessionId: string;
  dimension: DimensionType | 'direction';
  optionId: string;
}

export interface SelectOptionResponse {
  sessionId: string;
  images: GeneratedImage[];
  currentDimension: DimensionType | 'camera_motion' | 'subject_motion';
  lockedDimensions: LockedDimension[];
  options?: Array<{ id: string; label: string }>;
}

export interface RefineTextRequest {
  sessionId: string;
  refinement: string;
}

export interface RefineTextResponse {
  sessionId: string;
  images: GeneratedImage[];
  interpretation: string;
}

export interface GenerateCameraMotionRequest {
  sessionId: string;
}

export interface GenerateCameraMotionResponse {
  sessionId: string;
  depthMapUrl: string;
  cameraPaths: CameraPath[];
}

export interface CameraPath {
  id: string;
  label: string;
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  duration: number;
}

export interface SelectCameraMotionRequest {
  sessionId: string;
  cameraMotionId: string;
}

export interface GenerateSubjectMotionRequest {
  sessionId: string;
  subjectMotion: string;
}

export interface GenerateSubjectMotionResponse {
  sessionId: string;
  videoUrl: string;
  prompt: string;
}

export interface FinalizeSessionRequest {
  sessionId: string;
}

export interface FinalizeSessionResponse {
  sessionId: string;
  finalPrompt: string;
  lockedDimensions: LockedDimension[];
  previewImageUrl: string;
  cameraMotion: string;
  subjectMotion: string;
}
```

### 1.2 Session Store

**File:** `server/src/services/convergence/session/SessionStore.ts`

```typescript
/**
 * Session Store - Firestore persistence for convergence sessions
 * 
 * PATTERN: Repository pattern
 * MAX LINES: 200
 */

import { getFirestore } from '@infrastructure/firebaseAdmin';
import { logger } from '@infrastructure/Logger';
import type { ConvergenceSession } from '../types';

const COLLECTION = 'convergence_sessions';
const SESSION_TTL_HOURS = 24;

export class SessionStore {
  private db = getFirestore();
  private collection = this.db.collection(COLLECTION);
  private log = logger.child({ service: 'SessionStore' });

  async create(session: ConvergenceSession): Promise<void> {
    await this.collection.doc(session.id).set({
      ...session,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  async get(sessionId: string): Promise<ConvergenceSession | null> {
    const doc = await this.collection.doc(sessionId).get();
    if (!doc.exists) return null;
    return doc.data() as ConvergenceSession;
  }

  async update(sessionId: string, updates: Partial<ConvergenceSession>): Promise<void> {
    await this.collection.doc(sessionId).update({
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(sessionId: string): Promise<void> {
    await this.collection.doc(sessionId).delete();
  }

  async getByUserId(userId: string, limit = 10): Promise<ConvergenceSession[]> {
    const snapshot = await this.collection
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => doc.data() as ConvergenceSession);
  }

  async cleanupExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - SESSION_TTL_HOURS * 60 * 60 * 1000);
    const snapshot = await this.collection
      .where('updatedAt', '<', cutoff)
      .where('status', '==', 'active')
      .limit(100)
      .get();

    const batch = this.db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { status: 'abandoned' });
    });
    await batch.commit();

    this.log.info('Cleaned up expired sessions', { count: snapshot.size });
    return snapshot.size;
  }
}
```

### 1.3 Dimension Fragments

**File:** `server/src/services/convergence/prompt-builder/DimensionFragments.ts`

```typescript
/**
 * Dimension Fragments - Prompt fragments for each dimension option
 * 
 * These fragments are appended to the base prompt when a dimension is locked.
 * Each option has multiple fragments to add variety and specificity.
 * 
 * PATTERN: Data file (no logic)
 */

import type { DimensionConfig, Direction } from '../types';

/**
 * Direction-specific base modifiers
 */
export const DIRECTION_FRAGMENTS: Record<Direction, string[]> = {
  cinematic: [
    'cinematic composition',
    'film-like quality',
    'dramatic framing',
    'movie production value',
  ],
  social: [
    'social media ready',
    'vibrant and engaging',
    'eye-catching composition',
    'scroll-stopping visual',
  ],
  artistic: [
    'artistic interpretation',
    'creative visual style',
    'expressive composition',
    'aesthetic focus',
  ],
  documentary: [
    'documentary style',
    'naturalistic look',
    'authentic atmosphere',
    'observational framing',
  ],
};

/**
 * Mood dimension options
 */
export const MOOD_DIMENSION: DimensionConfig = {
  type: 'mood',
  options: [
    {
      id: 'dramatic',
      label: 'Dramatic',
      promptFragments: [
        'high contrast lighting',
        'deep shadows',
        'intense atmosphere',
        'dramatic tension',
        'bold visual statement',
      ],
    },
    {
      id: 'peaceful',
      label: 'Peaceful',
      promptFragments: [
        'soft diffused light',
        'gentle color palette',
        'serene atmosphere',
        'tranquil mood',
        'calming visual tone',
      ],
    },
    {
      id: 'mysterious',
      label: 'Mysterious',
      promptFragments: [
        'atmospheric haze',
        'obscured details',
        'enigmatic mood',
        'subtle shadows',
        'intriguing composition',
      ],
    },
    {
      id: 'nostalgic',
      label: 'Nostalgic',
      promptFragments: [
        'warm vintage tones',
        'soft focus edges',
        'memory-like quality',
        'wistful atmosphere',
        'timeless feel',
      ],
    },
  ],
};

/**
 * Framing dimension options
 */
export const FRAMING_DIMENSION: DimensionConfig = {
  type: 'framing',
  options: [
    {
      id: 'wide',
      label: 'Wide Shot',
      promptFragments: [
        'wide establishing shot',
        'environment visible',
        'subject in context',
        'expansive framing',
        'full scene coverage',
      ],
    },
    {
      id: 'medium',
      label: 'Medium Shot',
      promptFragments: [
        'medium shot framing',
        'waist-up framing',
        'balanced composition',
        'conversational distance',
        'natural perspective',
      ],
    },
    {
      id: 'closeup',
      label: 'Close-up',
      promptFragments: [
        'intimate close-up shot',
        'shallow depth of field',
        'face fills frame',
        'detailed features visible',
        'emotional proximity',
      ],
    },
    {
      id: 'extreme_closeup',
      label: 'Extreme Close-up',
      promptFragments: [
        'extreme close-up detail',
        'macro-like framing',
        'texture emphasis',
        'ultra shallow focus',
        'abstract detail shot',
      ],
    },
  ],
};

/**
 * Lighting dimension options
 */
export const LIGHTING_DIMENSION: DimensionConfig = {
  type: 'lighting',
  options: [
    {
      id: 'golden_hour',
      label: 'Golden Hour',
      promptFragments: [
        'warm golden hour sunlight',
        'long shadows',
        'orange and amber tones',
        'soft directional light',
        'magic hour glow',
      ],
    },
    {
      id: 'blue_hour',
      label: 'Blue Hour',
      promptFragments: [
        'cool blue hour light',
        'twilight atmosphere',
        'soft ambient illumination',
        'blue and purple tones',
        'ethereal dusk lighting',
      ],
    },
    {
      id: 'high_key',
      label: 'High Key',
      promptFragments: [
        'bright high-key lighting',
        'minimal shadows',
        'clean bright aesthetic',
        'even illumination',
        'airy light quality',
      ],
    },
    {
      id: 'low_key',
      label: 'Low Key',
      promptFragments: [
        'dramatic low-key lighting',
        'deep blacks',
        'selective illumination',
        'chiaroscuro effect',
        'moody shadow play',
      ],
    },
  ],
};

/**
 * Camera motion options (used for labeling, actual motion is depth-based)
 */
export const CAMERA_MOTION_DIMENSION: DimensionConfig = {
  type: 'camera_motion',
  options: [
    {
      id: 'static',
      label: 'Static',
      promptFragments: [
        'locked off camera',
        'stable tripod shot',
        'no camera movement',
      ],
    },
    {
      id: 'pan_left',
      label: 'Pan Left',
      promptFragments: [
        'camera pans left',
        'horizontal pan movement',
        'smooth lateral tracking',
      ],
    },
    {
      id: 'pan_right',
      label: 'Pan Right',
      promptFragments: [
        'camera pans right',
        'horizontal pan movement',
        'smooth lateral tracking',
      ],
    },
    {
      id: 'push_in',
      label: 'Push In',
      promptFragments: [
        'camera pushes in slowly',
        'dolly forward movement',
        'increasing intimacy',
      ],
    },
    {
      id: 'pull_back',
      label: 'Pull Back',
      promptFragments: [
        'camera pulls back',
        'dolly backward movement',
        'revealing wider context',
      ],
    },
    {
      id: 'crane_up',
      label: 'Crane Up',
      promptFragments: [
        'camera cranes upward',
        'vertical ascending movement',
        'elevated perspective reveal',
      ],
    },
  ],
};

/**
 * Get all dimension configs in order
 */
export const DIMENSION_ORDER: DimensionConfig[] = [
  MOOD_DIMENSION,
  FRAMING_DIMENSION,
  LIGHTING_DIMENSION,
  CAMERA_MOTION_DIMENSION,
];

/**
 * Get dimension config by type
 */
export function getDimensionConfig(type: string): DimensionConfig | undefined {
  return DIMENSION_ORDER.find(d => d.type === type);
}

/**
 * Get next dimension after the given one
 */
export function getNextDimension(currentType: string): DimensionConfig | null {
  const currentIndex = DIMENSION_ORDER.findIndex(d => d.type === currentType);
  if (currentIndex === -1 || currentIndex >= DIMENSION_ORDER.length - 1) {
    return null;
  }
  return DIMENSION_ORDER[currentIndex + 1];
}
```

### 1.4 Prompt Builder Service

**File:** `server/src/services/convergence/prompt-builder/PromptBuilderService.ts`

```typescript
/**
 * Prompt Builder Service
 * 
 * Builds optimized prompts from locked dimensions.
 * Uses fragment library to construct cinematically-aware prompts.
 * 
 * PATTERN: PromptOptimizationService (orchestrator)
 * MAX LINES: 300
 */

import { logger } from '@infrastructure/Logger';
import type { Direction, LockedDimension } from '../types';
import {
  DIRECTION_FRAGMENTS,
  getDimensionConfig,
} from './DimensionFragments';

interface PromptBuildOptions {
  intent: string;
  direction: Direction;
  lockedDimensions: LockedDimension[];
  subjectMotion?: string;
}

export class PromptBuilderService {
  private log = logger.child({ service: 'PromptBuilderService' });

  /**
   * Build a full prompt from intent and locked dimensions
   */
  buildPrompt(options: PromptBuildOptions): string {
    const { intent, direction, lockedDimensions, subjectMotion } = options;

    // Start with base intent
    const parts: string[] = [intent.trim()];

    // Add direction fragments (pick 2)
    const directionFrags = DIRECTION_FRAGMENTS[direction];
    parts.push(...this.pickFragments(directionFrags, 2));

    // Add locked dimension fragments (pick 2-3 per dimension)
    for (const locked of lockedDimensions) {
      // Skip camera_motion - it's handled by video generation
      if (locked.type === 'camera_motion') continue;
      
      parts.push(...this.pickFragments(locked.promptFragments, 2));
    }

    // Add subject motion if provided
    if (subjectMotion) {
      parts.push(subjectMotion.trim());
    }

    // Add camera motion as text hint (for video gen models)
    const cameraLock = lockedDimensions.find(d => d.type === 'camera_motion');
    if (cameraLock) {
      parts.push(...this.pickFragments(cameraLock.promptFragments, 1));
    }

    const prompt = parts.join(', ');
    
    this.log.debug('Built prompt from dimensions', {
      intent,
      direction,
      dimensionCount: lockedDimensions.length,
      promptLength: prompt.length,
    });

    return prompt;
  }

  /**
   * Build a prompt for a specific dimension preview
   * (less specific, for showing options)
   */
  buildDimensionPreviewPrompt(
    intent: string,
    direction: Direction,
    lockedDimensions: LockedDimension[],
    previewDimension: { type: string; optionId: string; fragments: string[] }
  ): string {
    const parts: string[] = [intent.trim()];

    // Add direction fragments (pick 1 for preview)
    const directionFrags = DIRECTION_FRAGMENTS[direction];
    parts.push(...this.pickFragments(directionFrags, 1));

    // Add already-locked dimension fragments (pick 1 per dimension)
    for (const locked of lockedDimensions) {
      if (locked.type === 'camera_motion') continue;
      parts.push(...this.pickFragments(locked.promptFragments, 1));
    }

    // Add preview dimension fragments (pick 2 to emphasize)
    parts.push(...this.pickFragments(previewDimension.fragments, 2));

    return parts.join(', ');
  }

  /**
   * Build prompts for direction fork (4 directions)
   */
  buildDirectionPrompts(intent: string): Array<{ direction: Direction; prompt: string }> {
    const directions: Direction[] = ['cinematic', 'social', 'artistic', 'documentary'];
    
    return directions.map(direction => ({
      direction,
      prompt: `${intent.trim()}, ${this.pickFragments(DIRECTION_FRAGMENTS[direction], 2).join(', ')}`,
    }));
  }

  /**
   * Pick N random fragments from array
   */
  private pickFragments(fragments: string[], count: number): string[] {
    if (fragments.length <= count) return [...fragments];
    
    const shuffled = [...fragments].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
}
```

### 1.5 Main Convergence Service

**File:** `server/src/services/convergence/ConvergenceService.ts`

```typescript
/**
 * Convergence Service - Main Orchestrator
 * 
 * Orchestrates the visual convergence flow:
 * 1. Start session with intent
 * 2. Generate direction options (4 images)
 * 3. Lock direction, generate mood options
 * 4. Lock mood, generate framing options
 * 5. Lock framing, generate lighting options
 * 6. Lock lighting, generate depth map
 * 7. User selects camera motion (client-side rendered)
 * 8. User enters subject motion, generate Wan preview
 * 9. Finalize and return complete prompt
 * 
 * PATTERN: VideoConceptService (orchestrator)
 * MAX LINES: 500
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '@infrastructure/Logger';
import type { ImageGenerationService } from '@services/image-generation';
import type {
  ConvergenceSession,
  Direction,
  DimensionType,
  GeneratedImage,
  LockedDimension,
  StartSessionRequest,
  StartSessionResponse,
  SelectOptionRequest,
  SelectOptionResponse,
  GenerateCameraMotionRequest,
  GenerateCameraMotionResponse,
  SelectCameraMotionRequest,
  GenerateSubjectMotionRequest,
  GenerateSubjectMotionResponse,
  FinalizeSessionResponse,
  CameraPath,
} from './types';
import { SessionStore } from './session/SessionStore';
import { PromptBuilderService } from './prompt-builder/PromptBuilderService';
import { DepthEstimationService } from './depth/DepthEstimationService';
import {
  DIRECTION_FRAGMENTS,
  DIMENSION_ORDER,
  getDimensionConfig,
  getNextDimension,
} from './prompt-builder/DimensionFragments';
import { CAMERA_PATHS } from './camera-motion/CameraPaths';

interface ConvergenceServiceDeps {
  imageGenerationService: ImageGenerationService;
  depthEstimationService: DepthEstimationService;
  sessionStore: SessionStore;
  promptBuilder: PromptBuilderService;
  videoPreviewService?: {
    generatePreview(prompt: string, options?: { duration?: number }): Promise<{ videoUrl: string }>;
  };
}

export class ConvergenceService {
  private readonly imageGen: ImageGenerationService;
  private readonly depth: DepthEstimationService;
  private readonly sessions: SessionStore;
  private readonly promptBuilder: PromptBuilderService;
  private readonly videoPreview?: ConvergenceServiceDeps['videoPreviewService'];
  private readonly log = logger.child({ service: 'ConvergenceService' });

  constructor(deps: ConvergenceServiceDeps) {
    this.imageGen = deps.imageGenerationService;
    this.depth = deps.depthEstimationService;
    this.sessions = deps.sessionStore;
    this.promptBuilder = deps.promptBuilder;
    this.videoPreview = deps.videoPreviewService;
  }

  /**
   * Start a new convergence session
   * Generates 4 direction options
   */
  async startSession(request: StartSessionRequest): Promise<StartSessionResponse> {
    const { intent, userId } = request;
    const sessionId = uuidv4();

    this.log.info('Starting convergence session', { sessionId, userId, intent });

    // Create session
    const session: ConvergenceSession = {
      id: sessionId,
      userId,
      intent,
      direction: null,
      lockedDimensions: [],
      currentDimension: 'direction',
      generatedImages: [],
      depthMapUrl: null,
      cameraMotion: null,
      subjectMotion: null,
      finalPrompt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
    };

    await this.sessions.create(session);

    // Generate direction options
    const directionPrompts = this.promptBuilder.buildDirectionPrompts(intent);
    const images = await this.generateImagesParallel(
      directionPrompts.map(d => ({
        prompt: d.prompt,
        dimension: 'direction' as const,
        optionId: d.direction,
      })),
      userId
    );

    // Update session with generated images
    await this.sessions.update(sessionId, { generatedImages: images });

    return {
      sessionId,
      images,
      currentDimension: 'direction',
      options: [
        { id: 'cinematic', label: 'Cinematic' },
        { id: 'social', label: 'Social / Ad' },
        { id: 'artistic', label: 'Artistic' },
        { id: 'documentary', label: 'Documentary' },
      ],
    };
  }

  /**
   * Select an option for the current dimension
   * Generates options for the next dimension
   */
  async selectOption(request: SelectOptionRequest): Promise<SelectOptionResponse> {
    const { sessionId, dimension, optionId } = request;
    
    const session = await this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    this.log.info('Selecting option', { sessionId, dimension, optionId });

    // Handle direction selection
    if (dimension === 'direction') {
      return this.handleDirectionSelection(session, optionId as Direction);
    }

    // Handle dimension selection
    return this.handleDimensionSelection(session, dimension as DimensionType, optionId);
  }

  /**
   * Generate depth map and camera motion paths
   * Called after lighting is locked
   */
  async generateCameraMotion(request: GenerateCameraMotionRequest): Promise<GenerateCameraMotionResponse> {
    const { sessionId } = request;
    
    const session = await this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Get the last generated image (with all dimensions locked)
    const lastImage = session.generatedImages[session.generatedImages.length - 1];
    if (!lastImage) {
      throw new Error('No image available for depth estimation');
    }

    this.log.info('Generating depth map for camera motion', { sessionId });

    // Generate depth map
    const depthMapUrl = await this.depth.estimateDepth(lastImage.url);

    // Update session
    await this.sessions.update(sessionId, {
      depthMapUrl,
      currentDimension: 'camera_motion',
    });

    return {
      sessionId,
      depthMapUrl,
      cameraPaths: CAMERA_PATHS,
    };
  }

  /**
   * Lock camera motion selection
   */
  async selectCameraMotion(request: SelectCameraMotionRequest): Promise<void> {
    const { sessionId, cameraMotionId } = request;
    
    const session = await this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const cameraConfig = getDimensionConfig('camera_motion');
    const option = cameraConfig?.options.find(o => o.id === cameraMotionId);
    if (!option) {
      throw new Error('Invalid camera motion option');
    }

    const locked: LockedDimension = {
      type: 'camera_motion',
      optionId: cameraMotionId,
      label: option.label,
      promptFragments: option.promptFragments,
    };

    await this.sessions.update(sessionId, {
      cameraMotion: cameraMotionId,
      lockedDimensions: [...session.lockedDimensions, locked],
      currentDimension: 'subject_motion',
    });
  }

  /**
   * Generate subject motion preview with Wan
   */
  async generateSubjectMotion(request: GenerateSubjectMotionRequest): Promise<GenerateSubjectMotionResponse> {
    const { sessionId, subjectMotion } = request;
    
    const session = await this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (!session.direction) {
      throw new Error('Direction not set');
    }

    if (!this.videoPreview) {
      throw new Error('Video preview service not configured');
    }

    this.log.info('Generating subject motion preview', { sessionId, subjectMotion });

    // Build full prompt with subject motion
    const prompt = this.promptBuilder.buildPrompt({
      intent: session.intent,
      direction: session.direction,
      lockedDimensions: session.lockedDimensions,
      subjectMotion,
    });

    // Generate Wan preview
    const { videoUrl } = await this.videoPreview.generatePreview(prompt, { duration: 4 });

    // Update session
    await this.sessions.update(sessionId, {
      subjectMotion,
      finalPrompt: prompt,
    });

    return {
      sessionId,
      videoUrl,
      prompt,
    };
  }

  /**
   * Finalize session and return complete data for generation
   */
  async finalizeSession(sessionId: string): Promise<FinalizeSessionResponse> {
    const session = await this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    if (!session.direction || !session.finalPrompt) {
      throw new Error('Session not complete');
    }

    // Mark session as completed
    await this.sessions.update(sessionId, { status: 'completed' });

    // Get the preview image URL
    const lastImage = session.generatedImages[session.generatedImages.length - 1];

    return {
      sessionId,
      finalPrompt: session.finalPrompt,
      lockedDimensions: session.lockedDimensions,
      previewImageUrl: lastImage?.url ?? '',
      cameraMotion: session.cameraMotion ?? 'static',
      subjectMotion: session.subjectMotion ?? '',
    };
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<ConvergenceSession | null> {
    return this.sessions.get(sessionId);
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async handleDirectionSelection(
    session: ConvergenceSession,
    direction: Direction
  ): Promise<SelectOptionResponse> {
    // Lock direction
    await this.sessions.update(session.id, { direction });

    // Get first dimension (mood)
    const firstDimension = DIMENSION_ORDER[0];

    // Generate mood options
    const images = await this.generateDimensionOptions(
      session.intent,
      direction,
      [],
      firstDimension
    );

    await this.sessions.update(session.id, {
      generatedImages: [...session.generatedImages, ...images],
      currentDimension: firstDimension.type,
    });

    return {
      sessionId: session.id,
      images,
      currentDimension: firstDimension.type,
      lockedDimensions: [],
      options: firstDimension.options.map(o => ({ id: o.id, label: o.label })),
    };
  }

  private async handleDimensionSelection(
    session: ConvergenceSession,
    dimension: DimensionType,
    optionId: string
  ): Promise<SelectOptionResponse> {
    const dimensionConfig = getDimensionConfig(dimension);
    if (!dimensionConfig) {
      throw new Error(`Invalid dimension: ${dimension}`);
    }

    const option = dimensionConfig.options.find(o => o.id === optionId);
    if (!option) {
      throw new Error(`Invalid option: ${optionId}`);
    }

    // Add to locked dimensions
    const locked: LockedDimension = {
      type: dimension,
      optionId,
      label: option.label,
      promptFragments: option.promptFragments,
    };
    const newLockedDimensions = [...session.lockedDimensions, locked];

    // Get next dimension
    const nextDimension = getNextDimension(dimension);

    // If next is camera_motion, we're done with image generation
    if (!nextDimension || nextDimension.type === 'camera_motion') {
      await this.sessions.update(session.id, {
        lockedDimensions: newLockedDimensions,
        currentDimension: 'camera_motion',
      });

      return {
        sessionId: session.id,
        images: [],
        currentDimension: 'camera_motion',
        lockedDimensions: newLockedDimensions,
      };
    }

    // Generate next dimension options
    const images = await this.generateDimensionOptions(
      session.intent,
      session.direction!,
      newLockedDimensions,
      nextDimension
    );

    await this.sessions.update(session.id, {
      lockedDimensions: newLockedDimensions,
      generatedImages: [...session.generatedImages, ...images],
      currentDimension: nextDimension.type,
    });

    return {
      sessionId: session.id,
      images,
      currentDimension: nextDimension.type,
      lockedDimensions: newLockedDimensions,
      options: nextDimension.options.map(o => ({ id: o.id, label: o.label })),
    };
  }

  private async generateDimensionOptions(
    intent: string,
    direction: Direction,
    lockedDimensions: LockedDimension[],
    dimension: { type: string; options: Array<{ id: string; label: string; promptFragments: string[] }> }
  ): Promise<GeneratedImage[]> {
    const prompts = dimension.options.map(option => ({
      prompt: this.promptBuilder.buildDimensionPreviewPrompt(
        intent,
        direction,
        lockedDimensions,
        { type: dimension.type, optionId: option.id, fragments: option.promptFragments }
      ),
      dimension: dimension.type as DimensionType,
      optionId: option.id,
    }));

    return this.generateImagesParallel(prompts, 'system');
  }

  private async generateImagesParallel(
    prompts: Array<{ prompt: string; dimension: DimensionType | 'direction'; optionId: string }>,
    userId: string
  ): Promise<GeneratedImage[]> {
    const results = await Promise.all(
      prompts.map(async ({ prompt, dimension, optionId }) => {
        try {
          const result = await this.imageGen.generatePreview(prompt, { userId });
          return {
            id: uuidv4(),
            url: result.imageUrl,
            dimension,
            optionId,
            prompt,
            generatedAt: new Date(),
          };
        } catch (error) {
          this.log.error('Failed to generate image', error as Error, { prompt, optionId });
          throw error;
        }
      })
    );

    return results;
  }
}
```

---

## Phase 2: Backend - Depth & Camera Motion

### 2.1 Depth Estimation Service

**File:** `server/src/services/convergence/depth/DepthEstimationService.ts`

```typescript
/**
 * Depth Estimation Service
 * 
 * Uses Depth Anything v2 via Replicate to generate depth maps.
 * 
 * PATTERN: Single responsibility service
 * MAX LINES: 200
 */

import Replicate from 'replicate';
import { logger } from '@infrastructure/Logger';

interface DepthEstimationResult {
  depthMapUrl: string;
  width: number;
  height: number;
}

export class DepthEstimationService {
  private replicate: Replicate | null = null;
  private log = logger.child({ service: 'DepthEstimationService' });

  constructor() {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (apiToken) {
      this.replicate = new Replicate({ auth: apiToken });
    } else {
      this.log.warn('REPLICATE_API_TOKEN not configured, depth estimation disabled');
    }
  }

  /**
   * Estimate depth from an image URL
   */
  async estimateDepth(imageUrl: string): Promise<string> {
    if (!this.replicate) {
      throw new Error('Depth estimation not configured');
    }

    this.log.info('Estimating depth', { imageUrl });

    const output = await this.replicate.run(
      'cjwbw/depth-anything-v2:8a4ed4c4db6b05c8a3e9c8468a8e32c6eda832ce96c37ce787d6b65daf51d19c',
      {
        input: {
          image: imageUrl,
        },
      }
    );

    // Output is a URL to the depth map image
    const depthMapUrl = output as string;
    
    this.log.info('Depth estimation complete', { depthMapUrl });

    return depthMapUrl;
  }

  /**
   * Check if depth estimation is available
   */
  isAvailable(): boolean {
    return this.replicate !== null;
  }
}
```

### 2.2 Camera Paths Data

**File:** `server/src/services/convergence/camera-motion/CameraPaths.ts`

```typescript
/**
 * Camera Paths - Predefined camera motion paths for Three.js rendering
 * 
 * These paths are used client-side to animate the camera through
 * the depth-displaced mesh.
 * 
 * Coordinate system:
 * - x: horizontal (negative = left, positive = right)
 * - y: vertical (negative = down, positive = up)
 * - z: depth (negative = away, positive = toward viewer)
 * 
 * PATTERN: Data file (no logic)
 */

import type { CameraPath } from '../types';

export const CAMERA_PATHS: CameraPath[] = [
  {
    id: 'static',
    label: 'Static',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 0, y: 0, z: 0 },
    duration: 3,
  },
  {
    id: 'pan_left',
    label: 'Pan Left',
    start: { x: 0.15, y: 0, z: 0 },
    end: { x: -0.15, y: 0, z: 0 },
    duration: 3,
  },
  {
    id: 'pan_right',
    label: 'Pan Right',
    start: { x: -0.15, y: 0, z: 0 },
    end: { x: 0.15, y: 0, z: 0 },
    duration: 3,
  },
  {
    id: 'push_in',
    label: 'Push In',
    start: { x: 0, y: 0, z: -0.1 },
    end: { x: 0, y: 0, z: 0.25 },
    duration: 3,
  },
  {
    id: 'pull_back',
    label: 'Pull Back',
    start: { x: 0, y: 0, z: 0.2 },
    end: { x: 0, y: 0, z: -0.15 },
    duration: 3,
  },
  {
    id: 'crane_up',
    label: 'Crane Up',
    start: { x: 0, y: -0.1, z: 0 },
    end: { x: 0, y: 0.15, z: 0.05 },
    duration: 3,
  },
  {
    id: 'crane_down',
    label: 'Crane Down',
    start: { x: 0, y: 0.15, z: 0 },
    end: { x: 0, y: -0.1, z: 0.05 },
    duration: 3,
  },
  {
    id: 'orbit_left',
    label: 'Orbit Left',
    start: { x: 0.1, y: 0, z: 0 },
    end: { x: -0.1, y: 0, z: 0.1 },
    duration: 3,
  },
];
```

---

## Phase 3: Frontend - Convergence Flow

### 3.1 Types

**File:** `client/src/features/convergence/types.ts`

```typescript
/**
 * Convergence Feature Types
 */

export type Direction = 'cinematic' | 'social' | 'artistic' | 'documentary';

export type DimensionType = 'mood' | 'framing' | 'lighting' | 'camera_motion';

export type ConvergenceStep = 
  | 'intent'
  | 'direction'
  | 'mood'
  | 'framing'
  | 'lighting'
  | 'camera_motion'
  | 'subject_motion'
  | 'preview'
  | 'complete';

export interface GeneratedImage {
  id: string;
  url: string;
  dimension: DimensionType | 'direction';
  optionId: string;
  prompt: string;
}

export interface LockedDimension {
  type: DimensionType;
  optionId: string;
  label: string;
}

export interface CameraPath {
  id: string;
  label: string;
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  duration: number;
}

export interface ConvergenceState {
  sessionId: string | null;
  step: ConvergenceStep;
  intent: string;
  direction: Direction | null;
  lockedDimensions: LockedDimension[];
  currentImages: GeneratedImage[];
  currentOptions: Array<{ id: string; label: string }>;
  depthMapUrl: string | null;
  cameraPaths: CameraPath[];
  selectedCameraMotion: string | null;
  subjectMotion: string;
  subjectMotionVideoUrl: string | null;
  finalPrompt: string | null;
  isLoading: boolean;
  error: string | null;
}

export type ConvergenceAction =
  | { type: 'SET_INTENT'; payload: string }
  | { type: 'START_SESSION_REQUEST' }
  | { type: 'START_SESSION_SUCCESS'; payload: { sessionId: string; images: GeneratedImage[]; options: Array<{ id: string; label: string }> } }
  | { type: 'START_SESSION_FAILURE'; payload: string }
  | { type: 'SELECT_OPTION_REQUEST' }
  | { type: 'SELECT_OPTION_SUCCESS'; payload: { step: ConvergenceStep; images: GeneratedImage[]; options: Array<{ id: string; label: string }>; lockedDimensions: LockedDimension[] } }
  | { type: 'SELECT_OPTION_FAILURE'; payload: string }
  | { type: 'SET_DIRECTION'; payload: Direction }
  | { type: 'CAMERA_MOTION_READY'; payload: { depthMapUrl: string; cameraPaths: CameraPath[] } }
  | { type: 'SELECT_CAMERA_MOTION'; payload: string }
  | { type: 'SET_SUBJECT_MOTION'; payload: string }
  | { type: 'SUBJECT_MOTION_PREVIEW_REQUEST' }
  | { type: 'SUBJECT_MOTION_PREVIEW_SUCCESS'; payload: { videoUrl: string; prompt: string } }
  | { type: 'SUBJECT_MOTION_PREVIEW_FAILURE'; payload: string }
  | { type: 'FINALIZE_REQUEST' }
  | { type: 'FINALIZE_SUCCESS'; payload: { finalPrompt: string } }
  | { type: 'FINALIZE_FAILURE'; payload: string }
  | { type: 'RESET' };
```

### 3.2 API Layer

**File:** `client/src/features/convergence/api/convergenceApi.ts`

```typescript
/**
 * Convergence API
 * 
 * Centralized API calls for convergence feature.
 * 
 * PATTERN: VideoConceptBuilder api pattern
 * MAX LINES: 150
 */

import type {
  Direction,
  DimensionType,
  GeneratedImage,
  LockedDimension,
  CameraPath,
} from '../types';

const API_BASE = '/api/convergence';

interface StartSessionResponse {
  sessionId: string;
  images: GeneratedImage[];
  options: Array<{ id: string; label: string }>;
}

interface SelectOptionResponse {
  sessionId: string;
  images: GeneratedImage[];
  currentDimension: string;
  lockedDimensions: LockedDimension[];
  options?: Array<{ id: string; label: string }>;
}

interface CameraMotionResponse {
  sessionId: string;
  depthMapUrl: string;
  cameraPaths: CameraPath[];
}

interface SubjectMotionResponse {
  sessionId: string;
  videoUrl: string;
  prompt: string;
}

interface FinalizeResponse {
  sessionId: string;
  finalPrompt: string;
  lockedDimensions: LockedDimension[];
  previewImageUrl: string;
  cameraMotion: string;
  subjectMotion: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }
  return response.json();
}

export const convergenceApi = {
  async startSession(intent: string): Promise<StartSessionResponse> {
    const response = await fetch(`${API_BASE}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent }),
    });
    return handleResponse(response);
  },

  async selectOption(
    sessionId: string,
    dimension: DimensionType | 'direction',
    optionId: string
  ): Promise<SelectOptionResponse> {
    const response = await fetch(`${API_BASE}/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, dimension, optionId }),
    });
    return handleResponse(response);
  },

  async generateCameraMotion(sessionId: string): Promise<CameraMotionResponse> {
    const response = await fetch(`${API_BASE}/camera-motion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    return handleResponse(response);
  },

  async selectCameraMotion(sessionId: string, cameraMotionId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/camera-motion/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, cameraMotionId }),
    });
    return handleResponse(response);
  },

  async generateSubjectMotion(
    sessionId: string,
    subjectMotion: string
  ): Promise<SubjectMotionResponse> {
    const response = await fetch(`${API_BASE}/subject-motion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, subjectMotion }),
    });
    return handleResponse(response);
  },

  async finalize(sessionId: string): Promise<FinalizeResponse> {
    const response = await fetch(`${API_BASE}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    return handleResponse(response);
  },
};
```

### 3.3 State Hook

**File:** `client/src/features/convergence/hooks/useConvergenceSession.ts`

```typescript
/**
 * useConvergenceSession - State management for convergence flow
 * 
 * PATTERN: useVideoConceptState pattern (useReducer)
 * MAX LINES: 200
 */

import { useReducer, useCallback } from 'react';
import type {
  ConvergenceState,
  ConvergenceAction,
  ConvergenceStep,
  Direction,
  DimensionType,
} from '../types';
import { convergenceApi } from '../api/convergenceApi';

const initialState: ConvergenceState = {
  sessionId: null,
  step: 'intent',
  intent: '',
  direction: null,
  lockedDimensions: [],
  currentImages: [],
  currentOptions: [],
  depthMapUrl: null,
  cameraPaths: [],
  selectedCameraMotion: null,
  subjectMotion: '',
  subjectMotionVideoUrl: null,
  finalPrompt: null,
  isLoading: false,
  error: null,
};

function getNextStep(currentDimension: string): ConvergenceStep {
  const stepMap: Record<string, ConvergenceStep> = {
    direction: 'direction',
    mood: 'mood',
    framing: 'framing',
    lighting: 'lighting',
    camera_motion: 'camera_motion',
    subject_motion: 'subject_motion',
    complete: 'preview',
  };
  return stepMap[currentDimension] || 'intent';
}

function reducer(state: ConvergenceState, action: ConvergenceAction): ConvergenceState {
  switch (action.type) {
    case 'SET_INTENT':
      return { ...state, intent: action.payload };

    case 'START_SESSION_REQUEST':
      return { ...state, isLoading: true, error: null };

    case 'START_SESSION_SUCCESS':
      return {
        ...state,
        isLoading: false,
        sessionId: action.payload.sessionId,
        currentImages: action.payload.images,
        currentOptions: action.payload.options,
        step: 'direction',
      };

    case 'START_SESSION_FAILURE':
      return { ...state, isLoading: false, error: action.payload };

    case 'SELECT_OPTION_REQUEST':
      return { ...state, isLoading: true, error: null };

    case 'SELECT_OPTION_SUCCESS':
      return {
        ...state,
        isLoading: false,
        step: action.payload.step,
        currentImages: action.payload.images,
        currentOptions: action.payload.options,
        lockedDimensions: action.payload.lockedDimensions,
      };

    case 'SELECT_OPTION_FAILURE':
      return { ...state, isLoading: false, error: action.payload };

    case 'SET_DIRECTION':
      return { ...state, direction: action.payload };

    case 'CAMERA_MOTION_READY':
      return {
        ...state,
        isLoading: false,
        depthMapUrl: action.payload.depthMapUrl,
        cameraPaths: action.payload.cameraPaths,
        step: 'camera_motion',
      };

    case 'SELECT_CAMERA_MOTION':
      return {
        ...state,
        selectedCameraMotion: action.payload,
        step: 'subject_motion',
      };

    case 'SET_SUBJECT_MOTION':
      return { ...state, subjectMotion: action.payload };

    case 'SUBJECT_MOTION_PREVIEW_REQUEST':
      return { ...state, isLoading: true, error: null };

    case 'SUBJECT_MOTION_PREVIEW_SUCCESS':
      return {
        ...state,
        isLoading: false,
        subjectMotionVideoUrl: action.payload.videoUrl,
        finalPrompt: action.payload.prompt,
        step: 'preview',
      };

    case 'SUBJECT_MOTION_PREVIEW_FAILURE':
      return { ...state, isLoading: false, error: action.payload };

    case 'FINALIZE_REQUEST':
      return { ...state, isLoading: true, error: null };

    case 'FINALIZE_SUCCESS':
      return {
        ...state,
        isLoading: false,
        finalPrompt: action.payload.finalPrompt,
        step: 'complete',
      };

    case 'FINALIZE_FAILURE':
      return { ...state, isLoading: false, error: action.payload };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

export function useConvergenceSession() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setIntent = useCallback((intent: string) => {
    dispatch({ type: 'SET_INTENT', payload: intent });
  }, []);

  const startSession = useCallback(async (intent: string) => {
    dispatch({ type: 'START_SESSION_REQUEST' });
    try {
      const result = await convergenceApi.startSession(intent);
      dispatch({ type: 'START_SESSION_SUCCESS', payload: result });
    } catch (error) {
      dispatch({ type: 'START_SESSION_FAILURE', payload: (error as Error).message });
    }
  }, []);

  const selectOption = useCallback(async (
    dimension: DimensionType | 'direction',
    optionId: string
  ) => {
    if (!state.sessionId) return;
    
    dispatch({ type: 'SELECT_OPTION_REQUEST' });
    
    if (dimension === 'direction') {
      dispatch({ type: 'SET_DIRECTION', payload: optionId as Direction });
    }
    
    try {
      const result = await convergenceApi.selectOption(state.sessionId, dimension, optionId);
      
      // If we're moving to camera motion, generate depth map
      if (result.currentDimension === 'camera_motion') {
        const cameraResult = await convergenceApi.generateCameraMotion(state.sessionId);
        dispatch({ type: 'CAMERA_MOTION_READY', payload: cameraResult });
      } else {
        dispatch({
          type: 'SELECT_OPTION_SUCCESS',
          payload: {
            step: getNextStep(result.currentDimension),
            images: result.images,
            options: result.options || [],
            lockedDimensions: result.lockedDimensions,
          },
        });
      }
    } catch (error) {
      dispatch({ type: 'SELECT_OPTION_FAILURE', payload: (error as Error).message });
    }
  }, [state.sessionId]);

  const selectCameraMotion = useCallback(async (cameraMotionId: string) => {
    if (!state.sessionId) return;
    
    await convergenceApi.selectCameraMotion(state.sessionId, cameraMotionId);
    dispatch({ type: 'SELECT_CAMERA_MOTION', payload: cameraMotionId });
  }, [state.sessionId]);

  const setSubjectMotion = useCallback((motion: string) => {
    dispatch({ type: 'SET_SUBJECT_MOTION', payload: motion });
  }, []);

  const generateSubjectMotionPreview = useCallback(async () => {
    if (!state.sessionId || !state.subjectMotion) return;
    
    dispatch({ type: 'SUBJECT_MOTION_PREVIEW_REQUEST' });
    try {
      const result = await convergenceApi.generateSubjectMotion(
        state.sessionId,
        state.subjectMotion
      );
      dispatch({ type: 'SUBJECT_MOTION_PREVIEW_SUCCESS', payload: result });
    } catch (error) {
      dispatch({ type: 'SUBJECT_MOTION_PREVIEW_FAILURE', payload: (error as Error).message });
    }
  }, [state.sessionId, state.subjectMotion]);

  const finalize = useCallback(async () => {
    if (!state.sessionId) return;
    
    dispatch({ type: 'FINALIZE_REQUEST' });
    try {
      const result = await convergenceApi.finalize(state.sessionId);
      dispatch({ type: 'FINALIZE_SUCCESS', payload: result });
      return result;
    } catch (error) {
      dispatch({ type: 'FINALIZE_FAILURE', payload: (error as Error).message });
      return null;
    }
  }, [state.sessionId]);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    actions: {
      setIntent,
      startSession,
      selectOption,
      selectCameraMotion,
      setSubjectMotion,
      generateSubjectMotionPreview,
      finalize,
      reset,
    },
  };
}
```

### 3.4 Main Orchestrator Component

**File:** `client/src/features/convergence/ConvergenceFlow.tsx`

```typescript
/**
 * ConvergenceFlow - Main orchestrator for visual convergence
 * 
 * PATTERN: VideoConceptBuilder (orchestrator)
 * MAX LINES: 500
 */

import React from 'react';
import { useConvergenceSession } from './hooks/useConvergenceSession';
import { IntentInput } from './components/IntentInput';
import { DirectionFork } from './components/DirectionFork';
import { DimensionSelector } from './components/DimensionSelector';
import { CameraMotionPicker } from './components/CameraMotionPicker';
import { SubjectMotionInput } from './components/SubjectMotionInput';
import { ConvergencePreview } from './components/ConvergencePreview';
import { ProgressIndicator } from './components/ProgressIndicator';

const STEP_ORDER = ['intent', 'direction', 'mood', 'framing', 'lighting', 'camera_motion', 'subject_motion', 'preview'] as const;

export function ConvergenceFlow(): React.ReactElement {
  const { state, actions } = useConvergenceSession();

  const currentStepIndex = STEP_ORDER.indexOf(state.step as typeof STEP_ORDER[number]);

  const handleIntentSubmit = async (intent: string) => {
    await actions.startSession(intent);
  };

  const handleDirectionSelect = async (direction: string) => {
    await actions.selectOption('direction', direction);
  };

  const handleDimensionSelect = async (optionId: string) => {
    const dimensionMap: Record<string, 'mood' | 'framing' | 'lighting'> = {
      mood: 'mood',
      framing: 'framing',
      lighting: 'lighting',
    };
    const dimension = dimensionMap[state.step];
    if (dimension) {
      await actions.selectOption(dimension, optionId);
    }
  };

  const handleCameraMotionSelect = async (motionId: string) => {
    await actions.selectCameraMotion(motionId);
  };

  const handleSubjectMotionSubmit = async () => {
    await actions.generateSubjectMotionPreview();
  };

  const handleGenerate = async () => {
    const result = await actions.finalize();
    if (result) {
      // Navigate to generation or open generation modal
      // TODO: Integrate with existing video generation flow
      console.log('Ready to generate:', result);
    }
  };

  const handleReset = () => {
    actions.reset();
  };

  return (
    <div className="flex flex-col h-full bg-app">
      {/* Progress indicator */}
      <ProgressIndicator 
        steps={STEP_ORDER}
        currentStep={currentStepIndex}
        lockedDimensions={state.lockedDimensions}
      />

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-6">
        {state.error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {state.error}
          </div>
        )}

        {/* Step 1: Intent */}
        {state.step === 'intent' && (
          <IntentInput
            value={state.intent}
            onChange={actions.setIntent}
            onSubmit={handleIntentSubmit}
            isLoading={state.isLoading}
          />
        )}

        {/* Step 2: Direction Fork */}
        {state.step === 'direction' && (
          <DirectionFork
            images={state.currentImages}
            options={state.currentOptions}
            onSelect={handleDirectionSelect}
            isLoading={state.isLoading}
          />
        )}

        {/* Steps 3-5: Dimensions (mood, framing, lighting) */}
        {['mood', 'framing', 'lighting'].includes(state.step) && (
          <DimensionSelector
            dimension={state.step as 'mood' | 'framing' | 'lighting'}
            images={state.currentImages}
            options={state.currentOptions}
            lockedDimensions={state.lockedDimensions}
            onSelect={handleDimensionSelect}
            isLoading={state.isLoading}
          />
        )}

        {/* Step 6: Camera Motion */}
        {state.step === 'camera_motion' && state.depthMapUrl && (
          <CameraMotionPicker
            imageUrl={state.currentImages[state.currentImages.length - 1]?.url ?? ''}
            depthMapUrl={state.depthMapUrl}
            cameraPaths={state.cameraPaths}
            selectedMotion={state.selectedCameraMotion}
            onSelect={handleCameraMotionSelect}
            isLoading={state.isLoading}
          />
        )}

        {/* Step 7: Subject Motion */}
        {state.step === 'subject_motion' && (
          <SubjectMotionInput
            value={state.subjectMotion}
            onChange={actions.setSubjectMotion}
            onSubmit={handleSubjectMotionSubmit}
            videoUrl={state.subjectMotionVideoUrl}
            isLoading={state.isLoading}
          />
        )}

        {/* Step 8: Preview */}
        {state.step === 'preview' && (
          <ConvergencePreview
            videoUrl={state.subjectMotionVideoUrl}
            finalPrompt={state.finalPrompt}
            lockedDimensions={state.lockedDimensions}
            cameraMotion={state.selectedCameraMotion}
            subjectMotion={state.subjectMotion}
            onGenerate={handleGenerate}
            onReset={handleReset}
            isLoading={state.isLoading}
          />
        )}
      </div>
    </div>
  );
}

export default ConvergenceFlow;
```

---

## Phase 4: Frontend - Camera Motion Renderer

### 4.1 Three.js Camera Motion Renderer

**File:** `client/src/features/convergence/utils/cameraMotionRenderer.ts`

```typescript
/**
 * Camera Motion Renderer
 * 
 * Uses Three.js to create depth-based parallax videos from a single image.
 * 
 * PATTERN: Utility module
 */

import * as THREE from 'three';

export interface CameraPath {
  id: string;
  label: string;
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  duration: number;
}

export interface RenderOptions {
  width?: number;
  height?: number;
  fps?: number;
  displacementScale?: number;
}

const VERTEX_SHADER = `
  uniform sampler2D depthMap;
  uniform float displacementScale;
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    
    // Sample depth and displace
    float depth = texture2D(depthMap, uv).r;
    vec3 displaced = position + normal * depth * displacementScale;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform sampler2D colorMap;
  varying vec2 vUv;
  
  void main() {
    gl_FragColor = texture2D(colorMap, vUv);
  }
`;

/**
 * Load an image as a Three.js texture
 */
async function loadTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    loader.load(url, resolve, undefined, reject);
  });
}

/**
 * Interpolate camera position along path
 */
function interpolatePosition(
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
  t: number
): THREE.Vector3 {
  // Use ease-in-out for smoother motion
  const eased = t < 0.5
    ? 2 * t * t
    : 1 - Math.pow(-2 * t + 2, 2) / 2;
  
  return new THREE.Vector3(
    start.x + (end.x - start.x) * eased,
    start.y + (end.y - start.y) * eased,
    start.z + (end.z - start.z) * eased
  );
}

/**
 * Render camera motion to frames
 */
export async function renderCameraMotion(
  imageUrl: string,
  depthMapUrl: string,
  cameraPath: CameraPath,
  options: RenderOptions = {}
): Promise<string[]> {
  const {
    width = 512,
    height = 288,
    fps = 24,
    displacementScale = 0.3,
  } = options;

  // Load textures
  const [colorMap, depthMap] = await Promise.all([
    loadTexture(imageUrl),
    loadTexture(depthMapUrl),
  ]);

  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // Create camera
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
  camera.position.set(0, 0, 2);

  // Create renderer
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(width, height);

  // Create displacement mesh
  const geometry = new THREE.PlaneGeometry(3.2, 1.8, 128, 128);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      colorMap: { value: colorMap },
      depthMap: { value: depthMap },
      displacementScale: { value: displacementScale },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Calculate frames
  const totalFrames = Math.ceil(cameraPath.duration * fps);
  const frames: string[] = [];

  for (let i = 0; i < totalFrames; i++) {
    const t = i / (totalFrames - 1);
    
    // Update camera position
    const pos = interpolatePosition(cameraPath.start, cameraPath.end, t);
    camera.position.set(pos.x, pos.y, 2 + pos.z);
    camera.lookAt(0, 0, 0);

    // Render frame
    renderer.render(scene, camera);
    
    // Capture as data URL
    const dataUrl = renderer.domElement.toDataURL('image/jpeg', 0.85);
    frames.push(dataUrl);
  }

  // Cleanup
  geometry.dispose();
  material.dispose();
  colorMap.dispose();
  depthMap.dispose();
  renderer.dispose();

  return frames;
}

/**
 * Render camera motion preview (returns video blob)
 */
export async function renderCameraMotionVideo(
  imageUrl: string,
  depthMapUrl: string,
  cameraPath: CameraPath,
  options: RenderOptions = {}
): Promise<Blob> {
  const frames = await renderCameraMotion(imageUrl, depthMapUrl, cameraPath, options);
  return encodeFramesToVideo(frames, options.fps ?? 24);
}

/**
 * Encode frames to video using MediaRecorder
 */
async function encodeFramesToVideo(frames: string[], fps: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  // Get dimensions from first frame
  const firstImg = await loadImage(frames[0]);
  canvas.width = firstImg.width;
  canvas.height = firstImg.height;

  // Create video stream
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 2500000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  // Start recording
  recorder.start();

  // Draw frames
  const frameInterval = 1000 / fps;
  for (let i = 0; i < frames.length; i++) {
    const img = await loadImage(frames[i]);
    ctx.drawImage(img, 0, 0);
    await sleep(frameInterval);
  }

  // Stop recording and return blob
  return new Promise((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };
    recorder.stop();
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 4.2 Camera Motion Picker Component

**File:** `client/src/features/convergence/components/CameraMotionPicker.tsx`

```typescript
/**
 * CameraMotionPicker - Select camera motion with live previews
 * 
 * Renders depth-based parallax previews for each camera motion option.
 * 
 * PATTERN: UI Component
 * MAX LINES: 200
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, Check } from 'lucide-react';
import type { CameraPath } from '../types';
import { renderCameraMotion } from '../utils/cameraMotionRenderer';

interface CameraMotionPickerProps {
  imageUrl: string;
  depthMapUrl: string;
  cameraPaths: CameraPath[];
  selectedMotion: string | null;
  onSelect: (motionId: string) => void;
  isLoading: boolean;
}

interface MotionPreview {
  id: string;
  frames: string[];
  isRendering: boolean;
}

export function CameraMotionPicker({
  imageUrl,
  depthMapUrl,
  cameraPaths,
  selectedMotion,
  onSelect,
  isLoading,
}: CameraMotionPickerProps): React.ReactElement {
  const [previews, setPreviews] = useState<Map<string, MotionPreview>>(new Map());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const animationRef = useRef<number | null>(null);
  const frameIndexRef = useRef(0);

  // Render previews on mount
  useEffect(() => {
    let cancelled = false;

    async function renderPreviews() {
      for (const path of cameraPaths) {
        if (cancelled) break;
        
        setPreviews(prev => new Map(prev).set(path.id, {
          id: path.id,
          frames: [],
          isRendering: true,
        }));

        try {
          const frames = await renderCameraMotion(imageUrl, depthMapUrl, path, {
            width: 320,
            height: 180,
            fps: 15,
          });
          
          if (!cancelled) {
            setPreviews(prev => new Map(prev).set(path.id, {
              id: path.id,
              frames,
              isRendering: false,
            }));
          }
        } catch (error) {
          console.error(`Failed to render ${path.id}:`, error);
        }
      }
    }

    renderPreviews();

    return () => {
      cancelled = true;
    };
  }, [imageUrl, depthMapUrl, cameraPaths]);

  // Animation loop for playing preview
  useEffect(() => {
    if (!playingId) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const preview = previews.get(playingId);
    if (!preview || preview.frames.length === 0) return;

    let lastTime = 0;
    const frameDuration = 1000 / 15; // 15fps

    function animate(time: number) {
      if (time - lastTime >= frameDuration) {
        frameIndexRef.current = (frameIndexRef.current + 1) % preview!.frames.length;
        lastTime = time;
      }
      animationRef.current = requestAnimationFrame(animate);
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [playingId, previews]);

  const handleSelect = (motionId: string) => {
    onSelect(motionId);
  };

  const handleHover = (motionId: string | null) => {
    setPlayingId(motionId);
    frameIndexRef.current = 0;
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-foreground">
          How should the camera move?
        </h2>
        <p className="mt-2 text-muted">
          Hover to preview, click to select
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cameraPaths.map((path) => {
          const preview = previews.get(path.id);
          const isSelected = selectedMotion === path.id;
          const isPlaying = playingId === path.id;
          const currentFrame = isPlaying && preview?.frames.length
            ? preview.frames[frameIndexRef.current % preview.frames.length]
            : preview?.frames[0];

          return (
            <button
              key={path.id}
              onClick={() => handleSelect(path.id)}
              onMouseEnter={() => handleHover(path.id)}
              onMouseLeave={() => handleHover(null)}
              disabled={isLoading || preview?.isRendering}
              className={`
                relative aspect-video rounded-lg overflow-hidden border-2 transition-all
                ${isSelected 
                  ? 'border-violet-500 ring-2 ring-violet-500/30' 
                  : 'border-border hover:border-violet-500/50'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Preview image/animation */}
              {preview?.isRendering ? (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-1">
                  <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : currentFrame ? (
                <img
                  src={currentFrame}
                  alt={path.label}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-surface-1" />
              )}

              {/* Label overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">
                    {path.label}
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4 text-violet-400" />
                  )}
                  {!isSelected && isPlaying && (
                    <Play className="w-4 h-4 text-white/70" />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedMotion && (
        <div className="text-center">
          <p className="text-sm text-muted">
            Selected: <span className="text-foreground font-medium">
              {cameraPaths.find(p => p.id === selectedMotion)?.label}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## Phase 5: Integration & Polish

### 5.1 Routes Setup

**File:** `server/src/routes/convergence/convergence.routes.ts`

```typescript
/**
 * Convergence Routes
 */

import { Router } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import type { ConvergenceService } from '@services/convergence';
import {
  createStartSessionHandler,
  createSelectOptionHandler,
  createGenerateCameraMotionHandler,
  createSelectCameraMotionHandler,
  createGenerateSubjectMotionHandler,
  createFinalizeHandler,
} from './handlers';

interface ConvergenceRouteDeps {
  convergenceService: ConvergenceService;
}

export function createConvergenceRoutes(deps: ConvergenceRouteDeps): Router {
  const router = Router();
  const { convergenceService } = deps;

  router.post('/start', asyncHandler(createStartSessionHandler(convergenceService)));
  router.post('/select', asyncHandler(createSelectOptionHandler(convergenceService)));
  router.post('/camera-motion', asyncHandler(createGenerateCameraMotionHandler(convergenceService)));
  router.post('/camera-motion/select', asyncHandler(createSelectCameraMotionHandler(convergenceService)));
  router.post('/subject-motion', asyncHandler(createGenerateSubjectMotionHandler(convergenceService)));
  router.post('/finalize', asyncHandler(createFinalizeHandler(convergenceService)));

  return router;
}
```

### 5.2 App Integration

**File:** `server/src/app.ts` (additions)

```typescript
// Add to imports
import { createConvergenceRoutes } from '@routes/convergence/convergence.routes';
import { ConvergenceService } from '@services/convergence';
import { SessionStore } from '@services/convergence/session/SessionStore';
import { PromptBuilderService } from '@services/convergence/prompt-builder/PromptBuilderService';
import { DepthEstimationService } from '@services/convergence/depth/DepthEstimationService';

// Add to service initialization
const sessionStore = new SessionStore();
const promptBuilder = new PromptBuilderService();
const depthEstimationService = new DepthEstimationService();

const convergenceService = new ConvergenceService({
  imageGenerationService,
  depthEstimationService,
  sessionStore,
  promptBuilder,
  // videoPreviewService: wanPreviewService, // Connect to existing Wan service
});

// Add to routes
app.use('/api/convergence', createConvergenceRoutes({ convergenceService }));
```

### 5.3 Frontend Route

**File:** `client/src/App.tsx` (additions)

```typescript
// Add import
import { ConvergenceFlow } from '@features/convergence';

// Add route
<Route path="/create" element={<ConvergenceFlow />} />
```

---

## Database Schema

### Firestore Collection: `convergence_sessions`

```typescript
interface ConvergenceSessionDocument {
  id: string;                      // UUID
  userId: string;                  // Firebase Auth UID
  intent: string;                  // Original user input
  direction: Direction | null;     // Selected direction
  lockedDimensions: LockedDimension[];
  currentDimension: string;        // Current step
  generatedImages: GeneratedImage[];
  depthMapUrl: string | null;      // GCS URL to depth map
  cameraMotion: string | null;     // Selected camera motion ID
  subjectMotion: string | null;    // User's subject motion text
  finalPrompt: string | null;      // Complete generated prompt
  status: 'active' | 'completed' | 'abandoned';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Indexes

```
convergence_sessions:
  - userId ASC, status ASC, updatedAt DESC
  - updatedAt ASC, status ASC (for cleanup)
```

---

## API Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/convergence/start` | Start new session with intent |
| POST | `/api/convergence/select` | Select option for current dimension |
| POST | `/api/convergence/camera-motion` | Generate depth map and camera paths |
| POST | `/api/convergence/camera-motion/select` | Lock camera motion selection |
| POST | `/api/convergence/subject-motion` | Generate Wan preview with subject motion |
| POST | `/api/convergence/finalize` | Finalize session and return prompt |

### Request/Response Examples

See types in Phase 1.1 for complete request/response shapes.

---

## Testing Strategy

### Backend Unit Tests

```
server/src/services/convergence/__tests__/
├── ConvergenceService.test.ts
├── PromptBuilderService.test.ts
├── SessionStore.test.ts
└── DepthEstimationService.test.ts
```

### Frontend Unit Tests

```
client/src/features/convergence/__tests__/
├── useConvergenceSession.test.ts
├── convergenceApi.test.ts
└── cameraMotionRenderer.test.ts
```

### Integration Tests

```
tests/integration/
└── convergence.integration.test.ts
```

### Test Coverage Targets

| Component | Target |
|-----------|--------|
| ConvergenceService | 80% |
| PromptBuilderService | 90% |
| SessionStore | 80% |
| useConvergenceSession | 85% |
| cameraMotionRenderer | 70% |

---

## Implementation Order

### Week 1: Backend Core
1. [ ] Create `server/src/services/convergence/` directory structure
2. [ ] Implement types (`types.ts`)
3. [ ] Implement SessionStore
4. [ ] Implement DimensionFragments
5. [ ] Implement PromptBuilderService
6. [ ] Implement ConvergenceService (without depth/video)
7. [ ] Add routes
8. [ ] Test with Postman/curl

### Week 2: Depth & Camera Motion
1. [ ] Implement DepthEstimationService
2. [ ] Add CameraPaths data
3. [ ] Test depth estimation endpoint
4. [ ] Create `client/src/features/convergence/` structure
5. [ ] Implement cameraMotionRenderer.ts
6. [ ] Test Three.js rendering in isolation

### Week 3: Frontend Flow
1. [ ] Implement types
2. [ ] Implement convergenceApi
3. [ ] Implement useConvergenceSession
4. [ ] Implement IntentInput component
5. [ ] Implement DirectionFork component
6. [ ] Implement DimensionSelector component
7. [ ] Implement CameraMotionPicker component
8. [ ] Implement SubjectMotionInput component
9. [ ] Implement ConvergencePreview component
10. [ ] Implement ConvergenceFlow orchestrator

### Week 4: Integration & Polish
1. [ ] Connect to existing ImageGenerationService
2. [ ] Connect to existing Wan preview service
3. [ ] Add credits/billing integration
4. [ ] Add loading states and error handling
5. [ ] Add analytics tracking
6. [ ] Write tests
7. [ ] Performance optimization
8. [ ] Mobile responsiveness

### Week 5: Launch Prep
1. [ ] Landing page with `/create` CTA
2. [ ] User onboarding flow
3. [ ] Documentation
4. [ ] Beta user feedback
5. [ ] Bug fixes
6. [ ] Launch

---

## File Checklist

### Backend Files to Create

```
server/src/services/convergence/
├── ConvergenceService.ts ✓
├── types.ts ✓
├── index.ts
├── session/
│   ├── SessionManager.ts
│   ├── SessionStore.ts ✓
│   └── types.ts
├── prompt-builder/
│   ├── PromptBuilderService.ts ✓
│   ├── DimensionFragments.ts ✓
│   └── types.ts
├── depth/
│   ├── DepthEstimationService.ts ✓
│   └── types.ts
└── camera-motion/
    ├── CameraMotionService.ts
    └── CameraPaths.ts ✓

server/src/routes/convergence/
├── convergence.routes.ts ✓
├── handlers/
│   ├── startSession.ts
│   ├── selectOption.ts
│   ├── generateCameraMotion.ts
│   ├── selectCameraMotion.ts
│   ├── generateSubjectMotion.ts
│   └── finalizeSession.ts
└── types.ts
```

### Frontend Files to Create

```
client/src/features/convergence/
├── ConvergenceFlow.tsx ✓
├── index.ts
├── types.ts ✓
├── hooks/
│   ├── useConvergenceSession.ts ✓
│   ├── useImageGeneration.ts
│   └── useCameraMotionRenderer.ts
├── api/
│   └── convergenceApi.ts ✓
├── components/
│   ├── IntentInput.tsx
│   ├── DirectionFork.tsx
│   ├── DimensionSelector.tsx
│   ├── CameraMotionPicker.tsx ✓
│   ├── SubjectMotionInput.tsx
│   ├── ConvergencePreview.tsx
│   ├── ProgressIndicator.tsx
│   └── ImageOption.tsx
├── utils/
│   ├── cameraMotionRenderer.ts ✓
│   └── videoEncoder.ts
└── config/
    ├── dimensions.ts
    ├── directions.ts
    └── cameraMotions.ts
```

---

## Notes for AI Coding Tools

### Architecture Patterns

- **Backend services**: Follow `PromptOptimizationService` pattern (orchestrator max 500 lines, specialized services max 300 lines)
- **Frontend components**: Follow `VideoConceptBuilder` pattern (orchestrator max 500 lines, UI components max 200 lines)
- **State management**: Use `useReducer` pattern from `useVideoConceptState`
- **API layer**: Centralize in `api/` folder, no inline fetch calls

### Existing Code to Reference

- `server/src/services/image-generation/ImageGenerationService.ts` - Image generation pattern
- `server/src/services/video-generation/VideoGenerationService.ts` - Video generation pattern
- `client/src/components/VideoConceptBuilder/` - Frontend architecture
- `shared/taxonomy.ts` - Category definitions

### Environment Variables Needed

```env
# Already exists
REPLICATE_API_TOKEN=r8_...

# No new variables needed
```

### Dependencies to Add

```bash
# Frontend (if not already present)
npm install three @types/three

# Backend (already present)
# replicate, uuid, etc.
```

---

This plan is ready for implementation. Start with Phase 1 and work through sequentially. Each phase builds on the previous one.
