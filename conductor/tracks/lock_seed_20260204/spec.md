# Specification: Image-to-Video Continuity (Lock & Seed)

## Problem
Currently, users generate an image preview (Flux) and a video preview (Wan) independently. Even with the same prompt, the video often lacks visual continuity with the image (different character appearance, framing, or lighting). This makes the image preview less useful as a "validator" for the final video.

## Goal
Enable a "Lock & Seed" workflow where a specific image preview can be used as the starting frame (Keyframe) for a subsequent video generation, ensuring 100% visual continuity between the draft image and the draft video.

## Functional Requirements
1.  **Image Locking:** Users can "lock" a generated preview image.
2.  **State Persistence:** The locked image URL must be stored in the editor's state.
3.  **I2V Integration:** When a video is requested (Wan 2.2) and an image is locked, the system must use the locked image as the `image_url` parameter (Image-to-Video).
4.  **UI Feedback:** 
    - A "Lock" button/icon on image cards.
    - A clear visual indicator in the "Generations" or "Controls" panel that the next video will be based on the locked image.
5.  **Unlocking:** Users can unlock an image to return to Text-to-Video (T2V) mode.

## Technical Constraints
- The backend `VideoOptimizationService` must be updated to handle the optional `image_url`.
- The `WanReplicateStrategy` must support the `image` parameter for I2V.
- Credits must be handled correctly (I2V might have different pricing or requirements).

## Success Criteria
- [ ] A user can generate a Flux image, lock it, and then generate a Wan video that clearly uses that image as the first frame.
- [ ] The workflow is intuitive and the state (Locked vs. Unlocked) is obvious in the UI.
- [ ] Automated tests verify the state transition and API payload.
