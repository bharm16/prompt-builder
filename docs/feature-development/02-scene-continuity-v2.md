# Feature 2: Scene-to-Scene Continuity (Revised)

> **"Shots that cut together."** — Maintain visual consistency across a sequence of video generations using pixel-based style transfer.

**Effort:** 3-4 weeks  
**Priority:** 2 (Build Second)  
**Dependencies:** Replicate API (IP-Adapter for style), fal.ai (PuLID for identity), existing video generation system

**Continuity Guarantee (Mandatory):** Every shot must be conditioned on a visual anchor (frame bridge, keyframe, or 3D proxy). Providers that cannot accept image inputs or reference images are blocked for continuity sessions.

---

## Continuity Mechanisms (Priority Order)

| Priority | Mechanism | When Used | Fidelity |
|----------|-----------|-----------|----------|
| 1 | **Provider-Native Style Reference** | Provider supports it | Highest |
| 2 | **Frame Bridge** | Direct continuation, same angle | High |
| 3 | **PuLID Identity Keyframe** | New angle with character continuity | High |
| 4 | **IP-Adapter Style Keyframe** | New angle without character, no native support | High |
| 5 | **Seed Persistence** | All generations | Medium (stabilizes noise) |

The system attempts mechanisms in priority order, using the highest-fidelity option available for each provider/scenario.

### Mandatory Continuity (Provider Gating)
Continuity is a product guarantee, not a best-effort hint. For any continuity session:
- **Hard requirement:** Every shot must have a visual anchor (frame bridge, keyframe, or 3D proxy render).
- **Provider gating:** If a provider cannot accept image inputs (start image or reference images), it is **ineligible** for continuity generation.
- **Failure mode:** The system returns a clear error and prompts the user to switch to an eligible provider.

---

## Problem Statement

User generates a beautiful clip of a woman in a red dress walking through neon-lit Tokyo streets. Now they want shot 2: same woman, same street, different angle.

They re-run the prompt. They get:
- Different shade of red
- Different neon colors (pink vs cyan)
- Different time of night
- Subtly different street architecture
- Different rain intensity

**The clips don't cut together.** They look like different films.

### Why Text-Based Approaches Fail

The naive solution is to extract a text description of the style ("neon pink, cyan accents, wet streets, low-key lighting") and inject it into the next prompt.

**This doesn't work because:**
- VLMs describe style in words; video models interpret words differently
- "Neon pink" has millions of variations in latent space
- Text is a lossy compression of visual information
- You're playing telephone: `Pixels → Text → Different Pixels`

### The Correct Approach: Pass Pixels, Not Text

Instead of translating style to text, pass the **visual signal** directly using:
1. **Frame Bridge** — Use last frame of Shot 1 as start image for Shot 2
2. **PuLID Keyframe** — When angles change and identity must be preserved
3. **IP-Adapter** — When angles change and no native style reference exists
4. **Seed Persistence** — Lock generation seeds where APIs support it
5. **Post-Grade (Histogram/LUT)** — Match color palette to reduce drift after generation

---

## Solution Overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Shot 1    │ ──▶ │  Extract Frame   │ ──▶ │   Shot 2    │
│  (Source)   │     │  (Style Signal)  │     │  (Matched)  │
└─────────────┘     └──────────────────┘     └─────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
     ┌────────────────┐         ┌─────────────────┐
     │  Frame Bridge  │         │ PuLID / IP-Adapter│
     │ (Direct i2v)   │         │ (Keyframe)        │
     └────────────────┘         └─────────────────┘
           │                            │
           │    Same angle/continuous   │  Different angle/composition
           ▼                            ▼
     ┌────────────────┐         ┌─────────────────┐
     │  startImage =  │         │ Generate anchored│
     │   last frame   │         │ keyframe, then   │
     │                │         │ use as start    │
     └────────────────┘         └─────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  Post-Grade      │
                    │ (Palette Match)  │
                    └──────────────────┘
```

### Decision Logic

```
Is this shot a direct continuation (same framing)?
    │
    ├─ YES → Use last frame directly as startImage (Frame Bridge)
    │
    └─ NO (different angle/composition) → 
           │
           ├─ Character continuity required → Generate PuLID keyframe
           │     (optionally style-transfer), then use as startImage
           │
           └─ No character continuity → Generate style keyframe via IP-Adapter
                 then use as startImage
```

---

## User Experience

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🎬 Scene: Tokyo Night Chase                              [+ Add Shot]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Shot Timeline                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   Shot 1    │───▶│   Shot 2    │───▶│   Shot 3    │                 │
│  │  [Preview]  │    │  [Preview]  │    │ [Generating]│                 │
│  │             │    │             │    │    ████░░   │                 │
│  │  Wide shot  │    │   Medium    │    │   Close-up  │                 │
│  │   ✓ Done    │    │   ✓ Done    │    │  In progress│                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
│        │                                     │                          │
│   [Style Source]                      [Style from Shot 1]               │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ 🎨 Style Reference                                                      │
│  ┌──────────────────┐                                                   │
│  │   [Frame from    │  This frame anchors the visual style for all     │
│  │    Shot 1]       │  subsequent shots. Click to change reference.    │
│  │                  │                                                   │
│  └──────────────────┘                                                   │
│                                                                         │
│  Continuity Mode:                                                       │
│  ◉ Frame Bridge (same angle) — Use last frame directly                 │
│  ○ Style Match (new angle) — Generate style-matched keyframe           │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ 📝 Shot 3 Prompt                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Close-up of her face, rain droplets on skin, she looks up     │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ☑ Maintain scene style (IP-Adapter strength: 0.6)                     │
│  ☑ Use character reference (if available)                              │
│                                                                         │
│  [Generate Shot 3]                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### Directory Structure

```
server/src/services/continuity/
├── index.ts                           # Public exports
├── types.ts                           # All type definitions
├── ContinuityService.ts               # Main orchestrator (< 300 lines)
├── AnchorService.ts                   # Continuity decision engine (< 150 lines)
├── FrameBridgeService.ts              # Frame extraction for i2v (< 150 lines)
├── StyleReferenceService.ts           # IP-Adapter style matching (< 200 lines)
├── CharacterKeyframeService.ts        # PuLID identity keyframe (< 200 lines)
├── ProviderStyleAdapter.ts            # Provider-native style reference routing (< 200 lines)
├── SeedPersistenceService.ts          # Seed extraction and injection (< 100 lines)
├── ContinuitySessionService.ts        # Session management (< 250 lines)
├── StyleAnalysisService.ts            # Optional: VLM analysis for UI/debugging (< 150 lines)
├── GradingService.ts                  # Histogram/LUT palette match (< 150 lines)
├── QualityGateService.ts              # Similarity scoring + auto-retry (< 150 lines)
├── SceneProxyService.ts               # Phase 2: 3D proxy (NeRF/Splat)
└── __tests__/
    ├── FrameBridgeService.test.ts
    ├── StyleReferenceService.test.ts
    └── fixtures/

client/src/features/continuity/
├── index.ts
├── types.ts
├── context/
│   └── ContinuitySessionContext.tsx   # Session state management
├── hooks/
│   ├── useContinuitySession.ts        # Main session hook (< 100 lines)
│   ├── useStyleReference.ts           # Style reference hook (< 80 lines)
│   └── useFrameBridge.ts              # Frame bridge hook (< 60 lines)
├── components/
│   ├── ContinuitySession/
│   │   ├── ContinuitySession.tsx      # Main container (< 150 lines)
│   │   ├── SessionTimeline.tsx        # Shot sequence view (< 120 lines)
│   │   ├── ShotCard.tsx               # Individual shot (< 100 lines)
│   │   └── index.ts
│   ├── StyleReferencePanel/
│   │   ├── StyleReferencePanel.tsx    # Reference frame display (< 100 lines)
│   │   ├── StrengthSlider.tsx         # IP-Adapter strength (< 40 lines)
│   │   └── index.ts
│   ├── ShotEditor/
│   │   ├── ShotEditor.tsx             # New shot prompt editor (< 120 lines)
│   │   ├── ContinuityModeToggle.tsx   # Frame bridge vs style match (< 60 lines)
│   │   └── index.ts
│   └── ContinueSceneButton/
│       └── ContinueSceneButton.tsx    # Trigger from generation (< 60 lines)
└── api/
    └── continuityApi.ts               # API calls (< 80 lines)
```

---

## Type Definitions

### Core Types

```typescript
// server/src/services/continuity/types.ts

import { VideoModelId } from '@/types/video';

/**
 * A frame extracted from a video for style reference or i2v input
 */
export interface StyleReference {
  id: string;
  sourceVideoId: string;
  sourceFrameIndex: number;
  
  // The actual visual signal
  frameUrl: string;                    // URL to stored frame image
  frameTimestamp: number;              // Seconds into video
  
  // Frame metadata
  resolution: {
    width: number;
    height: number;
  };
  aspectRatio: string;
  
  // Optional: pre-computed for faster IP-Adapter calls
  clipEmbedding?: string;              // Base64 encoded embedding
  
  // Optional: text description for UI/debugging only (NOT for generation)
  analysisMetadata?: StyleAnalysisMetadata;
  
  extractedAt: Date;
}

/**
 * Optional metadata from VLM analysis — for UI display only, not generation
 */
export interface StyleAnalysisMetadata {
  dominantColors: string[];            // For color swatches in UI
  lightingDescription: string;         // Human-readable
  moodDescription: string;             // Human-readable
  confidence: number;
}

/**
 * Provider-specific continuity capabilities
 */
export interface ProviderContinuityCapabilities {
  supportsNativeStyleReference: boolean;   // e.g., Runway --sref
  supportsNativeCharacterReference: boolean; // e.g., Kling face lock
  supportsStartImage: boolean;             // i2v capability
  supportsSeedPersistence: boolean;        // Seed can be extracted and reused
  supportsExtendVideo: boolean;            // Native video extension
  
  // Provider-specific config
  styleReferenceParam?: string;            // API parameter name
  maxStyleReferenceImages?: number;        // Some support multiple refs
}

/**
 * Known provider capabilities
 */
export const PROVIDER_CAPABILITIES: Record<string, ProviderContinuityCapabilities> = {
  'runway': {
    supportsNativeStyleReference: true,
    supportsNativeCharacterReference: true,
    supportsStartImage: true,
    supportsSeedPersistence: true,
    supportsExtendVideo: true,
    styleReferenceParam: 'style_reference',
  },
  'kling': {
    supportsNativeStyleReference: false,
    supportsNativeCharacterReference: true,  // IP mode with face
    supportsStartImage: true,
    supportsSeedPersistence: false,
    supportsExtendVideo: false,
  },
  'luma': {
    supportsNativeStyleReference: false,
    supportsNativeCharacterReference: false,
    supportsStartImage: true,               // keyframes.frame0
    supportsSeedPersistence: false,
    supportsExtendVideo: true,              // extend_video endpoint
  },
  'veo': {
    supportsNativeStyleReference: false,
    supportsNativeCharacterReference: false,
    supportsStartImage: true,
    supportsSeedPersistence: false,
    supportsExtendVideo: false,
  },
  'sora': {
    supportsNativeStyleReference: false,
    supportsNativeCharacterReference: false,
    supportsStartImage: true,
    supportsSeedPersistence: false,
    supportsExtendVideo: false,
  },
  'replicate': {
    supportsNativeStyleReference: false,    // But we use IP-Adapter
    supportsNativeCharacterReference: false,
    supportsStartImage: true,
    supportsSeedPersistence: true,
    supportsExtendVideo: false,
  },
};

/**
 * Seed information for reproducibility
 */
export interface SeedInfo {
  seed: number;
  provider: string;
  modelId: string;
  extractedAt: Date;
}

/**
 * Frame bridge for direct i2v continuation
 */
export interface FrameBridge {
  id: string;
  sourceVideoId: string;
  sourceShotId: string;
  
  frameUrl: string;
  framePosition: 'first' | 'last';
  frameTimestamp: number;
  
  resolution: {
    width: number;
    height: number;
  };
  aspectRatio: string;
  
  extractedAt: Date;
}

/**
 * A single shot in a continuity session
 */
export interface ContinuityShot {
  id: string;
  sessionId: string;
  sequenceIndex: number;
  
  // User input
  userPrompt: string;
  
  // Continuity settings for this shot
  continuityMode: 'frame-bridge' | 'style-match' | 'native' | 'none';
  styleStrength: number;               // 0.0-1.0, IP-Adapter scale
  
  // Style linkage — which shot provides the style reference
  styleReferenceId: string | null;     // Shot ID to inherit from (null = this is source)
  styleReference?: StyleReference;     // Resolved reference
  
  // Frame bridge (for direct continuation)
  frameBridge?: FrameBridge;
  
  // Character reference (optional, from existing asset system)
  characterAssetId?: string;
  
  // Generation details
  modelId: VideoModelId;
  
  // Seed persistence
  seedInfo?: SeedInfo;                 // Seed from this generation
  inheritedSeed?: number;              // Seed to use (from previous shot)
  
  videoAssetId?: string;
  previewAssetId?: string;
  
  // Generated keyframe (if style-match mode)
  generatedKeyframeUrl?: string;
  
  // Which continuity mechanism was actually used
  continuityMechanismUsed?: 'native-style-ref' | 'frame-bridge' | 'ip-adapter' | 'seed-only' | 'none';
  
  // State
  status: 'draft' | 'generating-keyframe' | 'generating-video' | 'completed' | 'failed';
  error?: string;
  
  createdAt: Date;
  generatedAt?: Date;
}

/**
 * A multi-shot continuity session
 */
export interface ContinuitySession {
  id: string;
  userId: string;
  
  // Metadata
  name: string;
  description?: string;
  
  // The source of truth for visual style
  primaryStyleReference: StyleReference;
  
  // Shots in sequence
  shots: ContinuityShot[];
  
  // Default settings for new shots
  defaultSettings: ContinuitySessionSettings;
  
  // State
  status: 'active' | 'completed' | 'archived';
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ContinuitySessionSettings {
  defaultContinuityMode: 'frame-bridge' | 'style-match';
  defaultStyleStrength: number;        // 0.0-1.0
  defaultModel: VideoModelId;
  autoExtractFrameBridge: boolean;     // Auto-extract last frame after generation
  useCharacterConsistency: boolean;    // Use character assets if available
}

/**
 * IP-Adapter generation options
 */
export interface StyleMatchOptions {
  prompt: string;
  styleReferenceUrl: string;
  strength: number;                    // 0.0-1.0, maps to ip_adapter_scale
  aspectRatio?: '16:9' | '9:16' | '1:1';
  negativePrompt?: string;
}

/**
 * Request to create a new shot
 */
export interface CreateShotRequest {
  sessionId: string;
  prompt: string;
  
  // Continuity options
  continuityMode?: 'frame-bridge' | 'style-match' | 'none';
  styleReferenceId?: string;           // Which shot to match (defaults to previous)
  styleStrength?: number;              // Override default
  
  // Generation options
  modelId?: VideoModelId;
  characterAssetId?: string;
}

/**
 * Session creation request
 */
export interface CreateSessionRequest {
  name: string;
  description?: string;
  
  // Must provide one of these to establish style reference
  sourceVideoId?: string;              // Create from existing video
  sourceImageUrl?: string;             // Create from reference image
  initialPrompt?: string;              // Will generate first shot
  
  // Settings
  settings?: Partial<ContinuitySessionSettings>;
}
```

---

## Implementation Details

### 1. FrameBridgeService

Extracts frames from videos for direct i2v continuation.

```typescript
// server/src/services/continuity/FrameBridgeService.ts

import { StorageService } from '@/services/storage/StorageService';
import { FrameBridge } from './types';
import ffmpeg from 'fluent-ffmpeg';
import { logger } from '@/infrastructure/Logger';

export class FrameBridgeService {
  private readonly log = logger.child({ service: 'FrameBridgeService' });
  
  constructor(
    private storage: StorageService
  ) {}

  /**
   * Extract a frame from a video for use as i2v input
   */
  async extractBridgeFrame(
    videoId: string,
    videoUrl: string,
    shotId: string,
    position: 'first' | 'last' = 'last'
  ): Promise<FrameBridge> {
    this.log.info('Extracting bridge frame', { videoId, position });
    
    // Get video metadata
    const metadata = await this.getVideoMetadata(videoUrl);
    
    // Calculate timestamp
    const timestamp = position === 'first' 
      ? 0 
      : Math.max(0, metadata.duration - 0.1); // Slightly before end to avoid black frame
    
    // Extract frame
    const frameBuffer = await this.extractFrameAt(videoUrl, timestamp);
    
    // Store frame
    const framePath = `continuity/frames/${videoId}/${position}.png`;
    const frameUrl = await this.storage.uploadImage(frameBuffer, framePath, {
      contentType: 'image/png',
      metadata: {
        sourceVideo: videoId,
        position,
        timestamp: timestamp.toString(),
      }
    });

    return {
      id: this.generateId(),
      sourceVideoId: videoId,
      sourceShotId: shotId,
      frameUrl,
      framePosition: position,
      frameTimestamp: timestamp,
      resolution: {
        width: metadata.width,
        height: metadata.height,
      },
      aspectRatio: this.calculateAspectRatio(metadata.width, metadata.height),
      extractedAt: new Date(),
    };
  }

  /**
   * Extract the most representative frame (clearest, best-lit)
   * Uses simple heuristics — could be enhanced with VLM scoring
   */
  async extractRepresentativeFrame(
    videoId: string,
    videoUrl: string,
    shotId: string
  ): Promise<FrameBridge> {
    const metadata = await this.getVideoMetadata(videoUrl);
    
    // Sample frames at 25%, 50%, 75% and pick based on sharpness
    const candidates = [0.25, 0.5, 0.75].map(pct => pct * metadata.duration);
    
    let bestFrame: Buffer | null = null;
    let bestTimestamp = candidates[1]; // Default to middle
    let bestScore = 0;
    
    for (const timestamp of candidates) {
      const frame = await this.extractFrameAt(videoUrl, timestamp);
      const score = await this.scoreFrameQuality(frame);
      
      if (score > bestScore) {
        bestScore = score;
        bestFrame = frame;
        bestTimestamp = timestamp;
      }
    }
    
    const framePath = `continuity/frames/${videoId}/representative.png`;
    const frameUrl = await this.storage.uploadImage(bestFrame!, framePath, {
      contentType: 'image/png',
    });

    return {
      id: this.generateId(),
      sourceVideoId: videoId,
      sourceShotId: shotId,
      frameUrl,
      framePosition: bestTimestamp / metadata.duration as any, // Store as ratio
      frameTimestamp: bestTimestamp,
      resolution: {
        width: metadata.width,
        height: metadata.height,
      },
      aspectRatio: this.calculateAspectRatio(metadata.width, metadata.height),
      extractedAt: new Date(),
    };
  }

  private async getVideoMetadata(videoUrl: string): Promise<{
    duration: number;
    width: number;
    height: number;
    fps: number;
  }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoUrl, (err, metadata) => {
        if (err) return reject(err);
        
        const video = metadata.streams.find(s => s.codec_type === 'video');
        if (!video) return reject(new Error('No video stream found'));
        
        resolve({
          duration: metadata.format.duration || 0,
          width: video.width || 1920,
          height: video.height || 1080,
          fps: eval(video.r_frame_rate || '24') || 24,
        });
      });
    });
  }

  private async extractFrameAt(videoUrl: string, timestamp: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      
      ffmpeg(videoUrl)
        .seekInput(timestamp)
        .frames(1)
        .format('image2pipe')
        .outputOptions('-vcodec png')
        .on('error', reject)
        .pipe()
        .on('data', (chunk: Buffer) => chunks.push(chunk))
        .on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  private async scoreFrameQuality(frame: Buffer): Promise<number> {
    // Simple Laplacian variance for sharpness estimation
    // Higher variance = sharper image
    // In production, could use sharp library for better analysis
    const sharp = await import('sharp');
    const { data, info } = await sharp.default(frame)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Calculate variance of Laplacian (approximation)
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
      sumSq += data[i] * data[i];
    }
    const mean = sum / data.length;
    const variance = (sumSq / data.length) - (mean * mean);
    
    return variance;
  }

  private calculateAspectRatio(width: number, height: number): string {
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  }

  private generateId(): string {
    return `frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 2. StyleReferenceService

Uses IP-Adapter to generate style-matched keyframes (style only).

```typescript
// server/src/services/continuity/StyleReferenceService.ts

import Replicate from 'replicate';
import { StyleReference, StyleMatchOptions, FrameBridge } from './types';
import { StorageService } from '@/services/storage/StorageService';
import { logger } from '@/infrastructure/Logger';

const IP_ADAPTER_MODEL = 'lucataco/ip-adapter-sdxl:cbe488c8df305a99d155b038abdf003a0bba4e82352e561fbaab2c8c9b70a96e';

// Strength presets for different use cases
export const STYLE_STRENGTH_PRESETS = {
  loose: 0.4,      // Color palette and mood only
  balanced: 0.6,   // Good balance of style matching and prompt flexibility
  strict: 0.8,     // Strong style adherence
  exact: 0.95,     // Near-identical style (reduces prompt influence)
} as const;

export class StyleReferenceService {
  private readonly replicate: Replicate;
  private readonly log = logger.child({ service: 'StyleReferenceService' });
  
  constructor(
    private storage: StorageService,
    replicateApiToken?: string
  ) {
    this.replicate = new Replicate({
      auth: replicateApiToken || process.env.REPLICATE_API_TOKEN,
    });
  }

  /**
   * Create a style reference from a video
   */
  async createFromVideo(
    videoId: string,
    frame: FrameBridge
  ): Promise<StyleReference> {
    return {
      id: this.generateId(),
      sourceVideoId: videoId,
      sourceFrameIndex: 0, // From frame bridge
      frameUrl: frame.frameUrl,
      frameTimestamp: frame.frameTimestamp,
      resolution: frame.resolution,
      aspectRatio: frame.aspectRatio,
      extractedAt: new Date(),
    };
  }

  /**
   * Create a style reference from an uploaded image
   */
  async createFromImage(
    imageUrl: string,
    resolution: { width: number; height: number }
  ): Promise<StyleReference> {
    return {
      id: this.generateId(),
      sourceVideoId: 'image-upload',
      sourceFrameIndex: 0,
      frameUrl: imageUrl,
      frameTimestamp: 0,
      resolution,
      aspectRatio: this.calculateAspectRatio(resolution.width, resolution.height),
      extractedAt: new Date(),
    };
  }

  /**
   * Generate a style-matched keyframe using IP-Adapter
   * This is the core of the style continuity system
   */
  async generateStyledKeyframe(options: StyleMatchOptions): Promise<string> {
    this.log.info('Generating style-matched keyframe', {
      strength: options.strength,
      hasNegativePrompt: !!options.negativePrompt,
    });

    const startTime = Date.now();

    try {
      const output = await this.replicate.run(IP_ADAPTER_MODEL, {
        input: {
          prompt: options.prompt,
          ip_adapter_image: options.styleReferenceUrl,
          ip_adapter_scale: options.strength,
          negative_prompt: options.negativePrompt || 'blurry, low quality, distorted',
          num_inference_steps: 30,
          guidance_scale: 7.5,
          width: this.getWidthForAspectRatio(options.aspectRatio),
          height: this.getHeightForAspectRatio(options.aspectRatio),
        }
      }) as string[];

      if (!output || !output[0]) {
        throw new Error('IP-Adapter returned no output');
      }

      // Store the generated keyframe
      const keyframeUrl = output[0];
      const storedUrl = await this.storeKeyframe(keyframeUrl, options);

      this.log.info('Style-matched keyframe generated', {
        durationMs: Date.now() - startTime,
      });

      return storedUrl;

    } catch (error) {
      this.log.error('Failed to generate styled keyframe', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Generate keyframe with character consistency
   */
  async generateStyledKeyframeWithCharacter(
    options: StyleMatchOptions,
    characterReferenceUrl: string
  ): Promise<string> {
    // Deprecated: IP-Adapter FaceID is replaced by PuLID for identity.
    // Keep this method only if needed for legacy fallback.
    return this.generateStyledKeyframe(options);
  }

  private async storeKeyframe(
    sourceUrl: string,
    options: StyleMatchOptions
  ): Promise<string> {
    // Download and re-upload to our storage for permanence
    const response = await fetch(sourceUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    
    const path = `continuity/keyframes/${Date.now()}.png`;
    return this.storage.uploadImage(buffer, path, {
      contentType: 'image/png',
      metadata: {
        prompt: options.prompt.slice(0, 200),
        strength: options.strength.toString(),
      }
    });
  }

  private getWidthForAspectRatio(ratio?: string): number {
    switch (ratio) {
      case '9:16': return 768;
      case '1:1': return 1024;
      case '16:9':
      default: return 1024;
    }
  }

  private getHeightForAspectRatio(ratio?: string): number {
    switch (ratio) {
      case '9:16': return 1344;
      case '1:1': return 1024;
      case '16:9':
      default: return 576;
    }
  }

  private calculateAspectRatio(width: number, height: number): string {
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  }

  private generateId(): string {
    return `styleref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 3. ProviderStyleAdapter

Routes style reference requests to provider-native APIs when available, falling back to IP-Adapter.

```typescript
// server/src/services/continuity/ProviderStyleAdapter.ts

import { 
  PROVIDER_CAPABILITIES, 
  ProviderContinuityCapabilities,
  StyleReference,
  StyleMatchOptions,
  SeedInfo,
} from './types';
import { StyleReferenceService } from './StyleReferenceService';
import { logger } from '@/infrastructure/Logger';

/**
 * Routes style continuity to the most effective mechanism per provider
 */
export class ProviderStyleAdapter {
  private readonly log = logger.child({ service: 'ProviderStyleAdapter' });

  constructor(
    private styleRefService: StyleReferenceService
  ) {}

  /**
   * Get the best continuity strategy for a provider
   */
  getContinuityStrategy(
    provider: string,
    mode: 'frame-bridge' | 'style-match' | 'native' | 'none'
  ): ContinuityStrategy {
    const caps = this.getCapabilities(provider);

    // If native style reference is supported AND requested, use it
    if (mode === 'native' && caps.supportsNativeStyleReference) {
      return { type: 'native-style-ref', provider };
    }

    // Frame bridge is preferred for direct continuation
    if (mode === 'frame-bridge' && caps.supportsStartImage) {
      return { type: 'frame-bridge' };
    }

    // Style match via IP-Adapter (our fallback for providers without native support)
    if (mode === 'style-match') {
      if (caps.supportsNativeStyleReference) {
        return { type: 'native-style-ref', provider };
      }
      return { type: 'ip-adapter' };
    }

    return { type: 'none' };
  }

  /**
   * Build provider-specific generation options with style reference
   */
  async buildGenerationOptions(
    provider: string,
    baseOptions: Record<string, unknown>,
    styleRef: StyleReference,
    strength: number
  ): Promise<{
    options: Record<string, unknown>;
    requiresKeyframe: boolean;
    keyframeUrl?: string;
  }> {
    const caps = this.getCapabilities(provider);

    // Provider has native style reference — use it directly
    if (caps.supportsNativeStyleReference && caps.styleReferenceParam) {
      this.log.info('Using native style reference', { provider });
      return {
        options: {
          ...baseOptions,
          [caps.styleReferenceParam]: styleRef.frameUrl,
          style_reference_weight: strength,
        },
        requiresKeyframe: false,
      };
    }

    // No native support — generate keyframe via IP-Adapter
    this.log.info('Generating IP-Adapter keyframe', { provider });
    const keyframeUrl = await this.styleRefService.generateStyledKeyframe({
      prompt: baseOptions.prompt as string,
      styleReferenceUrl: styleRef.frameUrl,
      strength,
      aspectRatio: styleRef.aspectRatio as any,
    });

    return {
      options: {
        ...baseOptions,
        startImage: keyframeUrl,
      },
      requiresKeyframe: true,
      keyframeUrl,
    };
  }

  /**
   * Extract provider from model ID
   */
  getProviderFromModel(modelId: string): string {
    if (modelId.includes('runway')) return 'runway';
    if (modelId.includes('kling')) return 'kling';
    if (modelId.includes('luma') || modelId.includes('ray')) return 'luma';
    if (modelId.includes('veo')) return 'veo';
    if (modelId.includes('sora')) return 'sora';
    return 'replicate'; // Default fallback
  }

  getCapabilities(provider: string): ProviderContinuityCapabilities {
    return PROVIDER_CAPABILITIES[provider] || PROVIDER_CAPABILITIES['replicate'];
  }
}

interface ContinuityStrategy {
  type: 'native-style-ref' | 'frame-bridge' | 'ip-adapter' | 'none';
  provider?: string;
}
```

### 4. SeedPersistenceService

Extracts and injects seeds for generation reproducibility.

```typescript
// server/src/services/continuity/SeedPersistenceService.ts

import { SeedInfo, PROVIDER_CAPABILITIES } from './types';
import { logger } from '@/infrastructure/Logger';

/**
 * Manages seed extraction and injection for generation consistency
 * 
 * Seeds stabilize latent noise patterns. While not guaranteeing identical results
 * across different prompts, they help maintain compositional consistency.
 */
export class SeedPersistenceService {
  private readonly log = logger.child({ service: 'SeedPersistenceService' });

  /**
   * Extract seed from generation result if provider supports it
   */
  extractSeed(
    provider: string,
    modelId: string,
    generationResult: Record<string, unknown>
  ): SeedInfo | null {
    const caps = PROVIDER_CAPABILITIES[provider];
    
    if (!caps?.supportsSeedPersistence) {
      this.log.debug('Provider does not support seed persistence', { provider });
      return null;
    }

    // Different providers return seeds differently
    const seed = this.extractSeedFromResult(provider, generationResult);
    
    if (seed === null) {
      this.log.debug('No seed found in generation result', { provider });
      return null;
    }

    this.log.info('Extracted seed from generation', { provider, seed });

    return {
      seed,
      provider,
      modelId,
      extractedAt: new Date(),
    };
  }

  /**
   * Build seed parameter for generation request
   */
  buildSeedParam(
    provider: string,
    seed?: number
  ): Record<string, unknown> {
    if (!seed) return {};

    const caps = PROVIDER_CAPABILITIES[provider];
    if (!caps?.supportsSeedPersistence) {
      this.log.debug('Provider does not support seed injection', { provider });
      return {};
    }

    // Provider-specific seed parameter names
    const seedParams = this.getSeedParamName(provider);
    
    this.log.info('Injecting seed into generation', { provider, seed });
    
    return { [seedParams]: seed };
  }

  /**
   * Get seed from previous shot in sequence
   */
  getInheritedSeed(
    previousShotSeedInfo: SeedInfo | undefined,
    currentProvider: string
  ): number | undefined {
    if (!previousShotSeedInfo) return undefined;

    // Seeds are only useful within the same provider
    if (previousShotSeedInfo.provider !== currentProvider) {
      this.log.debug('Cannot inherit seed across providers', {
        from: previousShotSeedInfo.provider,
        to: currentProvider,
      });
      return undefined;
    }

    return previousShotSeedInfo.seed;
  }

  private extractSeedFromResult(
    provider: string,
    result: Record<string, unknown>
  ): number | null {
    switch (provider) {
      case 'replicate':
        // Replicate returns seed in metrics or output
        return (result.seed as number) 
          || (result.metrics as any)?.seed 
          || null;
      
      case 'runway':
        // Runway returns seed in generation metadata
        return (result.generation as any)?.seed || null;
      
      default:
        // Try common field names
        return (result.seed as number) || null;
    }
  }

  private getSeedParamName(provider: string): string {
    switch (provider) {
      case 'replicate':
        return 'seed';
      case 'runway':
        return 'seed';
      default:
        return 'seed';
    }
  }
}
```

### 5. StyleAnalysisService (Optional — UI/Debugging Only)

```typescript
// server/src/services/continuity/StyleAnalysisService.ts

/**
 * IMPORTANT: This service is for UI display and debugging ONLY.
 * It does NOT participate in the generation pipeline.
 * Style continuity is achieved via pixel-based methods (FrameBridge, IP-Adapter).
 */

import { StyleAnalysisMetadata } from './types';
import type { AIService } from '@/services/prompt-optimization/types';
import { logger } from '@/infrastructure/Logger';

export class StyleAnalysisService {
  private readonly log = logger.child({ service: 'StyleAnalysisService' });

  constructor(private ai: AIService) {}

  /**
   * Analyze a frame for UI display purposes only
   * Returns human-readable descriptions for the style panel
   */
  async analyzeForDisplay(imageUrl: string): Promise<StyleAnalysisMetadata> {
    try {
      const response = await this.ai.completeWithVision({
        prompt: ANALYSIS_PROMPT,
        imageUrl,
        responseFormat: 'json',
        maxTokens: 500,
      });

      const parsed = JSON.parse(response.content);
      
      return {
        dominantColors: parsed.colors || [],
        lightingDescription: parsed.lighting || 'Unknown',
        moodDescription: parsed.mood || 'Unknown',
        confidence: parsed.confidence || 0.5,
      };
    } catch (error) {
      this.log.warn('Style analysis failed, returning defaults', {
        error: (error as Error).message,
      });
      
      return {
        dominantColors: [],
        lightingDescription: 'Unable to analyze',
        moodDescription: 'Unable to analyze',
        confidence: 0,
      };
    }
  }
}

const ANALYSIS_PROMPT = `Analyze this image and provide a brief description for a UI display.
Return JSON with:
{
  "colors": ["color1", "color2", "color3"],  // 3 dominant colors as simple names
  "lighting": "Brief lighting description",   // e.g., "Warm golden hour light from left"
  "mood": "One word mood",                    // e.g., "Melancholic", "Energetic"
  "confidence": 0.0-1.0
}

Be concise. This is for display only, not generation.`;
```

### 6. ContinuitySessionService

Orchestrates the full continuity workflow.

```typescript
// server/src/services/continuity/ContinuitySessionService.ts

import { 
  ContinuitySession, 
  ContinuityShot, 
  CreateSessionRequest,
  CreateShotRequest,
  ContinuitySessionSettings,
  StyleReference,
} from './types';
import { AnchorService } from './AnchorService';
import { FrameBridgeService } from './FrameBridgeService';
import { StyleReferenceService, STYLE_STRENGTH_PRESETS } from './StyleReferenceService';
import { CharacterKeyframeService } from './CharacterKeyframeService';
import { ProviderStyleAdapter } from './ProviderStyleAdapter';
import { SeedPersistenceService } from './SeedPersistenceService';
import { StyleAnalysisService } from './StyleAnalysisService';
import { GradingService } from './GradingService';
import { QualityGateService } from './QualityGateService';
import { VideoGenerationService } from '@/services/video-generation/VideoGenerationService';
import { logger } from '@/infrastructure/Logger';

export class ContinuitySessionService {
  private readonly log = logger.child({ service: 'ContinuitySessionService' });

  constructor(
    private anchorService: AnchorService,
    private frameBridge: FrameBridgeService,
    private styleReference: StyleReferenceService,
    private characterKeyframes: CharacterKeyframeService,
    private providerAdapter: ProviderStyleAdapter,
    private seedService: SeedPersistenceService,
    private styleAnalysis: StyleAnalysisService,
    private grading: GradingService,
    private qualityGate: QualityGateService,
    private videoGenerator: VideoGenerationService,
    private sessionStore: SessionStore
  ) {}

  /**
   * Create a new continuity session
   */
  async createSession(
    userId: string,
    request: CreateSessionRequest
  ): Promise<ContinuitySession> {
    this.log.info('Creating continuity session', { userId, name: request.name });

    // Establish the primary style reference
    let primaryStyleReference: StyleReference;

    if (request.sourceVideoId) {
      // Create from existing video — extract representative frame
      const videoUrl = await this.videoGenerator.getVideoUrl(request.sourceVideoId);
      const frame = await this.frameBridge.extractRepresentativeFrame(
        request.sourceVideoId,
        videoUrl,
        'initial'
      );
      primaryStyleReference = await this.styleReference.createFromVideo(
        request.sourceVideoId,
        frame
      );
    } else if (request.sourceImageUrl) {
      // Create from reference image
      primaryStyleReference = await this.styleReference.createFromImage(
        request.sourceImageUrl,
        { width: 1920, height: 1080 } // Default, could extract from image
      );
    } else {
      throw new Error('Must provide sourceVideoId or sourceImageUrl');
    }

    // Optionally analyze for UI display
    primaryStyleReference.analysisMetadata = await this.styleAnalysis.analyzeForDisplay(
      primaryStyleReference.frameUrl
    );

    const session: ContinuitySession = {
      id: this.generateSessionId(),
      userId,
      name: request.name,
      description: request.description,
      primaryStyleReference,
      shots: [],
      defaultSettings: { ...this.defaultSettings(), ...request.settings },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.sessionStore.save(session);
    
    this.log.info('Session created', { sessionId: session.id });
    return session;
  }

  /**
   * Add a new shot to a session
   */
  async addShot(request: CreateShotRequest): Promise<ContinuityShot> {
    const session = await this.sessionStore.get(request.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${request.sessionId}`);
    }

    const sequenceIndex = session.shots.length;
    const previousShot = session.shots[sequenceIndex - 1];
    
    // Determine which shot to use as style reference
    const styleReferenceId = request.styleReferenceId 
      || previousShot?.id 
      || null; // null means use primary reference

    // Resolve continuity mode
    const continuityMode = request.continuityMode 
      || session.defaultSettings.defaultContinuityMode;

    // Get frame bridge if using frame-bridge mode and there's a previous shot
    let frameBridge;
    if (continuityMode === 'frame-bridge' && previousShot?.videoAssetId) {
      const videoUrl = await this.videoGenerator.getVideoUrl(previousShot.videoAssetId);
      frameBridge = await this.frameBridge.extractBridgeFrame(
        previousShot.videoAssetId,
        videoUrl,
        previousShot.id,
        'last'
      );
    }

    const shot: ContinuityShot = {
      id: this.generateShotId(),
      sessionId: session.id,
      sequenceIndex,
      userPrompt: request.prompt,
      continuityMode,
      styleStrength: request.styleStrength ?? session.defaultSettings.defaultStyleStrength,
      styleReferenceId,
      frameBridge,
      characterAssetId: request.characterAssetId,
      modelId: request.modelId || session.defaultSettings.defaultModel,
      status: 'draft',
      createdAt: new Date(),
    };

    session.shots.push(shot);
    session.updatedAt = new Date();
    await this.sessionStore.save(session);

    return shot;
  }

  /**
   * Generate a shot — the core continuity workflow
   */
  async generateShot(sessionId: string, shotId: string): Promise<ContinuityShot> {
    const session = await this.sessionStore.get(sessionId);
    const shot = session?.shots.find(s => s.id === shotId);
    if (!session || !shot) {
      throw new Error(`Shot not found: ${shotId}`);
    }

    const provider = this.providerAdapter.getProviderFromModel(shot.modelId);
    const previousShot = session.shots.find(s => s.sequenceIndex === shot.sequenceIndex - 1);

    this.log.info('Generating shot', { 
      sessionId, 
      shotId, 
      mode: shot.continuityMode,
      strength: shot.styleStrength,
      provider,
    });

    try {
      let startImageUrl: string | undefined;
      let continuityMechanismUsed: ContinuityShot['continuityMechanismUsed'] = 'none';

      // Get inherited seed from previous shot (if same provider supports it)
      const inheritedSeed = this.seedService.getInheritedSeed(
        previousShot?.seedInfo,
        provider
      );
      shot.inheritedSeed = inheritedSeed;

      // STEP 0: Enforce continuity gating (provider must support image inputs)
      this.anchorService.assertProviderSupportsContinuity(provider);

      // STEP 1: Determine continuity mechanism based on mode + provider capabilities
      const strategy = this.providerAdapter.getContinuityStrategy(provider, shot.continuityMode);

      if (strategy.type === 'native-style-ref') {
        // Provider has native style reference — best case
        this.log.info('Using native style reference', { provider });
        continuityMechanismUsed = 'native-style-ref';
        // Style ref will be injected via buildGenerationOptions below

      } else if (strategy.type === 'frame-bridge' && shot.frameBridge) {
        // Direct continuation — use last frame as-is
        startImageUrl = shot.frameBridge.frameUrl;
        continuityMechanismUsed = 'frame-bridge';
        this.log.info('Using frame bridge for direct continuation');

      } else if (strategy.type === 'ip-adapter') {
        // Different angle, no native support — generate keyframe via IP-Adapter (style only)
        shot.status = 'generating-keyframe';
        await this.sessionStore.save(session);

        const styleRef = this.resolveStyleReference(session, shot);
        
        startImageUrl = await this.styleReference.generateStyledKeyframe({
          prompt: shot.userPrompt,
          styleReferenceUrl: styleRef.frameUrl,
          strength: shot.styleStrength,
          aspectRatio: styleRef.aspectRatio as any,
        });
        
        shot.generatedKeyframeUrl = startImageUrl;
        continuityMechanismUsed = 'ip-adapter';
        this.log.info('Generated style-matched keyframe via IP-Adapter');

      } else if (inheritedSeed) {
        // No visual continuity, but we can at least use seed
        continuityMechanismUsed = 'seed-only';
        this.log.info('Using seed-only continuity');
      }

      // STEP 2: Build generation options (handles native style ref injection)
      let generationOptions: Record<string, unknown> = {
        prompt: shot.userPrompt,
        model: shot.modelId,
        startImage: startImageUrl,
        characterAssetId: shot.characterAssetId,
      };

      // Inject seed if available
      const seedParams = this.seedService.buildSeedParam(provider, inheritedSeed);
      generationOptions = { ...generationOptions, ...seedParams };

      // Handle native style reference
      if (strategy.type === 'native-style-ref') {
        const styleRef = this.resolveStyleReference(session, shot);
        const { options } = await this.providerAdapter.buildGenerationOptions(
          provider,
          generationOptions,
          styleRef,
          shot.styleStrength
        );
        generationOptions = options;
      }

      // STEP 3: Generate video
      shot.status = 'generating-video';
      await this.sessionStore.save(session);

      const result = await this.videoGenerator.generate(generationOptions);

      // STEP 4: Extract seed from result
      const seedInfo = this.seedService.extractSeed(provider, shot.modelId, result);
      shot.seedInfo = seedInfo || undefined;

      // STEP 5: Post-grade (palette match) + quality gate
      await this.grading.matchPalette(result.assetId, this.resolveStyleReference(session, shot).frameUrl);
      await this.qualityGate.assertContinuity(result.assetId, shot);

      // STEP 6: Extract frame bridge for next shot
      if (session.defaultSettings.autoExtractFrameBridge) {
        const videoUrl = await this.videoGenerator.getVideoUrl(result.assetId);
        await this.frameBridge.extractBridgeFrame(
          result.assetId,
          videoUrl,
          shot.id,
          'last'
        );
      }

      // Update shot with result
      shot.videoAssetId = result.assetId;
      shot.continuityMechanismUsed = continuityMechanismUsed;
      shot.status = 'completed';
      shot.generatedAt = new Date();

      this.log.info('Shot generation completed', { 
        shotId, 
        assetId: result.assetId,
        continuityMechanism: continuityMechanismUsed,
        seedPersisted: !!seedInfo,
      });

    } catch (error) {
      shot.status = 'failed';
      shot.error = error instanceof Error ? error.message : 'Generation failed';
      this.log.error('Shot generation failed', { shotId, error: shot.error });
    }

    session.updatedAt = new Date();
    await this.sessionStore.save(session);

    return shot;
  }

  /**
   * Resolve which style reference to use for a shot
   */
  private resolveStyleReference(
    session: ContinuitySession, 
    shot: ContinuityShot
  ): StyleReference {
    if (!shot.styleReferenceId) {
      // Use primary session reference
      return session.primaryStyleReference;
    }

    // Find the referenced shot
    const refShot = session.shots.find(s => s.id === shot.styleReferenceId);
    if (!refShot?.styleReference) {
      // Fallback to primary
      return session.primaryStyleReference;
    }

    return refShot.styleReference;
  }

  /**
   * Update style reference for a shot (non-linear inheritance)
   */
  async updateShotStyleReference(
    sessionId: string,
    shotId: string,
    styleReferenceId: string
  ): Promise<ContinuityShot> {
    const session = await this.sessionStore.get(sessionId);
    const shot = session?.shots.find(s => s.id === shotId);
    if (!session || !shot) {
      throw new Error(`Shot not found: ${shotId}`);
    }

    shot.styleReferenceId = styleReferenceId;
    session.updatedAt = new Date();
    await this.sessionStore.save(session);

    return shot;
  }

  /**
   * Update session's primary style reference
   */
  async updatePrimaryStyleReference(
    sessionId: string,
    sourceVideoId?: string,
    sourceImageUrl?: string
  ): Promise<ContinuitySession> {
    const session = await this.sessionStore.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (sourceVideoId) {
      const videoUrl = await this.videoGenerator.getVideoUrl(sourceVideoId);
      const frame = await this.frameBridge.extractRepresentativeFrame(
        sourceVideoId,
        videoUrl,
        'updated'
      );
      session.primaryStyleReference = await this.styleReference.createFromVideo(
        sourceVideoId,
        frame
      );
    } else if (sourceImageUrl) {
      session.primaryStyleReference = await this.styleReference.createFromImage(
        sourceImageUrl,
        { width: 1920, height: 1080 }
      );
    }

    // Re-analyze for UI
    session.primaryStyleReference.analysisMetadata = 
      await this.styleAnalysis.analyzeForDisplay(session.primaryStyleReference.frameUrl);

    session.updatedAt = new Date();
    await this.sessionStore.save(session);

    return session;
  }

  private async getCharacterReferenceUrl(assetId: string): Promise<string> {
    // TODO: Integrate with existing AssetService
    // For now, placeholder
    throw new Error('Character reference not implemented');
  }

  private defaultSettings(): ContinuitySessionSettings {
    return {
      defaultContinuityMode: 'frame-bridge',
      defaultStyleStrength: STYLE_STRENGTH_PRESETS.balanced,
      defaultModel: 'veo-3',
      autoExtractFrameBridge: true,
      useCharacterConsistency: false,
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateShotId(): string {
    return `shot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Session store interface
interface SessionStore {
  save(session: ContinuitySession): Promise<void>;
  get(sessionId: string): Promise<ContinuitySession | null>;
  findByUser(userId: string): Promise<ContinuitySession[]>;
  delete(sessionId: string): Promise<void>;
}
```

---

## API Endpoints

```typescript
// server/src/routes/continuity.ts

import { Router } from 'express';
import { authenticateUser } from '@/middleware/auth';

const router = Router();
router.use(authenticateUser);

/**
 * POST /api/continuity/sessions
 * Create a new continuity session
 */
router.post('/sessions', async (req, res) => {
  const { name, description, sourceVideoId, sourceImageUrl, settings } = req.body;
  
  if (!sourceVideoId && !sourceImageUrl) {
    return res.status(400).json({ 
      error: 'Must provide sourceVideoId or sourceImageUrl' 
    });
  }

  try {
    const service = req.app.get('continuitySessionService');
    const session = await service.createSession(req.user.id, {
      name,
      description,
      sourceVideoId,
      sourceImageUrl,
      settings,
    });
    
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * GET /api/continuity/sessions
 */
router.get('/sessions', async (req, res) => {
  const service = req.app.get('continuitySessionService');
  const sessions = await service.getUserSessions(req.user.id);
  res.json({ success: true, data: sessions });
});

/**
 * GET /api/continuity/sessions/:sessionId
 */
router.get('/sessions/:sessionId', async (req, res) => {
  const service = req.app.get('continuitySessionService');
  const session = await service.getSession(req.params.sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({ success: true, data: session });
});

/**
 * POST /api/continuity/sessions/:sessionId/shots
 * Add a new shot
 */
router.post('/sessions/:sessionId/shots', async (req, res) => {
  const { 
    prompt, 
    continuityMode, 
    styleReferenceId,
    styleStrength, 
    modelId,
    characterAssetId 
  } = req.body;
  
  try {
    const service = req.app.get('continuitySessionService');
    const shot = await service.addShot({
      sessionId: req.params.sessionId,
      prompt,
      continuityMode,
      styleReferenceId,
      styleStrength,
      modelId,
      characterAssetId,
    });
    
    res.json({ success: true, data: shot });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add shot' });
  }
});

/**
 * POST /api/continuity/sessions/:sessionId/shots/:shotId/generate
 * Generate a shot
 */
router.post('/sessions/:sessionId/shots/:shotId/generate', async (req, res) => {
  try {
    const service = req.app.get('continuitySessionService');
    const shot = await service.generateShot(
      req.params.sessionId,
      req.params.shotId
    );
    
    res.json({ success: true, data: shot });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate shot' });
  }
});

/**
 * PUT /api/continuity/sessions/:sessionId/shots/:shotId/style-reference
 * Update which shot a shot inherits style from (non-linear inheritance)
 */
router.put('/sessions/:sessionId/shots/:shotId/style-reference', async (req, res) => {
  const { styleReferenceId } = req.body;
  
  try {
    const service = req.app.get('continuitySessionService');
    const shot = await service.updateShotStyleReference(
      req.params.sessionId,
      req.params.shotId,
      styleReferenceId
    );
    
    res.json({ success: true, data: shot });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update style reference' });
  }
});

/**
 * PUT /api/continuity/sessions/:sessionId/style-reference
 * Update session's primary style reference
 */
router.put('/sessions/:sessionId/style-reference', async (req, res) => {
  const { sourceVideoId, sourceImageUrl } = req.body;
  
  try {
    const service = req.app.get('continuitySessionService');
    const session = await service.updatePrimaryStyleReference(
      req.params.sessionId,
      sourceVideoId,
      sourceImageUrl
    );
    
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update style reference' });
  }
});

export default router;
```

---

## Workflow Diagrams

### Direct Continuation (Frame Bridge)

```
Shot 1 Completed
       │
       ▼
┌──────────────────┐
│ Extract last     │
│ frame            │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Use as startImage│
│ for Shot 2       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Generate Shot 2  │
│ (same angle,     │
│  continues)      │
└──────────────────┘
```

### Style Match (Different Angle)

```
Shot 1 Completed
       │
       ▼
┌──────────────────┐
│ Extract          │
│ representative   │
│ frame            │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ IP-Adapter       │
│ (frame + prompt  │
│  → keyframe)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Use keyframe as  │
│ startImage       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Generate Shot 2  │
│ (new angle,      │
│  matched style)  │
└──────────────────┘
```

### Non-Linear Inheritance

```
Shot 1 ──────────────────────┐
   │                         │
   ▼                         │
Shot 2 (Flashback,           │
        different style)     │
   │                         │
   ▼                         │
Shot 3 ◄─────────────────────┘
        (References Shot 1,
         not Shot 2)
```

### Provider-Aware Continuity Selection

```
                     ┌─────────────────────────────┐
                     │   Continuity Request        │
                     │   (shot + mode + provider)  │
                     └─────────────┬───────────────┘
                                   │
                     ┌─────────────▼───────────────┐
                     │  Check Provider Capabilities │
                     └─────────────┬───────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │ Native Style Ref│  │  Frame Bridge   │  │   IP-Adapter    │
    │  (Runway, etc.) │  │   (all i2v)     │  │   (fallback)    │
    └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
             │                    │                    │
             │  Pass reference    │  Pass last frame   │  Generate
             │  directly to API   │  as startImage     │  keyframe first
             │                    │                    │
             └────────────────────┼────────────────────┘
                                  │
                     ┌────────────▼────────────┐
                     │   Inject Seed (if       │
                     │   provider supports)    │
                     └────────────┬────────────┘
                                  │
                     ┌────────────▼────────────┐
                     │   Generate Video        │
                     └────────────┬────────────┘
                                  │
                     ┌────────────▼────────────┐
                     │   Extract + Persist     │
                     │   Seed from Result      │
                     └─────────────────────────┘
```

---

## Implementation Priority

| Priority | Task | Effort | Rationale |
|----------|------|--------|-----------|
| **1** | Provider gating + AnchorService | 2 days | Enforce mandatory continuity and select anchors |
| **2** | FrameBridgeService | 2 days | Foundation — extracts frames for all modes |
| **3** | CharacterKeyframeService (PuLID) | 2 days | Identity-locked keyframes for new angles |
| **4** | StyleReferenceService (IP-Adapter) | 3 days | Style-only keyframes when no native refs |
| **5** | ProviderStyleAdapter | 2 days | Routes to native APIs when available |
| **6** | SeedPersistenceService | 1 day | Low-effort, moderate value |
| **7** | GradingService (Post-Grade) | 1 day | Palette matching to reduce drift |
| **8** | QualityGateService | 2 days | Similarity scoring + auto-retry |
| **9** | ContinuitySessionService | 3 days | Orchestrates workflow |
| **10** | API endpoints | 1 day | Wire up services |
| **11** | Client: Context + hooks | 2 days | State management |
| **12** | Client: Session timeline | 2 days | Core UI |
| **13** | Client: Style panel | 1 day | Display reference + strength slider |
| **14** | StyleAnalysisService | 1 day | Optional — UI polish only |
| **15** | Integration + testing | 3 days | End-to-end |
| | **Total (Phase 1)** | **~25-28 days** | |
| **Phase 2** | SceneProxyService (NeRF/Splat) | 2-3 weeks | Optional "endgame" continuity |

---

## What's Removed vs Original Plan

| Original | Status | Reason |
|----------|--------|--------|
| StyleExtractionService (VLM → JSON) | **Demoted** to optional UI-only `StyleAnalysisService` | Text descriptions don't preserve visual fidelity |
| StyleInjectionService (text merging) | **Deleted** | Regex-based conflict removal is fragile; IP-Adapter makes it unnecessary |
| Complex token building | **Deleted** | Not needed when passing pixels |
| VLM prompt template | **Simplified** | Only used for UI display, not generation |

## What's Added

| New | Purpose |
|-----|---------|
| StyleReferenceService | IP-Adapter integration for pixel-based style transfer (style only) |
| `styleReferenceId` on shots | Non-linear inheritance (flashbacks, cutaways) |
| Strength presets | User-friendly controls (loose/balanced/strict/exact) |
| Representative frame extraction | Better style reference than arbitrary first/last frame |
| Character consistency | PuLID keyframe pipeline for identity |
| Post-grade | Histogram/LUT palette match after generation |
| Provider gating | Hard block for providers without image inputs |
| Quality gate | CLIP/face similarity scoring with auto-retry |
| Scene proxy (Phase 2) | 3D proxy (NeRF/Splat) for alternate angles |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Style consistency score | > 0.85 | CLIP similarity between consecutive shots |
| User re-generation rate | < 20% | Shots needing re-gen for style mismatch |
| Avg shots per session | > 3 | Indicates users find value in continuity |
| Frame bridge usage | > 70% | Primary mode for direct continuation |
| IP-Adapter keyframe quality | > 4/5 user rating | Spot-check user feedback |
| Seed persistence rate | > 80% | Seeds extracted and reused where supported |

---

## What's Removed vs Original Plan

| Original | Status | Reason |
|----------|--------|--------|
| StyleExtractionService (VLM → JSON) | **Demoted** to optional UI-only `StyleAnalysisService` | Text descriptions don't preserve visual fidelity |
| StyleInjectionService (text merging) | **Deleted** | Regex-based conflict removal is fragile; IP-Adapter makes it unnecessary |
| Complex token building | **Deleted** | Not needed when passing pixels |
| VLM prompt template for generation | **Deleted** | Only used for UI display, not generation |

## What's Added

| New | Purpose |
|-----|---------|
| `StyleReferenceService` | IP-Adapter integration for pixel-based style transfer (style only) |
| `ProviderStyleAdapter` | Routes to native style reference APIs when available |
| `SeedPersistenceService` | Extracts and injects seeds for generation reproducibility |
| `styleReferenceId` on shots | Non-linear inheritance (flashbacks, cutaways) |
| `PROVIDER_CAPABILITIES` config | Documents which providers support which continuity mechanisms |
| `continuityMechanismUsed` tracking | Records which mechanism was actually used per shot |
| Strength presets | User-friendly controls (loose/balanced/strict/exact) |
| Representative frame extraction | Better style reference than arbitrary first/last frame |
| Character consistency | PuLID keyframe pipeline for identity |
| Post-grade | Histogram/LUT palette match after generation |
| Provider gating | Hard block for providers without image inputs |
| Quality gate | CLIP/face similarity scoring with auto-retry |
| Scene proxy (Phase 2) | 3D proxy (NeRF/Splat) for alternate angles |

---

## Open Questions

1. **IP-Adapter model choice**: Which model best matches style without degrading identity? Need to benchmark.

2. **Strength defaults**: Is 0.6 the right balance? May need user testing.

3. **Cost**: IP-Adapter adds ~$0.02/keyframe. Acceptable for the value?

4. **Fallback behavior**: When IP-Adapter/Replicate is unavailable:
   - Queue and retry (recommended for temporary outages)
   - Block with clear error message
   - Let user proceed without style matching (explicit opt-in)
   - **NOT**: Silent fallback to text-based injection (broken approach)

5. **Provider capability updates**: How do we keep `PROVIDER_CAPABILITIES` current as providers add features?

6. **3D proxy viability**: Which scenes warrant splat/NeRF vs direct i2v? (Phase 2)
