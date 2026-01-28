# Image-to-Video Prompt Decomposer/Optimizer Implementation Plan

> **Goal:** Build an image-aware optimization pipeline that respects the visual ground truth of a source image, only allowing motion-compatible prompt optimizations for i2v generation.

---

## Table of Contents

1. [Problem Analysis](#problem-analysis)
2. [Architecture Overview](#architecture-overview)
3. [Phase 1: ImageAnalysisService](#phase-1-imageanalysisservice)
4. [Phase 2: I2V Optimization Strategy](#phase-2-i2v-optimization-strategy)
5. [Phase 3: Constrained Enhancement Service](#phase-3-constrained-enhancement-service)
6. [Phase 4: Frontend Integration](#phase-4-frontend-integration)
7. [Phase 5: Span Labeling Adaptations](#phase-5-span-labeling-adaptations)
8. [API Reference](#api-reference)
9. [Testing Strategy](#testing-strategy)
10. [Implementation Checklist](#implementation-checklist)

---

## Problem Analysis

### The Core Issue

The current `PromptOptimizationService` assumes **creative freedom** - it can freely suggest any subject, framing, lighting, or camera angle because in text-to-video (t2v), everything is generated from scratch.

In image-to-video (i2v), **the image is ground truth**. The optimizer might currently suggest:

| Optimizer Suggestion | Image Reality | Result |
|---------------------|---------------|--------|
| "Wide establishing shot" | Close-up portrait | ❌ Conflict |
| "Golden hour backlight" | Flat overcast lighting | ❌ Conflict |
| "A woman in her 30s" | Elderly man | ❌ Conflict |
| "Camera pans left" | Subject at frame edge | ⚠️ May break framing |

**The prompt should describe motion, not re-describe the scene.**

### Current Flow (Broken for i2v)

```
User Prompt → PromptOptimizationService → Optimized Prompt → Video Generation
                     ↑
                     NO awareness of source image
```

### Desired Flow (i2v-aware)

```
Source Image → ImageAnalysisService → VisualGroundTruth
                                            ↓
User Prompt → I2VOptimizationService → Motion-Focused Prompt → Video Generation
                     ↑
              Constrained by VisualGroundTruth
```

---

## Architecture Overview

### New Services

```
server/src/services/
├── image-analysis/
│   ├── ImageAnalysisService.ts          # Main orchestrator (max 400 lines)
│   ├── types.ts                          # Type definitions
│   ├── index.ts                          # Exports
│   │
│   ├── extractors/
│   │   ├── SubjectExtractor.ts           # Extract subject details (max 200 lines)
│   │   ├── FramingExtractor.ts           # Extract shot type/angle (max 200 lines)
│   │   ├── LightingExtractor.ts          # Extract lighting conditions (max 200 lines)
│   │   ├── EnvironmentExtractor.ts       # Extract environment/setting (max 200 lines)
│   │   └── CompositionExtractor.ts       # Extract composition details (max 200 lines)
│   │
│   ├── templates/
│   │   ├── image-analysis-prompt.md      # Main analysis prompt
│   │   └── motion-compatibility-prompt.md # Motion suggestion prompt
│   │
│   └── cache/
│       └── ImageAnalysisCache.ts         # Cache by image hash (max 150 lines)
│
└── prompt-optimization/
    ├── strategies/
    │   └── ImageToVideoStrategy.ts       # NEW: i2v-specific strategy (max 400 lines)
    │
    └── services/
        └── I2VPromptBuilderService.ts    # NEW: Motion-focused prompt builder (max 300 lines)
```

### Modified Services

```
server/src/services/
├── prompt-optimization/
│   ├── PromptOptimizationService.ts      # Add i2v detection and routing
│   └── services/
│       └── StrategyFactory.ts            # Add ImageToVideoStrategy
│
├── enhancement/
│   └── EnhancementService.ts             # Constrain suggestions by ground truth
│
└── video-generation/
    └── workflows/
        └── generateVideo.ts              # Pass ground truth through pipeline
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           I2V OPTIMIZATION PIPELINE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    ┌─────────────────────┐    ┌────────────────────────┐     │
│  │  Source  │───▶│ ImageAnalysisService │───▶│   VisualGroundTruth    │     │
│  │  Image   │    │                     │    │                        │     │
│  └──────────┘    │ • Vision LLM call   │    │ • subject: {...}       │     │
│                  │ • Cache by hash     │    │ • framing: {...}       │     │
│                  │ • Extract 5 dims    │    │ • lighting: {...}      │     │
│                  └─────────────────────┘    │ • environment: {...}   │     │
│                                             │ • motionHints: [...]   │     │
│                                             └───────────┬────────────┘     │
│                                                         │                  │
│  ┌──────────┐    ┌─────────────────────┐               │                  │
│  │  User    │───▶│ I2VOptimization     │◀──────────────┘                  │
│  │  Prompt  │    │ Strategy            │                                   │
│  └──────────┘    │                     │    ┌────────────────────────┐     │
│                  │ • Strip conflicts   │───▶│  Motion-Focused Prompt │     │
│                  │ • Expand motion     │    │                        │     │
│                  │ • Add camera hints  │    │ "she slowly turns her  │     │
│                  │ • Preserve intent   │    │  head, camera dollies  │     │
│                  └─────────────────────┘    │  in gently..."         │     │
│                                             └────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: ImageAnalysisService

### 1.1 Types Definition

**File:** `server/src/services/image-analysis/types.ts`

```typescript
/**
 * Image Analysis Types
 * 
 * Defines the visual ground truth extracted from source images for i2v.
 */

/**
 * Subject information extracted from image
 */
export interface SubjectAnalysis {
  /** Primary subject description */
  description: string;
  /** Subject type */
  type: 'person' | 'animal' | 'object' | 'landscape' | 'abstract' | 'multiple';
  /** Position in frame */
  position: 'center' | 'left' | 'right' | 'top' | 'bottom' | 'distributed';
  /** Approximate count if multiple subjects */
  count: number;
  /** Physical attributes (age, gender, clothing, etc.) */
  attributes: string[];
  /** Current pose/state */
  pose: string;
  /** Expression/emotion if applicable */
  expression?: string;
}

/**
 * Framing/shot information extracted from image
 */
export interface FramingAnalysis {
  /** Shot type */
  shotType: 'extreme-close-up' | 'close-up' | 'medium-close-up' | 'medium' | 'medium-wide' | 'wide' | 'extreme-wide';
  /** Camera angle */
  angle: 'eye-level' | 'low-angle' | 'high-angle' | 'birds-eye' | 'worms-eye' | 'dutch' | 'over-shoulder';
  /** Approximate focal length feel */
  focalLength: 'wide' | 'normal' | 'telephoto';
  /** Depth of field */
  depthOfField: 'shallow' | 'moderate' | 'deep';
  /** Composition rule */
  composition: 'rule-of-thirds' | 'centered' | 'symmetrical' | 'asymmetrical' | 'leading-lines' | 'framing';
}

/**
 * Lighting information extracted from image
 */
export interface LightingAnalysis {
  /** Overall lighting quality */
  quality: 'natural' | 'artificial' | 'mixed' | 'dramatic' | 'flat';
  /** Primary light direction */
  direction: 'front' | 'side' | 'back' | 'top' | 'bottom' | 'ambient';
  /** Time of day feel */
  timeOfDay: 'golden-hour' | 'blue-hour' | 'midday' | 'night' | 'overcast' | 'indoor';
  /** Contrast level */
  contrast: 'high' | 'medium' | 'low';
  /** Color temperature */
  temperature: 'warm' | 'neutral' | 'cool';
  /** Key lighting style */
  style: 'high-key' | 'low-key' | 'balanced';
}

/**
 * Environment/setting information extracted from image
 */
export interface EnvironmentAnalysis {
  /** Setting type */
  type: 'interior' | 'exterior' | 'studio' | 'abstract';
  /** Specific location description */
  location: string;
  /** Weather/atmosphere if applicable */
  atmosphere?: string;
  /** Key environmental elements */
  elements: string[];
  /** Depth/space description */
  depth: 'shallow' | 'moderate' | 'deep' | 'infinite';
}

/**
 * Color and style analysis
 */
export interface ColorStyleAnalysis {
  /** Dominant colors */
  dominantColors: string[];
  /** Color palette mood */
  paletteMood: 'vibrant' | 'muted' | 'monochromatic' | 'complementary' | 'analogous';
  /** Overall visual style */
  style: 'realistic' | 'cinematic' | 'stylized' | 'vintage' | 'modern' | 'artistic';
  /** Texture quality */
  texture: 'smooth' | 'detailed' | 'grainy' | 'sharp';
}

/**
 * Motion compatibility assessment
 */
export interface MotionCompatibility {
  /** Camera movements that work with this framing */
  compatibleCameraMoves: CameraMoveCompatibility[];
  /** Camera movements to avoid */
  incompatibleCameraMoves: string[];
  /** Suggested subject motions */
  suggestedSubjectMotions: string[];
  /** Motion constraints */
  constraints: string[];
  /** Overall motion potential */
  motionPotential: 'high' | 'medium' | 'low';
}

export interface CameraMoveCompatibility {
  movement: string;
  compatibility: 'excellent' | 'good' | 'possible' | 'risky';
  reason: string;
}

/**
 * Complete visual ground truth extracted from an image
 */
export interface VisualGroundTruth {
  /** Image hash for caching */
  imageHash: string;
  /** Analysis timestamp */
  analyzedAt: Date;
  /** Source image URL */
  sourceUrl: string;
  
  /** Extracted analyses */
  subject: SubjectAnalysis;
  framing: FramingAnalysis;
  lighting: LightingAnalysis;
  environment: EnvironmentAnalysis;
  colorStyle: ColorStyleAnalysis;
  
  /** Motion compatibility */
  motion: MotionCompatibility;
  
  /** Raw description for prompt prefix */
  sceneDescription: string;
  
  /** Confidence scores */
  confidence: {
    overall: number;
    subject: number;
    framing: number;
    lighting: number;
    environment: number;
  };
}

/**
 * Categories that are "locked" by the image (cannot be changed)
 */
export type LockedCategory = 
  | 'subject.identity'
  | 'subject.appearance'
  | 'subject.position'
  | 'shot.type'
  | 'shot.angle'
  | 'lighting.quality'
  | 'lighting.direction'
  | 'environment.type'
  | 'environment.location'
  | 'color.palette';

/**
 * Categories that are "free" (can be influenced by prompt)
 */
export type FreeCategory =
  | 'action.movement'
  | 'action.gesture'
  | 'camera.movement'
  | 'camera.speed'
  | 'subject.expression'
  | 'subject.emotion'
  | 'atmosphere.change';

/**
 * Service configuration
 */
export interface ImageAnalysisConfig {
  /** Vision model to use */
  visionModel: 'gpt-4o' | 'gpt-4o-mini' | 'gemini-1.5-pro' | 'gemini-1.5-flash' | 'claude-3-sonnet';
  /** Cache TTL in seconds */
  cacheTtlSeconds: number;
  /** Max concurrent analyses */
  maxConcurrent: number;
  /** Timeout in ms */
  timeoutMs: number;
}

/**
 * Analysis request
 */
export interface ImageAnalysisRequest {
  /** Image URL or base64 */
  image: string;
  /** Whether to include motion compatibility */
  includeMotionAnalysis?: boolean;
  /** Force re-analysis even if cached */
  skipCache?: boolean;
  /** Abort signal */
  signal?: AbortSignal;
}

/**
 * Analysis result
 */
export interface ImageAnalysisResult {
  success: boolean;
  groundTruth?: VisualGroundTruth;
  error?: string;
  cached: boolean;
  analysisTimeMs: number;
}
```

### 1.2 Analysis Prompt Template

**File:** `server/src/services/image-analysis/templates/image-analysis-prompt.md`

```markdown
# Image Analysis for Video Generation

You are an expert cinematographer and visual analyst. Analyze this image to extract precise visual information that will constrain video generation prompts.

## Your Task

Extract factual, observable information from the image. Be specific and precise. Do not interpret or imagine elements that aren't clearly visible.

## Output Format

Respond with ONLY valid JSON matching this structure:

```json
{
  "subject": {
    "description": "Brief description of primary subject",
    "type": "person|animal|object|landscape|abstract|multiple",
    "position": "center|left|right|top|bottom|distributed",
    "count": 1,
    "attributes": ["observable physical attributes"],
    "pose": "current pose/state description",
    "expression": "facial expression if visible"
  },
  "framing": {
    "shotType": "extreme-close-up|close-up|medium-close-up|medium|medium-wide|wide|extreme-wide",
    "angle": "eye-level|low-angle|high-angle|birds-eye|worms-eye|dutch|over-shoulder",
    "focalLength": "wide|normal|telephoto",
    "depthOfField": "shallow|moderate|deep",
    "composition": "rule-of-thirds|centered|symmetrical|asymmetrical|leading-lines|framing"
  },
  "lighting": {
    "quality": "natural|artificial|mixed|dramatic|flat",
    "direction": "front|side|back|top|bottom|ambient",
    "timeOfDay": "golden-hour|blue-hour|midday|night|overcast|indoor",
    "contrast": "high|medium|low",
    "temperature": "warm|neutral|cool",
    "style": "high-key|low-key|balanced"
  },
  "environment": {
    "type": "interior|exterior|studio|abstract",
    "location": "specific location description",
    "atmosphere": "weather/mood if applicable",
    "elements": ["key environmental elements"],
    "depth": "shallow|moderate|deep|infinite"
  },
  "colorStyle": {
    "dominantColors": ["color1", "color2", "color3"],
    "paletteMood": "vibrant|muted|monochromatic|complementary|analogous",
    "style": "realistic|cinematic|stylized|vintage|modern|artistic",
    "texture": "smooth|detailed|grainy|sharp"
  },
  "sceneDescription": "A single sentence describing the complete scene as you see it",
  "confidence": {
    "overall": 0.0-1.0,
    "subject": 0.0-1.0,
    "framing": 0.0-1.0,
    "lighting": 0.0-1.0,
    "environment": 0.0-1.0
  }
}
```

## Guidelines

1. **Be Factual**: Only describe what is clearly visible. If uncertain, lower your confidence score.

2. **Shot Type Reference**:
   - Extreme close-up: Eyes/mouth fill frame
   - Close-up: Face fills frame
   - Medium close-up: Head and shoulders
   - Medium: Waist up
   - Medium-wide: Knees up
   - Wide: Full body with environment
   - Extreme wide: Subject small in vast environment

3. **Lighting Assessment**:
   - Look at shadow direction and hardness
   - Note highlight placement
   - Assess color temperature of light sources

4. **Confidence Scoring**:
   - 0.9-1.0: Crystal clear, no ambiguity
   - 0.7-0.9: Clear with minor uncertainty
   - 0.5-0.7: Reasonably confident but some ambiguity
   - Below 0.5: Significant uncertainty

5. **Scene Description**: Write as if describing to someone who will recreate this exact frame. Include only what's visible.

Remember: This analysis will constrain video generation. Inaccurate analysis leads to prompt conflicts. When in doubt, be conservative.
```

### 1.3 Motion Compatibility Prompt

**File:** `server/src/services/image-analysis/templates/motion-compatibility-prompt.md`

```markdown
# Motion Compatibility Analysis

Given the image analysis below, determine which camera movements and subject motions would work well, and which should be avoided.

## Image Analysis

{{{IMAGE_ANALYSIS}}}

## Your Task

Assess motion compatibility based on:
1. **Framing constraints**: What camera moves break the composition?
2. **Subject position**: What moves risk cutting off the subject?
3. **Depth availability**: Is there space for push/pull moves?
4. **Natural continuation**: What motion feels like a natural extension?

## Output Format

Respond with ONLY valid JSON:

```json
{
  "compatibleCameraMoves": [
    {
      "movement": "dolly in",
      "compatibility": "excellent|good|possible|risky",
      "reason": "why this works or doesn't"
    }
  ],
  "incompatibleCameraMoves": ["movement names to avoid"],
  "suggestedSubjectMotions": [
    "natural motion the subject could perform"
  ],
  "constraints": [
    "specific limitation or consideration"
  ],
  "motionPotential": "high|medium|low"
}
```

## Camera Movement Reference

Consider these movements:
- **Pan (left/right)**: Rotation on vertical axis
- **Tilt (up/down)**: Rotation on horizontal axis
- **Dolly (in/out)**: Physical movement toward/away
- **Truck (left/right)**: Physical lateral movement
- **Crane (up/down)**: Physical vertical movement
- **Zoom (in/out)**: Focal length change (no parallax)
- **Arc (left/right)**: Curved movement around subject
- **Push in**: Slow dolly toward subject
- **Pull back**: Slow dolly away from subject

## Compatibility Levels

- **Excellent**: Movement enhances the shot naturally
- **Good**: Movement works well with minor considerations
- **Possible**: Movement works but requires care
- **Risky**: Movement likely causes problems (subject cutoff, breaking composition)

## Guidelines

1. Close-ups have limited camera move options
2. Centered compositions work with dolly in/out
3. Rule-of-thirds compositions risk cutoff with lateral moves
4. Shallow DOF limits dolly range
5. Consider what's revealed by camera movement
```

### 1.4 ImageAnalysisService Implementation

**File:** `server/src/services/image-analysis/ImageAnalysisService.ts`

```typescript
/**
 * ImageAnalysisService - Extracts visual ground truth from images
 * 
 * Uses vision-capable LLMs to analyze source images and extract
 * structured information that constrains i2v prompt optimization.
 * 
 * PATTERN: PromptOptimizationService (orchestrator)
 * MAX LINES: 400
 */

import { logger } from '@infrastructure/Logger';
import type { ILogger } from '@interfaces/ILogger';
import { hashImageUrl, hashBase64Image } from '@utils/hash';
import { templateService } from './templates/TemplateService';
import { ImageAnalysisCache } from './cache/ImageAnalysisCache';
import type {
  ImageAnalysisConfig,
  ImageAnalysisRequest,
  ImageAnalysisResult,
  VisualGroundTruth,
  MotionCompatibility,
  SubjectAnalysis,
  FramingAnalysis,
  LightingAnalysis,
  EnvironmentAnalysis,
  ColorStyleAnalysis,
} from './types';

interface AIServiceWithVision {
  executeWithImage(
    taskType: string,
    params: {
      systemPrompt: string;
      userPrompt?: string;
      imageUrl?: string;
      imageBase64?: string;
      maxTokens?: number;
      temperature?: number;
      signal?: AbortSignal;
    }
  ): Promise<{ text: string }>;
}

const DEFAULT_CONFIG: ImageAnalysisConfig = {
  visionModel: 'gpt-4o-mini',
  cacheTtlSeconds: 86400, // 24 hours
  maxConcurrent: 3,
  timeoutMs: 30000,
};

export class ImageAnalysisService {
  private readonly ai: AIServiceWithVision;
  private readonly cache: ImageAnalysisCache;
  private readonly config: ImageAnalysisConfig;
  private readonly log: ILogger;
  private activeAnalyses = 0;

  constructor(
    aiService: AIServiceWithVision,
    config: Partial<ImageAnalysisConfig> = {}
  ) {
    this.ai = aiService;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new ImageAnalysisCache(this.config.cacheTtlSeconds);
    this.log = logger.child({ service: 'ImageAnalysisService' });

    this.log.info('ImageAnalysisService initialized', {
      visionModel: this.config.visionModel,
      cacheTtlSeconds: this.config.cacheTtlSeconds,
    });
  }

  /**
   * Analyze an image and extract visual ground truth
   */
  async analyze(request: ImageAnalysisRequest): Promise<ImageAnalysisResult> {
    const startTime = performance.now();
    const operation = 'analyze';

    // Generate image hash for caching
    const imageHash = request.image.startsWith('data:')
      ? hashBase64Image(request.image)
      : hashImageUrl(request.image);

    this.log.debug('Starting image analysis', {
      operation,
      imageHash,
      skipCache: request.skipCache,
    });

    // Check cache first
    if (!request.skipCache) {
      const cached = await this.cache.get(imageHash);
      if (cached) {
        this.log.debug('Returning cached analysis', { operation, imageHash });
        return {
          success: true,
          groundTruth: cached,
          cached: true,
          analysisTimeMs: Math.round(performance.now() - startTime),
        };
      }
    }

    // Check concurrency limit
    if (this.activeAnalyses >= this.config.maxConcurrent) {
      this.log.warn('Concurrency limit reached, queuing analysis', {
        operation,
        activeAnalyses: this.activeAnalyses,
        maxConcurrent: this.config.maxConcurrent,
      });
      // In production, implement proper queuing
      await this.waitForSlot();
    }

    this.activeAnalyses++;

    try {
      // Step 1: Extract visual information
      const visualAnalysis = await this.extractVisualInfo(request);

      // Step 2: Analyze motion compatibility (if requested)
      let motionAnalysis: MotionCompatibility | null = null;
      if (request.includeMotionAnalysis !== false) {
        motionAnalysis = await this.analyzeMotionCompatibility(visualAnalysis, request.signal);
      }

      // Step 3: Build complete ground truth
      const groundTruth: VisualGroundTruth = {
        imageHash,
        analyzedAt: new Date(),
        sourceUrl: request.image.startsWith('data:') ? '[base64]' : request.image,
        subject: visualAnalysis.subject,
        framing: visualAnalysis.framing,
        lighting: visualAnalysis.lighting,
        environment: visualAnalysis.environment,
        colorStyle: visualAnalysis.colorStyle,
        motion: motionAnalysis || this.getDefaultMotionCompatibility(visualAnalysis),
        sceneDescription: visualAnalysis.sceneDescription,
        confidence: visualAnalysis.confidence,
      };

      // Cache the result
      await this.cache.set(imageHash, groundTruth);

      const analysisTimeMs = Math.round(performance.now() - startTime);
      this.log.info('Image analysis complete', {
        operation,
        imageHash,
        analysisTimeMs,
        confidence: groundTruth.confidence.overall,
      });

      return {
        success: true,
        groundTruth,
        cached: false,
        analysisTimeMs,
      };

    } catch (error) {
      const analysisTimeMs = Math.round(performance.now() - startTime);
      this.log.error('Image analysis failed', error as Error, {
        operation,
        imageHash,
        analysisTimeMs,
      });

      return {
        success: false,
        error: (error as Error).message,
        cached: false,
        analysisTimeMs,
      };

    } finally {
      this.activeAnalyses--;
    }
  }

  /**
   * Extract visual information from image using vision LLM
   */
  private async extractVisualInfo(
    request: ImageAnalysisRequest
  ): Promise<{
    subject: SubjectAnalysis;
    framing: FramingAnalysis;
    lighting: LightingAnalysis;
    environment: EnvironmentAnalysis;
    colorStyle: ColorStyleAnalysis;
    sceneDescription: string;
    confidence: VisualGroundTruth['confidence'];
  }> {
    const systemPrompt = await templateService.getTemplate('image-analysis-prompt');

    const isBase64 = request.image.startsWith('data:');
    
    const response = await this.ai.executeWithImage('analyze_image', {
      systemPrompt,
      ...(isBase64 
        ? { imageBase64: request.image }
        : { imageUrl: request.image }
      ),
      maxTokens: 2000,
      temperature: 0.1, // Low temperature for consistent analysis
      signal: request.signal,
    });

    // Parse JSON response
    const parsed = this.parseJsonResponse(response.text);
    
    return {
      subject: this.validateSubjectAnalysis(parsed.subject),
      framing: this.validateFramingAnalysis(parsed.framing),
      lighting: this.validateLightingAnalysis(parsed.lighting),
      environment: this.validateEnvironmentAnalysis(parsed.environment),
      colorStyle: this.validateColorStyleAnalysis(parsed.colorStyle),
      sceneDescription: parsed.sceneDescription || 'Scene description unavailable',
      confidence: this.validateConfidence(parsed.confidence),
    };
  }

  /**
   * Analyze motion compatibility based on visual analysis
   */
  private async analyzeMotionCompatibility(
    visualAnalysis: {
      subject: SubjectAnalysis;
      framing: FramingAnalysis;
      lighting: LightingAnalysis;
      environment: EnvironmentAnalysis;
      sceneDescription: string;
    },
    signal?: AbortSignal
  ): Promise<MotionCompatibility> {
    const templateContent = await templateService.getTemplate('motion-compatibility-prompt');
    const systemPrompt = templateContent.replace(
      '{{{IMAGE_ANALYSIS}}}',
      JSON.stringify(visualAnalysis, null, 2)
    );

    const response = await this.ai.executeWithImage('analyze_motion', {
      systemPrompt,
      maxTokens: 1500,
      temperature: 0.2,
      signal,
    });

    const parsed = this.parseJsonResponse(response.text);
    return this.validateMotionCompatibility(parsed);
  }

  /**
   * Generate default motion compatibility based on framing
   */
  private getDefaultMotionCompatibility(
    visualAnalysis: { framing: FramingAnalysis; subject: SubjectAnalysis }
  ): MotionCompatibility {
    const { shotType, composition } = visualAnalysis.framing;
    const { position } = visualAnalysis.subject;

    // Heuristic-based defaults
    const compatibleMoves: MotionCompatibility['compatibleCameraMoves'] = [];
    const incompatibleMoves: string[] = [];

    // Close-ups: limited movement
    if (shotType === 'close-up' || shotType === 'extreme-close-up') {
      compatibleMoves.push(
        { movement: 'subtle push in', compatibility: 'excellent', reason: 'Adds intimacy without breaking framing' },
        { movement: 'static', compatibility: 'excellent', reason: 'Preserves tight framing' }
      );
      incompatibleMoves.push('pan', 'truck', 'crane', 'arc');
    }

    // Wide shots: more options
    if (shotType === 'wide' || shotType === 'extreme-wide') {
      compatibleMoves.push(
        { movement: 'pan', compatibility: 'excellent', reason: 'Plenty of frame to explore' },
        { movement: 'dolly in', compatibility: 'good', reason: 'Reveals subject detail' },
        { movement: 'crane up', compatibility: 'good', reason: 'Establishes scope' }
      );
    }

    // Centered compositions work with dolly
    if (composition === 'centered' || composition === 'symmetrical') {
      compatibleMoves.push(
        { movement: 'dolly in', compatibility: 'excellent', reason: 'Maintains symmetry' },
        { movement: 'dolly out', compatibility: 'excellent', reason: 'Maintains symmetry' }
      );
    }

    // Off-center subjects: be careful with lateral movement
    if (position === 'left') {
      incompatibleMoves.push('truck left', 'pan right');
    }
    if (position === 'right') {
      incompatibleMoves.push('truck right', 'pan left');
    }

    return {
      compatibleCameraMoves: compatibleMoves,
      incompatibleCameraMoves: incompatibleMoves,
      suggestedSubjectMotions: ['subtle movement', 'natural gesture'],
      constraints: ['Maintain subject in frame', 'Preserve lighting direction'],
      motionPotential: shotType.includes('wide') ? 'high' : 'medium',
    };
  }

  // Validation helpers (implement proper validation)
  private parseJsonResponse(text: string): Record<string, unknown> {
    // Strip markdown code blocks if present
    const cleaned = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      this.log.warn('Failed to parse JSON response, attempting repair', { error: (e as Error).message });
      // Attempt basic repairs
      const repaired = cleaned
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      return JSON.parse(repaired);
    }
  }

  private validateSubjectAnalysis(data: unknown): SubjectAnalysis {
    const d = data as Partial<SubjectAnalysis>;
    return {
      description: d?.description || 'Subject',
      type: d?.type || 'object',
      position: d?.position || 'center',
      count: d?.count || 1,
      attributes: d?.attributes || [],
      pose: d?.pose || 'neutral',
      expression: d?.expression,
    };
  }

  private validateFramingAnalysis(data: unknown): FramingAnalysis {
    const d = data as Partial<FramingAnalysis>;
    return {
      shotType: d?.shotType || 'medium',
      angle: d?.angle || 'eye-level',
      focalLength: d?.focalLength || 'normal',
      depthOfField: d?.depthOfField || 'moderate',
      composition: d?.composition || 'centered',
    };
  }

  private validateLightingAnalysis(data: unknown): LightingAnalysis {
    const d = data as Partial<LightingAnalysis>;
    return {
      quality: d?.quality || 'natural',
      direction: d?.direction || 'front',
      timeOfDay: d?.timeOfDay || 'midday',
      contrast: d?.contrast || 'medium',
      temperature: d?.temperature || 'neutral',
      style: d?.style || 'balanced',
    };
  }

  private validateEnvironmentAnalysis(data: unknown): EnvironmentAnalysis {
    const d = data as Partial<EnvironmentAnalysis>;
    return {
      type: d?.type || 'exterior',
      location: d?.location || 'unspecified location',
      atmosphere: d?.atmosphere,
      elements: d?.elements || [],
      depth: d?.depth || 'moderate',
    };
  }

  private validateColorStyleAnalysis(data: unknown): ColorStyleAnalysis {
    const d = data as Partial<ColorStyleAnalysis>;
    return {
      dominantColors: d?.dominantColors || ['neutral'],
      paletteMood: d?.paletteMood || 'muted',
      style: d?.style || 'realistic',
      texture: d?.texture || 'smooth',
    };
  }

  private validateMotionCompatibility(data: unknown): MotionCompatibility {
    const d = data as Partial<MotionCompatibility>;
    return {
      compatibleCameraMoves: d?.compatibleCameraMoves || [],
      incompatibleCameraMoves: d?.incompatibleCameraMoves || [],
      suggestedSubjectMotions: d?.suggestedSubjectMotions || [],
      constraints: d?.constraints || [],
      motionPotential: d?.motionPotential || 'medium',
    };
  }

  private validateConfidence(data: unknown): VisualGroundTruth['confidence'] {
    const d = data as Partial<VisualGroundTruth['confidence']>;
    return {
      overall: d?.overall ?? 0.7,
      subject: d?.subject ?? 0.7,
      framing: d?.framing ?? 0.7,
      lighting: d?.lighting ?? 0.7,
      environment: d?.environment ?? 0.7,
    };
  }

  private async waitForSlot(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (this.activeAnalyses < this.config.maxConcurrent) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  /**
   * Check if image analysis is cached
   */
  async isCached(imageUrl: string): Promise<boolean> {
    const hash = imageUrl.startsWith('data:')
      ? hashBase64Image(imageUrl)
      : hashImageUrl(imageUrl);
    return this.cache.has(hash);
  }

  /**
   * Clear cache for a specific image
   */
  async clearCache(imageUrl: string): Promise<void> {
    const hash = imageUrl.startsWith('data:')
      ? hashBase64Image(imageUrl)
      : hashImageUrl(imageUrl);
    await this.cache.delete(hash);
  }
}
```

### 1.5 Image Analysis Cache

**File:** `server/src/services/image-analysis/cache/ImageAnalysisCache.ts`

```typescript
/**
 * ImageAnalysisCache - Caches image analysis results by hash
 * 
 * Uses in-memory cache with optional Redis backing.
 * 
 * PATTERN: Repository pattern
 * MAX LINES: 150
 */

import { logger } from '@infrastructure/Logger';
import { cacheService } from '@services/cache/CacheService';
import type { VisualGroundTruth } from '../types';

const CACHE_NAMESPACE = 'image-analysis';

export class ImageAnalysisCache {
  private readonly ttlSeconds: number;
  private readonly memoryCache: Map<string, { data: VisualGroundTruth; expiresAt: number }>;
  private readonly log = logger.child({ service: 'ImageAnalysisCache' });

  constructor(ttlSeconds: number = 86400) {
    this.ttlSeconds = ttlSeconds;
    this.memoryCache = new Map();

    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanupExpired(), 5 * 60 * 1000);
  }

  async get(imageHash: string): Promise<VisualGroundTruth | null> {
    // Check memory cache first
    const memoryCached = this.memoryCache.get(imageHash);
    if (memoryCached && memoryCached.expiresAt > Date.now()) {
      this.log.debug('Memory cache hit', { imageHash });
      return memoryCached.data;
    }

    // Check Redis cache
    try {
      const redisCached = await cacheService.get<VisualGroundTruth>(
        `${CACHE_NAMESPACE}:${imageHash}`
      );
      if (redisCached) {
        // Populate memory cache
        this.memoryCache.set(imageHash, {
          data: redisCached,
          expiresAt: Date.now() + this.ttlSeconds * 1000,
        });
        this.log.debug('Redis cache hit', { imageHash });
        return redisCached;
      }
    } catch (error) {
      this.log.warn('Redis cache read failed', { imageHash, error: (error as Error).message });
    }

    return null;
  }

  async set(imageHash: string, data: VisualGroundTruth): Promise<void> {
    // Set in memory cache
    this.memoryCache.set(imageHash, {
      data,
      expiresAt: Date.now() + this.ttlSeconds * 1000,
    });

    // Set in Redis cache
    try {
      await cacheService.set(
        `${CACHE_NAMESPACE}:${imageHash}`,
        data,
        this.ttlSeconds
      );
    } catch (error) {
      this.log.warn('Redis cache write failed', { imageHash, error: (error as Error).message });
    }
  }

  async has(imageHash: string): Promise<boolean> {
    return (await this.get(imageHash)) !== null;
  }

  async delete(imageHash: string): Promise<void> {
    this.memoryCache.delete(imageHash);
    try {
      await cacheService.delete(`${CACHE_NAMESPACE}:${imageHash}`);
    } catch (error) {
      this.log.warn('Redis cache delete failed', { imageHash, error: (error as Error).message });
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expiresAt <= now) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.log.debug('Cleaned expired cache entries', { count: cleaned });
    }
  }
}
```

---

## Phase 2: I2V Optimization Strategy

### 2.1 ImageToVideoStrategy

**File:** `server/src/services/prompt-optimization/strategies/ImageToVideoStrategy.ts`

```typescript
/**
 * ImageToVideoStrategy - Optimizes prompts constrained by source image
 * 
 * This strategy receives visual ground truth from ImageAnalysisService
 * and only optimizes motion-related aspects of the prompt, preserving
 * visual elements that are locked by the source image.
 * 
 * PATTERN: Strategy pattern (VideoStrategy sibling)
 * MAX LINES: 400
 */

import { logger } from '@infrastructure/Logger';
import type { ILogger } from '@interfaces/ILogger';
import { templateService } from '../services/TemplateService';
import type {
  OptimizationStrategy,
  StrategyOptimizeParams,
} from '../types';
import type {
  VisualGroundTruth,
  LockedCategory,
  FreeCategory,
} from '@services/image-analysis/types';

/**
 * Categories that are locked by the image (cannot be modified)
 */
const LOCKED_CATEGORIES: LockedCategory[] = [
  'subject.identity',
  'subject.appearance',
  'subject.position',
  'shot.type',
  'shot.angle',
  'lighting.quality',
  'lighting.direction',
  'environment.type',
  'environment.location',
  'color.palette',
];

/**
 * Categories that can be freely optimized
 */
const FREE_CATEGORIES: FreeCategory[] = [
  'action.movement',
  'action.gesture',
  'camera.movement',
  'camera.speed',
  'subject.expression',
  'subject.emotion',
  'atmosphere.change',
];

interface I2VOptimizeParams extends StrategyOptimizeParams {
  visualGroundTruth: VisualGroundTruth;
}

export class ImageToVideoStrategy implements OptimizationStrategy {
  private readonly ai: StrategyOptimizeParams['aiService'];
  private readonly log: ILogger;

  constructor(aiService: StrategyOptimizeParams['aiService']) {
    this.ai = aiService;
    this.log = logger.child({ service: 'ImageToVideoStrategy' });
  }

  /**
   * Optimize prompt for i2v generation
   */
  async optimize(params: I2VOptimizeParams): Promise<string> {
    const { prompt, visualGroundTruth, onMetadata, signal } = params;
    const startTime = performance.now();

    this.log.debug('Starting i2v optimization', {
      promptLength: prompt.length,
      confidence: visualGroundTruth.confidence.overall,
    });

    // Step 1: Extract motion intent from user prompt
    const motionIntent = await this.extractMotionIntent(prompt, signal);

    // Step 2: Validate motion against ground truth
    const validatedMotion = this.validateMotionAgainstGroundTruth(
      motionIntent,
      visualGroundTruth
    );

    // Step 3: Build i2v prompt
    const optimizedPrompt = this.buildI2VPrompt(
      visualGroundTruth,
      validatedMotion
    );

    // Step 4: Report locked/free elements via metadata
    if (onMetadata) {
      onMetadata({
        strategy: 'image-to-video',
        lockedElements: this.getLockedElements(visualGroundTruth),
        motionElements: validatedMotion,
        confidence: visualGroundTruth.confidence,
        optimizationTimeMs: Math.round(performance.now() - startTime),
      });
    }

    this.log.info('I2V optimization complete', {
      inputLength: prompt.length,
      outputLength: optimizedPrompt.length,
      motionPotential: visualGroundTruth.motion.motionPotential,
    });

    return optimizedPrompt;
  }

  /**
   * Extract motion intent from user's prompt
   */
  private async extractMotionIntent(
    prompt: string,
    signal?: AbortSignal
  ): Promise<MotionIntent> {
    const systemPrompt = `You are a motion intent extractor for video generation.

Given a user's prompt, extract ONLY the motion-related elements:
- Subject actions (walking, turning, gesturing)
- Camera movements (pan, dolly, zoom)
- Timing/pacing (slow, fast, gradual)
- Emotional trajectory (becoming happy, growing tense)

Ignore visual descriptions (lighting, color, environment) as these are fixed by the source image.

Respond with JSON:
{
  "subjectMotion": "what the subject does",
  "cameraMotion": "camera movement if any",
  "pacing": "slow|medium|fast",
  "emotionalArc": "emotional change if any",
  "duration": "short|medium|long"
}

If no motion is specified, return:
{
  "subjectMotion": "subtle natural movement",
  "cameraMotion": "static",
  "pacing": "slow",
  "emotionalArc": null,
  "duration": "short"
}`;

    const response = await this.ai.execute('extract_motion', {
      systemPrompt,
      userPrompt: prompt,
      maxTokens: 500,
      temperature: 0.1,
      signal,
    });

    try {
      const parsed = JSON.parse(
        response.text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      );
      return this.validateMotionIntent(parsed);
    } catch {
      // Default motion if extraction fails
      return {
        subjectMotion: 'subtle natural movement',
        cameraMotion: 'static',
        pacing: 'slow',
        emotionalArc: null,
        duration: 'short',
      };
    }
  }

  private validateMotionIntent(data: unknown): MotionIntent {
    const d = data as Partial<MotionIntent>;
    return {
      subjectMotion: d?.subjectMotion || 'subtle movement',
      cameraMotion: d?.cameraMotion || 'static',
      pacing: d?.pacing || 'slow',
      emotionalArc: d?.emotionalArc || null,
      duration: d?.duration || 'short',
    };
  }

  /**
   * Validate motion against ground truth constraints
   */
  private validateMotionAgainstGroundTruth(
    motion: MotionIntent,
    groundTruth: VisualGroundTruth
  ): ValidatedMotion {
    const warnings: string[] = [];
    let validatedCameraMotion = motion.cameraMotion;

    // Check camera motion compatibility
    if (motion.cameraMotion !== 'static') {
      const normalizedMotion = motion.cameraMotion.toLowerCase();
      const isIncompatible = groundTruth.motion.incompatibleCameraMoves.some(
        (move) => normalizedMotion.includes(move.toLowerCase())
      );

      if (isIncompatible) {
        warnings.push(
          `Camera movement "${motion.cameraMotion}" may not work with this framing. ` +
          `Recommended: ${groundTruth.motion.compatibleCameraMoves
            .filter((m) => m.compatibility === 'excellent' || m.compatibility === 'good')
            .map((m) => m.movement)
            .join(', ')}`
        );

        // Suggest alternative
        const bestAlternative = groundTruth.motion.compatibleCameraMoves
          .find((m) => m.compatibility === 'excellent');
        if (bestAlternative) {
          validatedCameraMotion = bestAlternative.movement;
        } else {
          validatedCameraMotion = 'subtle movement';
        }
      }
    }

    // Check subject position constraints
    if (groundTruth.subject.position !== 'center') {
      const lateralMoves = ['pan', 'truck', 'arc'];
      const hasLateralMove = lateralMoves.some(
        (move) => validatedCameraMotion.toLowerCase().includes(move)
      );
      if (hasLateralMove) {
        warnings.push(
          `Subject is positioned ${groundTruth.subject.position}. ` +
          `Lateral camera movement may cut off subject.`
        );
      }
    }

    return {
      subjectMotion: motion.subjectMotion,
      cameraMotion: validatedCameraMotion,
      pacing: motion.pacing,
      emotionalArc: motion.emotionalArc,
      duration: motion.duration,
      warnings,
      wasAdjusted: validatedCameraMotion !== motion.cameraMotion,
    };
  }

  /**
   * Build the final i2v prompt
   */
  private buildI2VPrompt(
    groundTruth: VisualGroundTruth,
    motion: ValidatedMotion
  ): string {
    const parts: string[] = [];

    // Scene context (minimal - image provides visuals)
    parts.push(groundTruth.sceneDescription);

    // Subject motion (primary focus)
    if (motion.subjectMotion && motion.subjectMotion !== 'static') {
      parts.push(motion.subjectMotion);
    }

    // Emotional arc if present
    if (motion.emotionalArc) {
      parts.push(motion.emotionalArc);
    }

    // Camera motion
    if (motion.cameraMotion && motion.cameraMotion !== 'static') {
      parts.push(`camera ${motion.cameraMotion}`);
    }

    // Pacing
    const pacingMap: Record<string, string> = {
      slow: 'smooth, gradual movement',
      medium: 'natural pacing',
      fast: 'dynamic, energetic movement',
    };
    if (motion.pacing && pacingMap[motion.pacing]) {
      parts.push(pacingMap[motion.pacing]);
    }

    // Technical specs based on ground truth
    const techSpecs: string[] = [];
    
    // Maintain visual continuity
    techSpecs.push(`${groundTruth.lighting.style} lighting`);
    techSpecs.push(`${groundTruth.colorStyle.paletteMood} color palette`);

    if (techSpecs.length > 0) {
      parts.push(techSpecs.join(', '));
    }

    return parts.join('. ') + '.';
  }

  /**
   * Get locked elements from ground truth for UI display
   */
  private getLockedElements(groundTruth: VisualGroundTruth): LockedElement[] {
    return [
      {
        category: 'subject.identity',
        value: groundTruth.subject.description,
        locked: true,
      },
      {
        category: 'shot.type',
        value: groundTruth.framing.shotType,
        locked: true,
      },
      {
        category: 'shot.angle',
        value: groundTruth.framing.angle,
        locked: true,
      },
      {
        category: 'lighting.quality',
        value: `${groundTruth.lighting.quality} ${groundTruth.lighting.direction} lighting`,
        locked: true,
      },
      {
        category: 'environment.location',
        value: groundTruth.environment.location,
        locked: true,
      },
    ];
  }
}

// Supporting interfaces
interface MotionIntent {
  subjectMotion: string;
  cameraMotion: string;
  pacing: 'slow' | 'medium' | 'fast';
  emotionalArc: string | null;
  duration: 'short' | 'medium' | 'long';
}

interface ValidatedMotion extends MotionIntent {
  warnings: string[];
  wasAdjusted: boolean;
}

interface LockedElement {
  category: LockedCategory;
  value: string;
  locked: boolean;
}
```

### 2.2 Modify StrategyFactory

**File:** `server/src/services/prompt-optimization/services/StrategyFactory.ts` (modifications)

```typescript
// Add to imports
import { ImageToVideoStrategy } from '../strategies/ImageToVideoStrategy';
import type { VisualGroundTruth } from '@services/image-analysis/types';

// Add new mode
export type OptimizationMode = 'video' | 'image' | 'image-to-video';

// Modify getStrategy method
getStrategy(mode: OptimizationMode, visualGroundTruth?: VisualGroundTruth): OptimizationStrategy {
  if (mode === 'image-to-video') {
    if (!visualGroundTruth) {
      throw new Error('image-to-video mode requires visualGroundTruth');
    }
    return new ImageToVideoStrategy(this.ai);
  }
  
  // ... existing logic
}

// Add to getSupportedModes
getSupportedModes(): OptimizationMode[] {
  return ['video', 'image', 'image-to-video'];
}
```

### 2.3 Modify PromptOptimizationService

**File:** `server/src/services/prompt-optimization/PromptOptimizationService.ts` (modifications)

```typescript
// Add to imports
import { ImageAnalysisService } from '@services/image-analysis';
import type { VisualGroundTruth } from '@services/image-analysis/types';

// Add to constructor
private readonly imageAnalysis: ImageAnalysisService | null;

constructor(aiService: AIService, videoPromptService: VideoPromptService | null = null) {
  // ... existing
  
  // Initialize image analysis if vision-capable AI is available
  this.imageAnalysis = aiService.supportsVision?.() 
    ? new ImageAnalysisService(aiService)
    : null;
}

// Add to OptimizationRequest type
interface OptimizationRequest {
  // ... existing fields
  
  /** Source image for i2v optimization */
  startImage?: string;
  /** Pre-computed visual ground truth (skips analysis) */
  visualGroundTruth?: VisualGroundTruth;
}

// Modify optimize method
async optimize(request: OptimizationRequest): Promise<string> {
  const { prompt, startImage, visualGroundTruth: providedGroundTruth, ...rest } = request;
  
  // Detect i2v mode
  const isI2V = Boolean(startImage || providedGroundTruth);
  
  if (isI2V) {
    return this.optimizeI2V({
      prompt,
      startImage,
      visualGroundTruth: providedGroundTruth,
      ...rest,
    });
  }
  
  // ... existing t2v optimization logic
}

// Add i2v-specific method
private async optimizeI2V(request: OptimizationRequest & { startImage?: string }): Promise<string> {
  const startTime = performance.now();
  const operation = 'optimizeI2V';

  // Get or compute visual ground truth
  let groundTruth = request.visualGroundTruth;
  
  if (!groundTruth && request.startImage) {
    if (!this.imageAnalysis) {
      throw new Error('Image analysis not available - vision model required');
    }
    
    const analysisResult = await this.imageAnalysis.analyze({
      image: request.startImage,
      includeMotionAnalysis: true,
      signal: request.signal,
    });
    
    if (!analysisResult.success || !analysisResult.groundTruth) {
      throw new Error(`Image analysis failed: ${analysisResult.error}`);
    }
    
    groundTruth = analysisResult.groundTruth;
  }
  
  if (!groundTruth) {
    throw new Error('No visual ground truth available for i2v optimization');
  }

  // Get i2v strategy
  const strategy = this.strategyFactory.getStrategy('image-to-video', groundTruth);
  
  // Optimize with ground truth constraints
  const optimizedPrompt = await strategy.optimize({
    prompt: request.prompt,
    visualGroundTruth: groundTruth,
    context: request.context,
    onMetadata: request.onMetadata,
    signal: request.signal,
  });

  this.log.info('I2V optimization complete', {
    operation,
    duration: Math.round(performance.now() - startTime),
    inputLength: request.prompt.length,
    outputLength: optimizedPrompt.length,
    confidence: groundTruth.confidence.overall,
  });

  return optimizedPrompt;
}
```

---

## Phase 3: Constrained Enhancement Service

### 3.1 Modify EnhancementService

The enhancement service needs to respect visual ground truth when generating suggestions for i2v prompts.

**File:** `server/src/services/enhancement/services/I2VConstrainedSuggestions.ts`

```typescript
/**
 * I2VConstrainedSuggestions - Generates suggestions constrained by visual ground truth
 * 
 * When a user clicks on a span in an i2v context, this service ensures
 * suggestions don't conflict with the locked visual elements.
 * 
 * PATTERN: Strategy pattern
 * MAX LINES: 250
 */

import { logger } from '@infrastructure/Logger';
import type { VisualGroundTruth, LockedCategory, FreeCategory } from '@services/image-analysis/types';
import type { Suggestion } from './types';

/**
 * Map taxonomy categories to locked/free status
 */
const CATEGORY_LOCK_MAP: Record<string, 'locked' | 'free' | 'conditional'> = {
  // Locked by image
  'subject.identity': 'locked',
  'subject.appearance': 'locked',
  'subject.age': 'locked',
  'subject.gender': 'locked',
  'subject.clothing': 'locked',
  'shot.type': 'locked',
  'shot.angle': 'locked',
  'shot.framing': 'locked',
  'lighting.type': 'locked',
  'lighting.quality': 'locked',
  'lighting.direction': 'locked',
  'environment.setting': 'locked',
  'environment.location': 'locked',
  'color.palette': 'locked',
  'style.visual': 'locked',
  
  // Free to modify
  'action.movement': 'free',
  'action.gesture': 'free',
  'action.interaction': 'free',
  'camera.movement': 'free',
  'camera.speed': 'free',
  'subject.expression': 'free',
  'subject.emotion': 'free',
  'atmosphere.mood': 'conditional', // Can suggest gradual change
  'timing.duration': 'free',
  'timing.pacing': 'free',
  
  // Default for unknown categories
  'default': 'conditional',
};

export class I2VConstrainedSuggestions {
  private readonly log = logger.child({ service: 'I2VConstrainedSuggestions' });

  /**
   * Check if a category is locked by the source image
   */
  isCategoryLocked(category: string, groundTruth: VisualGroundTruth): boolean {
    const status = CATEGORY_LOCK_MAP[category] || CATEGORY_LOCK_MAP['default'];
    return status === 'locked';
  }

  /**
   * Filter suggestions to remove those that conflict with ground truth
   */
  filterSuggestions(
    suggestions: Suggestion[],
    groundTruth: VisualGroundTruth,
    category: string
  ): Suggestion[] {
    if (!this.isCategoryLocked(category, groundTruth)) {
      return suggestions;
    }

    this.log.debug('Filtering suggestions for locked category', {
      category,
      originalCount: suggestions.length,
    });

    // For locked categories, we shouldn't return alternatives
    // Instead, explain why alternatives aren't available
    return [];
  }

  /**
   * Generate motion-focused suggestions for i2v context
   */
  generateMotionSuggestions(
    currentText: string,
    groundTruth: VisualGroundTruth
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Add compatible camera movements
    for (const move of groundTruth.motion.compatibleCameraMoves) {
      if (move.compatibility === 'excellent' || move.compatibility === 'good') {
        suggestions.push({
          text: `camera ${move.movement}`,
          category: 'camera.movement',
          reason: move.reason,
          confidence: move.compatibility === 'excellent' ? 0.95 : 0.85,
        });
      }
    }

    // Add suggested subject motions
    for (const motion of groundTruth.motion.suggestedSubjectMotions) {
      suggestions.push({
        text: motion,
        category: 'action.movement',
        reason: 'Natural motion for this subject',
        confidence: 0.8,
      });
    }

    return suggestions;
  }

  /**
   * Get explanation for why a category is locked
   */
  getLockedCategoryExplanation(
    category: string,
    groundTruth: VisualGroundTruth
  ): string {
    const explanations: Record<string, () => string> = {
      'subject.identity': () => 
        `Subject is fixed by image: ${groundTruth.subject.description}`,
      'subject.appearance': () =>
        `Appearance is determined by image: ${groundTruth.subject.attributes.join(', ')}`,
      'shot.type': () =>
        `Shot type is ${groundTruth.framing.shotType} - defined by source image`,
      'shot.angle': () =>
        `Camera angle is ${groundTruth.framing.angle} - fixed by source image`,
      'lighting.type': () =>
        `Lighting is ${groundTruth.lighting.quality} ${groundTruth.lighting.direction} - fixed by source`,
      'environment.location': () =>
        `Environment is ${groundTruth.environment.location} - shown in source image`,
    };

    const explainer = explanations[category];
    if (explainer) {
      return explainer();
    }

    return `This element is defined by your source image and cannot be changed in i2v mode.`;
  }

  /**
   * Annotate suggestions with i2v context
   */
  annotateSuggestionsForI2V(
    suggestions: Suggestion[],
    category: string,
    groundTruth: VisualGroundTruth
  ): AnnotatedSuggestion[] {
    const isLocked = this.isCategoryLocked(category, groundTruth);

    if (isLocked) {
      return [{
        ...suggestions[0] || { text: '', category, confidence: 0 },
        isLocked: true,
        lockedReason: this.getLockedCategoryExplanation(category, groundTruth),
        alternatives: [],
      }];
    }

    return suggestions.map((s) => ({
      ...s,
      isLocked: false,
      alternatives: this.generateMotionSuggestions(s.text, groundTruth),
    }));
  }
}

interface AnnotatedSuggestion extends Suggestion {
  isLocked: boolean;
  lockedReason?: string;
  alternatives?: Suggestion[];
}
```

### 3.2 Modify EnhancementService Main Class

**File:** `server/src/services/enhancement/EnhancementService.ts` (modifications)

```typescript
// Add to imports
import { I2VConstrainedSuggestions } from './services/I2VConstrainedSuggestions';
import type { VisualGroundTruth } from '@services/image-analysis/types';

// Add to constructor
private readonly i2vConstraints: I2VConstrainedSuggestions;

constructor(dependencies: EnhancementServiceDependencies) {
  // ... existing
  this.i2vConstraints = new I2VConstrainedSuggestions();
}

// Modify getEnhancementSuggestions
async getEnhancementSuggestions(params: EnhancementRequestParams & {
  visualGroundTruth?: VisualGroundTruth;
}): Promise<EnhancementResult> {
  const { visualGroundTruth, highlightedCategory, ...rest } = params;

  // Check if category is locked by image
  if (visualGroundTruth && highlightedCategory) {
    const isLocked = this.i2vConstraints.isCategoryLocked(
      highlightedCategory,
      visualGroundTruth
    );

    if (isLocked) {
      return {
        suggestions: [],
        metadata: {
          isLocked: true,
          lockedReason: this.i2vConstraints.getLockedCategoryExplanation(
            highlightedCategory,
            visualGroundTruth
          ),
          motionAlternatives: this.i2vConstraints.generateMotionSuggestions(
            params.highlightedText,
            visualGroundTruth
          ),
        },
      };
    }
  }

  // Generate normal suggestions
  const result = await this.generateSuggestions(rest);

  // Filter suggestions if in i2v mode
  if (visualGroundTruth && highlightedCategory) {
    result.suggestions = this.i2vConstraints.filterSuggestions(
      result.suggestions,
      visualGroundTruth,
      highlightedCategory
    );
  }

  return result;
}
```

---

## Phase 4: Frontend Integration

### 4.1 Types

**File:** `client/src/features/prompt-optimizer/types/i2v.ts`

```typescript
/**
 * I2V Types for Frontend
 */

export interface VisualGroundTruth {
  imageHash: string;
  sceneDescription: string;
  subject: {
    description: string;
    type: string;
    position: string;
  };
  framing: {
    shotType: string;
    angle: string;
  };
  lighting: {
    quality: string;
    direction: string;
  };
  motion: {
    compatibleCameraMoves: Array<{
      movement: string;
      compatibility: string;
      reason: string;
    }>;
    suggestedSubjectMotions: string[];
    motionPotential: string;
  };
  confidence: {
    overall: number;
  };
}

export interface I2VOptimizationContext {
  isI2VMode: boolean;
  startImageUrl: string | null;
  groundTruth: VisualGroundTruth | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  lockedCategories: string[];
}

export interface LockedSpanInfo {
  category: string;
  reason: string;
  value: string;
}
```

### 4.2 useI2VContext Hook

**File:** `client/src/features/prompt-optimizer/hooks/useI2VContext.ts`

```typescript
/**
 * useI2VContext - Manages i2v optimization context
 * 
 * Handles image analysis and ground truth state for i2v mode.
 * 
 * PATTERN: Custom hook
 * MAX LINES: 150
 */

import { useState, useCallback, useEffect } from 'react';
import { analyzeImage } from '../api/imageAnalysisApi';
import type { VisualGroundTruth, I2VOptimizationContext } from '../types/i2v';

const LOCKED_CATEGORIES = [
  'subject.identity',
  'subject.appearance',
  'shot.type',
  'shot.angle',
  'lighting.quality',
  'lighting.direction',
  'environment.location',
  'color.palette',
];

export function useI2VContext(startImageUrl: string | null): I2VOptimizationContext & {
  analyzeStartImage: () => Promise<void>;
  clearGroundTruth: () => void;
} {
  const [groundTruth, setGroundTruth] = useState<VisualGroundTruth | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const isI2VMode = Boolean(startImageUrl);

  const analyzeStartImage = useCallback(async () => {
    if (!startImageUrl) {
      setGroundTruth(null);
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const result = await analyzeImage(startImageUrl);
      if (result.success && result.groundTruth) {
        setGroundTruth(result.groundTruth);
      } else {
        setAnalysisError(result.error || 'Failed to analyze image');
      }
    } catch (error) {
      setAnalysisError((error as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [startImageUrl]);

  const clearGroundTruth = useCallback(() => {
    setGroundTruth(null);
    setAnalysisError(null);
  }, []);

  // Auto-analyze when start image changes
  useEffect(() => {
    if (startImageUrl) {
      analyzeStartImage();
    } else {
      clearGroundTruth();
    }
  }, [startImageUrl, analyzeStartImage, clearGroundTruth]);

  return {
    isI2VMode,
    startImageUrl,
    groundTruth,
    isAnalyzing,
    analysisError,
    lockedCategories: isI2VMode ? LOCKED_CATEGORIES : [],
    analyzeStartImage,
    clearGroundTruth,
  };
}
```

### 4.3 API Layer

**File:** `client/src/features/prompt-optimizer/api/imageAnalysisApi.ts`

```typescript
/**
 * Image Analysis API
 * 
 * PATTERN: API layer
 * MAX LINES: 100
 */

import type { VisualGroundTruth } from '../types/i2v';

const API_BASE = '/api/image-analysis';

interface AnalyzeImageResponse {
  success: boolean;
  groundTruth?: VisualGroundTruth;
  error?: string;
  cached: boolean;
  analysisTimeMs: number;
}

export async function analyzeImage(
  imageUrl: string,
  options?: {
    includeMotionAnalysis?: boolean;
    skipCache?: boolean;
  }
): Promise<AnalyzeImageResponse> {
  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: imageUrl,
      includeMotionAnalysis: options?.includeMotionAnalysis ?? true,
      skipCache: options?.skipCache ?? false,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Analysis failed' }));
    return {
      success: false,
      error: error.message,
      cached: false,
      analysisTimeMs: 0,
    };
  }

  return response.json();
}

export async function checkAnalysisCache(imageUrl: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/cached?url=${encodeURIComponent(imageUrl)}`);
  const data = await response.json();
  return data.cached === true;
}
```

### 4.4 Locked Span Indicator Component

**File:** `client/src/features/prompt-optimizer/components/LockedSpanIndicator.tsx`

```typescript
/**
 * LockedSpanIndicator - Shows lock icon and tooltip for i2v-locked spans
 * 
 * PATTERN: UI Component
 * MAX LINES: 100
 */

import React from 'react';
import { Lock } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@promptstudio/system/components/ui/tooltip';
import type { LockedSpanInfo } from '../types/i2v';

interface LockedSpanIndicatorProps {
  info: LockedSpanInfo;
  className?: string;
}

export function LockedSpanIndicator({
  info,
  className,
}: LockedSpanIndicatorProps): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`
            inline-flex items-center gap-1 px-1.5 py-0.5 
            rounded bg-amber-500/10 text-amber-500 
            border border-amber-500/20
            cursor-help
            ${className}
          `}
        >
          <Lock className="w-3 h-3" />
          <span className="text-xs font-medium">{info.value}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <div className="font-medium text-amber-400">Locked by Image</div>
          <div className="text-xs text-muted">{info.reason}</div>
          <div className="text-xs text-muted italic">
            This element is fixed by your source image and cannot be changed.
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
```

### 4.5 Motion Suggestions Panel

**File:** `client/src/features/prompt-optimizer/components/MotionSuggestionsPanel.tsx`

```typescript
/**
 * MotionSuggestionsPanel - Shows motion suggestions for i2v mode
 * 
 * Replaces or supplements the normal suggestions panel when in i2v mode,
 * focusing on compatible camera movements and subject motions.
 * 
 * PATTERN: UI Component
 * MAX LINES: 180
 */

import React from 'react';
import { Video, Camera, User, AlertTriangle } from 'lucide-react';
import type { VisualGroundTruth } from '../types/i2v';

interface MotionSuggestionsPanelProps {
  groundTruth: VisualGroundTruth;
  onSelectMotion: (motion: string) => void;
  className?: string;
}

export function MotionSuggestionsPanel({
  groundTruth,
  onSelectMotion,
  className,
}: MotionSuggestionsPanelProps): React.ReactElement {
  const { motion } = groundTruth;

  const excellentMoves = motion.compatibleCameraMoves.filter(
    (m) => m.compatibility === 'excellent'
  );
  const goodMoves = motion.compatibleCameraMoves.filter(
    (m) => m.compatibility === 'good'
  );
  const riskyMoves = motion.compatibleCameraMoves.filter(
    (m) => m.compatibility === 'possible' || m.compatibility === 'risky'
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Motion Potential Indicator */}
      <div className="flex items-center gap-2 text-sm">
        <Video className="w-4 h-4 text-violet-400" />
        <span className="text-muted">Motion potential:</span>
        <span
          className={`font-medium ${
            motion.motionPotential === 'high'
              ? 'text-green-400'
              : motion.motionPotential === 'medium'
              ? 'text-amber-400'
              : 'text-red-400'
          }`}
        >
          {motion.motionPotential}
        </span>
      </div>

      {/* Camera Movements */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted uppercase tracking-wider">
          <Camera className="w-3 h-3" />
          Camera Movements
        </div>

        {excellentMoves.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-green-400">Recommended</div>
            <div className="flex flex-wrap gap-1">
              {excellentMoves.map((move) => (
                <button
                  key={move.movement}
                  onClick={() => onSelectMotion(`camera ${move.movement}`)}
                  className="px-2 py-1 text-xs rounded bg-green-500/10 text-green-400 
                           border border-green-500/20 hover:bg-green-500/20 transition"
                  title={move.reason}
                >
                  {move.movement}
                </button>
              ))}
            </div>
          </div>
        )}

        {goodMoves.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-blue-400">Good options</div>
            <div className="flex flex-wrap gap-1">
              {goodMoves.map((move) => (
                <button
                  key={move.movement}
                  onClick={() => onSelectMotion(`camera ${move.movement}`)}
                  className="px-2 py-1 text-xs rounded bg-blue-500/10 text-blue-400 
                           border border-blue-500/20 hover:bg-blue-500/20 transition"
                  title={move.reason}
                >
                  {move.movement}
                </button>
              ))}
            </div>
          </div>
        )}

        {riskyMoves.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Use with caution
            </div>
            <div className="flex flex-wrap gap-1">
              {riskyMoves.map((move) => (
                <button
                  key={move.movement}
                  onClick={() => onSelectMotion(`camera ${move.movement}`)}
                  className="px-2 py-1 text-xs rounded bg-amber-500/10 text-amber-400 
                           border border-amber-500/20 hover:bg-amber-500/20 transition"
                  title={move.reason}
                >
                  {move.movement}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Subject Motions */}
      {motion.suggestedSubjectMotions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-muted uppercase tracking-wider">
            <User className="w-3 h-3" />
            Subject Motions
          </div>
          <div className="flex flex-wrap gap-1">
            {motion.suggestedSubjectMotions.map((subjectMotion, i) => (
              <button
                key={i}
                onClick={() => onSelectMotion(subjectMotion)}
                className="px-2 py-1 text-xs rounded bg-violet-500/10 text-violet-400 
                         border border-violet-500/20 hover:bg-violet-500/20 transition"
              >
                {subjectMotion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Constraints */}
      {motion.constraints.length > 0 && (
        <div className="text-xs text-muted border-t border-border pt-2">
          <div className="font-medium mb-1">Constraints:</div>
          <ul className="list-disc list-inside space-y-0.5">
            {motion.constraints.map((constraint, i) => (
              <li key={i}>{constraint}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

---

## Phase 5: Span Labeling Adaptations

### 5.1 I2V Span Labeling Mode

When labeling spans for i2v prompts, the system should:
1. Mark visual categories as "locked"
2. Focus on motion/action categories
3. Provide visual indicators for locked spans

**File:** `server/src/llm/span-labeling/templates/i2v-span-labeling-prompt.md`

```markdown
# I2V Span Labeling System Prompt

You are labeling spans in a prompt that will be used with an existing source image. The visual elements are FIXED by the image - you should only label motion and action elements.

## Context

This prompt is for image-to-video generation. The source image already defines:
- Subject identity and appearance
- Shot type and camera angle
- Lighting conditions
- Environment and setting
- Color palette

Your job is to identify and label MOTION elements only.

## Valid Categories for I2V

Only use these categories:

### Action Categories (LABEL THESE)
- `action.movement` - Physical motion (walking, running, turning)
- `action.gesture` - Hand/body gestures
- `action.interaction` - Interaction with objects/environment

### Camera Categories (LABEL THESE)
- `camera.movement` - Pan, tilt, dolly, zoom, crane
- `camera.speed` - Slow, fast, accelerating
- `camera.focus` - Focus pulls, rack focus

### Timing Categories (LABEL THESE)
- `timing.duration` - Length indicators (brief, extended)
- `timing.pacing` - Rhythm (slow, energetic, building)

### Emotional Categories (LABEL THESE)
- `subject.expression` - Facial expressions
- `subject.emotion` - Emotional state changes
- `atmosphere.change` - Mood transitions

## DO NOT LABEL

These are fixed by the source image:
- Subject descriptions (who/what they are)
- Physical appearance (clothing, age, etc.)
- Shot type (close-up, wide, etc.)
- Camera angle (low, high, eye-level)
- Lighting descriptions
- Environment/location
- Color/style descriptions

## Output Format

```json
{
  "analysis_trace": "Identified motion elements only, ignoring visual descriptions fixed by source image.",
  "spans": [
    {"text": "slowly turns her head", "role": "action.movement", "confidence": 0.95},
    {"text": "camera dollies in", "role": "camera.movement", "confidence": 0.9}
  ],
  "i2vMode": true,
  "skippedVisualElements": ["description of woman", "golden hour lighting"],
  "meta": {"version": "v3-i2v"}
}
```

## Guidelines

1. Only label motion/action/timing elements
2. Skip any visual descriptions - they're provided by the image
3. If the prompt is mostly visual descriptions, return few/no spans
4. Note skipped visual elements in `skippedVisualElements` for transparency
```

### 5.2 Modify SpanLabelingService

**File:** `server/src/llm/span-labeling/SpanLabelingService.ts` (modifications)

```typescript
// Add i2v mode detection and routing

interface SpanLabelingOptions {
  // ... existing
  isI2VMode?: boolean;
  visualGroundTruth?: VisualGroundTruth;
}

async labelSpans(prompt: string, options: SpanLabelingOptions = {}): Promise<SpanLabelingResult> {
  const { isI2VMode, visualGroundTruth, ...rest } = options;

  // Use i2v-specific template if in i2v mode
  if (isI2VMode) {
    return this.labelSpansI2V(prompt, visualGroundTruth);
  }

  // ... existing logic
}

private async labelSpansI2V(
  prompt: string,
  groundTruth?: VisualGroundTruth
): Promise<SpanLabelingResult> {
  const template = await this.templateService.getTemplate('i2v-span-labeling-prompt');
  
  // ... i2v-specific labeling logic
}
```

---

## API Reference

### New Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/image-analysis/analyze` | Analyze image and extract visual ground truth |
| GET | `/api/image-analysis/cached` | Check if analysis is cached |

### Modified Endpoints

| Method | Path | Changes |
|--------|------|---------|
| POST | `/api/optimize` | Add `startImage` and `visualGroundTruth` params |
| POST | `/api/optimize-stream` | Add i2v support |
| POST | `/api/enhance` | Add `visualGroundTruth` for constrained suggestions |
| POST | `/api/span-label` | Add `isI2VMode` param |

### Request Examples

**Analyze Image:**
```json
POST /api/image-analysis/analyze
{
  "image": "https://example.com/image.jpg",
  "includeMotionAnalysis": true,
  "skipCache": false
}
```

**I2V Optimization:**
```json
POST /api/optimize
{
  "prompt": "she slowly turns to face the camera",
  "startImage": "https://example.com/portrait.jpg",
  "mode": "video"
}
```

**Constrained Enhancement:**
```json
POST /api/enhance
{
  "highlightedText": "golden hour",
  "highlightedCategory": "lighting.quality",
  "fullPrompt": "...",
  "visualGroundTruth": { ... }
}
```

---

## Testing Strategy

### Unit Tests

```
server/src/services/image-analysis/__tests__/
├── ImageAnalysisService.test.ts
├── ImageAnalysisCache.test.ts
└── extractors/*.test.ts

server/src/services/prompt-optimization/strategies/__tests__/
└── ImageToVideoStrategy.test.ts

server/src/services/enhancement/services/__tests__/
└── I2VConstrainedSuggestions.test.ts
```

### Integration Tests

```
tests/integration/
├── i2v-optimization.integration.test.ts
└── i2v-enhancement.integration.test.ts
```

### Test Coverage Targets

| Component | Target |
|-----------|--------|
| ImageAnalysisService | 85% |
| ImageToVideoStrategy | 80% |
| I2VConstrainedSuggestions | 90% |
| useI2VContext | 85% |

### Key Test Cases

1. **Image Analysis**
   - Valid image URL analysis
   - Base64 image analysis
   - Cache hit/miss scenarios
   - Vision model failure handling
   - Concurrent analysis limiting

2. **I2V Optimization**
   - Motion extraction from prompts
   - Camera movement validation
   - Prompt building with ground truth
   - Fallback to t2v when no image

3. **Constrained Enhancement**
   - Locked category filtering
   - Motion suggestion generation
   - Mixed locked/free category handling

4. **Frontend Integration**
   - i2v mode detection
   - Ground truth state management
   - Locked span visualization
   - Motion suggestion selection

---

## Implementation Checklist

### Phase 1: ImageAnalysisService (Week 1)
- [ ] Create `server/src/services/image-analysis/` directory
- [ ] Implement `types.ts`
- [ ] Implement `templates/image-analysis-prompt.md`
- [ ] Implement `templates/motion-compatibility-prompt.md`
- [ ] Implement `cache/ImageAnalysisCache.ts`
- [ ] Implement `ImageAnalysisService.ts`
- [ ] Add routes for `/api/image-analysis/*`
- [ ] Write unit tests
- [ ] Test with real images

### Phase 2: I2V Optimization Strategy (Week 2)
- [ ] Implement `ImageToVideoStrategy.ts`
- [ ] Modify `StrategyFactory.ts`
- [ ] Modify `PromptOptimizationService.ts` for i2v routing
- [ ] Add i2v mode to `optimize` endpoint
- [ ] Write unit tests
- [ ] Integration tests

### Phase 3: Constrained Enhancement (Week 2-3)
- [ ] Implement `I2VConstrainedSuggestions.ts`
- [ ] Modify `EnhancementService.ts`
- [ ] Add ground truth param to enhance endpoint
- [ ] Write unit tests

### Phase 4: Frontend Integration (Week 3)
- [ ] Create `types/i2v.ts`
- [ ] Implement `api/imageAnalysisApi.ts`
- [ ] Implement `hooks/useI2VContext.ts`
- [ ] Implement `components/LockedSpanIndicator.tsx`
- [ ] Implement `components/MotionSuggestionsPanel.tsx`
- [ ] Integrate into PromptCanvas
- [ ] Test UI interactions

### Phase 5: Span Labeling (Week 4)
- [ ] Create `i2v-span-labeling-prompt.md`
- [ ] Modify `SpanLabelingService.ts`
- [ ] Update span highlighting for i2v mode
- [ ] Test labeling accuracy

### Polish & Launch (Week 4-5)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] Error handling improvements
- [ ] Analytics/logging
- [ ] Beta testing
- [ ] Launch

---

## File Summary

### New Files to Create

```
server/src/services/image-analysis/
├── ImageAnalysisService.ts
├── types.ts
├── index.ts
├── extractors/
│   ├── SubjectExtractor.ts
│   ├── FramingExtractor.ts
│   ├── LightingExtractor.ts
│   ├── EnvironmentExtractor.ts
│   └── CompositionExtractor.ts
├── templates/
│   ├── image-analysis-prompt.md
│   ├── motion-compatibility-prompt.md
│   └── TemplateService.ts
└── cache/
    └── ImageAnalysisCache.ts

server/src/services/prompt-optimization/strategies/
└── ImageToVideoStrategy.ts

server/src/services/prompt-optimization/services/
└── I2VPromptBuilderService.ts

server/src/services/enhancement/services/
└── I2VConstrainedSuggestions.ts

server/src/llm/span-labeling/templates/
└── i2v-span-labeling-prompt.md

server/src/routes/image-analysis/
├── imageAnalysis.routes.ts
└── handlers/
    ├── analyze.ts
    └── checkCache.ts

client/src/features/prompt-optimizer/
├── types/i2v.ts
├── api/imageAnalysisApi.ts
├── hooks/useI2VContext.ts
└── components/
    ├── LockedSpanIndicator.tsx
    └── MotionSuggestionsPanel.tsx
```

### Files to Modify

```
server/src/services/prompt-optimization/
├── PromptOptimizationService.ts      # Add i2v detection and routing
└── services/StrategyFactory.ts       # Add ImageToVideoStrategy

server/src/services/enhancement/
└── EnhancementService.ts             # Add ground truth constraints

server/src/llm/span-labeling/
└── SpanLabelingService.ts            # Add i2v mode

client/src/features/prompt-optimizer/
├── PromptCanvas.tsx                  # Integrate i2v context
├── hooks/usePromptCanvasState.ts     # Add i2v state
└── components/SuggestionsPanel/      # Show motion suggestions
```

---

## Architecture Decision Records

### ADR-001: Server-Side Image Analysis

**Decision:** Image analysis happens server-side in `ImageAnalysisService`

**Rationale:**
1. Optimization already happens server-side
2. Can reuse existing AI service routing with circuit breakers
3. Can cache analysis results by image hash
4. Keeps sensitive API keys server-side
5. Single source of truth for ground truth

**Alternatives Considered:**
- Client-side analysis: Would require exposing API keys, no caching benefits
- Hybrid: Adds complexity, harder to maintain consistency

### ADR-002: Motion-Only Optimization for I2V

**Decision:** I2V optimization only modifies motion-related elements

**Rationale:**
1. Visual elements are fixed by source image
2. Modifying them causes generation conflicts
3. Users expect the video to match their image
4. Focus on what can actually change: motion

**Alternatives Considered:**
- Full optimization with filters: More complex, harder to explain to users
- Two-prompt system (scene + motion): Cleaner separation but more UI complexity

### ADR-003: Locked Category Visualization

**Decision:** Show locked spans with amber lock icon and tooltip explanation

**Rationale:**
1. Makes constraints visible to users
2. Explains why alternatives aren't available
3. Guides users toward motion-focused editing
4. Consistent with existing span highlighting

---

## Notes for Implementation

1. **Vision Model Selection**: GPT-4o-mini is recommended for cost-efficiency. Gemini 1.5 Flash is a good alternative.

2. **Caching Strategy**: Cache by image hash (SHA-256 of URL or base64 content). TTL of 24 hours is reasonable since images don't change.

3. **Confidence Thresholds**: If analysis confidence is below 0.5, warn user that constraints may be unreliable.

4. **Fallback Behavior**: If image analysis fails, fall back to t2v optimization with a warning.

5. **Performance**: Image analysis adds ~2-3s to the workflow. Consider showing a "analyzing image" state.

6. **Mobile**: Locked span indicators should be touch-friendly with tap-to-show tooltip.
