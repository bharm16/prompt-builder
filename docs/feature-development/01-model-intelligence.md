# Feature 1: Model Intelligence

> **"Which model should I use?"** — Automatic model recommendation based on prompt analysis.

**Effort:** 2-3 weeks  
**Priority:** 1 (Build First)  
**Dependencies:** Existing span labeling system

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
│ 🥈 Also Consider: Veo 3                             78% fit     │
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

import { VideoModelId } from '@/types/video';
import { TaxonomyCategory } from '@shared/taxonomy';

/**
 * Requirements extracted from a prompt
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
  detectedCategories: TaxonomyCategory[];
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
  
  // Comparison suggestion
  suggestComparison: boolean;
  comparisonModels?: [VideoModelId, VideoModelId];
  
  // Metadata
  computedAt: Date;
}

/**
 * Model comparison result
 */
export interface ModelComparison {
  promptId: string;
  prompt: string;
  
  comparisons: {
    modelId: VideoModelId;
    previewUrl: string;
    previewGeneratedAt: Date;
    score: ModelScore;
  }[];
  
  winner: VideoModelId | null;    // null if user hasn't chosen
  winnerSelectedAt?: Date;
}
```

---

## Implementation Details

### 1. PromptRequirementsService

Extracts requirements from span labels.

```typescript
// server/src/services/model-intelligence/PromptRequirementsService.ts

import { LabeledSpan } from '@/llm/span-labeling/types';
import { PromptRequirements } from './types';

export class PromptRequirementsService {
  /**
   * Extract generation requirements from labeled spans
   */
  extractRequirements(
    prompt: string,
    spans: LabeledSpan[]
  ): PromptRequirements {
    const categories = spans.map(s => s.category);
    
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

  private analyzePhysics(spans: LabeledSpan[]): PromptRequirements['physics'] {
    const physicsIndicators = {
      water: ['water', 'rain', 'ocean', 'river', 'splash', 'wet', 'puddle', 'wave'],
      fire: ['fire', 'flame', 'burning', 'explosion', 'spark'],
      particles: ['rain', 'snow', 'smoke', 'dust', 'sparks', 'embers', 'fog'],
      cloth: ['dress', 'cape', 'curtain', 'flag', 'fabric', 'flowing'],
      collision: ['crash', 'impact', 'breaking', 'shatter', 'collision'],
    };
    
    const spanTexts = spans.map(s => s.text.toLowerCase());
    const allText = spanTexts.join(' ');
    
    const hasWater = physicsIndicators.water.some(w => allText.includes(w));
    const hasFire = physicsIndicators.fire.some(w => allText.includes(w));
    const hasParticles = physicsIndicators.particles.some(w => allText.includes(w));
    const hasCloth = physicsIndicators.cloth.some(w => allText.includes(w));
    const hasCollision = physicsIndicators.collision.some(w => allText.includes(w));
    
    // Weather spans directly indicate particle systems
    const weatherSpans = spans.filter(s => 
      s.category === 'environment.weather' || 
      s.category.startsWith('environment.weather.')
    );
    
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

  private analyzeCharacter(spans: LabeledSpan[]): PromptRequirements['character'] {
    // Subject spans
    const subjectSpans = spans.filter(s => s.category.startsWith('subject.'));
    const emotionSpans = spans.filter(s => s.category === 'subject.emotion');
    const actionSpans = spans.filter(s => s.category.startsWith('action.'));
    
    const allText = spans.map(s => s.text.toLowerCase()).join(' ');
    
    // Human indicators
    const humanIndicators = ['person', 'man', 'woman', 'child', 'people', 'face', 
                            'human', 'girl', 'boy', 'her', 'his', 'they'];
    const hasHuman = humanIndicators.some(h => allText.includes(h)) ||
                     subjectSpans.some(s => s.category === 'subject.identity');
    
    // Animal indicators
    const animalIndicators = ['dog', 'cat', 'bird', 'animal', 'creature', 'horse'];
    const hasAnimal = animalIndicators.some(a => allText.includes(a));
    
    // Mechanical indicators
    const mechIndicators = ['robot', 'machine', 'android', 'mech', 'drone', 'vehicle'];
    const hasMech = mechIndicators.some(m => allText.includes(m));
    
    // Facial performance indicators
    const faceIndicators = ['expression', 'smile', 'cry', 'laugh', 'frown', 'look', 
                           'gaze', 'stare', 'eyes', 'face'];
    const needsFace = faceIndicators.some(f => allText.includes(f)) || 
                      emotionSpans.length > 0;
    
    // Body language indicators  
    const bodyIndicators = ['gesture', 'posture', 'stance', 'movement', 'walk', 
                           'run', 'dance', 'sit', 'stand'];
    const needsBody = bodyIndicators.some(b => allText.includes(b)) ||
                      actionSpans.length > 0;
    
    // Emotional intensity
    const emotionalIntensity = this.assessEmotionalIntensity(emotionSpans, allText);
    
    return {
      hasHumanCharacter: hasHuman,
      hasAnimalCharacter: hasAnimal,
      hasMechanicalCharacter: hasMech,
      requiresFacialPerformance: hasHuman && needsFace,
      requiresBodyLanguage: hasHuman && needsBody,
      requiresLipSync: allText.includes('speak') || allText.includes('talk') || 
                       allText.includes('sing'),
      emotionalIntensity,
    };
  }

  private analyzeEnvironment(spans: LabeledSpan[]): PromptRequirements['environment'] {
    const envSpans = spans.filter(s => s.category.startsWith('environment.'));
    const allText = spans.map(s => s.text.toLowerCase()).join(' ');
    
    // Environment type detection
    const interiorIndicators = ['room', 'interior', 'inside', 'indoor', 'house', 
                               'building', 'office', 'kitchen', 'bedroom'];
    const exteriorIndicators = ['outside', 'outdoor', 'street', 'city', 'forest', 
                               'beach', 'mountain', 'sky'];
    
    const hasInterior = interiorIndicators.some(i => allText.includes(i));
    const hasExterior = exteriorIndicators.some(e => allText.includes(e));
    
    // Complexity based on number of environment details
    const complexity = envSpans.length <= 1 ? 'simple' : 
                       envSpans.length <= 3 ? 'moderate' : 'complex';
    
    return {
      complexity,
      type: hasInterior && hasExterior ? 'mixed' : 
            hasInterior ? 'interior' : 
            hasExterior ? 'exterior' : 'abstract',
      hasArchitecture: allText.includes('building') || allText.includes('architecture') ||
                       allText.includes('city') || allText.includes('street'),
      hasNature: allText.includes('tree') || allText.includes('forest') ||
                 allText.includes('ocean') || allText.includes('mountain'),
      hasUrbanElements: allText.includes('city') || allText.includes('urban') ||
                        allText.includes('neon') || allText.includes('street'),
    };
  }

  private analyzeLighting(spans: LabeledSpan[]): PromptRequirements['lighting'] {
    const lightingSpans = spans.filter(s => s.category.startsWith('lighting.'));
    const allText = spans.map(s => s.text.toLowerCase()).join(' ');
    
    // Dramatic lighting indicators
    const dramaticIndicators = ['dramatic', 'rim', 'backlight', 'silhouette', 
                               'chiaroscuro', 'noir', 'moody', 'contrast'];
    const hasDramatic = dramaticIndicators.some(d => allText.includes(d));
    
    // Stylized lighting
    const stylizedIndicators = ['neon', 'colorful', 'vibrant', 'saturated'];
    const hasStylized = stylizedIndicators.some(s => allText.includes(s));
    
    // Practical lights
    const practicalIndicators = ['neon', 'lamp', 'screen', 'sign', 'glow', 'light source'];
    const hasPractical = practicalIndicators.some(p => allText.includes(p));
    
    // Atmospherics
    const atmosphericIndicators = ['fog', 'haze', 'mist', 'smoke', 'volumetric', 'rays'];
    const hasAtmospherics = atmosphericIndicators.some(a => allText.includes(a));
    
    return {
      requirements: hasDramatic ? 'dramatic' : hasStylized ? 'stylized' : 'natural',
      complexity: lightingSpans.length <= 1 ? 'simple' :
                  lightingSpans.length <= 2 ? 'moderate' : 'complex',
      hasPracticalLights: hasPractical,
      requiresAtmospherics: hasAtmospherics,
    };
  }

  private analyzeStyle(spans: LabeledSpan[]): PromptRequirements['style'] {
    const styleSpans = spans.filter(s => s.category.startsWith('style.'));
    const allText = spans.map(s => s.text.toLowerCase()).join(' ');
    
    // Photorealistic indicators
    const realisticIndicators = ['realistic', 'photorealistic', 'lifelike', 'real'];
    const isPhotorealistic = realisticIndicators.some(r => allText.includes(r));
    
    // Stylized indicators
    const stylizedIndicators = ['anime', 'cartoon', 'illustration', 'painted', 
                               'artistic', 'stylized', 'abstract'];
    const isStylized = stylizedIndicators.some(s => allText.includes(s));
    
    // Cinematic indicators
    const cinematicIndicators = ['cinematic', 'film', 'movie', 'cinema', 'theatrical',
                                'anamorphic', 'widescreen', 'letterbox'];
    const isCinematic = cinematicIndicators.some(c => allText.includes(c));
    
    // Detect specific aesthetic
    let specificAesthetic: string | null = null;
    const aesthetics = ['anime', 'noir', 'cyberpunk', 'vintage', 'retro', 
                       'minimalist', 'surreal', 'gothic'];
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

  private analyzeMotion(spans: LabeledSpan[]): PromptRequirements['motion'] {
    const cameraSpans = spans.filter(s => s.category.startsWith('camera.'));
    const actionSpans = spans.filter(s => s.category.startsWith('action.'));
    const allText = spans.map(s => s.text.toLowerCase()).join(' ');
    
    // Camera motion complexity
    const complexCameraIndicators = ['tracking', 'dolly', 'crane', 'aerial', 'orbit'];
    const simpleCameraIndicators = ['pan', 'tilt', 'zoom'];
    const staticCameraIndicators = ['static', 'locked', 'still', 'fixed'];
    
    let cameraComplexity: 'static' | 'simple' | 'moderate' | 'complex' = 'static';
    if (complexCameraIndicators.some(c => allText.includes(c))) {
      cameraComplexity = 'complex';
    } else if (simpleCameraIndicators.some(c => allText.includes(c))) {
      cameraComplexity = 'simple';
    } else if (cameraSpans.length > 0 && !staticCameraIndicators.some(s => allText.includes(s))) {
      cameraComplexity = 'moderate';
    }
    
    // Subject motion complexity
    const subjectComplexity = actionSpans.length === 0 ? 'static' :
                              actionSpans.length <= 1 ? 'simple' :
                              actionSpans.length <= 2 ? 'moderate' : 'complex';
    
    // Morphing/transitions
    const morphIndicators = ['morph', 'transform', 'transition', 'become', 'change into'];
    const hasMorphing = morphIndicators.some(m => allText.includes(m));
    
    return {
      cameraComplexity,
      subjectComplexity: subjectComplexity as any,
      hasMorphing,
      hasTransitions: hasMorphing || allText.includes('transition'),
    };
  }

  private assessEmotionalIntensity(
    emotionSpans: LabeledSpan[], 
    allText: string
  ): 'none' | 'subtle' | 'moderate' | 'intense' {
    if (emotionSpans.length === 0) return 'none';
    
    const intenseIndicators = ['crying', 'screaming', 'rage', 'terror', 'ecstatic', 
                              'devastated', 'furious'];
    const moderateIndicators = ['sad', 'happy', 'angry', 'scared', 'excited', 
                               'worried', 'joyful'];
    
    if (intenseIndicators.some(i => allText.includes(i))) return 'intense';
    if (moderateIndicators.some(m => allText.includes(m))) return 'moderate';
    return 'subtle';
  }

  private scoreToComplexity(
    score: number, 
    max: number
  ): 'none' | 'simple' | 'moderate' | 'complex' {
    const ratio = score / max;
    if (ratio === 0) return 'none';
    if (ratio <= 0.25) return 'simple';
    if (ratio <= 0.5) return 'moderate';
    return 'complex';
  }

  private calculateConfidence(spans: LabeledSpan[]): number {
    if (spans.length === 0) return 0.3;
    
    // More spans = more confidence in analysis
    const spanConfidence = Math.min(spans.length / 10, 1);
    
    // Average span confidence scores
    const avgSpanConfidence = spans.reduce((sum, s) => sum + (s.confidence || 0.5), 0) / spans.length;
    
    return (spanConfidence * 0.4) + (avgSpanConfidence * 0.6);
  }
}
```

### 2. ModelCapabilityRegistry

Configuration-driven model capabilities.

```typescript
// server/src/services/model-intelligence/ModelCapabilityRegistry.ts

import { VideoModelId } from '@/types/video';
import { ModelCapabilities } from './types';

/**
 * Central registry of model capabilities
 * 
 * Scores are 0.0 - 1.0 based on empirical testing and community consensus.
 * These should be updated as models improve.
 */
export class ModelCapabilityRegistry {
  private capabilities: Map<VideoModelId, ModelCapabilities>;

  constructor() {
    this.capabilities = new Map();
    this.initializeCapabilities();
  }

  getCapabilities(modelId: VideoModelId): ModelCapabilities | null {
    return this.capabilities.get(modelId) || null;
  }

  getAllModels(): VideoModelId[] {
    return Array.from(this.capabilities.keys());
  }

  getProductionModels(): VideoModelId[] {
    return Array.from(this.capabilities.entries())
      .filter(([_, cap]) => cap.qualityTier !== 'preview')
      .map(([id, _]) => id);
  }

  private initializeCapabilities(): void {
    // Sora 2 - Best for physics and spatial complexity
    this.capabilities.set('sora-2', {
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
      
      speedTier: 'slow',
      costTier: 'high',
      qualityTier: 'premium',
    });

    // Veo 3 - Best for cinematic lighting and atmosphere
    this.capabilities.set('veo-3', {
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
      
      speedTier: 'medium',
      costTier: 'medium',
      qualityTier: 'premium',
    });

    // Kling 2.1 - Best for character performance
    this.capabilities.set('kling-v2-1', {
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
      
      speedTier: 'medium',
      costTier: 'medium',
      qualityTier: 'standard',
    });

    // Luma Ray 3 - Best for morphing and stylization
    this.capabilities.set('luma-ray3', {
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
      
      speedTier: 'fast',
      costTier: 'medium',
      qualityTier: 'standard',
    });

    // Wan 2.2 - Preview/draft quality, general purpose
    this.capabilities.set('wan-2-2', {
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
      
      speedTier: 'fast',
      costTier: 'low',
      qualityTier: 'preview',
    });
  }

  /**
   * Update capabilities (e.g., after model updates)
   */
  updateCapability(
    modelId: VideoModelId, 
    updates: Partial<ModelCapabilities>
  ): void {
    const existing = this.capabilities.get(modelId);
    if (existing) {
      this.capabilities.set(modelId, { ...existing, ...updates });
    }
  }
}
```

### 3. ModelScoringService

Scoring algorithm that matches requirements to capabilities.

```typescript
// server/src/services/model-intelligence/ModelScoringService.ts

import { VideoModelId } from '@/types/video';
import { 
  PromptRequirements, 
  ModelCapabilities, 
  ModelScore, 
  FactorScore 
} from './types';
import { ModelCapabilityRegistry } from './ModelCapabilityRegistry';

interface ScoringWeight {
  factor: keyof ModelCapabilities;
  label: string;
  weight: number;
  condition: (req: PromptRequirements) => boolean;
  explanation: (req: PromptRequirements) => string;
}

export class ModelScoringService {
  constructor(private registry: ModelCapabilityRegistry) {}

  /**
   * Score all models against requirements
   */
  scoreAllModels(requirements: PromptRequirements): ModelScore[] {
    const models = this.registry.getProductionModels();
    
    const scores = models.map(modelId => 
      this.scoreModel(modelId, requirements)
    );
    
    // Sort by score descending
    return scores.sort((a, b) => b.overallScore - a.overallScore);
  }

  /**
   * Score a single model against requirements
   */
  scoreModel(
    modelId: VideoModelId, 
    requirements: PromptRequirements
  ): ModelScore {
    const capabilities = this.registry.getCapabilities(modelId);
    
    if (!capabilities) {
      return this.createEmptyScore(modelId);
    }

    const weights = this.calculateWeights(requirements);
    const factorScores = this.calculateFactorScores(
      capabilities, 
      weights, 
      requirements
    );
    
    const overallScore = this.calculateOverallScore(factorScores);
    const { strengths, weaknesses, warnings } = this.analyzeStrengthsWeaknesses(
      capabilities, 
      requirements, 
      factorScores
    );

    return {
      modelId,
      overallScore,
      factorScores,
      strengths,
      weaknesses,
      warnings,
    };
  }

  private calculateWeights(requirements: PromptRequirements): ScoringWeight[] {
    const weights: ScoringWeight[] = [];

    // Physics requirements
    if (requirements.physics.hasComplexPhysics) {
      weights.push({
        factor: 'physics',
        label: 'Complex Physics',
        weight: 2.0,
        condition: () => true,
        explanation: () => 'Prompt requires accurate physics simulation',
      });
    }

    if (requirements.physics.hasParticleSystems) {
      weights.push({
        factor: 'particleSystems',
        label: 'Particle Effects',
        weight: 1.5,
        condition: () => true,
        explanation: () => 'Rain, smoke, or particle effects detected',
      });
    }

    if (requirements.physics.hasFluidDynamics) {
      weights.push({
        factor: 'fluidDynamics',
        label: 'Fluid Dynamics',
        weight: 1.8,
        condition: () => true,
        explanation: () => 'Water or fluid simulation required',
      });
    }

    // Character requirements
    if (requirements.character.requiresFacialPerformance) {
      weights.push({
        factor: 'facialPerformance',
        label: 'Facial Performance',
        weight: 2.0,
        condition: () => true,
        explanation: () => 'Human character with emotional expression',
      });
    }

    if (requirements.character.requiresBodyLanguage) {
      weights.push({
        factor: 'bodyLanguage',
        label: 'Body Language',
        weight: 1.3,
        condition: () => true,
        explanation: () => 'Character movement and gesture required',
      });
    }

    if (requirements.character.emotionalIntensity === 'intense') {
      weights.push({
        factor: 'characterActing',
        label: 'Character Acting',
        weight: 1.8,
        condition: () => true,
        explanation: () => 'Intense emotional performance needed',
      });
    }

    // Lighting requirements
    if (requirements.lighting.requirements === 'dramatic') {
      weights.push({
        factor: 'cinematicLighting',
        label: 'Cinematic Lighting',
        weight: 1.6,
        condition: () => true,
        explanation: () => 'Dramatic or cinematic lighting specified',
      });
    }

    if (requirements.lighting.requiresAtmospherics) {
      weights.push({
        factor: 'atmospherics',
        label: 'Atmospheric Effects',
        weight: 1.4,
        condition: () => true,
        explanation: () => 'Fog, haze, or volumetric lighting needed',
      });
    }

    // Environment requirements
    if (requirements.environment.complexity === 'complex') {
      weights.push({
        factor: 'environmentDetail',
        label: 'Environment Detail',
        weight: 1.5,
        condition: () => true,
        explanation: () => 'Complex environment with many details',
      });
    }

    if (requirements.environment.hasArchitecture) {
      weights.push({
        factor: 'architecturalAccuracy',
        label: 'Architectural Detail',
        weight: 1.2,
        condition: () => true,
        explanation: () => 'Buildings or architectural elements present',
      });
    }

    // Style requirements
    if (requirements.style.requiresCinematicLook) {
      weights.push({
        factor: 'cinematicLighting',
        label: 'Cinematic Look',
        weight: 1.4,
        condition: () => true,
        explanation: () => 'Cinematic film quality requested',
      });
    }

    if (requirements.style.isStylized) {
      weights.push({
        factor: 'stylization',
        label: 'Stylization',
        weight: 1.5,
        condition: () => true,
        explanation: () => 'Non-photorealistic or stylized look',
      });
    }

    if (requirements.style.isPhotorealistic) {
      weights.push({
        factor: 'photorealism',
        label: 'Photorealism',
        weight: 1.5,
        condition: () => true,
        explanation: () => 'Photorealistic rendering required',
      });
    }

    // Motion requirements
    if (requirements.motion.cameraComplexity === 'complex') {
      weights.push({
        factor: 'cameraControl',
        label: 'Camera Control',
        weight: 1.3,
        condition: () => true,
        explanation: () => 'Complex camera movement specified',
      });
    }

    if (requirements.motion.hasMorphing) {
      weights.push({
        factor: 'morphing',
        label: 'Morphing',
        weight: 2.0,
        condition: () => true,
        explanation: () => 'Morphing or transformation effects',
      });
    }

    // Default weights if nothing specific detected
    if (weights.length === 0) {
      weights.push(
        { factor: 'photorealism', label: 'General Quality', weight: 1.0, 
          condition: () => true, explanation: () => 'Overall video quality' },
        { factor: 'motionComplexity', label: 'Motion Quality', weight: 1.0,
          condition: () => true, explanation: () => 'Smooth motion rendering' },
      );
    }

    return weights;
  }

  private calculateFactorScores(
    capabilities: ModelCapabilities,
    weights: ScoringWeight[],
    requirements: PromptRequirements
  ): FactorScore[] {
    return weights.map(w => ({
      factor: w.factor,
      label: w.label,
      weight: w.weight,
      capability: capabilities[w.factor] as number,
      contribution: (capabilities[w.factor] as number) * w.weight,
      explanation: w.explanation(requirements),
    }));
  }

  private calculateOverallScore(factorScores: FactorScore[]): number {
    if (factorScores.length === 0) return 50;
    
    const totalContribution = factorScores.reduce(
      (sum, f) => sum + f.contribution, 0
    );
    const totalWeight = factorScores.reduce(
      (sum, f) => sum + f.weight, 0
    );
    
    // Normalize to 0-100
    return Math.round((totalContribution / totalWeight) * 100);
  }

  private analyzeStrengthsWeaknesses(
    capabilities: ModelCapabilities,
    requirements: PromptRequirements,
    factorScores: FactorScore[]
  ): { strengths: string[]; weaknesses: string[]; warnings: string[] } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const warnings: string[] = [];

    // Analyze each factor
    for (const factor of factorScores) {
      if (factor.capability >= 0.85) {
        strengths.push(`${factor.label}: ${factor.explanation}`);
      } else if (factor.capability < 0.6 && factor.weight >= 1.5) {
        weaknesses.push(`${factor.label}: May struggle with this requirement`);
      }
    }

    // Add specific warnings
    if (requirements.physics.hasComplexPhysics && capabilities.physics < 0.7) {
      warnings.push('Physics simulation may be inconsistent');
    }

    if (requirements.character.requiresFacialPerformance && capabilities.facialPerformance < 0.7) {
      warnings.push('Facial expressions may lack subtlety');
    }

    if (requirements.motion.hasMorphing && capabilities.morphing < 0.6) {
      warnings.push('Morphing effects may not render smoothly');
    }

    return { strengths, weaknesses, warnings };
  }

  private createEmptyScore(modelId: VideoModelId): ModelScore {
    return {
      modelId,
      overallScore: 0,
      factorScores: [],
      strengths: [],
      weaknesses: ['Model capabilities unknown'],
      warnings: ['Unable to score this model'],
    };
  }
}
```

### 4. Main Orchestrator

```typescript
// server/src/services/model-intelligence/ModelIntelligenceService.ts

import { VideoModelId } from '@/types/video';
import { LabeledSpan } from '@/llm/span-labeling/types';
import { SpanLabelingService } from '@/llm/span-labeling/SpanLabelingService';
import { 
  ModelRecommendation, 
  ModelScore, 
  PromptRequirements 
} from './types';
import { PromptRequirementsService } from './PromptRequirementsService';
import { ModelCapabilityRegistry } from './ModelCapabilityRegistry';
import { ModelScoringService } from './ModelScoringService';
import { RecommendationExplainerService } from './RecommendationExplainerService';

export class ModelIntelligenceService {
  private requirementsService: PromptRequirementsService;
  private registry: ModelCapabilityRegistry;
  private scoringService: ModelScoringService;
  private explainerService: RecommendationExplainerService;

  constructor(
    private spanLabeler: SpanLabelingService
  ) {
    this.requirementsService = new PromptRequirementsService();
    this.registry = new ModelCapabilityRegistry();
    this.scoringService = new ModelScoringService(this.registry);
    this.explainerService = new RecommendationExplainerService();
  }

  /**
   * Get model recommendation for a prompt
   */
  async getRecommendation(
    prompt: string,
    existingSpans?: LabeledSpan[]
  ): Promise<ModelRecommendation> {
    // Get spans if not provided
    const spans = existingSpans || await this.spanLabeler.labelSpans(prompt);
    
    // Extract requirements
    const requirements = this.requirementsService.extractRequirements(prompt, spans);
    
    // Score all models
    const scores = this.scoringService.scoreAllModels(requirements);
    
    // Generate recommendation
    const recommended = this.determineRecommendation(scores, requirements);
    
    // Check if comparison would be valuable
    const comparison = this.shouldSuggestComparison(scores);

    return {
      promptId: this.generatePromptId(),
      prompt,
      requirements,
      recommendations: scores,
      recommended,
      suggestComparison: comparison.suggest,
      comparisonModels: comparison.models,
      computedAt: new Date(),
    };
  }

  /**
   * Get recommendation from pre-computed requirements
   */
  getRecommendationFromRequirements(
    prompt: string,
    requirements: PromptRequirements
  ): ModelRecommendation {
    const scores = this.scoringService.scoreAllModels(requirements);
    const recommended = this.determineRecommendation(scores, requirements);
    const comparison = this.shouldSuggestComparison(scores);

    return {
      promptId: this.generatePromptId(),
      prompt,
      requirements,
      recommendations: scores,
      recommended,
      suggestComparison: comparison.suggest,
      comparisonModels: comparison.models,
      computedAt: new Date(),
    };
  }

  /**
   * Quick recommendation without full analysis
   */
  quickRecommend(prompt: string): VideoModelId {
    // Fast heuristics for common cases
    const lowerPrompt = prompt.toLowerCase();
    
    // Physics-heavy
    if (this.hasPhysicsKeywords(lowerPrompt)) {
      return 'sora-2';
    }
    
    // Character-focused
    if (this.hasCharacterKeywords(lowerPrompt)) {
      return 'kling-v2-1';
    }
    
    // Atmospheric/cinematic
    if (this.hasAtmosphericKeywords(lowerPrompt)) {
      return 'veo-3';
    }
    
    // Morphing/transitions
    if (this.hasMorphingKeywords(lowerPrompt)) {
      return 'luma-ray3';
    }
    
    // Default to Veo for general quality
    return 'veo-3';
  }

  private determineRecommendation(
    scores: ModelScore[],
    requirements: PromptRequirements
  ): ModelRecommendation['recommended'] {
    const topScore = scores[0];
    const secondScore = scores[1];
    
    // Determine confidence
    let confidence: 'high' | 'medium' | 'low';
    const scoreDiff = topScore.overallScore - (secondScore?.overallScore || 0);
    
    if (scoreDiff >= 15 && topScore.overallScore >= 80) {
      confidence = 'high';
    } else if (scoreDiff >= 8 || topScore.overallScore >= 70) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    // Generate reasoning
    const reasoning = this.explainerService.explainRecommendation(
      topScore,
      requirements
    );

    return {
      modelId: topScore.modelId,
      confidence,
      reasoning,
    };
  }

  private shouldSuggestComparison(
    scores: ModelScore[]
  ): { suggest: boolean; models?: [VideoModelId, VideoModelId] } {
    if (scores.length < 2) {
      return { suggest: false };
    }

    const [first, second] = scores;
    const scoreDiff = first.overallScore - second.overallScore;

    // Suggest comparison if scores are close
    if (scoreDiff < 12 && second.overallScore >= 65) {
      return {
        suggest: true,
        models: [first.modelId, second.modelId],
      };
    }

    return { suggest: false };
  }

  private hasPhysicsKeywords(text: string): boolean {
    const keywords = ['water', 'rain', 'fire', 'explosion', 'smoke', 'physics', 
                      'collision', 'splash', 'wave', 'particle'];
    return keywords.some(k => text.includes(k));
  }

  private hasCharacterKeywords(text: string): boolean {
    const keywords = ['emotion', 'expression', 'face', 'crying', 'laughing', 
                      'speaking', 'acting', 'performance', 'dialogue'];
    return keywords.some(k => text.includes(k));
  }

  private hasAtmosphericKeywords(text: string): boolean {
    const keywords = ['cinematic', 'atmospheric', 'moody', 'dramatic lighting',
                      'fog', 'haze', 'golden hour', 'noir', 'film'];
    return keywords.some(k => text.includes(k));
  }

  private hasMorphingKeywords(text: string): boolean {
    const keywords = ['morph', 'transform', 'transition', 'become', 
                      'change into', 'evolve'];
    return keywords.some(k => text.includes(k));
  }

  private generatePromptId(): string {
    return `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

---

## API Endpoints

```typescript
// server/src/routes/model-intelligence.ts

import { Router } from 'express';
import { ModelIntelligenceService } from '@/services/model-intelligence';

const router = Router();

/**
 * POST /api/model-intelligence/recommend
 * 
 * Get model recommendation for a prompt
 */
router.post('/recommend', async (req, res) => {
  const { prompt, spans } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const service = req.app.get('modelIntelligenceService') as ModelIntelligenceService;
    const recommendation = await service.getRecommendation(prompt, spans);
    
    res.json({
      success: true,
      data: recommendation,
    });
  } catch (error) {
    console.error('Model recommendation error:', error);
    res.status(500).json({ error: 'Failed to generate recommendation' });
  }
});

/**
 * GET /api/model-intelligence/capabilities
 * 
 * Get all model capabilities
 */
router.get('/capabilities', (req, res) => {
  const registry = req.app.get('modelCapabilityRegistry');
  const models = registry.getAllModels();
  
  const capabilities = models.map(modelId => ({
    modelId,
    capabilities: registry.getCapabilities(modelId),
  }));
  
  res.json({
    success: true,
    data: capabilities,
  });
});

/**
 * POST /api/model-intelligence/quick
 * 
 * Quick recommendation (no span analysis)
 */
router.post('/quick', (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const service = req.app.get('modelIntelligenceService') as ModelIntelligenceService;
  const modelId = service.quickRecommend(prompt);
  
  res.json({
    success: true,
    data: { modelId },
  });
});

export default router;
```

---

## Client Implementation

### Main Hook

```typescript
// client/src/features/model-intelligence/hooks/useModelRecommendation.ts

import { useState, useEffect, useCallback } from 'react';
import { usePromptState } from '@/features/prompt-optimizer/context/PromptStateContext';
import { modelIntelligenceApi } from '../api/modelIntelligenceApi';
import type { ModelRecommendation } from '../types';

interface UseModelRecommendationOptions {
  autoFetch?: boolean;
  debounceMs?: number;
}

export function useModelRecommendation(options: UseModelRecommendationOptions = {}) {
  const { autoFetch = true, debounceMs = 500 } = options;
  
  const { prompt, spans } = usePromptState();
  const [recommendation, setRecommendation] = useState<ModelRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchRecommendation = useCallback(async () => {
    if (!prompt || prompt.trim().length < 10) {
      setRecommendation(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await modelIntelligenceApi.getRecommendation(prompt, spans);
      setRecommendation(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get recommendation'));
    } finally {
      setIsLoading(false);
    }
  }, [prompt, spans]);

  // Auto-fetch with debounce
  useEffect(() => {
    if (!autoFetch) return;

    const timeoutId = setTimeout(fetchRecommendation, debounceMs);
    return () => clearTimeout(timeoutId);
  }, [autoFetch, debounceMs, fetchRecommendation]);

  const selectModel = useCallback((modelId: string) => {
    // Update generation context with selected model
    // This would integrate with your existing GenerationControlsContext
  }, []);

  return {
    recommendation,
    isLoading,
    error,
    refetch: fetchRecommendation,
    selectModel,
  };
}
```

### Main Component

```typescript
// client/src/features/model-intelligence/components/ModelRecommendation/ModelRecommendation.tsx

import React from 'react';
import { useModelRecommendation } from '../../hooks/useModelRecommendation';
import { ModelScoreCard } from './ModelScoreCard';
import { CompareButton } from './CompareButton';
import type { VideoModelId } from '@/types/video';

interface ModelRecommendationProps {
  onSelectModel: (modelId: VideoModelId) => void;
  onCompare: (models: [VideoModelId, VideoModelId]) => void;
  className?: string;
}

export function ModelRecommendation({
  onSelectModel,
  onCompare,
  className = '',
}: ModelRecommendationProps) {
  const { recommendation, isLoading, error } = useModelRecommendation();

  if (isLoading) {
    return (
      <div className={`model-recommendation ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-zinc-700 rounded w-3/4 mb-2"></div>
          <div className="h-20 bg-zinc-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !recommendation) {
    return null; // Silently hide if no recommendation
  }

  const { recommendations, recommended, suggestComparison, comparisonModels } = recommendation;
  const topModels = recommendations.slice(0, 3);

  return (
    <div className={`model-recommendation ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-zinc-300">
          Model Recommendation
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded ${
          recommended.confidence === 'high' 
            ? 'bg-green-500/20 text-green-400'
            : recommended.confidence === 'medium'
            ? 'bg-yellow-500/20 text-yellow-400'
            : 'bg-zinc-500/20 text-zinc-400'
        }`}>
          {recommended.confidence} confidence
        </span>
      </div>

      {/* Top recommendation */}
      <ModelScoreCard
        score={recommendations[0]}
        isRecommended={true}
        onSelect={() => onSelectModel(recommendations[0].modelId)}
      />

      {/* Other options */}
      {topModels.slice(1).map((score) => (
        <ModelScoreCard
          key={score.modelId}
          score={score}
          isRecommended={false}
          onSelect={() => onSelectModel(score.modelId)}
          compact
        />
      ))}

      {/* Compare button */}
      {suggestComparison && comparisonModels && (
        <CompareButton
          models={comparisonModels}
          onClick={() => onCompare(comparisonModels)}
        />
      )}
    </div>
  );
}
```

---

## Integration Points

### 1. With Existing Span Labeling

```typescript
// The ModelIntelligenceService uses SpanLabelingService
// Integration in server/src/services/index.ts

import { SpanLabelingService } from '@/llm/span-labeling/SpanLabelingService';
import { ModelIntelligenceService } from '@/services/model-intelligence';

// Create instances with dependency injection
const spanLabeler = new SpanLabelingService(/* deps */);
const modelIntelligence = new ModelIntelligenceService(spanLabeler);

// Register with Express app
app.set('modelIntelligenceService', modelIntelligence);
```

### 2. With Generation Flow

```typescript
// In the generation controls, show recommendation before generating
// client/src/features/prompt-optimizer/components/GenerationControls.tsx

import { ModelRecommendation } from '@/features/model-intelligence';

function GenerationControls() {
  const [selectedModel, setSelectedModel] = useState<VideoModelId | null>(null);
  
  return (
    <div>
      {/* Model recommendation appears above model selector */}
      <ModelRecommendation
        onSelectModel={setSelectedModel}
        onCompare={handleCompare}
      />
      
      {/* Existing model selector, pre-filled with recommendation */}
      <ModelSelector value={selectedModel} onChange={setSelectedModel} />
      
      {/* Generate button */}
      <GenerateButton model={selectedModel} />
    </div>
  );
}
```

### 3. With Preview System (Compare Both)

```typescript
// When user clicks "Compare Both", generate two previews
// client/src/features/model-intelligence/hooks/useModelComparison.ts

export function useModelComparison() {
  const [comparison, setComparison] = useState<ModelComparison | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const startComparison = async (
    prompt: string,
    models: [VideoModelId, VideoModelId]
  ) => {
    setIsComparing(true);
    
    try {
      // Generate two Wan previews in parallel
      const [preview1, preview2] = await Promise.all([
        generatePreview(prompt, models[0]),
        generatePreview(prompt, models[1]),
      ]);
      
      setComparison({
        prompt,
        comparisons: [
          { modelId: models[0], previewUrl: preview1.url, ... },
          { modelId: models[1], previewUrl: preview2.url, ... },
        ],
        winner: null,
      });
    } finally {
      setIsComparing(false);
    }
  };

  const selectWinner = (modelId: VideoModelId) => {
    setComparison(prev => prev ? { ...prev, winner: modelId } : null);
  };

  return { comparison, isComparing, startComparison, selectWinner };
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// server/src/services/model-intelligence/__tests__/PromptRequirementsService.test.ts

import { describe, it, expect } from 'vitest';
import { PromptRequirementsService } from '../PromptRequirementsService';
import { createMockSpans } from './fixtures/testPrompts';

describe('PromptRequirementsService', () => {
  const service = new PromptRequirementsService();

  describe('physics detection', () => {
    it('detects rain as particle system', () => {
      const spans = createMockSpans([
        { text: 'rain', category: 'environment.weather' }
      ]);
      
      const requirements = service.extractRequirements('walking in the rain', spans);
      
      expect(requirements.physics.hasParticleSystems).toBe(true);
    });

    it('detects water as fluid dynamics', () => {
      const spans = createMockSpans([
        { text: 'ocean waves', category: 'environment.location' }
      ]);
      
      const requirements = service.extractRequirements('ocean waves crashing', spans);
      
      expect(requirements.physics.hasFluidDynamics).toBe(true);
      expect(requirements.physics.hasComplexPhysics).toBe(true);
    });
  });

  describe('character detection', () => {
    it('detects facial performance requirements', () => {
      const spans = createMockSpans([
        { text: 'woman', category: 'subject.identity' },
        { text: 'crying', category: 'subject.emotion' }
      ]);
      
      const requirements = service.extractRequirements(
        'a woman crying with tears', 
        spans
      );
      
      expect(requirements.character.hasHumanCharacter).toBe(true);
      expect(requirements.character.requiresFacialPerformance).toBe(true);
      expect(requirements.character.emotionalIntensity).toBe('intense');
    });
  });
});
```

### Integration Tests

```typescript
// server/src/services/model-intelligence/__tests__/ModelIntelligenceService.test.ts

describe('ModelIntelligenceService', () => {
  it('recommends Sora for physics-heavy prompts', async () => {
    const service = new ModelIntelligenceService(mockSpanLabeler);
    
    const result = await service.getRecommendation(
      'Robot walking through rain with explosions in the background'
    );
    
    expect(result.recommended.modelId).toBe('sora-2');
    expect(result.recommended.confidence).toBe('high');
  });

  it('recommends Kling for character-focused prompts', async () => {
    const service = new ModelIntelligenceService(mockSpanLabeler);
    
    const result = await service.getRecommendation(
      'Close-up of a woman crying, tears streaming down her face'
    );
    
    expect(result.recommended.modelId).toBe('kling-v2-1');
  });

  it('suggests comparison when scores are close', async () => {
    const service = new ModelIntelligenceService(mockSpanLabeler);
    
    const result = await service.getRecommendation(
      'Cinematic shot of a person in fog'
    );
    
    expect(result.suggestComparison).toBe(true);
    expect(result.comparisonModels).toContain('veo-3');
  });
});
```

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
| PromptRequirementsService | 3 days | Span labeling system |
| ModelCapabilityRegistry | 2 days | None |
| ModelScoringService | 2 days | Registry |
| RecommendationExplainerService | 1 day | Scoring |
| API endpoints | 1 day | Services |
| Client: useModelRecommendation hook | 1 day | API |
| Client: ModelRecommendation component | 2 days | Hook |
| Client: ModelComparison component | 2 days | Preview system |
| Integration with generation flow | 1 day | All above |
| Testing | 2 days | All above |
| **Total** | **~2.5 weeks** | |

---

## Open Questions

1. **Capability calibration**: How do we validate the capability scores? Manual testing? User feedback?

2. **Model updates**: When models get better, how do we update the registry? Automatic recalibration?

3. **User override tracking**: Should we track when users ignore recommendations to improve the model?

4. **Cost consideration**: Should recommendations factor in credit cost, or is that separate?

---

## Next Steps

1. [ ] Implement PromptRequirementsService with existing span labeling
2. [ ] Create ModelCapabilityRegistry with initial scores
3. [ ] Build ModelScoringService with weighted algorithm
4. [ ] Create API endpoints
5. [ ] Build React components
6. [ ] Integrate with generation flow
7. [ ] Add "Compare Both" feature
8. [ ] Write tests
9. [ ] Deploy and monitor metrics
