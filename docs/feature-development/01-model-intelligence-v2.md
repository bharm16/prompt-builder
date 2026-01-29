# Feature 1: Model Intelligence (V2)

> **"Which model should I use?"** — Automatic model recommendation based on prompt analysis.

**Effort:** 2-3 weeks  
**Priority:** 1 (Build First)  
**Dependencies:** Existing span labeling system, model ID registry, availability gating

---

## Problem Statement

Users don't know which video model to use. Each has distinct strengths:

| Model | Best For | Weakest At |
|-------|----------|------------|
| **Sora 2** | Physics, spatial complexity, mechanical movement | Stylization, artistic looks |
| **Veo 3** | Cinematic lighting, atmosphere, mood | Complex physics |
| **Kling 2.1** | Facial performance, character emotion, acting | Environment detail |
| **Luma Ray 3** | Morphing, transitions, stylized looks | Realistic physics |
| **Wan 2.2** | Fast previews, general purpose | Final production quality |

This knowledge is tribal — locked in Reddit threads and Discord servers. Users either pick randomly, use what they used last time, or assume expensive = best.

**Result:** Wasted credits on suboptimal model choices.

---

## Solution Overview

Analyze the prompt using existing span labeling, extract requirements, score against model capabilities, recommend with explanations.

```
User prompt → Span Analysis → Requirements Extraction → Model Scoring → Recommendation
```

### Compatibility Updates (Required for This Codebase)

These are mandatory adjustments to avoid build failures and ensure the system works with existing services:

- Use `span.role` as the taxonomy category signal (`role ?? category` defensively). Server spans do **not** have `category`.
- Use the existing `labelSpans(...)` function (or coordinator) — there is no `SpanLabelingService` class to inject.
- Use canonical generation IDs from `VIDEO_MODELS` (e.g., `google/veo-3`, `kling-v2-1-master`, `wan-video/wan-2.2-t2v-fast`).
- Normalize any incoming/legacy IDs via existing alias utilities before scoring or display.
- Apply availability + entitlement gating **before** final recommendation.
- Support input modes (`t2v` vs `i2v`) with capability modifiers.
- Tie-break close scores using cost/speed to surface a “Best Value” option.

### User Experience

```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 Model Recommendation                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Your prompt requires: Complex physics, Urban environment        │
│                                                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                 │
│ 🥇 Best Match: Sora 2                               92% fit     │
│    ├─ Complex physics: rain simulation              ████████░░  │
│    ├─ Mechanical movement: robot locomotion         ████████░░  │
│    └─ Urban environment: architectural detail       ███████░░░  │
│                                                                 │
│ 🥈 Efficient Option: Veo 3                         89% fit     │
│    ├─ Atmospheric: contemplative mood               █████████░  │
│    └─ Weaker on: physics simulation                 ████░░░░░░  │
│                                                                 │
│ 🥉 Not Recommended: Kling 2.1                       45% fit     │
│    └─ No human performance elements detected                    │
│                                                                 │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                 │
│ [Use Sora 2 ✓]  [Use Veo 3]  [Compare Both →]                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### Directory Structure

```
server/src/services/model-intelligence/
├── index.ts                           # Public exports
├── types.ts                           # All type definitions
├── ModelIntelligenceService.ts        # Main orchestrator (< 300 lines)
├── PromptRequirementsService.ts       # Span → Requirements (< 200 lines)
├── ModelCapabilityRegistry.ts         # Model capabilities config (< 150 lines)
├── ModelScoringService.ts             # Scoring algorithm (< 200 lines)
├── RecommendationExplainerService.ts  # Human-readable explanations (< 150 lines)
└── __tests__/
    ├── ModelIntelligenceService.test.ts
    ├── PromptRequirementsService.test.ts
    ├── ModelScoringService.test.ts
    └── fixtures/
        └── testPrompts.ts

client/src/features/model-intelligence/
├── index.ts
├── types.ts
├── hooks/
│   ├── useModelRecommendation.ts      # Main hook (< 100 lines)
│   └── useModelComparison.ts          # Compare mode hook (< 80 lines)
├── components/
│   ├── ModelRecommendation/
│   │   ├── ModelRecommendation.tsx    # Main container (< 150 lines)
│   │   ├── ModelScoreCard.tsx         # Individual model card (< 100 lines)
│   │   ├── ScoreBar.tsx               # Visual score indicator (< 50 lines)
│   │   ├── RecommendationReasons.tsx  # Why this model (< 80 lines)
│   │   └── index.ts
│   ├── ModelComparison/
│   │   ├── ModelComparison.tsx        # Side-by-side view (< 150 lines)
│   │   ├── ComparisonPreview.tsx      # Preview thumbnails (< 100 lines)
│   │   └── index.ts
│   └── ModelSelector/
│       ├── ModelSelector.tsx          # Dropdown with recommendations (< 100 lines)
│       └── index.ts
└── api/
    └── modelIntelligenceApi.ts        # API calls (< 50 lines)
```

---

## Type Definitions

### Core Types

```typescript
// server/src/services/model-intelligence/types.ts

import { VideoModelId } from '@/services/video-generation/types';

/**
 * Requirements extracted from a prompt
 * Derived from span.role (taxonomy IDs), not span.category.
 */
export interface PromptRequirements {
  // Physics complexity
  physics: {
    hasComplexPhysics: boolean;      // water, fire, cloth, collision
    hasParticleSystems: boolean;     // rain, snow, smoke, sparks
    hasFluidDynamics: boolean;       // water, liquids
    hasSoftBodyPhysics: boolean;     // cloth, hair, organic deformation
    physicsComplexity: 'none' | 'simple' | 'moderate' | 'complex';
  };

  // Character requirements
  character: {
    hasHumanCharacter: boolean;
    hasAnimalCharacter: boolean;
    hasMechanicalCharacter: boolean; // robots, machines
    requiresFacialPerformance: boolean;
    requiresBodyLanguage: boolean;
    requiresLipSync: boolean;
    emotionalIntensity: 'none' | 'subtle' | 'moderate' | 'intense';
  };

  // Environment
  environment: {
    complexity: 'simple' | 'moderate' | 'complex';
    type: 'interior' | 'exterior' | 'abstract' | 'mixed';
    hasArchitecture: boolean;
    hasNature: boolean;
    hasUrbanElements: boolean;
  };

  // Lighting
  lighting: {
    requirements: 'natural' | 'stylized' | 'dramatic' | 'mixed';
    complexity: 'simple' | 'moderate' | 'complex';
    hasPracticalLights: boolean;     // neon, lamps, screens
    requiresAtmospherics: boolean;   // fog, haze, volumetrics
  };

  // Style
  style: {
    isPhotorealistic: boolean;
    isStylized: boolean;
    isAbstract: boolean;
    requiresCinematicLook: boolean;
    hasSpecificAesthetic: string | null;  // "anime", "noir", etc.
  };

  // Motion
  motion: {
    cameraComplexity: 'static' | 'simple' | 'moderate' | 'complex';
    subjectComplexity: 'static' | 'simple' | 'moderate' | 'complex';
    hasMorphing: boolean;
    hasTransitions: boolean;
  };

  // Extracted from spans
  detectedCategories: string[];
  confidenceScore: number;
}

/**
 * Model capability scores (0.0 - 1.0)
 */
export interface ModelCapabilities {
  // Core capabilities
  physics: number;
  particleSystems: number;
  fluidDynamics: number;

  facialPerformance: number;
  bodyLanguage: number;
  characterActing: number;

  cinematicLighting: number;
  atmospherics: number;

  environmentDetail: number;
  architecturalAccuracy: number;

  motionComplexity: number;
  cameraControl: number;

  stylization: number;
  photorealism: number;

  // Special capabilities
  morphing: number;
  transitions: number;

  // Mode modifiers
  i2vBoost?: number;          // Optional multiplier for i2v mode
  t2vBoost?: number;          // Optional multiplier for t2v mode

  // Meta
  speedTier: 'fast' | 'medium' | 'slow';
  costTier: 'low' | 'medium' | 'high';
  qualityTier: 'preview' | 'standard' | 'premium';
}

/**
 * Scoring result for a single model
 */
export interface ModelScore {
  modelId: VideoModelId;
  overallScore: number;           // 0-100

  // Breakdown
  factorScores: FactorScore[];

  // Explanations
  strengths: string[];
  weaknesses: string[];

  // Warnings
  warnings: string[];             // e.g., "May struggle with rain physics"
}

export interface FactorScore {
  factor: string;                 // e.g., "physics", "facialPerformance"
  label: string;                  // e.g., "Complex Physics"
  weight: number;                 // How important this was
  capability: number;             // Model's capability (0-1)
  contribution: number;           // Weighted contribution to score
  explanation: string;            // Why this matters for this prompt
}

/**
 * Full recommendation response
 */
export interface ModelRecommendation {
  // Input
  promptId: string;
  prompt: string;
  requirements: PromptRequirements;

  // Recommendations (sorted by score)
  recommendations: ModelScore[];

  // Top pick
  recommended: {
    modelId: VideoModelId;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  };

  // Efficient option (when close scores)
  alsoConsider?: {
    modelId: VideoModelId;
    reasoning: string;
  };

  // Comparison suggestion
  suggestComparison: boolean;
  comparisonModels?: [VideoModelId, VideoModelId];

  // Filtered out (availability/entitlement)
  filteredOut?: Array<{ modelId: VideoModelId; reason: string }>;

  // Metadata
  computedAt: Date;
}
```

---

## Implementation Details

### 1. PromptRequirementsService

Extracts requirements from **span.role** (taxonomy IDs), not `span.category`.

```typescript
// server/src/services/model-intelligence/PromptRequirementsService.ts

import { LLMSpan } from '@/llm/span-labeling/types';
import { PromptRequirements } from './types';

export class PromptRequirementsService {
  /**
   * Extract generation requirements from labeled spans
   */
  extractRequirements(
    prompt: string,
    spans: LLMSpan[]
  ): PromptRequirements {
    const categories = spans.map(s => s.role || (s as any).category).filter(Boolean) as string[];

    return {
      physics: this.analyzePhysics(spans),
      character: this.analyzeCharacter(spans),
      environment: this.analyzeEnvironment(spans),
      lighting: this.analyzeLighting(spans),
      style: this.analyzeStyle(spans),
      motion: this.analyzeMotion(spans),
      detectedCategories: categories,
      confidenceScore: this.calculateConfidence(spans),
    };
  }

  private analyzePhysics(spans: LLMSpan[]): PromptRequirements['physics'] {
    const spanTexts = spans.map(s => s.text.toLowerCase());
    const allText = spanTexts.join(' ');

    const roles = spans.map(s => s.role || (s as any).category).filter(Boolean) as string[];

    const hasWater = /\b(water|rain|ocean|river|splash|wet|puddle|wave)\b/.test(allText);
    const hasFire = /\b(fire|flame|burning|explosion|spark)\b/.test(allText);
    const hasParticles = /\b(rain|snow|smoke|dust|sparks|embers|fog)\b/.test(allText);
    const hasCloth = /\b(dress|cape|curtain|flag|fabric|flowing)\b/.test(allText);
    const hasCollision = /\b(crash|impact|breaking|shatter|collision)\b/.test(allText);

    const weatherSpans = roles.filter(r => r === 'environment.weather' || r.startsWith('environment.weather.'));
    const complexityScore = [hasWater, hasFire, hasParticles, hasCloth, hasCollision]
      .filter(Boolean).length;

    return {
      hasComplexPhysics: complexityScore >= 2 || hasWater || hasFire,
      hasParticleSystems: hasParticles || weatherSpans.length > 0,
      hasFluidDynamics: hasWater,
      hasSoftBodyPhysics: hasCloth,
      physicsComplexity: this.scoreToComplexity(complexityScore, 4),
    };
  }

  private analyzeCharacter(spans: LLMSpan[]): PromptRequirements['character'] {
    const roles = spans.map(s => s.role || (s as any).category).filter(Boolean) as string[];
    const subjectRoles = roles.filter(r => r.startsWith('subject.'));
    const emotionRoles = roles.filter(r => r === 'subject.emotion');
    const actionRoles = roles.filter(r => r.startsWith('action.'));

    const allText = spans.map(s => s.text.toLowerCase()).join(' ');

    const hasHuman = subjectRoles.includes('subject.identity') || /\b(person|man|woman|child|people|face|human|girl|boy)\b/.test(allText);
    const hasAnimal = /\b(dog|cat|bird|animal|creature|horse)\b/.test(allText);
    const hasMech = /\b(robot|machine|android|mech|drone|vehicle)\b/.test(allText);

    const needsFace = emotionRoles.length > 0 || /\b(expression|smile|cry|laugh|frown|gaze|eyes|face)\b/.test(allText);
    const needsBody = actionRoles.length > 0 || /\b(gesture|posture|stance|movement|walk|run|dance|sit|stand)\b/.test(allText);

    const emotionalIntensity = this.assessEmotionalIntensity(emotionRoles, allText);

    return {
      hasHumanCharacter: hasHuman,
      hasAnimalCharacter: hasAnimal,
      hasMechanicalCharacter: hasMech,
      requiresFacialPerformance: hasHuman && needsFace,
      requiresBodyLanguage: hasHuman && needsBody,
      requiresLipSync: /\b(speak|talk|sing)\b/.test(allText),
      emotionalIntensity,
    };
  }

  private analyzeEnvironment(spans: LLMSpan[]): PromptRequirements['environment'] {
    const roles = spans.map(s => s.role || (s as any).category).filter(Boolean) as string[];
    const envRoles = roles.filter(r => r.startsWith('environment.'));
    const allText = spans.map(s => s.text.toLowerCase()).join(' ');

    const hasInterior = /\b(room|interior|inside|indoor|house|building|office|kitchen|bedroom)\b/.test(allText);
    const hasExterior = /\b(outside|outdoor|street|city|forest|beach|mountain|sky)\b/.test(allText);

    const complexity = envRoles.length <= 1 ? 'simple' : envRoles.length <= 3 ? 'moderate' : 'complex';

    return {
      complexity,
      type: hasInterior && hasExterior ? 'mixed' : hasInterior ? 'interior' : hasExterior ? 'exterior' : 'abstract',
      hasArchitecture: /\b(building|architecture|city|street)\b/.test(allText),
      hasNature: /\b(tree|forest|ocean|mountain)\b/.test(allText),
      hasUrbanElements: /\b(city|urban|neon|street)\b/.test(allText),
    };
  }

  private analyzeLighting(spans: LLMSpan[]): PromptRequirements['lighting'] {
    const roles = spans.map(s => s.role || (s as any).category).filter(Boolean) as string[];
    const lightingRoles = roles.filter(r => r.startsWith('lighting.'));
    const allText = spans.map(s => s.text.toLowerCase()).join(' ');

    const hasDramatic = /\b(dramatic|rim|backlight|silhouette|chiaroscuro|noir|moody|contrast)\b/.test(allText);
    const hasStylized = /\b(neon|colorful|vibrant|saturated)\b/.test(allText);
    const hasPractical = /\b(neon|lamp|screen|sign|glow|light source)\b/.test(allText);
    const hasAtmospherics = /\b(fog|haze|mist|smoke|volumetric|rays)\b/.test(allText);

    return {
      requirements: hasDramatic ? 'dramatic' : hasStylized ? 'stylized' : 'natural',
      complexity: lightingRoles.length <= 1 ? 'simple' : lightingRoles.length <= 2 ? 'moderate' : 'complex',
      hasPracticalLights: hasPractical,
      requiresAtmospherics: hasAtmospherics,
    };
  }

  private analyzeStyle(spans: LLMSpan[]): PromptRequirements['style'] {
    const roles = spans.map(s => s.role || (s as any).category).filter(Boolean) as string[];
    const styleRoles = roles.filter(r => r.startsWith('style.'));
    const allText = spans.map(s => s.text.toLowerCase()).join(' ');

    const isPhotorealistic = /\b(realistic|photorealistic|lifelike|real)\b/.test(allText);
    const isStylized = /\b(anime|cartoon|illustration|painted|artistic|stylized|abstract)\b/.test(allText);
    const isCinematic = /\b(cinematic|film|movie|cinema|theatrical|anamorphic|widescreen|letterbox)\b/.test(allText);

    let specificAesthetic: string | null = null;
    const aesthetics = ['anime', 'noir', 'cyberpunk', 'vintage', 'retro', 'minimalist', 'surreal', 'gothic'];
    for (const aesthetic of aesthetics) {
      if (allText.includes(aesthetic)) {
        specificAesthetic = aesthetic;
        break;
      }
    }

    return {
      isPhotorealistic: isPhotorealistic && !isStylized,
      isStylized,
      isAbstract: allText.includes('abstract'),
      requiresCinematicLook: isCinematic,
      hasSpecificAesthetic: specificAesthetic,
    };
  }

  private analyzeMotion(spans: LLMSpan[]): PromptRequirements['motion'] {
    const roles = spans.map(s => s.role || (s as any).category).filter(Boolean) as string[];
    const cameraRoles = roles.filter(r => r.startsWith('camera.'));
    const actionRoles = roles.filter(r => r.startsWith('action.'));
    const allText = spans.map(s => s.text.toLowerCase()).join(' ');

    const complexCamera = /\b(tracking|dolly|crane|aerial|orbit)\b/.test(allText);
    const simpleCamera = /\b(pan|tilt|zoom)\b/.test(allText);
    const staticCamera = /\b(static|locked|still|fixed)\b/.test(allText);

    let cameraComplexity: 'static' | 'simple' | 'moderate' | 'complex' = 'static';
    if (complexCamera) cameraComplexity = 'complex';
    else if (simpleCamera) cameraComplexity = 'simple';
    else if (cameraRoles.length > 0 && !staticCamera) cameraComplexity = 'moderate';

    const subjectComplexity = actionRoles.length === 0 ? 'static' :
      actionRoles.length <= 1 ? 'simple' :
      actionRoles.length <= 2 ? 'moderate' : 'complex';

    const hasMorphing = /\b(morph|transform|transition|become|change into)\b/.test(allText);

    return {
      cameraComplexity,
      subjectComplexity,
      hasMorphing,
      hasTransitions: hasMorphing || allText.includes('transition'),
    };
  }

  private assessEmotionalIntensity(
    emotionRoles: string[],
    allText: string
  ): 'none' | 'subtle' | 'moderate' | 'intense' {
    if (emotionRoles.length === 0) return 'none';

    if (/\b(crying|screaming|rage|terror|ecstatic|devastated|furious)\b/.test(allText)) return 'intense';
    if (/\b(sad|happy|angry|scared|excited|worried|joyful)\b/.test(allText)) return 'moderate';
    return 'subtle';
  }

  private scoreToComplexity(score: number, max: number): 'none' | 'simple' | 'moderate' | 'complex' {
    const ratio = score / max;
    if (ratio === 0) return 'none';
    if (ratio <= 0.25) return 'simple';
    if (ratio <= 0.5) return 'moderate';
    return 'complex';
  }

  private calculateConfidence(spans: LLMSpan[]): number {
    if (spans.length === 0) return 0.3;
    const spanConfidence = Math.min(spans.length / 10, 1);
    const avgSpanConfidence = spans.reduce((sum, s) => sum + (s.confidence || 0.5), 0) / spans.length;
    return (spanConfidence * 0.4) + (avgSpanConfidence * 0.6);
  }
}
```

### 2. ModelCapabilityRegistry

Configuration-driven model capabilities using **canonical generation IDs** from `VIDEO_MODELS`.

```typescript
// server/src/services/model-intelligence/ModelCapabilityRegistry.ts

import { VIDEO_MODELS } from '@/config/modelConfig';
import { ModelCapabilities } from './types';

export class ModelCapabilityRegistry {
  private capabilities: Map<string, ModelCapabilities>;

  constructor() {
    this.capabilities = new Map();
    this.initializeCapabilities();
  }

  getCapabilities(modelId: string): ModelCapabilities | null {
    return this.capabilities.get(modelId) || null;
  }

  getAllModels(): string[] {
    return Array.from(this.capabilities.keys());
  }

  getProductionModels(): string[] {
    return Array.from(this.capabilities.entries())
      .filter(([_, cap]) => cap.qualityTier !== 'preview')
      .map(([id]) => id);
  }

  private initializeCapabilities(): void {
    this.capabilities.set(VIDEO_MODELS.SORA_2, {
      physics: 0.95,
      particleSystems: 0.90,
      fluidDynamics: 0.92,
      facialPerformance: 0.70,
      bodyLanguage: 0.75,
      characterActing: 0.68,
      cinematicLighting: 0.80,
      atmospherics: 0.85,
      environmentDetail: 0.90,
      architecturalAccuracy: 0.88,
      motionComplexity: 0.85,
      cameraControl: 0.82,
      stylization: 0.60,
      photorealism: 0.88,
      morphing: 0.50,
      transitions: 0.55,
      t2vBoost: 1.0,
      i2vBoost: 0.9,
      speedTier: 'slow',
      costTier: 'high',
      qualityTier: 'premium',
    });

    this.capabilities.set(VIDEO_MODELS.VEO_3, {
      physics: 0.70,
      particleSystems: 0.65,
      fluidDynamics: 0.68,
      facialPerformance: 0.75,
      bodyLanguage: 0.72,
      characterActing: 0.70,
      cinematicLighting: 0.95,
      atmospherics: 0.92,
      environmentDetail: 0.85,
      architecturalAccuracy: 0.80,
      motionComplexity: 0.75,
      cameraControl: 0.78,
      stylization: 0.80,
      photorealism: 0.85,
      morphing: 0.60,
      transitions: 0.65,
      t2vBoost: 1.0,
      i2vBoost: 0.95,
      speedTier: 'medium',
      costTier: 'medium',
      qualityTier: 'premium',
    });

    this.capabilities.set(VIDEO_MODELS.KLING_V2_1, {
      physics: 0.65,
      particleSystems: 0.55,
      fluidDynamics: 0.58,
      facialPerformance: 0.92,
      bodyLanguage: 0.88,
      characterActing: 0.90,
      cinematicLighting: 0.70,
      atmospherics: 0.65,
      environmentDetail: 0.70,
      architecturalAccuracy: 0.65,
      motionComplexity: 0.80,
      cameraControl: 0.75,
      stylization: 0.65,
      photorealism: 0.78,
      morphing: 0.55,
      transitions: 0.50,
      t2vBoost: 1.0,
      i2vBoost: 0.95,
      speedTier: 'medium',
      costTier: 'medium',
      qualityTier: 'standard',
    });

    this.capabilities.set(VIDEO_MODELS.LUMA_RAY3, {
      physics: 0.60,
      particleSystems: 0.58,
      fluidDynamics: 0.55,
      facialPerformance: 0.65,
      bodyLanguage: 0.62,
      characterActing: 0.60,
      cinematicLighting: 0.75,
      atmospherics: 0.78,
      environmentDetail: 0.70,
      architecturalAccuracy: 0.65,
      motionComplexity: 0.70,
      cameraControl: 0.72,
      stylization: 0.88,
      photorealism: 0.68,
      morphing: 0.95,
      transitions: 0.92,
      t2vBoost: 0.95,
      i2vBoost: 1.1,
      speedTier: 'fast',
      costTier: 'medium',
      qualityTier: 'standard',
    });

    this.capabilities.set(VIDEO_MODELS.DRAFT, {
      physics: 0.55,
      particleSystems: 0.50,
      fluidDynamics: 0.48,
      facialPerformance: 0.58,
      bodyLanguage: 0.55,
      characterActing: 0.52,
      cinematicLighting: 0.60,
      atmospherics: 0.58,
      environmentDetail: 0.58,
      architecturalAccuracy: 0.55,
      motionComplexity: 0.55,
      cameraControl: 0.52,
      stylization: 0.60,
      photorealism: 0.55,
      morphing: 0.50,
      transitions: 0.48,
      t2vBoost: 1.0,
      i2vBoost: 1.0,
      speedTier: 'fast',
      costTier: 'low',
      qualityTier: 'preview',
    });
  }
}
```

### 3. ModelScoringService

Scoring algorithm that matches requirements to capabilities, with tie-break logic.

```typescript
// server/src/services/model-intelligence/ModelScoringService.ts

import { PromptRequirements, ModelCapabilities, ModelScore, FactorScore } from './types';

export class ModelScoringService {
  scoreModel(
    modelId: string,
    capabilities: ModelCapabilities,
    requirements: PromptRequirements,
    mode: 't2v' | 'i2v' = 't2v'
  ): ModelScore {
    const weights = this.calculateWeights(requirements);

    const factorScores = weights.map(w => ({
      factor: w.factor,
      label: w.label,
      weight: w.weight,
      capability: (capabilities[w.factor] as number) * this.getModeBoost(capabilities, mode),
      contribution: (capabilities[w.factor] as number) * w.weight * this.getModeBoost(capabilities, mode),
      explanation: w.explanation(requirements),
    }));

    const overallScore = this.calculateOverallScore(factorScores);

    return {
      modelId,
      overallScore,
      factorScores,
      strengths: [],
      weaknesses: [],
      warnings: [],
    };
  }

  private calculateWeights(requirements: PromptRequirements) {
    // Same weighting logic as v1, but mapped to requirements derived from role-based taxonomy.
    // (Omitted here for brevity; keep as in v1 with updated requirement sources.)
    return [] as Array<{
      factor: keyof ModelCapabilities;
      label: string;
      weight: number;
      explanation: (req: PromptRequirements) => string;
    }>;
  }

  private calculateOverallScore(factorScores: FactorScore[]): number {
    if (factorScores.length === 0) return 50;

    const totalContribution = factorScores.reduce((sum, f) => sum + f.contribution, 0);
    const totalWeight = factorScores.reduce((sum, f) => sum + f.weight, 0);

    return Math.round((totalContribution / totalWeight) * 100);
  }

  private getModeBoost(capabilities: ModelCapabilities, mode: 't2v' | 'i2v'): number {
    if (mode === 'i2v') return capabilities.i2vBoost ?? 1.0;
    return capabilities.t2vBoost ?? 1.0;
  }
}
```

### 4. Main Orchestrator

Uses `labelSpans(...)` directly (or coordinator), and applies availability gating.

```typescript
// server/src/services/model-intelligence/ModelIntelligenceService.ts

import { labelSpans } from '@/llm/span-labeling/SpanLabelingService';
import { VideoGenerationService } from '@/services/video-generation/VideoGenerationService';
import { PromptRequirementsService } from './PromptRequirementsService';
import { ModelCapabilityRegistry } from './ModelCapabilityRegistry';
import { ModelScoringService } from './ModelScoringService';

export class ModelIntelligenceService {
  constructor(
    private videoService: VideoGenerationService
  ) {
    this.requirementsService = new PromptRequirementsService();
    this.registry = new ModelCapabilityRegistry();
    this.scoringService = new ModelScoringService();
  }

  private requirementsService: PromptRequirementsService;
  private registry: ModelCapabilityRegistry;
  private scoringService: ModelScoringService;

  async getRecommendation(prompt: string, mode: 't2v' | 'i2v' = 't2v') {
    const result = await labelSpans({ text: prompt }, this.videoService as any);
    const spans = result.spans || [];

    const requirements = this.requirementsService.extractRequirements(prompt, spans);

    const modelIds = this.registry.getAllModels();
    const availability = this.videoService.getAvailabilityReport(modelIds);

    const availableIds = availability.availableModels;

    const scores = availableIds
      .map((id) => {
        const caps = this.registry.getCapabilities(id);
        if (!caps) return null;
        return this.scoringService.scoreModel(id, caps, requirements, mode);
      })
      .filter(Boolean)
      .sort((a, b) => (b as any).overallScore - (a as any).overallScore) as any[];

    return {
      requirements,
      recommendations: scores,
    };
  }
}
```

---

## Availability & Entitlement Refactor (New Requirement)

The recommendation engine must **not** rely on the current `getAvailabilityReport` as-is. It is outdated and ineffective.

### Required Refactor

**New availability contract must:**
- Accept canonical generation IDs only.
- Return per-model `available`, `reason`, `requiredKey`, `supportsI2V`, and `planTier/entitlement` flags.
- Expose a fast “availability snapshot” with no network calls.
- Align with model resolver + provider aliasing.

**Temporary fallback (if refactor lags):** gate only by provider keys + model ID resolution, and mark the rest as “unknown availability.”

---

## API Endpoints

```typescript
// server/src/routes/model-intelligence.ts

router.post('/recommend', async (req, res) => {
  const { prompt, spans, mode = 't2v' } = req.body;

  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    const service = req.app.get('modelIntelligenceService');
    const recommendation = await service.getRecommendation(prompt, mode, spans);
    res.json({ success: true, data: recommendation });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate recommendation' });
  }
});
```

---

## Client Implementation

- Show **Best Match** and **Efficient Option** when they differ.
- Warn if a model is filtered out due to availability or entitlements.
- Keep explanations concise (top 2–3 reasons).

---

## Testing Strategy

### Unit Tests

- Requirements extraction from span.role taxonomy IDs
- Scoring + tie-break logic
- Availability gating + canonical ID enforcement

### Integration Tests

- End-to-end recommendation with mocked span labeling
- Availability refactor compliance

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Recommendation follow rate | > 60% | Track model selection vs recommendation |
| Comparison usage | > 15% of sessions | Track "Compare Both" clicks |
| Generation success improvement | +10% | Compare success rate recommended vs non-recommended |
| Multi-model usage | +25% | Track users trying 2+ models |
| Time to first generation | -20% | Measure decision time with/without recommendation |

---

## Effort Breakdown

| Task | Estimate | Dependencies |
|------|----------|--------------|
| PromptRequirementsService (role-based) | 3 days | Span labeling system |
| ModelCapabilityRegistry (canonical IDs) | 2 days | VIDEO_MODELS |
| ModelScoringService + tie-break | 2 days | Registry |
| Availability refactor | 2 days | VideoGenerationService |
| API endpoints | 1 day | Services |
| Client: useModelRecommendation | 1 day | API |
| Client: ModelRecommendation UI | 2 days | Hook |
| Integration with generation flow | 1 day | All above |
| Testing | 2 days | All above |
| **Total** | **~2.5 weeks** | |

---

## Open Questions

1. **Capability calibration**: How do we validate capability scores (manual testing vs user feedback)?
2. **Model updates**: When models improve, how do we update the registry (manual vs automated)?
3. **User override tracking**: Should ignoring recommendations feed back into scores?
4. **Cost sensitivity**: Should “best value” be default only when scores are close?
5. **I2V analysis**: Should requirements incorporate start image analysis (v2)?

---

## Next Steps

1. [ ] Implement role-based PromptRequirementsService
2. [ ] Create canonical ModelCapabilityRegistry
3. [ ] Build scoring with tie-break logic
4. [ ] Refactor availability report
5. [ ] Wire API endpoints
6. [ ] Build client UI
7. [ ] Integrate with generation flow
8. [ ] Add tests
9. [ ] Deploy and monitor metrics

---

## Remaining Implementation Notes

- [ ] Define and configure `MODEL_TIER_REQUIREMENTS` for real plan gating (currently empty, so entitlements effectively allow all models when plan tier is unknown).
- [ ] Ensure `planTier` is reliably populated for existing users (webhook updates on new invoices only; may need backfill/migration).
- [ ] Close the success-metrics loop: persist/aggregate telemetry, add dashboards/queries, and instrument generation outcomes to compute success-rate deltas, multi-model usage, and time-to-first-generation in practice.
- [ ] Deploy and monitor the new recommendation metrics in production.
