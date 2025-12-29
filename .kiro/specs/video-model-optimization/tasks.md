# Implementation Plan: Video Model Prompt Optimization Engine

## Overview

This implementation plan breaks down the POE feature into discrete coding tasks. The approach is incremental: first establishing core interfaces and utilities, then implementing each strategy, and finally integrating with the existing VideoPromptService.

## Tasks

- [ ] 1. Define core interfaces and types
  - [ ] 1.1 Create strategy types file with PromptOptimizationResult, OptimizationMetadata, PhaseResult, PromptContext, AssetReference, and PromptOptimizationStrategy interfaces
    - Create `server/src/services/video-prompt-analysis/strategies/types.ts`
    - Export all interfaces for use by strategy implementations
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 1.2 Create StrategyRegistry class for managing strategy instances
    - Create `server/src/services/video-prompt-analysis/strategies/StrategyRegistry.ts`
    - Implement register, get, getAll, has methods
    - _Requirements: 1.2_

  - [ ] 1.3 Write property test for strategy pipeline validity
    - **Property 2: Strategy Pipeline Validity**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

- [ ] 2. Implement shared utilities
  - [ ] 2.1 Create TechStripper utility
    - Create `server/src/services/video-prompt-analysis/utils/TechStripper.ts`
    - Implement placebo token detection: "4k", "8k", "trending on artstation", "award winning"
    - Implement model-aware removal logic (remove for Runway/Luma, keep for Kling/Veo)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 2.2 Write property test for TechStripper model-aware behavior
    - **Property 7: TechStripper Model-Aware Behavior**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5**

  - [ ] 2.3 Create SafetySanitizer utility
    - Create `server/src/services/video-prompt-analysis/utils/SafetySanitizer.ts`
    - Implement blocklist for NSFW terms, celebrity names, violent acts
    - Implement replacement logic with generic descriptors
    - Return sanitized text and replacements list
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 2.4 Write property test for SafetySanitizer replacement consistency
    - **Property 8: SafetySanitizer Replacement Consistency**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

- [ ] 3. Checkpoint - Ensure utilities pass all tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Enhance ModelDetectionService
  - [ ] 4.1 Add new model patterns to ModelDetectionService
    - Update `server/src/services/video-prompt-analysis/services/detection/ModelDetectionService.ts`
    - Add patterns for runway-gen45, luma-ray3, kling-26, sora-2, veo-4
    - Update scoring logic to handle new patterns
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ] 4.2 Write property test for model detection correctness
    - **Property 1: Model Detection Correctness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

- [ ] 5. Implement BaseStrategy abstract class
  - [ ] 5.1 Create BaseStrategy with common pipeline logic
    - Create `server/src/services/video-prompt-analysis/strategies/BaseStrategy.ts`
    - Implement shared validate, normalize, transform, augment scaffolding
    - Integrate TechStripper and SafetySanitizer calls
    - Implement metadata tracking and timing
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

- [ ] 6. Implement RunwayStrategy
  - [ ] 6.1 Create RunwayStrategy with CSAE transformation
    - Create `server/src/services/video-prompt-analysis/strategies/RunwayStrategy.ts`
    - Implement normalize: strip emotional/abstract terms, morphing/blur
    - Implement transform: CSAE reordering (Camera → Subject → Action → Environment)
    - Implement augment: inject "single continuous shot", "fluid motion", "consistent geometry", cinematographic triggers
    - Implement camera motion mapping (depth→dolly, vertigo→zoom)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_

  - [ ] 6.2 Write property test for Runway CSAE ordering
    - **Property 4: Runway CSAE Ordering**
    - **Validates: Requirements 3.3, 3.4**

  - [ ] 6.3 Write property test for Runway augmentation triggers
    - **Property 6 (Runway): Augmentation Trigger Injection**
    - **Validates: Requirements 3.5, 3.6, 3.7**

- [ ] 7. Implement LumaStrategy
  - [ ] 7.1 Create LumaStrategy with causal chain expansion
    - Create `server/src/services/video-prompt-analysis/strategies/LumaStrategy.ts`
    - Implement normalize: strip "loop"/"seamless" when loop:true, strip "4k"/"8k"
    - Implement transform: causal chain expansion for static descriptions
    - Implement augment: inject HDR triggers, motion triggers
    - Implement keyframe structure support
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ] 7.2 Write property test for Luma normalization
    - **Property 3 (Luma): Normalization Token Stripping**
    - **Validates: Requirements 4.1, 4.2**

- [ ] 8. Checkpoint - Ensure Runway and Luma strategies pass all tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement KlingStrategy
  - [ ] 9.1 Create KlingStrategy with screenplay formatting
    - Create `server/src/services/video-prompt-analysis/strategies/KlingStrategy.ts`
    - Implement normalize: strip generic "sound"/"noise", strip visual tokens from audio sections
    - Implement transform: screenplay format `[Character] ([Emotion]): "[Line]"`, Audio: blocks
    - Implement augment: inject "synced lips", "natural speech", "high fidelity audio"
    - Implement @Element syntax for reference images
    - Implement MemFlow context tracking
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 9.2 Write property test for Kling screenplay formatting
    - **Property 4 (Kling): Dialogue Formatting**
    - **Validates: Requirements 5.3, 5.4**

- [ ] 10. Implement SoraStrategy
  - [ ] 10.1 Create SoraStrategy with physics grounding
    - Create `server/src/services/video-prompt-analysis/strategies/SoraStrategy.ts`
    - Implement normalize: strip public figure names, preserve @Cameo tokens
    - Implement transform: physics analysis, temporal segmentation (Shot 1 → Shot 2)
    - Implement augment: inject physics terms, response_format metadata
    - Implement aspect ratio validation
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ] 10.2 Write property test for Sora safety filtering
    - **Property 3 (Sora): Celebrity Name Stripping**
    - **Validates: Requirements 6.1, 6.2**

- [ ] 11. Implement VeoStrategy
  - [ ] 11.1 Create VeoStrategy with JSON serialization
    - Create `server/src/services/video-prompt-analysis/strategies/VeoStrategy.ts`
    - Implement normalize: strip markdown, conversational filler
    - Implement transform: JSON schema serialization with subject, camera, environment, audio
    - Implement augment: inject style_preset, brand_context
    - Implement Flow editing mode support
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ] 11.2 Write property test for Veo JSON schema validity
    - **Property 5: Veo JSON Schema Validity**
    - **Validates: Requirements 7.2, 7.3, 7.5**

- [ ] 12. Checkpoint - Ensure all strategies pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement Multimodal Asset Manager
  - [ ] 13.1 Create MultimodalAssetManager service
    - Create `server/src/services/video-prompt-analysis/services/MultimodalAssetManager.ts`
    - Implement asset upload staging
    - Implement provider-specific upload endpoints (mock for now)
    - Implement token caching by content hash
    - Implement describeAsset method (VLM integration placeholder)
    - Implement Cameo token validation
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [ ] 13.2 Write property test for MAM token caching
    - **Property 10: MAM Token Caching**
    - **Validates: Requirements 12.3, 12.5**

- [ ] 14. Integrate with VideoPromptService
  - [ ] 14.1 Add optimizeForModel method to VideoPromptService
    - Update `server/src/services/video-prompt-analysis/VideoPromptService.ts`
    - Initialize StrategyRegistry with all 5 strategies
    - Implement optimizeForModel: detect model → get strategy → run pipeline
    - Add logging for model, phase, timing
    - Implement error handling: log and return original on failure
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ] 14.2 Add translateToAllModels method to VideoPromptService
    - Implement parallel strategy execution for all models
    - Return Map<modelId, PromptOptimizationResult>
    - Implement failure isolation: continue on individual strategy errors
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ] 14.3 Write property test for cross-model translation isolation
    - **Property 9: Cross-Model Translation Isolation**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4**

- [ ] 15. Update exports and index files
  - [ ] 15.1 Update video-prompt-analysis index.ts
    - Export all new strategies, utilities, and types
    - Export StrategyRegistry
    - _Requirements: 10.1_

- [ ] 16. Final checkpoint - Full integration test
  - Ensure all tests pass, ask the user if questions arise.
  - Verify VideoPromptService.optimizeForModel works end-to-end
  - Verify VideoPromptService.translateToAllModels works end-to-end

## Notes

- All tasks including property tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The MAM VLM integration (describeAsset) is a placeholder for Phase 3
- Causal chain expansion in LumaStrategy may require LLM integration
