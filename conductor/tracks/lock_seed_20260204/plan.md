# Implementation Plan: Lock & Seed Workflow

This plan outlines the steps to implement the Image-to-Video continuity workflow, allowing users to use a preview image as a reference for video generation.

## Phase 1: Backend Infrastructure & API Support

- [ ] **Task: Update Video Generation Contracts**
    - [ ] Update Zod schema in `shared/types/video.ts` (or equivalent) to include optional `sourceImageUrl`.
    - [ ] Update `VideoGenerationRequest` type.
- [ ] **Task: Update WanReplicateStrategy for I2V**
    - [ ] Write unit tests for `WanReplicateStrategy` to verify it correctly maps `sourceImageUrl` to Replicate's `image` parameter.
    - [ ] Implement the mapping in `WanReplicateStrategy.ts`.
- [ ] **Task: Update Video Generation Orchestrator**
    - [ ] Write unit tests for `VideoGenerationService` to ensure it passes the `sourceImageUrl` from the request to the strategy.
    - [ ] Update `VideoGenerationService.ts` to pass the parameter.
- [ ] **Task: Conductor - User Manual Verification 'Phase 1: Backend Infrastructure' (Protocol in workflow.md)**

## Phase 2: Frontend State & API Client

- [ ] **Task: Update Frontend State Management**
    - [ ] Write tests for the `usePromptOptimizer` reducer (or equivalent) to handle `LOCK_IMAGE` and `UNLOCK_IMAGE` actions.
    - [ ] Implement `lockedImage` in the state and the corresponding actions.
- [ ] **Task: Update Video API Client**
    - [ ] Update the `generateVideo` function in `client/src/api/video.ts` to accept and send the `sourceImageUrl`.
    - [ ] Verify the API call sends the correct payload when an image is locked.
- [ ] **Task: Conductor - User Manual Verification 'Phase 2: Frontend State' (Protocol in workflow.md)**

## Phase 3: UI Implementation

- [ ] **Task: Implement "Lock" Toggle on Image Cards**
    - [ ] Create/Update the component for image preview cards to include a "Lock" button.
    - [ ] Add tooltips explaining the "Lock & Seed" functionality.
- [ ] **Task: Implement I2V Status Indicator**
    - [ ] Add a visual indicator in the `GenerationControls` panel that shows when "Image-to-Video" mode is active.
    - [ ] Add a "Clear Lock" button to this indicator.
- [ ] **Task: End-to-End Integration Test**
    - [ ] Create a Playwright test that performs the full flow: Generate Image -> Lock -> Generate Video.
- [ ] **Task: Conductor - User Manual Verification 'Phase 3: UI Implementation' (Protocol in workflow.md)**
