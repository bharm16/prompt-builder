# Feature 2: Scene-to-Scene Continuity

> **"Shots that cut together."** — Maintain visual consistency across a sequence of video generations.

**Effort:** 3-4 weeks  
**Priority:** 2 (Build Second)  
**Dependencies:** VLM integration (GPT-4o Vision or Gemini), existing video generation system

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

### Why It's Hard

Video models have no memory. Each generation is completely stateless. The "Tokyo at night" in generation 1 is a completely different "Tokyo at night" in generation 2.

**Current workarounds (all inadequate):**
- **Seed locking** — Helps slightly, but models interpret prompts differently each time
- **Style keywords** — "cyberpunk, neon pink and blue" — too loose, inconsistent
- **Manual iteration** — Generate 20 times, hope 2 happen to match

---

## Solution Overview

Extract visual style from generation 1, inject it into generation 2+.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Generation 1 │ ──▶ │    Style     │ ──▶ │ Generation 2 │
│   (Source)   │     │  Extraction  │     │  (Matched)   │
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Extracted   │
                    │    Style     │
                    │   Tokens     │
                    └──────────────┘
```

### User Experience

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🎬 Scene: Tokyo Night Chase                              [+ Add Shot]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Shot Timeline                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │
│  │   Shot 1    │ ─▶ │   Shot 2    │ ─▶ │   Shot 3    │                 │
│  │  [Preview]  │    │  [Preview]  │    │ [Generating]│                 │
│  │             │    │             │    │    ████░░   │                 │
│  │  Wide shot  │    │   Medium    │    │   Close-up  │                 │
│  │   ✓ Done    │    │   ✓ Done    │    │  In progress│                 │
│  └─────────────┘    └─────────────┘    └─────────────┘                 │
│        │                  │                  │                          │
│        ▼                  ▼                  ▼                          │
│   [Style Base]      [Inherited]        [Inherited]                      │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ 🎨 Scene Style (extracted from Shot 1)                                  │
│                                                                         │
│  Colors: ████ Neon Pink  ████ Cyan  ████ Deep Blue                     │
│  Lighting: Low-key rim lighting from left                               │
│  Atmosphere: Wet streets, light rain, neon reflections                  │
│  Style: Cinematic, high contrast, anamorphic                           │
│                                                                         │
│  [Edit Style] [Reset to Shot 1] [Apply to All]                         │
├─────────────────────────────────────────────────────────────────────────┤
│ 📝 Shot 3 Prompt                                                        │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │ Close-up of her face, rain droplets on skin, neon reflections │    │
│  │ in her eyes, she looks up at something off-screen             │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ☑ Use frame bridge (last frame of Shot 2 as start image)             │
│  ☑ Inject scene style automatically                                    │
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
├── StyleExtractionService.ts          # VLM-based style analysis (< 250 lines)
├── StyleInjectionService.ts           # Prompt augmentation (< 150 lines)
├── FrameBridgeService.ts              # Frame extraction for i2v (< 150 lines)
├── ContinuitySessionService.ts        # Session management (< 200 lines)
├── templates/
│   ├── style-extraction.md            # VLM prompt for extraction
│   └── style-comparison.md            # VLM prompt for consistency check
└── __tests__/
    ├── StyleExtractionService.test.ts
    ├── StyleInjectionService.test.ts
    └── fixtures/
        └── sampleFrames.ts

client/src/features/continuity/
├── index.ts
├── types.ts
├── context/
│   └── ContinuitySessionContext.tsx   # Session state management
├── hooks/
│   ├── useContinuitySession.ts        # Main session hook (< 100 lines)
│   ├── useStyleExtraction.ts          # Style extraction hook (< 80 lines)
│   └── useFrameBridge.ts              # Frame bridge hook (< 60 lines)
├── components/
│   ├── ContinuitySession/
│   │   ├── ContinuitySession.tsx      # Main container (< 150 lines)
│   │   ├── SessionTimeline.tsx        # Shot sequence view (< 120 lines)
│   │   ├── ShotCard.tsx               # Individual shot (< 100 lines)
│   │   └── index.ts
│   ├── StylePanel/
│   │   ├── StylePanel.tsx             # Style display/edit (< 150 lines)
│   │   ├── ColorPalette.tsx           # Color swatches (< 60 lines)
│   │   ├── StyleAttribute.tsx         # Single attribute (< 40 lines)
│   │   └── index.ts
│   ├── ShotEditor/
│   │   ├── ShotEditor.tsx             # New shot prompt editor (< 120 lines)
│   │   ├── FrameBridgeToggle.tsx      # i2v toggle (< 40 lines)
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
 * Extracted visual style from a video/frame
 */
export interface ExtractedStyle {
  id: string;
  sourceVideoId: string;
  sourceFrameIndex: number;      // Which frame was analyzed
  extractedAt: Date;
  
  // Color characteristics
  color: {
    palette: ColorPalette;
    temperature: 'warm' | 'neutral' | 'cool';
    saturation: 'muted' | 'natural' | 'vibrant';
    contrast: 'low' | 'medium' | 'high';
  };
  
  // Lighting characteristics
  lighting: {
    style: string;               // "low-key with strong rim lighting"
    direction: string;           // "from left, slightly behind"
    quality: string;             // "hard shadows, neon bounce fill"
    keyLight: string;            // "neon signage"
    fillLight?: string;          // "ambient city glow"
    intensity: 'dim' | 'moderate' | 'bright';
  };
  
  // Atmospheric elements
  atmosphere: {
    elements: string[];          // ["wet streets", "light rain", "reflections"]
    timeOfDay: string;           // "night", "golden hour", etc.
    weather: string;             // "rainy", "clear", "foggy"
    mood: string;                // "melancholic", "tense", "peaceful"
  };
  
  // Technical style
  technical: {
    filmStock: string;           // "cinematic, high contrast"
    lensCharacteristics: string; // "anamorphic, lens flares"
    grainLevel: 'none' | 'light' | 'moderate' | 'heavy';
    depthOfField: 'deep' | 'moderate' | 'shallow';
    motionBlur: 'none' | 'subtle' | 'noticeable';
  };
  
  // Pre-composed prompt fragment
  stylePromptFragment: string;
  
  // Confidence in extraction
  confidence: number;            // 0-1
  
  // Raw VLM response for debugging
  rawAnalysis?: string;
}

export interface ColorPalette {
  primary: HexColor;
  secondary: HexColor;
  accent: HexColor;
  shadows: HexColor;
  highlights: HexColor;
  dominant: HexColor[];          // Top 3-5 colors by area
}

export type HexColor = `#${string}`;

/**
 * Frame extracted for i2v continuity
 */
export interface FrameBridge {
  id: string;
  sourceVideoId: string;
  framePosition: 'first' | 'last' | number;
  frameUrl: string;              // URL to stored frame image
  frameTimestamp: number;        // Seconds into video
  extractedAt: Date;
  
  // Frame metadata
  resolution: {
    width: number;
    height: number;
  };
  aspectRatio: string;           // "16:9", "9:16", etc.
}

/**
 * A single shot in a continuity session
 */
export interface ContinuityShot {
  id: string;
  sessionId: string;
  sequenceIndex: number;         // 0, 1, 2, ...
  
  // User input
  userPrompt: string;            // What user typed
  
  // Processed
  injectedPrompt: string;        // With style tokens added
  
  // Generation details
  modelId: VideoModelId;
  videoAssetId?: string;
  previewAssetId?: string;
  
  // Continuity linkage
  styleSource: 'base' | 'inherited' | 'custom';
  appliedStyle?: ExtractedStyle;
  bridgeFrame?: FrameBridge;     // Last frame from previous shot
  
  // State
  status: 'draft' | 'pending' | 'generating' | 'completed' | 'failed';
  error?: string;
  
  // Timestamps
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
  name: string;                  // User-defined scene name
  description?: string;
  
  // Style baseline
  baseStyle: ExtractedStyle;
  styleSource: 'extracted' | 'user-defined' | 'template';
  
  // Shots in sequence
  shots: ContinuityShot[];
  
  // Settings
  settings: ContinuitySettings;
  
  // State
  status: 'active' | 'completed' | 'archived';
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface ContinuitySettings {
  // Automatic behavior
  autoExtractStyle: boolean;     // Extract style after each generation
  autoFrameBridge: boolean;      // Use last frame for next shot
  
  // Style injection
  styleInjectionStrength: 'light' | 'medium' | 'strong';
  styleInjectionPosition: 'prefix' | 'suffix' | 'smart';
  
  // What to inherit
  inheritColor: boolean;
  inheritLighting: boolean;
  inheritAtmosphere: boolean;
  inheritTechnical: boolean;
  
  // Generation
  defaultModel: VideoModelId;
  usePreviewFirst: boolean;      // Generate Wan preview before final
}

/**
 * Style injection options
 */
export interface StyleInjectionOptions {
  strength: 'light' | 'medium' | 'strong';
  position: 'prefix' | 'suffix' | 'smart';
  
  // Selective injection
  includeColor: boolean;
  includeLighting: boolean;
  includeAtmosphere: boolean;
  includeTechnical: boolean;
  
  // Conflict resolution
  skipConflicting: boolean;      // Don't override user-specified elements
}

/**
 * Request to create a new shot
 */
export interface CreateShotRequest {
  sessionId: string;
  prompt: string;
  modelId?: VideoModelId;        // Override default
  useFrameBridge?: boolean;      // Override setting
  styleOverrides?: Partial<ExtractedStyle>;
}

/**
 * Session creation request
 */
export interface CreateSessionRequest {
  name: string;
  description?: string;
  
  // Initial shot (optional)
  initialPrompt?: string;
  initialVideoId?: string;       // Create from existing video
  
  // Settings
  settings?: Partial<ContinuitySettings>;
}
```

---

## Implementation Details

### 1. StyleExtractionService

Uses VLM to analyze video frames and extract visual style.

```typescript
// server/src/services/continuity/StyleExtractionService.ts

import { VLMService } from '@/services/vlm/VLMService';
import { AssetService } from '@/services/asset/AssetService';
import { ExtractedStyle, ColorPalette, HexColor } from './types';
import { loadTemplate } from '@/utils/templates';

export class StyleExtractionService {
  private extractionPrompt: string;

  constructor(
    private vlm: VLMService,
    private assetService: AssetService
  ) {
    this.extractionPrompt = loadTemplate('continuity/style-extraction.md');
  }

  /**
   * Extract style from a video asset
   */
  async extractFromVideo(
    videoId: string,
    framePosition: 'first' | 'middle' | 'last' | number = 'middle'
  ): Promise<ExtractedStyle> {
    // Extract frame from video
    const frame = await this.assetService.extractFrame(videoId, framePosition);
    
    // Analyze frame with VLM
    const analysis = await this.analyzeFrame(frame.url);
    
    // Parse and structure the response
    const style = this.parseAnalysis(analysis, videoId, frame.index);
    
    return style;
  }

  /**
   * Extract style from an image
   */
  async extractFromImage(imageUrl: string): Promise<ExtractedStyle> {
    const analysis = await this.analyzeFrame(imageUrl);
    return this.parseAnalysis(analysis, 'image', 0);
  }

  /**
   * Analyze a single frame
   */
  private async analyzeFrame(frameUrl: string): Promise<VLMAnalysisResponse> {
    const response = await this.vlm.analyzeImage({
      imageUrl: frameUrl,
      prompt: this.extractionPrompt,
      responseFormat: 'json',
      maxTokens: 2000,
    });

    return JSON.parse(response.content);
  }

  /**
   * Parse VLM response into ExtractedStyle
   */
  private parseAnalysis(
    analysis: VLMAnalysisResponse,
    sourceId: string,
    frameIndex: number
  ): ExtractedStyle {
    // Extract color palette
    const palette = this.parseColorPalette(analysis.colors);
    
    // Build style prompt fragment
    const styleFragment = this.buildStyleFragment(analysis);

    return {
      id: this.generateStyleId(),
      sourceVideoId: sourceId,
      sourceFrameIndex: frameIndex,
      extractedAt: new Date(),
      
      color: {
        palette,
        temperature: analysis.colorTemperature || 'neutral',
        saturation: analysis.saturation || 'natural',
        contrast: analysis.contrast || 'medium',
      },
      
      lighting: {
        style: analysis.lightingStyle || 'natural lighting',
        direction: analysis.lightingDirection || 'frontal',
        quality: analysis.lightingQuality || 'soft',
        keyLight: analysis.keyLight || 'natural',
        fillLight: analysis.fillLight,
        intensity: analysis.lightingIntensity || 'moderate',
      },
      
      atmosphere: {
        elements: analysis.atmosphericElements || [],
        timeOfDay: analysis.timeOfDay || 'day',
        weather: analysis.weather || 'clear',
        mood: analysis.mood || 'neutral',
      },
      
      technical: {
        filmStock: analysis.filmStock || 'digital',
        lensCharacteristics: analysis.lensCharacteristics || 'standard',
        grainLevel: analysis.grain || 'none',
        depthOfField: analysis.depthOfField || 'moderate',
        motionBlur: analysis.motionBlur || 'none',
      },
      
      stylePromptFragment: styleFragment,
      confidence: analysis.confidence || 0.8,
      rawAnalysis: JSON.stringify(analysis),
    };
  }

  /**
   * Parse colors from VLM response
   */
  private parseColorPalette(colors: VLMColorResponse): ColorPalette {
    const toHex = (color: string): HexColor => {
      // Handle various formats: "neon pink", "#FF1493", "rgb(255, 20, 147)"
      if (color.startsWith('#')) return color as HexColor;
      
      // Color name to hex mapping
      const colorMap: Record<string, HexColor> = {
        'neon pink': '#FF1493',
        'cyan': '#00FFFF',
        'deep blue': '#0A0A2E',
        'warm orange': '#FF8C00',
        'golden': '#FFD700',
        // Add more as needed
      };
      
      const normalized = color.toLowerCase().trim();
      return colorMap[normalized] || '#808080';
    };

    return {
      primary: toHex(colors.primary || '#808080'),
      secondary: toHex(colors.secondary || '#606060'),
      accent: toHex(colors.accent || '#404040'),
      shadows: toHex(colors.shadows || '#1a1a1a'),
      highlights: toHex(colors.highlights || '#ffffff'),
      dominant: (colors.dominant || []).map(toHex),
    };
  }

  /**
   * Build a prompt fragment from extracted style
   */
  private buildStyleFragment(analysis: VLMAnalysisResponse): string {
    const parts: string[] = [];

    // Color description
    if (analysis.colorDescription) {
      parts.push(analysis.colorDescription);
    }

    // Lighting
    if (analysis.lightingStyle) {
      let lighting = analysis.lightingStyle;
      if (analysis.lightingDirection) {
        lighting += `, light ${analysis.lightingDirection}`;
      }
      parts.push(lighting);
    }

    // Atmosphere
    if (analysis.atmosphericElements?.length > 0) {
      parts.push(analysis.atmosphericElements.join(', '));
    }

    // Technical style
    if (analysis.filmStock && analysis.filmStock !== 'digital') {
      parts.push(analysis.filmStock);
    }
    if (analysis.lensCharacteristics && analysis.lensCharacteristics !== 'standard') {
      parts.push(analysis.lensCharacteristics);
    }

    return parts.join('. ') + '.';
  }

  /**
   * Compare two styles for consistency
   */
  async compareStyles(
    style1: ExtractedStyle,
    style2: ExtractedStyle
  ): Promise<StyleComparison> {
    // Calculate similarity scores for each aspect
    const colorSimilarity = this.compareColors(style1.color, style2.color);
    const lightingSimilarity = this.compareLighting(style1.lighting, style2.lighting);
    const atmosphereSimilarity = this.compareAtmosphere(style1.atmosphere, style2.atmosphere);
    
    const overall = (colorSimilarity + lightingSimilarity + atmosphereSimilarity) / 3;

    return {
      overall,
      color: colorSimilarity,
      lighting: lightingSimilarity,
      atmosphere: atmosphereSimilarity,
      issues: this.identifyIssues(style1, style2),
    };
  }

  private compareColors(c1: ExtractedStyle['color'], c2: ExtractedStyle['color']): number {
    // Simple comparison - could be enhanced with color distance algorithms
    let score = 0;
    if (c1.temperature === c2.temperature) score += 0.3;
    if (c1.saturation === c2.saturation) score += 0.3;
    if (c1.contrast === c2.contrast) score += 0.4;
    return score;
  }

  private compareLighting(l1: ExtractedStyle['lighting'], l2: ExtractedStyle['lighting']): number {
    let score = 0;
    if (l1.style === l2.style) score += 0.4;
    if (l1.direction === l2.direction) score += 0.3;
    if (l1.intensity === l2.intensity) score += 0.3;
    return score;
  }

  private compareAtmosphere(a1: ExtractedStyle['atmosphere'], a2: ExtractedStyle['atmosphere']): number {
    let score = 0;
    if (a1.timeOfDay === a2.timeOfDay) score += 0.4;
    if (a1.weather === a2.weather) score += 0.3;
    
    // Compare elements overlap
    const overlap = a1.elements.filter(e => a2.elements.includes(e));
    score += 0.3 * (overlap.length / Math.max(a1.elements.length, a2.elements.length, 1));
    
    return score;
  }

  private identifyIssues(s1: ExtractedStyle, s2: ExtractedStyle): string[] {
    const issues: string[] = [];
    
    if (s1.color.temperature !== s2.color.temperature) {
      issues.push(`Color temperature mismatch: ${s1.color.temperature} vs ${s2.color.temperature}`);
    }
    if (s1.lighting.direction !== s2.lighting.direction) {
      issues.push(`Lighting direction mismatch: ${s1.lighting.direction} vs ${s2.lighting.direction}`);
    }
    if (s1.atmosphere.timeOfDay !== s2.atmosphere.timeOfDay) {
      issues.push(`Time of day mismatch: ${s1.atmosphere.timeOfDay} vs ${s2.atmosphere.timeOfDay}`);
    }
    
    return issues;
  }

  private generateStyleId(): string {
    return `style_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// VLM response types
interface VLMAnalysisResponse {
  colors: VLMColorResponse;
  colorTemperature: 'warm' | 'neutral' | 'cool';
  colorDescription: string;
  saturation: 'muted' | 'natural' | 'vibrant';
  contrast: 'low' | 'medium' | 'high';
  
  lightingStyle: string;
  lightingDirection: string;
  lightingQuality: string;
  keyLight: string;
  fillLight?: string;
  lightingIntensity: 'dim' | 'moderate' | 'bright';
  
  atmosphericElements: string[];
  timeOfDay: string;
  weather: string;
  mood: string;
  
  filmStock: string;
  lensCharacteristics: string;
  grain: 'none' | 'light' | 'moderate' | 'heavy';
  depthOfField: 'deep' | 'moderate' | 'shallow';
  motionBlur: 'none' | 'subtle' | 'noticeable';
  
  confidence: number;
}

interface VLMColorResponse {
  primary: string;
  secondary: string;
  accent: string;
  shadows: string;
  highlights: string;
  dominant: string[];
}

interface StyleComparison {
  overall: number;
  color: number;
  lighting: number;
  atmosphere: number;
  issues: string[];
}
```

### VLM Prompt Template

```markdown
<!-- server/src/services/continuity/templates/style-extraction.md -->

Analyze this video frame and extract detailed visual style characteristics.
Focus on elements that would need to be consistent across multiple shots in the same scene.

Return a JSON object with the following structure:

```json
{
  "colors": {
    "primary": "main color (hex or descriptive name)",
    "secondary": "second most prominent color",
    "accent": "accent/highlight color",
    "shadows": "shadow tone color",
    "highlights": "highlight color",
    "dominant": ["top 3-5 colors by screen area"]
  },
  "colorTemperature": "warm | neutral | cool",
  "colorDescription": "One sentence describing the color palette",
  "saturation": "muted | natural | vibrant",
  "contrast": "low | medium | high",
  
  "lightingStyle": "Detailed description of lighting approach (e.g., 'low-key with strong rim lighting')",
  "lightingDirection": "Where light comes from (e.g., 'from left, slightly behind')",
  "lightingQuality": "Hard/soft shadows, quality description",
  "keyLight": "Main light source",
  "fillLight": "Secondary light source if visible",
  "lightingIntensity": "dim | moderate | bright",
  
  "atmosphericElements": ["List visible atmospheric elements like: wet streets, rain, fog, dust, etc."],
  "timeOfDay": "night | dawn | day | dusk | golden hour | blue hour",
  "weather": "clear | cloudy | rainy | foggy | snowy",
  "mood": "One word mood descriptor",
  
  "filmStock": "Visual style description (e.g., 'cinematic, high contrast' or 'vintage film')",
  "lensCharacteristics": "Lens effects (e.g., 'anamorphic, lens flares' or 'standard')",
  "grain": "none | light | moderate | heavy",
  "depthOfField": "deep | moderate | shallow",
  "motionBlur": "none | subtle | noticeable",
  
  "confidence": 0.0 to 1.0
}
```

Be specific and use cinematography terminology.
Extract what you actually see, not what you assume.
If uncertain about an element, provide your best estimate but lower the confidence score.
```

### 2. StyleInjectionService

Augments user prompts with extracted style tokens.

```typescript
// server/src/services/continuity/StyleInjectionService.ts

import { ExtractedStyle, StyleInjectionOptions } from './types';
import { LabeledSpan } from '@/llm/span-labeling/types';

export class StyleInjectionService {
  /**
   * Inject style into a user prompt
   */
  injectStyle(
    userPrompt: string,
    style: ExtractedStyle,
    options: StyleInjectionOptions = this.defaultOptions()
  ): string {
    // Build style prefix from selected components
    const styleTokens = this.buildStyleTokens(style, options);
    
    // Clean user prompt of conflicting elements
    const cleanedPrompt = options.skipConflicting
      ? this.removeConflictingElements(userPrompt, style)
      : userPrompt;
    
    // Combine based on position preference
    return this.combinePrompts(styleTokens, cleanedPrompt, options.position);
  }

  /**
   * Build style tokens from extracted style
   */
  private buildStyleTokens(
    style: ExtractedStyle,
    options: StyleInjectionOptions
  ): string {
    const parts: string[] = [];

    // Color tokens
    if (options.includeColor) {
      const colorTokens = this.buildColorTokens(style, options.strength);
      if (colorTokens) parts.push(colorTokens);
    }

    // Lighting tokens
    if (options.includeLighting) {
      const lightingTokens = this.buildLightingTokens(style, options.strength);
      if (lightingTokens) parts.push(lightingTokens);
    }

    // Atmosphere tokens
    if (options.includeAtmosphere) {
      const atmosphereTokens = this.buildAtmosphereTokens(style, options.strength);
      if (atmosphereTokens) parts.push(atmosphereTokens);
    }

    // Technical tokens
    if (options.includeTechnical) {
      const technicalTokens = this.buildTechnicalTokens(style, options.strength);
      if (technicalTokens) parts.push(technicalTokens);
    }

    return parts.join(' ');
  }

  /**
   * Build color description tokens
   */
  private buildColorTokens(
    style: ExtractedStyle,
    strength: 'light' | 'medium' | 'strong'
  ): string {
    const { palette, temperature, saturation, contrast } = style.color;

    if (strength === 'light') {
      // Just temperature and mood
      return `${temperature} color tones`;
    }

    if (strength === 'medium') {
      // Add key colors
      return `Color palette: ${palette.primary}, ${palette.secondary}, ${palette.accent}. ${temperature} tones, ${saturation} saturation.`;
    }

    // Strong: full detail
    return `Color palette: ${palette.primary} (primary), ${palette.secondary} (secondary), ${palette.accent} (accent). ${temperature} color temperature, ${saturation} saturation, ${contrast} contrast.`;
  }

  /**
   * Build lighting description tokens
   */
  private buildLightingTokens(
    style: ExtractedStyle,
    strength: 'light' | 'medium' | 'strong'
  ): string {
    const { style: lightStyle, direction, quality, intensity } = style.lighting;

    if (strength === 'light') {
      return lightStyle;
    }

    if (strength === 'medium') {
      return `${lightStyle}, light ${direction}`;
    }

    return `${lightStyle}, light coming ${direction}, ${quality}, ${intensity} intensity`;
  }

  /**
   * Build atmosphere description tokens
   */
  private buildAtmosphereTokens(
    style: ExtractedStyle,
    strength: 'light' | 'medium' | 'strong'
  ): string {
    const { elements, timeOfDay, weather, mood } = style.atmosphere;

    if (strength === 'light') {
      return `${timeOfDay}, ${mood} mood`;
    }

    if (strength === 'medium') {
      const elementStr = elements.slice(0, 3).join(', ');
      return `${timeOfDay}, ${weather}, ${elementStr}`;
    }

    const elementStr = elements.join(', ');
    return `${timeOfDay}, ${weather} weather, ${elementStr}, ${mood} atmosphere`;
  }

  /**
   * Build technical style tokens
   */
  private buildTechnicalTokens(
    style: ExtractedStyle,
    strength: 'light' | 'medium' | 'strong'
  ): string {
    const { filmStock, lensCharacteristics, grainLevel } = style.technical;

    if (strength === 'light') {
      return filmStock;
    }

    if (strength === 'medium') {
      return `${filmStock}, ${lensCharacteristics}`;
    }

    const grain = grainLevel !== 'none' ? `, ${grainLevel} film grain` : '';
    return `${filmStock}, ${lensCharacteristics}${grain}`;
  }

  /**
   * Remove elements from user prompt that conflict with style
   */
  private removeConflictingElements(
    prompt: string,
    style: ExtractedStyle
  ): string {
    // Define conflicting keywords by category
    const colorConflicts = ['warm', 'cool', 'cold', 'vibrant', 'muted', 'saturated'];
    const lightingConflicts = ['bright', 'dim', 'dark', 'shadowy', 'backlit', 'frontlit'];
    const timeConflicts = ['day', 'night', 'sunset', 'sunrise', 'dawn', 'dusk'];
    
    let cleaned = prompt;
    
    // Remove standalone conflicting words (not part of larger descriptions)
    const allConflicts = [...colorConflicts, ...lightingConflicts, ...timeConflicts];
    
    for (const word of allConflicts) {
      // Only remove if it's a standalone word, not part of something else
      const regex = new RegExp(`\\b${word}\\b(?!\\s+(?:sky|scene|shot))`, 'gi');
      cleaned = cleaned.replace(regex, '');
    }
    
    // Clean up double spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }

  /**
   * Combine style tokens with user prompt
   */
  private combinePrompts(
    styleTokens: string,
    userPrompt: string,
    position: 'prefix' | 'suffix' | 'smart'
  ): string {
    if (!styleTokens) return userPrompt;
    
    if (position === 'prefix') {
      return `${styleTokens} ${userPrompt}`;
    }
    
    if (position === 'suffix') {
      return `${userPrompt}. ${styleTokens}`;
    }
    
    // Smart: inject after scene setup, before action
    return this.smartInject(styleTokens, userPrompt);
  }

  /**
   * Intelligently inject style tokens
   */
  private smartInject(styleTokens: string, userPrompt: string): string {
    // Look for natural break points
    const breakPoints = [
      /\.\s+(?=[A-Z])/,           // After period before capital
      /,\s+(?=she|he|they|it)/i,  // Before pronouns
      /:\s+/,                      // After colon
    ];
    
    for (const pattern of breakPoints) {
      const match = userPrompt.match(pattern);
      if (match && match.index !== undefined) {
        const position = match.index + match[0].length;
        return (
          userPrompt.slice(0, position) +
          styleTokens + '. ' +
          userPrompt.slice(position)
        );
      }
    }
    
    // Fallback to prefix
    return `${styleTokens}. ${userPrompt}`;
  }

  private defaultOptions(): StyleInjectionOptions {
    return {
      strength: 'medium',
      position: 'prefix',
      includeColor: true,
      includeLighting: true,
      includeAtmosphere: true,
      includeTechnical: true,
      skipConflicting: true,
    };
  }
}
```

### 3. FrameBridgeService

Extracts frames from videos for i2v continuity.

```typescript
// server/src/services/continuity/FrameBridgeService.ts

import { AssetService } from '@/services/asset/AssetService';
import { StorageService } from '@/services/storage/StorageService';
import { FrameBridge } from './types';

export class FrameBridgeService {
  constructor(
    private assetService: AssetService,
    private storage: StorageService
  ) {}

  /**
   * Extract a frame from a video for use as i2v input
   */
  async extractBridgeFrame(
    videoId: string,
    position: 'first' | 'last' | number = 'last'
  ): Promise<FrameBridge> {
    // Get video metadata
    const video = await this.assetService.getVideoAsset(videoId);
    
    if (!video) {
      throw new Error(`Video not found: ${videoId}`);
    }

    // Calculate frame position
    const frameIndex = this.calculateFrameIndex(position, video.frameCount, video.duration);
    
    // Extract frame
    const frameBuffer = await this.assetService.extractFrameBuffer(
      videoId,
      frameIndex
    );
    
    // Store frame for use in generation
    const frameUrl = await this.storage.uploadImage(
      frameBuffer,
      `bridge-frames/${videoId}/${frameIndex}.png`,
      { 
        contentType: 'image/png',
        metadata: {
          sourceVideo: videoId,
          frameIndex: frameIndex.toString(),
          extractedFor: 'continuity-bridge',
        }
      }
    );

    return {
      id: this.generateFrameId(),
      sourceVideoId: videoId,
      framePosition: position,
      frameUrl,
      frameTimestamp: this.frameToTimestamp(frameIndex, video.fps),
      extractedAt: new Date(),
      resolution: {
        width: video.width,
        height: video.height,
      },
      aspectRatio: this.calculateAspectRatio(video.width, video.height),
    };
  }

  /**
   * Get the last frame of a video
   */
  async getLastFrame(videoId: string): Promise<FrameBridge> {
    return this.extractBridgeFrame(videoId, 'last');
  }

  /**
   * Get the first frame of a video
   */
  async getFirstFrame(videoId: string): Promise<FrameBridge> {
    return this.extractBridgeFrame(videoId, 'first');
  }

  /**
   * Pre-warm frame extraction (call after generation completes)
   */
  async prewarmBridgeFrame(videoId: string): Promise<void> {
    // Extract and cache the last frame for quick access
    await this.extractBridgeFrame(videoId, 'last');
  }

  private calculateFrameIndex(
    position: 'first' | 'last' | number,
    frameCount: number,
    duration: number
  ): number {
    if (position === 'first') return 0;
    if (position === 'last') return Math.max(0, frameCount - 1);
    
    // Position as seconds
    if (typeof position === 'number') {
      const fps = frameCount / duration;
      return Math.min(Math.floor(position * fps), frameCount - 1);
    }
    
    return frameCount - 1;
  }

  private frameToTimestamp(frameIndex: number, fps: number): number {
    return frameIndex / fps;
  }

  private calculateAspectRatio(width: number, height: number): string {
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  }

  private generateFrameId(): string {
    return `frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 4. ContinuitySessionService

Manages multi-shot sessions.

```typescript
// server/src/services/continuity/ContinuitySessionService.ts

import { 
  ContinuitySession, 
  ContinuityShot, 
  CreateSessionRequest,
  CreateShotRequest,
  ContinuitySettings,
  ExtractedStyle
} from './types';
import { StyleExtractionService } from './StyleExtractionService';
import { StyleInjectionService } from './StyleInjectionService';
import { FrameBridgeService } from './FrameBridgeService';
import { VideoGenerationService } from '@/services/video-generation/VideoGenerationService';

export class ContinuitySessionService {
  constructor(
    private styleExtractor: StyleExtractionService,
    private styleInjector: StyleInjectionService,
    private frameBridge: FrameBridgeService,
    private videoGenerator: VideoGenerationService,
    private sessionStore: SessionStore  // Your persistence layer
  ) {}

  /**
   * Create a new continuity session
   */
  async createSession(
    userId: string,
    request: CreateSessionRequest
  ): Promise<ContinuitySession> {
    let baseStyle: ExtractedStyle;

    // Extract style from existing video or use defaults
    if (request.initialVideoId) {
      baseStyle = await this.styleExtractor.extractFromVideo(request.initialVideoId);
    } else {
      baseStyle = this.createDefaultStyle();
    }

    const session: ContinuitySession = {
      id: this.generateSessionId(),
      userId,
      name: request.name,
      description: request.description,
      baseStyle,
      styleSource: request.initialVideoId ? 'extracted' : 'user-defined',
      shots: [],
      settings: { ...this.defaultSettings(), ...request.settings },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Create initial shot if prompt provided
    if (request.initialPrompt) {
      const initialShot = this.createDraftShot(session, request.initialPrompt, 0);
      session.shots.push(initialShot);
    }

    await this.sessionStore.save(session);
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

    // Get frame bridge from previous shot if enabled
    let bridgeFrame;
    if (request.useFrameBridge ?? session.settings.autoFrameBridge) {
      if (previousShot?.videoAssetId) {
        bridgeFrame = await this.frameBridge.getLastFrame(previousShot.videoAssetId);
      }
    }

    // Inject style into prompt
    const injectedPrompt = this.styleInjector.injectStyle(
      request.prompt,
      request.styleOverrides 
        ? this.mergeStyles(session.baseStyle, request.styleOverrides)
        : session.baseStyle,
      {
        strength: session.settings.styleInjectionStrength,
        position: session.settings.styleInjectionPosition,
        includeColor: session.settings.inheritColor,
        includeLighting: session.settings.inheritLighting,
        includeAtmosphere: session.settings.inheritAtmosphere,
        includeTechnical: session.settings.inheritTechnical,
        skipConflicting: true,
      }
    );

    const shot: ContinuityShot = {
      id: this.generateShotId(),
      sessionId: session.id,
      sequenceIndex,
      userPrompt: request.prompt,
      injectedPrompt,
      modelId: request.modelId || session.settings.defaultModel,
      styleSource: 'inherited',
      appliedStyle: session.baseStyle,
      bridgeFrame,
      status: 'draft',
      createdAt: new Date(),
    };

    session.shots.push(shot);
    session.updatedAt = new Date();
    await this.sessionStore.save(session);

    return shot;
  }

  /**
   * Generate a shot
   */
  async generateShot(
    sessionId: string,
    shotId: string
  ): Promise<ContinuityShot> {
    const session = await this.sessionStore.get(sessionId);
    const shot = session?.shots.find(s => s.id === shotId);

    if (!session || !shot) {
      throw new Error(`Shot not found: ${shotId}`);
    }

    // Update status
    shot.status = 'generating';
    await this.sessionStore.save(session);

    try {
      // Generate video
      const result = await this.videoGenerator.generate({
        prompt: shot.injectedPrompt,
        modelId: shot.modelId,
        startImage: shot.bridgeFrame?.frameUrl,
        // ... other generation options
      });

      // Update shot with result
      shot.videoAssetId = result.videoId;
      shot.status = 'completed';
      shot.generatedAt = new Date();

      // Extract style for future shots if enabled
      if (session.settings.autoExtractStyle) {
        shot.appliedStyle = await this.styleExtractor.extractFromVideo(result.videoId);
        
        // Update base style if this is the first shot
        if (shot.sequenceIndex === 0) {
          session.baseStyle = shot.appliedStyle;
          session.styleSource = 'extracted';
        }
      }

      // Pre-warm frame bridge for next shot
      if (session.settings.autoFrameBridge) {
        await this.frameBridge.prewarmBridgeFrame(result.videoId);
      }

    } catch (error) {
      shot.status = 'failed';
      shot.error = error instanceof Error ? error.message : 'Generation failed';
    }

    session.updatedAt = new Date();
    await this.sessionStore.save(session);

    return shot;
  }

  /**
   * Update session style
   */
  async updateSessionStyle(
    sessionId: string,
    styleUpdates: Partial<ExtractedStyle>
  ): Promise<ContinuitySession> {
    const session = await this.sessionStore.get(sessionId);
    
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.baseStyle = this.mergeStyles(session.baseStyle, styleUpdates);
    session.styleSource = 'user-defined';
    session.updatedAt = new Date();

    await this.sessionStore.save(session);
    return session;
  }

  /**
   * Regenerate a shot
   */
  async regenerateShot(
    sessionId: string,
    shotId: string,
    newPrompt?: string
  ): Promise<ContinuityShot> {
    const session = await this.sessionStore.get(sessionId);
    const shot = session?.shots.find(s => s.id === shotId);

    if (!session || !shot) {
      throw new Error(`Shot not found: ${shotId}`);
    }

    if (newPrompt) {
      shot.userPrompt = newPrompt;
      shot.injectedPrompt = this.styleInjector.injectStyle(
        newPrompt,
        session.baseStyle,
        this.buildInjectionOptions(session.settings)
      );
    }

    shot.status = 'pending';
    shot.error = undefined;
    
    await this.sessionStore.save(session);
    return this.generateShot(sessionId, shotId);
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<ContinuitySession[]> {
    return this.sessionStore.findByUser(userId);
  }

  /**
   * Get a single session
   */
  async getSession(sessionId: string): Promise<ContinuitySession | null> {
    return this.sessionStore.get(sessionId);
  }

  private createDraftShot(
    session: ContinuitySession,
    prompt: string,
    index: number
  ): ContinuityShot {
    return {
      id: this.generateShotId(),
      sessionId: session.id,
      sequenceIndex: index,
      userPrompt: prompt,
      injectedPrompt: prompt, // Will be injected on generate
      modelId: session.settings.defaultModel,
      styleSource: 'base',
      status: 'draft',
      createdAt: new Date(),
    };
  }

  private mergeStyles(
    base: ExtractedStyle,
    overrides: Partial<ExtractedStyle>
  ): ExtractedStyle {
    return {
      ...base,
      ...overrides,
      color: { ...base.color, ...overrides.color },
      lighting: { ...base.lighting, ...overrides.lighting },
      atmosphere: { ...base.atmosphere, ...overrides.atmosphere },
      technical: { ...base.technical, ...overrides.technical },
    };
  }

  private buildInjectionOptions(settings: ContinuitySettings) {
    return {
      strength: settings.styleInjectionStrength,
      position: settings.styleInjectionPosition,
      includeColor: settings.inheritColor,
      includeLighting: settings.inheritLighting,
      includeAtmosphere: settings.inheritAtmosphere,
      includeTechnical: settings.inheritTechnical,
      skipConflicting: true,
    };
  }

  private createDefaultStyle(): ExtractedStyle {
    return {
      id: 'default',
      sourceVideoId: 'none',
      sourceFrameIndex: 0,
      extractedAt: new Date(),
      color: {
        palette: {
          primary: '#808080',
          secondary: '#606060',
          accent: '#a0a0a0',
          shadows: '#1a1a1a',
          highlights: '#ffffff',
          dominant: [],
        },
        temperature: 'neutral',
        saturation: 'natural',
        contrast: 'medium',
      },
      lighting: {
        style: 'natural lighting',
        direction: 'frontal',
        quality: 'soft',
        keyLight: 'natural',
        intensity: 'moderate',
      },
      atmosphere: {
        elements: [],
        timeOfDay: 'day',
        weather: 'clear',
        mood: 'neutral',
      },
      technical: {
        filmStock: 'digital',
        lensCharacteristics: 'standard',
        grainLevel: 'none',
        depthOfField: 'moderate',
        motionBlur: 'none',
      },
      stylePromptFragment: '',
      confidence: 1.0,
    };
  }

  private defaultSettings(): ContinuitySettings {
    return {
      autoExtractStyle: true,
      autoFrameBridge: true,
      styleInjectionStrength: 'medium',
      styleInjectionPosition: 'prefix',
      inheritColor: true,
      inheritLighting: true,
      inheritAtmosphere: true,
      inheritTechnical: true,
      defaultModel: 'veo-3',
      usePreviewFirst: true,
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateShotId(): string {
    return `shot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Session store interface (implement with your persistence layer)
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

// All routes require authentication
router.use(authenticateUser);

/**
 * POST /api/continuity/sessions
 * Create a new continuity session
 */
router.post('/sessions', async (req, res) => {
  const { name, description, initialPrompt, initialVideoId, settings } = req.body;
  
  try {
    const service = req.app.get('continuitySessionService');
    const session = await service.createSession(req.user.id, {
      name,
      description,
      initialPrompt,
      initialVideoId,
      settings,
    });
    
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * GET /api/continuity/sessions
 * Get all sessions for current user
 */
router.get('/sessions', async (req, res) => {
  const service = req.app.get('continuitySessionService');
  const sessions = await service.getUserSessions(req.user.id);
  res.json({ success: true, data: sessions });
});

/**
 * GET /api/continuity/sessions/:sessionId
 * Get a single session
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
 * Add a new shot to a session
 */
router.post('/sessions/:sessionId/shots', async (req, res) => {
  const { prompt, modelId, useFrameBridge, styleOverrides } = req.body;
  
  try {
    const service = req.app.get('continuitySessionService');
    const shot = await service.addShot({
      sessionId: req.params.sessionId,
      prompt,
      modelId,
      useFrameBridge,
      styleOverrides,
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
 * PUT /api/continuity/sessions/:sessionId/style
 * Update session style
 */
router.put('/sessions/:sessionId/style', async (req, res) => {
  try {
    const service = req.app.get('continuitySessionService');
    const session = await service.updateSessionStyle(
      req.params.sessionId,
      req.body.style
    );
    
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update style' });
  }
});

/**
 * POST /api/continuity/extract-style
 * Extract style from a video (standalone)
 */
router.post('/extract-style', async (req, res) => {
  const { videoId, framePosition } = req.body;
  
  try {
    const extractor = req.app.get('styleExtractionService');
    const style = await extractor.extractFromVideo(videoId, framePosition);
    
    res.json({ success: true, data: style });
  } catch (error) {
    res.status(500).json({ error: 'Failed to extract style' });
  }
});

export default router;
```

---

## Client Implementation

### Context Provider

```typescript
// client/src/features/continuity/context/ContinuitySessionContext.tsx

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { continuityApi } from '../api/continuityApi';
import type { ContinuitySession, ContinuityShot, ExtractedStyle } from '../types';

interface ContinuityState {
  session: ContinuitySession | null;
  isLoading: boolean;
  error: string | null;
  activeShot: ContinuityShot | null;
}

type ContinuityAction =
  | { type: 'SET_SESSION'; session: ContinuitySession }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_ACTIVE_SHOT'; shot: ContinuityShot | null }
  | { type: 'UPDATE_SHOT'; shot: ContinuityShot }
  | { type: 'ADD_SHOT'; shot: ContinuityShot }
  | { type: 'UPDATE_STYLE'; style: ExtractedStyle };

const reducer = (state: ContinuityState, action: ContinuityAction): ContinuityState => {
  switch (action.type) {
    case 'SET_SESSION':
      return { ...state, session: action.session, isLoading: false };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };
    case 'SET_ERROR':
      return { ...state, error: action.error, isLoading: false };
    case 'SET_ACTIVE_SHOT':
      return { ...state, activeShot: action.shot };
    case 'UPDATE_SHOT':
      if (!state.session) return state;
      return {
        ...state,
        session: {
          ...state.session,
          shots: state.session.shots.map(s =>
            s.id === action.shot.id ? action.shot : s
          ),
        },
      };
    case 'ADD_SHOT':
      if (!state.session) return state;
      return {
        ...state,
        session: {
          ...state.session,
          shots: [...state.session.shots, action.shot],
        },
      };
    case 'UPDATE_STYLE':
      if (!state.session) return state;
      return {
        ...state,
        session: {
          ...state.session,
          baseStyle: action.style,
        },
      };
    default:
      return state;
  }
};

interface ContinuityContextValue extends ContinuityState {
  createSession: (name: string, initialVideoId?: string) => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  addShot: (prompt: string, options?: { modelId?: string; useFrameBridge?: boolean }) => Promise<ContinuityShot>;
  generateShot: (shotId: string) => Promise<void>;
  updateStyle: (updates: Partial<ExtractedStyle>) => Promise<void>;
  setActiveShot: (shot: ContinuityShot | null) => void;
}

const ContinuityContext = createContext<ContinuityContextValue | null>(null);

export function ContinuitySessionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    session: null,
    isLoading: false,
    error: null,
    activeShot: null,
  });

  const createSession = useCallback(async (name: string, initialVideoId?: string) => {
    dispatch({ type: 'SET_LOADING', isLoading: true });
    try {
      const session = await continuityApi.createSession({ name, initialVideoId });
      dispatch({ type: 'SET_SESSION', session });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', error: 'Failed to create session' });
    }
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    dispatch({ type: 'SET_LOADING', isLoading: true });
    try {
      const session = await continuityApi.getSession(sessionId);
      dispatch({ type: 'SET_SESSION', session });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', error: 'Failed to load session' });
    }
  }, []);

  const addShot = useCallback(async (
    prompt: string,
    options?: { modelId?: string; useFrameBridge?: boolean }
  ) => {
    if (!state.session) throw new Error('No active session');
    
    const shot = await continuityApi.addShot(state.session.id, {
      prompt,
      ...options,
    });
    dispatch({ type: 'ADD_SHOT', shot });
    return shot;
  }, [state.session]);

  const generateShot = useCallback(async (shotId: string) => {
    if (!state.session) return;
    
    // Update to generating status
    const shot = state.session.shots.find(s => s.id === shotId);
    if (shot) {
      dispatch({ type: 'UPDATE_SHOT', shot: { ...shot, status: 'generating' } });
    }

    try {
      const updatedShot = await continuityApi.generateShot(state.session.id, shotId);
      dispatch({ type: 'UPDATE_SHOT', shot: updatedShot });
    } catch (error) {
      if (shot) {
        dispatch({ type: 'UPDATE_SHOT', shot: { ...shot, status: 'failed', error: 'Generation failed' } });
      }
    }
  }, [state.session]);

  const updateStyle = useCallback(async (updates: Partial<ExtractedStyle>) => {
    if (!state.session) return;
    
    const session = await continuityApi.updateStyle(state.session.id, updates);
    dispatch({ type: 'UPDATE_STYLE', style: session.baseStyle });
  }, [state.session]);

  const setActiveShot = useCallback((shot: ContinuityShot | null) => {
    dispatch({ type: 'SET_ACTIVE_SHOT', shot });
  }, []);

  return (
    <ContinuityContext.Provider
      value={{
        ...state,
        createSession,
        loadSession,
        addShot,
        generateShot,
        updateStyle,
        setActiveShot,
      }}
    >
      {children}
    </ContinuityContext.Provider>
  );
}

export function useContinuitySession() {
  const context = useContext(ContinuityContext);
  if (!context) {
    throw new Error('useContinuitySession must be used within ContinuitySessionProvider');
  }
  return context;
}
```

### Main Component

```typescript
// client/src/features/continuity/components/ContinuitySession/ContinuitySession.tsx

import React from 'react';
import { useContinuitySession } from '../../context/ContinuitySessionContext';
import { SessionTimeline } from './SessionTimeline';
import { StylePanel } from '../StylePanel';
import { ShotEditor } from '../ShotEditor';

interface ContinuitySessionProps {
  className?: string;
}

export function ContinuitySession({ className = '' }: ContinuitySessionProps) {
  const { session, isLoading, error, activeShot } = useContinuitySession();

  if (isLoading) {
    return (
      <div className={`continuity-session ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-700 rounded w-1/3 mb-4"></div>
          <div className="h-40 bg-zinc-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`continuity-session ${className}`}>
        <div className="text-red-400 p-4 bg-red-500/10 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={`continuity-session ${className}`}>
        <CreateSessionPrompt />
      </div>
    );
  }

  return (
    <div className={`continuity-session ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">
            🎬 {session.name}
          </h2>
          <p className="text-sm text-zinc-400">
            {session.shots.length} shots
          </p>
        </div>
        <button className="btn-primary">
          + Add Shot
        </button>
      </div>

      {/* Timeline */}
      <SessionTimeline shots={session.shots} />

      {/* Style Panel */}
      <StylePanel style={session.baseStyle} />

      {/* Active Shot Editor */}
      {activeShot && (
        <ShotEditor shot={activeShot} />
      )}
    </div>
  );
}

function CreateSessionPrompt() {
  const { createSession } = useContinuitySession();
  const [name, setName] = React.useState('');

  const handleCreate = () => {
    if (name.trim()) {
      createSession(name.trim());
    }
  };

  return (
    <div className="text-center py-12">
      <h3 className="text-lg font-medium text-white mb-4">
        Create a New Scene
      </h3>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Scene name..."
        className="input-field w-64 mb-4"
      />
      <button 
        onClick={handleCreate}
        disabled={!name.trim()}
        className="btn-primary"
      >
        Create Scene
      </button>
    </div>
  );
}
```

---

## Integration: "Continue Scene" Button

Add to existing generation completion flow:

```typescript
// client/src/features/prompt-optimizer/components/GenerationComplete.tsx

import { ContinueSceneButton } from '@/features/continuity/components/ContinueSceneButton';

export function GenerationComplete({ generation }) {
  return (
    <div className="generation-complete">
      {/* ... existing completion UI ... */}
      
      {/* Add Continue Scene option */}
      <div className="mt-4 pt-4 border-t border-zinc-700">
        <ContinueSceneButton 
          videoId={generation.videoId}
          prompt={generation.prompt}
        />
      </div>
    </div>
  );
}
```

```typescript
// client/src/features/continuity/components/ContinueSceneButton/ContinueSceneButton.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { continuityApi } from '../../api/continuityApi';

interface ContinueSceneButtonProps {
  videoId: string;
  prompt: string;
}

export function ContinueSceneButton({ videoId, prompt }: ContinueSceneButtonProps) {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = React.useState(false);

  const handleClick = async () => {
    setIsCreating(true);
    try {
      // Create session from this video
      const session = await continuityApi.createSession({
        name: `Scene from ${new Date().toLocaleDateString()}`,
        initialVideoId: videoId,
        initialPrompt: prompt,
      });
      
      // Navigate to continuity view
      navigate(`/continuity/${session.id}`);
    } catch (error) {
      console.error('Failed to create continuity session:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isCreating}
      className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
    >
      <span>🎬</span>
      {isCreating ? 'Creating scene...' : 'Continue this scene →'}
    </button>
  );
}
```

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Continuity session creation | > 20% of users | Track session creates |
| Shots per session | > 2.5 average | Avg shots in active sessions |
| Style consistency score | > 0.75 | VLM comparison of consecutive shots |
| Re-generation rate | < 30% | Shots needing re-gen due to style mismatch |
| Frame bridge usage | > 60% of shots | Track i2v usage in sessions |

---

## Effort Breakdown

| Task | Estimate | Dependencies |
|------|----------|--------------|
| StyleExtractionService + VLM integration | 3 days | VLM access (GPT-4o Vision) |
| StyleInjectionService | 2 days | Extraction service |
| FrameBridgeService | 2 days | Asset service |
| ContinuitySessionService | 3 days | All above |
| API endpoints | 1 day | Services |
| Client: Context + hooks | 2 days | API |
| Client: Session timeline UI | 3 days | Context |
| Client: Style panel | 2 days | Context |
| Client: Shot editor | 2 days | Context |
| Integration with existing generation | 1 day | All above |
| Testing | 3 days | All above |
| **Total** | **~3.5 weeks** | |

---

## Open Questions

1. **VLM cost**: How much will style extraction cost per shot? Should we cache aggressively?

2. **Style drift**: Over many shots, will injected style drift from original? Need periodic re-anchoring?

3. **User override UX**: How do users override inherited style for specific shots?

4. **Model compatibility**: Does style injection work equally well for all models?

5. **Preview generation**: Should we generate a preview with style injection before final, to validate?

---

## Next Steps

1. [ ] Set up VLM integration (GPT-4o Vision or Gemini)
2. [ ] Implement StyleExtractionService with prompt template
3. [ ] Build StyleInjectionService with strength levels
4. [ ] Implement FrameBridgeService
5. [ ] Create ContinuitySessionService with persistence
6. [ ] Build API endpoints
7. [ ] Create React context and hooks
8. [ ] Build timeline UI components
9. [ ] Add "Continue Scene" button to generation flow
10. [ ] Test with real generations
11. [ ] Monitor style consistency metrics
