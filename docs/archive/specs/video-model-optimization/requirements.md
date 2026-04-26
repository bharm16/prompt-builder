# Requirements Document

## Introduction

This document specifies the requirements for implementing a Prompt Optimization Engine (POE) that transforms user prompts into model-specific optimized outputs for AI video generation models. The system will support Runway Gen-4.5, Luma Ray-3, Kling AI 2.6, OpenAI Sora 2, and Google Veo 4, using a polymorphic middleware architecture with three distinct phases: Normalization, Transformation, and Augmentation.

## Glossary

- **POE (Prompt_Optimization_Engine)**: The core system that processes user prompts through a 3-phase pipeline to produce model-optimized outputs
- **Strategy**: A model-specific implementation of the optimization pipeline
- **Normalization_Phase**: The first phase that strips incompatible tokens and cleans input
- **Transformation_Phase**: The second phase that restructures prompts based on model architecture
- **Augmentation_Phase**: The third phase that injects model-specific triggers and physics compliance
- **A2D (Autoregressive_to_Diffusion)**: Runway's architecture type requiring structural-literal prompts
- **MDT (Multimodal_Diffusion_Transformer)**: Kling's architecture with audio-visual capabilities
- **CSAE_Protocol**: Camera-Subject-Action-Environment ordering for Runway prompts
- **TechStripper**: Utility that removes placebo tokens that degrade model performance
- **SafetySanitizer**: Pre-flight safety check utility to prevent API rejections
- **MAM (Multimodal_Asset_Manager)**: Service handling image and element references

## Requirements

### Requirement 1: Strategy Interface Definition

**User Story:** As a developer, I want a consistent interface for all model optimization strategies, so that I can add new models without changing the core pipeline.

#### Acceptance Criteria

1. THE POE SHALL define a `PromptOptimizationResult` interface containing `prompt` (string | object), `negativePrompt` (string | undefined), and `metadata` (object)
2. THE POE SHALL define a `PromptOptimizationStrategy` interface with `normalize`, `transform`, and `augment` methods
3. WHEN a strategy's `normalize` method is called with input text, THE Strategy SHALL return cleaned text with incompatible tokens removed
4. WHEN a strategy's `transform` method is called, THE Strategy SHALL return a `PromptOptimizationResult` based on model requirements
5. WHEN a strategy's `augment` method is called, THE Strategy SHALL return the `PromptOptimizationResult` with model-specific triggers injected
6. THE POE SHALL define a `PromptContext` interface containing userIntent, detectedSection, constraints, and history fields

### Requirement 2: Model Detection Enhancement

**User Story:** As a system, I want to detect the target video model from user prompts, so that I can apply the correct optimization strategy.

#### Acceptance Criteria

1. WHEN a prompt contains "gen-4.5", "gen4.5", or "runway gen 4.5" patterns, THE ModelDetectionService SHALL detect "runway-gen45" as the target model
2. WHEN a prompt contains "ray-3", "ray3", or "luma ray" patterns, THE ModelDetectionService SHALL detect "luma-ray3" as the target model
3. WHEN a prompt contains "kling 2.6", "kling2.6", or "kling ai 2.6" patterns, THE ModelDetectionService SHALL detect "kling-26" as the target model
4. WHEN a prompt contains "sora 2", "sora2", or "openai sora 2" patterns, THE ModelDetectionService SHALL detect "sora-2" as the target model
5. WHEN a prompt contains "veo 4", "veo4", or "google veo 4" patterns, THE ModelDetectionService SHALL detect "veo-4" as the target model
6. WHEN no model is explicitly detected, THE ModelDetectionService SHALL return null

### Requirement 3: Runway Gen-4.5 Strategy

**User Story:** As a user targeting Runway Gen-4.5, I want my prompts optimized for the A2D architecture, so that I get consistent, high-quality video output.

#### Acceptance Criteria

1. WHEN normalizing a Runway prompt, THE RunwayStrategy SHALL strip emotional/abstract terms like "vibe" and "sad" unless translatable to lighting terms
2. WHEN normalizing a Runway prompt, THE RunwayStrategy SHALL strip "morphing" and "blur" terms unless explicitly requested as style
3. WHEN transforming a Runway prompt, THE RunwayStrategy SHALL reorder content to follow CSAE protocol: Camera → Subject → Action → Environment
4. WHEN transforming a Runway prompt containing camera terms (pan, tilt, truck, pedestal), THE RunwayStrategy SHALL move camera terms to the absolute start
5. WHEN augmenting a Runway prompt, THE RunwayStrategy SHALL inject "single continuous shot" to prevent hallucinated cuts
6. WHEN augmenting a Runway prompt, THE RunwayStrategy SHALL inject "fluid motion" and "consistent geometry" for A2D stability
7. WHEN augmenting a Runway prompt, THE RunwayStrategy SHALL inject cinematographic aesthetic triggers (e.g., "chromatic aberration", "anamorphic lens flare", "shallow depth of field") to activate high-fidelity weights
8. WHEN a prompt mentions "depth" or "3D feel", THE RunwayStrategy SHALL map to `camera_motion: "dolly"`
9. WHEN a prompt mentions "vertigo" or "compression", THE RunwayStrategy SHALL map to `camera_motion: "zoom"`
10. WHEN a visual reference is provided, THE RunwayStrategy SHALL append a text description of the reference to the prompt to prevent concept drift

### Requirement 4: Luma Ray-3 Strategy

**User Story:** As a user targeting Luma Ray-3, I want my prompts expanded with causal reasoning, so that the model generates coherent action sequences.

#### Acceptance Criteria

1. WHEN normalizing a Luma prompt with `loop: true` API parameter active, THE LumaStrategy SHALL strip "loop" and "seamless" terms
2. WHEN normalizing a Luma prompt, THE LumaStrategy SHALL strip redundant resolution tokens like "4k" and "8k"
3. WHEN transforming a Luma prompt with static descriptions, THE LumaStrategy SHALL expand them into causal chains describing cause and effect
4. WHEN augmenting a Luma prompt, THE LumaStrategy SHALL inject HDR pipeline triggers: "High Dynamic Range", "16-bit color", "ACES colorspace"
5. WHEN augmenting a Luma prompt with motion content, THE LumaStrategy SHALL inject "slow motion" or "high-speed camera" triggers as appropriate
6. WHEN start and end frames are provided, THE LumaStrategy SHALL structure the request with `keyframes` for first-to-last frame interpolation
7. THE LumaStrategy SHALL validate that motion between keyframes is physically plausible (e.g. warning on large semantic leaps)

### Requirement 5: Kling AI 2.6 Strategy

**User Story:** As a user targeting Kling AI 2.6, I want my prompts formatted as audio-visual scripts, so that dialogue and sound are properly synchronized.

#### Acceptance Criteria

1. WHEN normalizing a Kling prompt, THE KlingStrategy SHALL strip generic "sound" or "noise" terms to prevent white noise generation
2. WHEN normalizing a Kling prompt, THE KlingStrategy SHALL strip visual quality tokens from audio description sections
3. WHEN transforming a Kling prompt with dialogue patterns, THE KlingStrategy SHALL format as `[Character] ([Emotion]): "[Line]"`
4. WHEN transforming a Kling prompt with sound effects, THE KlingStrategy SHALL extract them to separate `Audio:` blocks
5. WHEN augmenting a Kling prompt, THE KlingStrategy SHALL inject "synced lips", "natural speech", "high fidelity audio" triggers
6. WHEN reference images are present, THE KlingStrategy SHALL use `@Element` syntax for consistency
7. WHEN processing a multi-shot narrative, THE KlingStrategy SHALL maintain "MemFlow" consistency by tracking and referencing established entities across prompts

### Requirement 6: OpenAI Sora 2 Strategy

**User Story:** As a user targeting OpenAI Sora 2, I want my prompts grounded in physics simulation, so that interactions appear realistic.

#### Acceptance Criteria

1. WHEN normalizing a Sora prompt, THE SoraStrategy SHALL aggressively strip public figure names to prevent API rejections
2. WHEN a prompt contains a valid Cameo identity token (e.g. `@Cameo(id)`), THE SoraStrategy SHALL preserve it while stripping unauthorized names
3. WHEN transforming a Sora prompt with physical interactions, THE SoraStrategy SHALL analyze for collisions and gravity effects
4. WHEN transforming a complex Sora prompt, THE SoraStrategy SHALL segment into temporal sequences: "Shot 1 (0-4s) → Shot 2"
5. WHEN augmenting a Sora prompt, THE SoraStrategy SHALL inject physics terms: "Newtonian physics", "momentum conservation", "surface friction"
6. WHEN augmenting a Sora prompt for API calls, THE SoraStrategy SHALL inject `response_format: { type: "json_object" }` metadata
7. THE SoraStrategy SHALL validate and enforce supported aspect ratios and resolutions (e.g. 1080p vertical for social)

### Requirement 7: Google Veo 4 Strategy

**User Story:** As a user targeting Google Veo 4, I want my prompts serialized to structured JSON, so that the Gemini-integrated model receives optimal input.

#### Acceptance Criteria

1. WHEN normalizing a Veo prompt, THE VeoStrategy SHALL strip markdown formatting and conversational filler
2. WHEN transforming a Veo prompt, THE VeoStrategy SHALL serialize to JSON schema with subject, camera, environment, and audio fields
3. THE VeoStrategy's JSON output SHALL include nested objects: subject.description, subject.action, camera.type, camera.movement, environment.lighting, environment.weather
4. WHEN augmenting a Veo prompt, THE VeoStrategy SHALL inject `style_preset: "cinematic"` based on detected keywords
5. WHEN augmenting a Veo prompt, THE VeoStrategy SHALL preserve the JSON structure while adding style metadata
6. WHEN brand context is provided (e.g. hex codes, style guides), THE VeoStrategy SHALL inject these into the JSON `environment` or `style` fields
7. THE VeoStrategy SHALL support "Flow" editing by handling edit prompts (e.g., "Remove the object") and maintaining session state

### Requirement 8: TechStripper Utility

**User Story:** As a system, I want to remove placebo tokens that degrade model performance, so that prompts are optimized for each architecture.

#### Acceptance Criteria

1. THE TechStripper SHALL identify and target tokens: "4k", "8k", "trending on artstation", "award winning"
2. WHEN processing for Runway or Luma models, THE TechStripper SHALL remove placebo tokens
3. WHEN processing for Kling or Veo models, THE TechStripper SHALL keep placebo tokens as boosters
4. THE TechStripper SHALL accept a model identifier to determine removal behavior
5. THE TechStripper SHALL return the processed text with appropriate tokens removed or preserved

### Requirement 9: SafetySanitizer Utility

**User Story:** As a system, I want to sanitize prompts for safety compliance, so that API calls are not rejected and accounts are not banned.

#### Acceptance Criteria

1. THE SafetySanitizer SHALL maintain a blocklist of NSFW terms, unauthorized celebrity names, and violent acts
2. WHEN a blocked term is detected, THE SafetySanitizer SHALL replace it with a generic descriptor
3. WHEN a celebrity name is detected, THE SafetySanitizer SHALL replace with physical description (e.g., "Taylor Swift" → "Pop star with blonde hair")
4. THE SafetySanitizer SHALL return both the sanitized text and a list of replacements made
5. IF no blocked terms are found, THEN THE SafetySanitizer SHALL return the original text unchanged

### Requirement 10: VideoPromptService Integration

**User Story:** As a developer, I want the POE integrated into the existing VideoPromptService, so that optimization is seamlessly available.

#### Acceptance Criteria

1. WHEN a prompt is submitted with a detected model, THE VideoPromptService SHALL apply the corresponding strategy
2. THE VideoPromptService SHALL expose an `optimizeForModel` method that runs the full 3-phase pipeline
3. WHEN no model is detected, THE VideoPromptService SHALL return the original prompt without optimization
4. THE VideoPromptService SHALL log optimization operations with model, phase, and timing information
5. IF a strategy throws an error, THEN THE VideoPromptService SHALL log the error and return the original prompt

### Requirement 11: Cross-Model Translation

**User Story:** As a user, I want to generate optimized prompts for multiple models from a single input, so that I can compare outputs across platforms.

#### Acceptance Criteria

1. THE VideoPromptService SHALL expose a `translateToAllModels` method that returns optimized prompts for all supported models
2. WHEN `translateToAllModels` is called, THE VideoPromptService SHALL apply each strategy independently
3. THE output SHALL be a map of model identifiers to optimized prompts
4. IF a strategy fails for one model, THEN THE VideoPromptService SHALL continue processing other models and include an error indicator

### Requirement 12: Multimodal Asset Manager (MAM)

**User Story:** As a system, I want to manage uploaded assets and reference them consistently, so that multimodal prompts work across different model APIs.

#### Acceptance Criteria

1. THE MAM SHALL accept image and video uploads and store them in a temporary staging area
2. WHEN a strategy requires an asset (e.g., Kling @Element, Runway @Image), THE MAM SHALL upload the asset to the provider's specific endpoint
3. THE MAM SHALL return the provider-specific token or UUID for the asset
4. THE MAM SHALL identify and process Cameo identity tokens (e.g., for Sora) to ensure they are valid before prompt injection
5. THE MAM SHALL cache asset tokens to prevent redundant uploads for the same file
6. THE MAM SHALL expose a `describeAsset` method (via VLM) to generate text descriptions for concept reinforcement (required for Runway)
