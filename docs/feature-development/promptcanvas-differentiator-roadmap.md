# PromptCanvas: Differentiator Feature Roadmap

> **Mission:** Transform PromptCanvas from a multi-model video generator into the **AI video production studio** that professionals can't work without.

---

## Executive Summary

### Current State
PromptCanvas offers multi-model video generation (Sora, Veo, Kling, Luma, Wan) with prompt optimization and a preview-first workflow. While technically solid, these features are "nice to have" rather than "must have."

### The Gap
No single feature creates strong user lock-in or solves a painful enough problem to drive organic growth.

### The Strategy
Build four differentiating features that compound on each other, transforming PromptCanvas into an indispensable production tool:

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | Model Intelligence | 2-3 weeks | Quick win, immediate differentiation |
| 2 | Scene-to-Scene Continuity | 3-4 weeks | Enables production use cases |
| 3 | Director Mode | 3-4 weeks | Revolutionary UX, highly demo-able |
| 4 | Storyboard Pipeline | 6-8 weeks | Full production tool (v2) |

**Launch-ready in 5-6 weeks** with features 1 + 2.

---

## Feature 1: Model Intelligence

### The Problem

Users don't know which model to use. They either:
- Pick randomly
- Use whatever they used last time
- Choose the most expensive assuming it's best

Each model has distinct strengths:
- **Sora**: Physics simulation, spatial complexity
- **Veo**: Cinematic lighting, atmosphere
- **Kling**: Facial performance, character emotion
- **Luma**: Morphing, transitions, stylization

This knowledge is tribal—locked in Reddit threads and Discord servers.

### The Solution

Automatic model recommendation based on prompt analysis.

```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 Model Recommendation                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Best Match: Sora 2                                    [92% fit] │
│ • Complex physics: rain simulation, reflections         ████   │
│ • Mechanical movement: robot locomotion                 ████   │
│ • Urban environment: architectural detail               ███    │
│                                                                 │
│ Also Consider: Veo 3                                  [78% fit] │
│ • Atmospheric: contemplative mood, cinematic lighting   █████  │
│ • Weaker on: physics simulation                         ██     │
│                                                                 │
│ Not Recommended: Kling                                [45% fit] │
│ • No human performance elements detected                       │
│                                                                 │
│ [Use Sora 2 ✓]  [Use Veo 3]  [Compare Both]                    │
└─────────────────────────────────────────────────────────────────┘
```

### Technical Architecture

```
server/src/services/model-intelligence/
├── PromptRequirementsService.ts    # Analyze prompt needs
├── ModelCapabilityRegistry.ts      # Model strengths/weaknesses matrix
├── ModelScoringService.ts          # Match requirements → capabilities
├── RecommendationExplainer.ts      # Generate human-readable reasons
└── types.ts

client/src/features/model-intelligence/
├── ModelRecommendation/
│   ├── ModelRecommendation.tsx     # Main recommendation card
│   ├── ModelScoreBar.tsx           # Visual fit indicator
│   ├── RecommendationReasons.tsx   # Why this model
│   └── CompareModelsView.tsx       # Side-by-side comparison
└── hooks/
    └── useModelRecommendation.ts
```

### Prompt Requirements Detection

Leverage existing span labeling to detect requirements:

```typescript
interface PromptRequirements {
  // Physics complexity
  hasComplexPhysics: boolean;       // water, fire, cloth, collision
  hasParticleSystems: boolean;      // rain, snow, smoke, sparks
  
  // Character requirements  
  hasHumanCharacter: boolean;
  requiresFacialPerformance: boolean;
  requiresBodyLanguage: boolean;
  
  // Environment
  environmentComplexity: 'simple' | 'moderate' | 'complex';
  lightingRequirements: 'natural' | 'stylized' | 'dramatic';
  
  // Style
  isPhotorealistic: boolean;
  isStylized: boolean;
  requiresCinematicLook: boolean;
  
  // Motion
  cameraMotionComplexity: 'static' | 'simple' | 'complex';
  subjectMotionComplexity: 'static' | 'simple' | 'complex';
}
```

**Mapping from span categories:**
- `environment.weather: rain` → `hasParticleSystems: true`
- `subject.emotion: *` → `requiresFacialPerformance: true`
- `lighting.quality: dramatic` → `lightingRequirements: 'dramatic'`
- `camera.movement: tracking` → `cameraMotionComplexity: 'complex'`

### Model Capability Matrix

```typescript
const MODEL_CAPABILITIES: Record<VideoModelId, ModelCapabilities> = {
  'sora-2': {
    physics: 0.95,
    facialPerformance: 0.70,
    cinematicLighting: 0.80,
    environmentDetail: 0.90,
    motionComplexity: 0.85,
    stylization: 0.60,
    particleSystems: 0.90,
  },
  'veo-3': {
    physics: 0.70,
    facialPerformance: 0.75,
    cinematicLighting: 0.95,
    environmentDetail: 0.85,
    motionComplexity: 0.75,
    stylization: 0.80,
    particleSystems: 0.65,
  },
  'kling-v2-1': {
    physics: 0.65,
    facialPerformance: 0.90,
    cinematicLighting: 0.70,
    environmentDetail: 0.70,
    motionComplexity: 0.80,
    stylization: 0.65,
    particleSystems: 0.55,
  },
  'luma-ray3': {
    physics: 0.60,
    facialPerformance: 0.65,
    cinematicLighting: 0.75,
    environmentDetail: 0.70,
    motionComplexity: 0.70,
    stylization: 0.85,
    morphing: 0.95,
  },
};
```

### Scoring Algorithm

```typescript
function scoreModelFit(
  requirements: PromptRequirements, 
  capabilities: ModelCapabilities
): ModelScore {
  const weights: WeightedFactors = [];
  
  // Physics requirements (heavy weight if detected)
  if (requirements.hasComplexPhysics) {
    weights.push({ factor: 'physics', weight: 2.0 });
  }
  if (requirements.hasParticleSystems) {
    weights.push({ factor: 'particleSystems', weight: 1.5 });
  }
  
  // Character performance (heavy weight for human subjects)
  if (requirements.requiresFacialPerformance) {
    weights.push({ factor: 'facialPerformance', weight: 1.8 });
  }
  if (requirements.requiresBodyLanguage) {
    weights.push({ factor: 'motionComplexity', weight: 1.3 });
  }
  
  // Cinematic requirements
  if (requirements.requiresCinematicLook) {
    weights.push({ factor: 'cinematicLighting', weight: 1.4 });
  }
  if (requirements.lightingRequirements === 'dramatic') {
    weights.push({ factor: 'cinematicLighting', weight: 1.2 });
  }
  
  // Calculate weighted score
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const { factor, weight } of weights) {
    totalScore += capabilities[factor] * weight;
    totalWeight += weight;
  }
  
  // Normalize to 0-100
  return {
    score: Math.round((totalScore / totalWeight) * 100),
    factors: weights,
    explanation: generateExplanation(requirements, capabilities, weights),
  };
}
```

### Killer Feature: "Compare Both"

Generate same prompt on 2 models at preview tier cost (5 credits each via Wan), display side-by-side:

```typescript
interface ModelComparison {
  promptId: string;
  prompt: string;
  comparisons: {
    modelId: VideoModelId;
    previewUrl: string;
    score: number;
    strengths: string[];
    weaknesses: string[];
  }[];
  recommendation: VideoModelId;
}
```

**User flow:**
1. User writes prompt
2. Sees recommendation: "Sora (92%) vs Veo (78%)"
3. Clicks "Compare Both"
4. Two Wan previews generate (~10 credits total)
5. User sees side-by-side, picks winner
6. Final generation with chosen model

### Effort Estimate

| Task | Time |
|------|------|
| PromptRequirementsService (integrate with span labeling) | 3 days |
| ModelCapabilityRegistry (manual curation + config) | 2 days |
| ModelScoringService | 2 days |
| RecommendationExplainer | 1 day |
| Client components | 3 days |
| Compare mode + preview integration | 3 days |
| Testing + polish | 2 days |
| **Total** | **~2.5 weeks** |

### Success Metrics

- % of users who follow recommendation
- Generation success rate by model (does following recommendation improve outcomes?)
- "Compare Both" usage rate
- Multi-model usage increase (users trying models they wouldn't have otherwise)

---

## Feature 2: Scene-to-Scene Continuity

### The Problem

User generates a beautiful clip. Now they want shot 2 in the same scene.

They re-run with a new prompt. They get:
- Different color palette
- Different lighting direction
- Different environment details
- Subtly different style

**The clips don't cut together.** They look like different films.

### Why It's Hard

Video models are stateless. Each generation starts fresh. "Tokyo at night" in generation 1 is completely different from "Tokyo at night" in generation 2.

### The Solution

Extract visual style from generation 1, inject it into generation 2+.

**User flow:**
1. Generate first clip
2. Click "Continue Scene"
3. Write next shot description
4. System automatically injects style from clip 1
5. Optional: use last frame as i2v input for hard continuity

### Technical Architecture

```
server/src/services/continuity/
├── StyleExtractionService.ts       # VLM-based style analysis
├── StyleInjectionService.ts        # Augment prompts with style tokens
├── FrameBridgeService.ts           # Extract frames for i2v continuity
├── ContinuitySessionService.ts     # Manage multi-shot sessions
└── types.ts

client/src/features/continuity/
├── ContinuitySession/
│   ├── ContinuitySessionProvider.tsx  # Context for active session
│   ├── SessionTimeline.tsx            # Visual shot sequence
│   ├── ContinueSceneButton.tsx        # Trigger continuation
│   └── StyleOverridePanel.tsx         # Manual style adjustment
├── hooks/
│   └── useContinuitySession.ts
└── types.ts
```

### Style Extraction

After generation completes, analyze the output with a VLM:

```typescript
interface ExtractedStyle {
  // Color
  colorPalette: {
    primary: string;    // Hex
    secondary: string;
    accent: string;
    shadows: string;
    highlights: string;
  };
  colorTemperature: 'warm' | 'neutral' | 'cool';
  saturation: 'muted' | 'natural' | 'vibrant';
  
  // Lighting
  lightingStyle: string;           // "low-key with strong rim lighting"
  lightingDirection: string;       // "from left, slightly behind"
  lightingQuality: string;         // "hard shadows, neon bounce fill"
  
  // Atmosphere
  atmosphere: string[];            // ["wet streets", "light rain", "reflections"]
  timeOfDay: string;               // "night"
  weather: string;                 // "rainy"
  
  // Technical style
  filmStock: string;               // "cinematic, high contrast"
  lensCharacteristics: string;     // "anamorphic, lens flares"
  grainLevel: 'none' | 'light' | 'heavy';
  
  // For prompt injection
  stylePromptFragment: string;     // Pre-composed injection string
}
```

**VLM Prompt for Extraction:**

```markdown
Analyze this video frame and extract the visual style characteristics.

Return a JSON object with:
1. Color palette (primary, secondary, accent colors as hex)
2. Lighting description (direction, quality, style)
3. Atmospheric elements (weather, time of day, environmental details)
4. Technical style (film stock feeling, lens characteristics)

Focus on elements that would need to be consistent across multiple shots 
in the same scene.

Be specific and use cinematography terminology.
```

### Style Injection

For subsequent shots, prepend extracted style to user prompt:

```typescript
function injectStyle(
  userPrompt: string, 
  style: ExtractedStyle,
  options: InjectionOptions = {}
): string {
  const stylePrefix = buildStylePrefix(style, options);
  
  // Don't duplicate if user already specified these elements
  const cleanedPrompt = removeConflictingElements(userPrompt, style);
  
  return `${stylePrefix} ${cleanedPrompt}`;
}

function buildStylePrefix(style: ExtractedStyle, options: InjectionOptions): string {
  const parts: string[] = [];
  
  // Color
  if (!options.skipColor) {
    parts.push(`Color palette: ${style.colorPalette.primary}, ${style.colorPalette.secondary}, ${style.colorPalette.accent}.`);
  }
  
  // Lighting
  if (!options.skipLighting) {
    parts.push(`${style.lightingStyle}, light ${style.lightingDirection}.`);
  }
  
  // Atmosphere
  if (!options.skipAtmosphere && style.atmosphere.length > 0) {
    parts.push(style.atmosphere.join(', ') + '.');
  }
  
  // Technical
  if (!options.skipTechnical) {
    parts.push(`${style.filmStock}, ${style.lensCharacteristics}.`);
  }
  
  return parts.join(' ');
}
```

**Example:**

```
User's first prompt:
"A woman in a red dress walks through Tokyo at night"

Generated → Style extracted:
- Colors: neon pink #FF1493, cyan #00FFFF, deep blue #0A0A2E
- Lighting: low-key, strong rim lighting from left
- Atmosphere: wet streets, neon reflections, light rain
- Style: cinematic, high contrast, anamorphic

User's second prompt (raw):
"She stops and looks up at a giant billboard"

Injected prompt:
"Color palette: neon pink, cyan, deep blue. Low-key lighting with 
strong rim light from left. Wet streets, neon reflections, light rain. 
Cinematic, high contrast, anamorphic. She stops and looks up at a 
giant billboard"
```

### Frame Bridge (i2v Continuity)

For hard continuity, use the last frame of clip N as the start image for clip N+1:

```typescript
interface FrameBridge {
  sourceVideoId: string;
  framePosition: 'first' | 'last' | number;  // Frame index or position
  frameUrl: string;
  extractedAt: Date;
}

async function extractBridgeFrame(
  videoId: string, 
  position: 'last' | number = 'last'
): Promise<FrameBridge> {
  const video = await assetStore.getVideo(videoId);
  const frame = await extractFrame(video, position);
  const frameUrl = await assetStore.storeImage(frame);
  
  return {
    sourceVideoId: videoId,
    framePosition: position,
    frameUrl,
    extractedAt: new Date(),
  };
}
```

When generating next shot:
```typescript
const options: VideoGenerationOptions = {
  model: selectedModel,
  // Use last frame as i2v input
  startImage: bridgeFrame.frameUrl,
  // ... other options
};
```

### Continuity Session Management

```typescript
interface ContinuitySession {
  id: string;
  userId: string;
  createdAt: Date;
  
  // Style baseline (from first generation or user-defined)
  baseStyle: ExtractedStyle;
  styleSource: 'extracted' | 'user-defined' | 'template';
  
  // Shots in sequence
  shots: ContinuityShot[];
  
  // Settings
  settings: {
    autoExtractStyle: boolean;
    useFrameBridge: boolean;
    styleInjectionStrength: 'light' | 'medium' | 'strong';
  };
}

interface ContinuityShot {
  id: string;
  sequenceIndex: number;
  
  // Generation
  prompt: string;
  injectedPrompt: string;
  modelId: VideoModelId;
  videoAssetId: string;
  
  // Continuity
  bridgeFrame?: FrameBridge;
  extractedStyle?: ExtractedStyle;
  
  // Metadata
  generatedAt: Date;
  status: 'pending' | 'generating' | 'completed' | 'failed';
}
```

### Client UI

**Session Timeline View:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Scene: Tokyo Night Chase                          [+ Add Shot]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐     │
│  │ Shot 1  │ → │ Shot 2  │ → │ Shot 3  │ → │   New   │      │
│  │ [thumb] │    │ [thumb] │    │ [thumb] │    │    +    │      │
│  │ Wide    │    │ Medium  │    │ Close   │    │         │      │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘      │
│       ↓              ↓              ↓                          │
│  [Style Base]   [Inherited]    [Inherited]                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Style: Neon pink/cyan • Low-key rim lighting • Wet streets     │
│ [Edit Style] [Reset to Shot 1]                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Effort Estimate

| Task | Time |
|------|------|
| StyleExtractionService (VLM integration) | 3 days |
| StyleInjectionService | 2 days |
| FrameBridgeService (frame extraction) | 2 days |
| ContinuitySessionService | 3 days |
| Client: Session timeline UI | 4 days |
| Client: Style override panel | 2 days |
| Integration with generation flow | 2 days |
| Testing + edge cases | 3 days |
| **Total** | **~3.5 weeks** |

### Success Metrics

- Continuity session creation rate
- Shots per session (are people making sequences?)
- Style consistency scores (VLM evaluation of cross-shot consistency)
- User feedback on match quality

---

## Feature 3: Director Mode

### The Problem

User generates a video. It's close, but:
- Camera is too static
- Lighting is too flat  
- Character doesn't look confident enough

To fix it, they need to:
1. Know what prompt changes would help
2. Understand cinematography vocabulary
3. Manually edit the prompt
4. Regenerate and hope

Most users don't have this knowledge. They just regenerate and hope for luck.

### The Solution

Natural language refinement. User just says what they want:

> "Pull the camera back a bit and add some dramatic rim lighting"

PromptCanvas:
1. Parses the intent
2. Maps it to specific prompt modifications  
3. Shows what will change
4. Regenerates with modifications

**This is talking to an AI director who translates creative intent into technical prompts.**

### Technical Architecture

```
server/src/services/director/
├── IntentParserService.ts          # NL → structured intent
├── PromptModifierService.ts        # Intent → span modifications
├── ModificationPreviewService.ts   # Generate diff preview
├── DirectorConversationService.ts  # Multi-turn refinement
└── templates/
    └── director-intent.md          # LLM prompt for parsing

client/src/features/director/
├── DirectorChat/
│   ├── DirectorChat.tsx            # Chat interface
│   ├── DirectorMessage.tsx         # Message bubbles
│   └── DirectorInput.tsx           # Input with suggestions
├── ModificationPreview/
│   ├── ModificationPreview.tsx     # Diff view
│   ├── PromptDiff.tsx              # Before/after comparison
│   └── ChangesList.tsx             # Itemized changes
├── hooks/
│   ├── useDirectorMode.ts
│   └── useModificationPreview.ts
└── types.ts
```

### Intent Parsing

```typescript
interface DirectorIntent {
  id: string;
  rawInput: string;
  
  modifications: PromptModification[];
  confidence: number;
  
  // For multi-turn
  requiresClarification: boolean;
  clarificationQuestion?: string;
}

interface PromptModification {
  type: 'add' | 'remove' | 'replace' | 'adjust';
  category: TaxonomyCategory;  // From your existing taxonomy
  
  // What to change
  target?: string;            // Existing span text (for replace/remove)
  value: string;              // New value (for add/replace)
  
  // Magnitude for adjustments
  direction?: 'increase' | 'decrease';
  magnitude?: 'slight' | 'moderate' | 'significant';
  
  // Explanation
  reason: string;
}
```

**Example Parsing:**

```
Input: "Pull the camera back a bit and add some dramatic rim lighting"

Parsed:
{
  modifications: [
    {
      type: 'replace',
      category: 'shot.type',
      target: 'Medium shot',      // Found in current prompt
      value: 'Wide shot',
      reason: 'Pull camera back → wider framing'
    },
    {
      type: 'add',
      category: 'lighting.direction',
      value: 'dramatic rim lighting from behind',
      reason: 'Add rim lighting for dramatic effect'
    }
  ],
  confidence: 0.92
}
```

### Intent Parser Prompt

```markdown
You are a cinematography director assistant. Parse the user's natural language 
direction into specific prompt modifications.

Current prompt:
"""
{currentPrompt}
"""

Current prompt spans (with categories):
{spans as JSON}

User's direction:
"""
{userDirection}
"""

Map the user's intent to specific modifications. Use these category mappings:

CAMERA/FRAMING:
- "pull back", "wider", "see more" → shot.type: wider framing
- "get closer", "tighter", "zoom in" → shot.type: tighter framing
- "from above", "bird's eye" → shot.type: high angle
- "from below", "low angle" → shot.type: low angle

CAMERA MOVEMENT:
- "follow", "track" → camera.movement: tracking shot
- "orbit", "circle around" → camera.movement: orbital
- "push in", "dolly" → camera.movement: dolly in
- "pull out" → camera.movement: dolly out
- "pan" → camera.movement: pan
- "static", "still", "locked off" → camera.movement: static

LIGHTING:
- "more dramatic", "moodier" → lighting.quality: dramatic, add contrast
- "rim light", "backlight" → lighting.direction: rim/back lighting
- "softer", "gentler" → lighting.quality: soft, diffused
- "warmer" → lighting.color: warm tones
- "cooler", "colder" → lighting.color: cool tones
- "brighter" → lighting.intensity: increase
- "darker", "dimmer" → lighting.intensity: decrease

SUBJECT/CHARACTER:
- "more confident" → subject.emotion: confident, add posture cues
- "sadder", "more emotional" → subject.emotion: sad/emotional
- "more intense" → subject.emotion: intense, focused
- "relaxed" → subject.emotion: relaxed, casual

STYLE:
- "more cinematic" → style.look: cinematic, add film characteristics
- "grittier" → style.look: gritty, raw
- "dreamier" → style.look: dreamy, soft focus
- "more realistic" → style.look: photorealistic

Return JSON:
{
  "modifications": [...],
  "confidence": 0.0-1.0,
  "requiresClarification": boolean,
  "clarificationQuestion": "string if needed"
}
```

### Prompt Modification Engine

Integrates with existing span system:

```typescript
class PromptModifierService {
  constructor(
    private spanLabeler: SpanLabelingService,
    private taxonomy: TaxonomyService
  ) {}

  async applyModifications(
    prompt: string,
    spans: LabeledSpan[],
    modifications: PromptModification[]
  ): Promise<ModifiedPrompt> {
    let modifiedPrompt = prompt;
    const changes: AppliedChange[] = [];

    for (const mod of modifications) {
      switch (mod.type) {
        case 'replace':
          const targetSpan = this.findSpan(spans, mod.target, mod.category);
          if (targetSpan) {
            modifiedPrompt = this.replaceSpan(modifiedPrompt, targetSpan, mod.value);
            changes.push({
              type: 'replace',
              before: targetSpan.text,
              after: mod.value,
              category: mod.category,
            });
          }
          break;

        case 'add':
          const insertPosition = this.findInsertPosition(modifiedPrompt, spans, mod.category);
          modifiedPrompt = this.insertAt(modifiedPrompt, insertPosition, mod.value);
          changes.push({
            type: 'add',
            after: mod.value,
            category: mod.category,
          });
          break;

        case 'remove':
          const removeSpan = this.findSpan(spans, mod.target, mod.category);
          if (removeSpan) {
            modifiedPrompt = this.removeSpan(modifiedPrompt, removeSpan);
            changes.push({
              type: 'remove',
              before: removeSpan.text,
              category: mod.category,
            });
          }
          break;

        case 'adjust':
          // For magnitude-based adjustments (e.g., "a bit wider")
          modifiedPrompt = await this.adjustWithMagnitude(
            modifiedPrompt, 
            spans, 
            mod
          );
          break;
      }
    }

    return {
      original: prompt,
      modified: modifiedPrompt,
      changes,
    };
  }
}
```

### Modification Preview UI

Before regenerating, show the user exactly what will change:

```
┌─────────────────────────────────────────────────────────────────┐
│ 🎬 Director Mode                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ You said: "Pull the camera back and add dramatic rim lighting"  │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ Changes:                                                        │
│                                                                 │
│   📷 Camera                                                     │
│      Medium shot → Wide shot                                    │
│                                                                 │
│   💡 Lighting                                                   │
│      + "dramatic rim lighting from behind"                      │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ Before:                                                         │
│ "Medium shot of a woman walking through neon streets at night"  │
│                                                                 │
│ After:                                                          │
│ "Wide shot of a woman walking through neon streets at night,    │
│  dramatic rim lighting from behind"                             │
│                                                                 │
│           [Regenerate ✓]  [Edit More]  [Cancel]                 │
└─────────────────────────────────────────────────────────────────┘
```

### Multi-Turn Conversation

User can continue refining:

```
User: "Pull the camera back and add rim lighting"
→ [Changes applied, preview shown]

User: "Actually make the lighting warmer too"
→ [Additional change added to preview]

User: "Good, but the background should be blurrier"
→ [Depth of field adjustment added]

User: [Clicks Regenerate]
→ All changes applied, new generation starts
```

```typescript
interface DirectorConversation {
  id: string visibleChanges;
  
  turns: DirectorTurn[];
  
  // Accumulated modifications (not yet applied)
  pendingModifications: PromptModification[];
  
  // Preview state
  previewPrompt: string;
  previewChanges: AppliedChange[];
}

interface DirectorTurn {
  id: string;
  input: string;
  parsedIntent: DirectorIntent;
  timestamp: Date;
}
```

### Quick Suggestions

Offer common refinements based on the current prompt:

```typescript
function generateQuickSuggestions(
  prompt: string, 
  spans: LabeledSpan[]
): QuickSuggestion[] {
  const suggestions: QuickSuggestion[] = [];
  
  // Camera suggestions
  const shotSpan = spans.find(s => s.category === 'shot.type');
  if (shotSpan) {
    if (shotSpan.text.includes('wide')) {
      suggestions.push({ label: 'Tighter framing', intent: 'Get closer to the subject' });
    } else if (shotSpan.text.includes('close')) {
      suggestions.push({ label: 'Wider shot', intent: 'Pull the camera back' });
    }
  }
  
  // Lighting suggestions
  const hasLighting = spans.some(s => s.category.startsWith('lighting.'));
  if (!hasLighting) {
    suggestions.push({ label: 'Add dramatic lighting', intent: 'Add dramatic rim lighting' });
    suggestions.push({ label: 'Golden hour', intent: 'Set the lighting to golden hour' });
  }
  
  // Motion suggestions
  const cameraMotion = spans.find(s => s.category === 'camera.movement');
  if (!cameraMotion) {
    suggestions.push({ label: 'Add camera movement', intent: 'Add a slow tracking shot' });
  }
  
  return suggestions.slice(0, 4);  // Max 4 suggestions
}
```

### Effort Estimate

| Task | Time |
|------|------|
| IntentParserService (LLM integration) | 3 days |
| PromptModifierService (span manipulation) | 3 days |
| ModificationPreviewService | 2 days |
| DirectorConversationService | 2 days |
| Client: DirectorChat UI | 3 days |
| Client: ModificationPreview | 2 days |
| Quick suggestions system | 1 day |
| Integration with generation flow | 2 days |
| Testing + prompt tuning | 3 days |
| **Total** | **~3.5 weeks** |

### Success Metrics

- Director mode activation rate
- Average turns per conversation
- Regeneration rate after using director mode (should decrease—fewer blind retries)
- User satisfaction with modifications (did the change achieve the intent?)

---

## Feature 4: Storyboard-to-Video Pipeline

### The Problem

A filmmaker has:
- A script with 12 scenes
- Rough storyboard sketches
- Shot list with framing notes

To use AI video generation, they must:
1. Manually translate each shot into a prompt
2. Guess which model works best
3. Maintain consistency manually
4. No connection between planning docs and generation

This is hours of tedious work that breaks their creative flow.

### The Solution

Upload planning documents → Get optimized prompts for each shot → Generate entire sequence.

**This transforms PromptCanvas from a "video generator" into a "pre-production tool."**

### User Flow

```
1. User uploads storyboard PDF or shot list
   ↓
2. System parses into structured shots
   ↓
3. User reviews/edits parsed shots
   ↓
4. System generates optimized prompt for each
   ↓
5. System recommends model per shot
   ↓
6. User reviews prompts, adjusts if needed
   ↓
7. One-click batch generation (or shot-by-shot)
   ↓
8. Review timeline, regenerate individual shots
```

### Technical Architecture

```
server/src/services/storyboard/
├── DocumentParserService.ts        # PDF/text → structured data
├── ShotExtractorService.ts         # Identify individual shots
├── ShotContextService.ts           # Cross-shot context management
├── BatchPromptService.ts           # Generate prompts for all shots
├── BatchGenerationService.ts       # Orchestrate multi-shot generation
└── types.ts

client/src/features/storyboard/
├── StoryboardUploader/
│   ├── StoryboardUploader.tsx      # File upload + parsing UI
│   ├── ParsingProgress.tsx         # Show extraction progress
│   └── ParsedPreview.tsx           # Preview extracted structure
├── ShotListEditor/
│   ├── ShotListEditor.tsx          # Edit parsed shots
│   ├── ShotCard.tsx                # Individual shot editor
│   └── ShotReorderPanel.tsx        # Drag to reorder
├── StoryboardCanvas/
│   ├── StoryboardCanvas.tsx        # Visual storyboard layout
│   ├── ShotThumbnail.tsx           # Shot with generation preview
│   └── ConnectionLines.tsx         # Visual flow between shots
├── BatchGeneration/
│   ├── BatchGenerationPanel.tsx    # Generation controls
│   ├── GenerationProgress.tsx      # Per-shot progress
│   └── BatchReview.tsx             # Review all generated clips
└── hooks/
    ├── useStoryboardParser.ts
    ├── useBatchGeneration.ts
    └── useStoryboardSession.ts
```

### Document Parsing

```typescript
interface ParsedStoryboard {
  id: string;
  sourceFile: string;
  sourceType: 'pdf' | 'text' | 'docx' | 'fountain';
  
  // Extracted metadata
  title?: string;
  author?: string;
  
  // Scenes and shots
  scenes: ParsedScene[];
  
  // Global style notes
  styleNotes?: string;
  
  // Parsing metadata
  parseConfidence: number;
  parseWarnings: string[];
}

interface ParsedScene {
  id: string;
  sceneNumber: number;
  
  // Scene heading
  location: string;
  timeOfDay: 'day' | 'night' | 'dawn' | 'dusk' | string;
  interior: boolean;
  
  // Shots within scene
  shots: ParsedShot[];
  
  // Scene-level notes
  description?: string;
}

interface ParsedShot {
  id: string;
  shotNumber: string;          // "3A", "3B", etc.
  
  // Shot details
  shotType: ShotType;          // wide, medium, close, etc.
  description: string;
  
  // Elements detected
  characters: string[];
  actions: string[];
  props: string[];
  
  // Technical notes
  cameraMovement?: string;
  specialNotes?: string[];
  
  // For storyboard images
  storyboardImageUrl?: string;
  
  // Generated content
  generatedPrompt?: string;
  recommendedModel?: VideoModelId;
  generatedVideoId?: string;
}

type ShotType = 
  | 'extreme-wide' 
  | 'wide' 
  | 'full' 
  | 'medium-wide'
  | 'medium' 
  | 'medium-close'
  | 'close-up' 
  | 'extreme-close'
  | 'pov'
  | 'insert'
  | 'over-shoulder'
  | 'two-shot';
```

### LLM-Based Document Parsing

```typescript
class DocumentParserService {
  async parseDocument(
    file: Buffer, 
    fileType: string
  ): Promise<ParsedStoryboard> {
    // Step 1: Extract text from document
    const rawText = await this.extractText(file, fileType);
    
    // Step 2: Identify document structure
    const structure = await this.identifyStructure(rawText);
    
    // Step 3: Parse into scenes and shots
    const scenes = await this.parseScenesAndShots(rawText, structure);
    
    // Step 4: Extract character and element references
    const enrichedScenes = await this.enrichWithContext(scenes);
    
    return {
      id: generateId(),
      sourceFile: file.name,
      sourceType: fileType,
      scenes: enrichedScenes,
      parseConfidence: this.calculateConfidence(enrichedScenes),
      parseWarnings: this.collectWarnings(enrichedScenes),
    };
  }

  private async parseScenesAndShots(
    text: string, 
    structure: DocumentStructure
  ): Promise<ParsedScene[]> {
    const prompt = `
      Parse this screenplay/storyboard into structured scenes and shots.
      
      Document:
      """
      ${text}
      """
      
      For each shot, extract:
      - Shot number/identifier
      - Shot type (wide, medium, close-up, POV, etc.)
      - Description of what's in the shot
      - Characters present
      - Actions occurring
      - Any camera movement notes
      - Special technical requirements
      
      Return as JSON array of scenes, each containing shots.
    `;
    
    return await this.llm.parseStructured(prompt, storyboardSchema);
  }
}
```

### Batch Prompt Generation

```typescript
class BatchPromptService {
  constructor(
    private promptOptimizer: PromptOptimizationService,
    private modelIntelligence: ModelIntelligenceService,
    private continuityService: ContinuityService
  ) {}

  async generatePromptsForStoryboard(
    storyboard: ParsedStoryboard,
    options: BatchPromptOptions = {}
  ): Promise<BatchPromptResult> {
    const results: ShotPromptResult[] = [];
    
    // Extract global style if first shot already generated
    let baseStyle: ExtractedStyle | null = null;
    
    for (const scene of storyboard.scenes) {
      // Scene-level context
      const sceneContext = this.buildSceneContext(scene);
      
      for (const shot of scene.shots) {
        // Build prompt with scene context
        const rawPrompt = this.buildRawPrompt(shot, sceneContext);
        
        // Optimize prompt
        const optimizedPrompt = await this.promptOptimizer.optimize({
          prompt: rawPrompt,
          mode: 'video',
          context: {
            scene: sceneContext,
            previousShots: results.slice(-3),  // Last 3 shots for context
            baseStyle,
          },
        });
        
        // Get model recommendation
        const modelRec = await this.modelIntelligence.recommend(optimizedPrompt);
        
        // Inject style for continuity (if not first shot)
        const finalPrompt = baseStyle
          ? this.continuityService.injectStyle(optimizedPrompt, baseStyle)
          : optimizedPrompt;
        
        results.push({
          shotId: shot.id,
          originalDescription: shot.description,
          generatedPrompt: finalPrompt,
          recommendedModel: modelRec.model,
          modelReasons: modelRec.reasons,
        });
        
        // Use first shot's style as baseline (once generated)
        if (results.length === 1 && options.enforceConsistency) {
          // Style will be extracted after first generation
        }
      }
    }
    
    return {
      storyboardId: storyboard.id,
      shots: results,
      estimatedCredits: this.calculateCredits(results),
    };
  }
}
```

### Batch Generation with Progress

```typescript
interface BatchGenerationJob {
  id: string;
  storyboardId: string;
  
  shots: BatchShotJob[];
  
  // Overall progress
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  progress: {
    total: number;
    completed: number;
    failed: number;
    inProgress: number;
  };
  
  // Settings
  settings: {
    parallelGenerations: number;  // 1-3 concurrent
    stopOnFailure: boolean;
    autoRetry: boolean;
    maxRetries: number;
  };
}

interface BatchShotJob {
  shotId: string;
  prompt: string;
  model: VideoModelId;
  
  status: 'pending' | 'queued' | 'generating' | 'completed' | 'failed';
  progress?: number;          // 0-100 if model supports
  videoAssetId?: string;
  error?: string;
  retryCount: number;
}

class BatchGenerationService {
  async startBatchGeneration(
    job: BatchGenerationJob
  ): Promise<void> {
    const queue = [...job.shots];
    const inProgress: Map<string, Promise<void>> = new Map();
    
    while (queue.length > 0 || inProgress.size > 0) {
      // Start new generations up to parallel limit
      while (
        queue.length > 0 && 
        inProgress.size < job.settings.parallelGenerations
      ) {
        const shot = queue.shift()!;
        const promise = this.generateShot(shot, job);
        inProgress.set(shot.shotId, promise);
      }
      
      // Wait for any to complete
      if (inProgress.size > 0) {
        const completed = await Promise.race(
          Array.from(inProgress.entries()).map(async ([id, p]) => {
            await p;
            return id;
          })
        );
        inProgress.delete(completed);
      }
      
      // Emit progress update
      this.emitProgress(job);
    }
  }
}
```

### Storyboard Canvas UI

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🎬 Project: "Night Chase" - 8 shots                    [Generate All ▶] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  SCENE 1: EXT. TOKYO STREET - NIGHT                                    │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                │
│  │   1A: Wide   │ → │  1B: Medium  │ → │ 1C: Close-up │                │
│  │  [Storyboard]│   │  [Storyboard]│   │  [Storyboard]│                │
│  │              │   │              │   │              │                │
│  │  [Sora ✓]    │   │  [Sora ✓]    │   │  [Kling ✓]   │                │
│  │  80 credits  │   │  80 credits  │   │  35 credits  │                │
│  └──────────────┘   └──────────────┘   └──────────────┘                │
│       ✓ Ready          ✓ Ready          ✓ Ready                        │
│                                                                         │
│  SCENE 2: INT. RAMEN BAR - NIGHT                                       │
│  ┌──────────────┐   ┌──────────────┐                                   │
│  │   2A: Wide   │ → │  2B: OTS     │   ┌──────────────┐                │
│  │  [Storyboard]│   │  [Storyboard]│   │   + Add      │                │
│  │              │   │              │   │     Shot     │                │
│  │  [Veo ✓]     │   │  [Kling ✓]   │   └──────────────┘                │
│  │  30 credits  │   │  35 credits  │                                   │
│  └──────────────┘   └──────────────┘                                   │
│       ✓ Ready          ⚠ Edit needed                                   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ Style: Consistent across all shots • Est. Total: 260 credits           │
│ [Edit Style] [Preview All Prompts] [Export Shot List]                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Effort Estimate

| Task | Time |
|------|------|
| DocumentParserService (PDF/text extraction) | 4 days |
| ShotExtractorService (LLM parsing) | 3 days |
| ShotContextService | 2 days |
| BatchPromptService | 3 days |
| BatchGenerationService | 4 days |
| Client: StoryboardUploader | 3 days |
| Client: ShotListEditor | 4 days |
| Client: StoryboardCanvas | 5 days |
| Client: BatchGeneration panel | 3 days |
| Integration + consistency features | 4 days |
| Testing + edge cases | 4 days |
| **Total** | **~6-7 weeks** |

### Success Metrics

- Storyboard upload rate
- Shots per storyboard (are people uploading real projects?)
- Prompt acceptance rate (do users keep generated prompts?)
- Batch generation completion rate
- Time savings vs manual workflow

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-3)
**Goal: Launch-ready differentiators**

```
Week 1:
├── Model Intelligence: PromptRequirementsService
├── Model Intelligence: ModelCapabilityRegistry  
└── Model Intelligence: ModelScoringService

Week 2:
├── Model Intelligence: Client components
├── Model Intelligence: "Compare Both" feature
└── Scene Continuity: StyleExtractionService

Week 3:
├── Scene Continuity: StyleInjectionService
├── Scene Continuity: FrameBridgeService
└── Scene Continuity: Client timeline UI
```

**Milestone: Beta launch with Model Intelligence + Scene Continuity**

### Phase 2: Director Mode (Weeks 4-6)
**Goal: Revolutionary UX differentiator**

```
Week 4:
├── Director: IntentParserService
├── Director: PromptModifierService
└── Director: Intent parsing prompt tuning

Week 5:
├── Director: Client chat UI
├── Director: Modification preview
└── Director: Quick suggestions

Week 6:
├── Director: Multi-turn conversation
├── Integration testing
└── UX polish
```

**Milestone: Director Mode launch**

### Phase 3: Storyboard Pipeline (Weeks 7-12)
**Goal: Full production tool**

```
Weeks 7-8:
├── Storyboard: Document parsing
├── Storyboard: Shot extraction
└── Storyboard: Batch prompt generation

Weeks 9-10:
├── Storyboard: Client upload/editor UI
├── Storyboard: Canvas visualization
└── Storyboard: Batch generation backend

Weeks 11-12:
├── Storyboard: Progress/review UI
├── Integration with continuity
└── Testing + edge cases
```

**Milestone: Storyboard Pipeline launch (v2.0)**

---

## Success Metrics Summary

| Feature | Primary Metric | Target |
|---------|---------------|--------|
| Model Intelligence | Recommendation follow rate | >60% |
| Scene Continuity | Multi-shot sessions | >30% of users |
| Director Mode | Refinement turns per session | >2 average |
| Storyboard Pipeline | Projects with 5+ shots | >20% of pro users |

### North Star Metric

**Multi-shot project completion rate**

If users are creating and completing multi-shot projects, all four features are working together.

---

## Risk Mitigation

### Technical Risks

| Risk | Mitigation |
|------|-----------|
| Style extraction inconsistency | Multiple VLM calls, user override option |
| Intent parsing errors | Show preview before applying, easy undo |
| Document parsing failures | Manual fallback, shot-by-shot editor |
| Batch generation failures | Robust retry, per-shot regeneration |

### Market Risks

| Risk | Mitigation |
|------|-----------|
| Platforms copy features | Move fast, compound features together |
| Users don't need multi-shot | Validate with beta users before Storyboard |
| Price sensitivity | Tiered features, prove value before upselling |

---

## Conclusion

These four features transform PromptCanvas from a multi-model video generator into **the AI video production studio**:

1. **Model Intelligence** — Know which model to use (quick win)
2. **Scene Continuity** — Shots that cut together (core pain point)
3. **Director Mode** — Refine without expertise (revolutionary UX)
4. **Storyboard Pipeline** — Plan to video in one place (full production tool)

Each feature compounds the others. Model Intelligence makes Scene Continuity smarter. Director Mode leverages the taxonomy. Storyboard Pipeline uses everything.

**Start with Model Intelligence (2-3 weeks) + Scene Continuity (3-4 weeks) for a differentiated launch in ~6 weeks.**

Then layer Director Mode and Storyboard Pipeline for a truly defensible product.
