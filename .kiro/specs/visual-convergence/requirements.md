# Requirements Document

## Introduction

The Visual Convergence feature transforms PromptCanvas from a text optimization tool into a visual-first video creation platform. Instead of writing prompts, users make visual choices through a guided flow that progressively narrows down their creative vision. The system generates image options at each step, allowing users to "converge" on their desired output through selection rather than description.

The flow guides users through: Direction (Cinematic/Social/Artistic/Documentary) → Mood → Framing → Lighting → Camera Motion → Subject Motion (optional) → Final Generation.

## Glossary

- **Convergence_Session**: A persistent session tracking a user's progress through the visual convergence flow, including all selections and generated assets
- **Direction**: The high-level creative style (cinematic, social, artistic, documentary) that influences all subsequent options
- **Dimension**: A visual attribute category (mood, framing, lighting, camera_motion) that users select from
- **Locked_Dimension**: A dimension that has been selected and will influence all subsequent image generations
- **Depth_Map**: A grayscale image representing depth information, used for parallax camera motion effects
- **Camera_Path**: A predefined 3D camera movement trajectory used for depth-based parallax rendering
- **Prompt_Fragment**: A text snippet associated with a dimension option that contributes to the final prompt
- **Subject_Motion**: User-provided text describing how the subject moves in the video
- **Wan_Preview**: A short video preview generated using the Wan 2.2 model
- **Studio**: The advanced prompt editor (formerly the main tool), accessible via the left panel
- **Create**: The Visual Convergence guided flow, accessible via the left panel

## Requirements

### Requirement 1: Session Management

**User Story:** As a user, I want my convergence progress to be saved, so that I can resume my creative session if interrupted.

#### Acceptance Criteria

1. WHEN a user starts a new convergence flow with an intent, THE Convergence_Session SHALL be created with a unique identifier and persisted to Firestore
2. WHEN a user makes a selection at any step, THE Convergence_Session SHALL be updated with the selection and timestamp
3. WHILE a Convergence_Session is active, THE System SHALL allow retrieval of the session by its identifier
4. WHEN a Convergence_Session has been inactive for 24 hours, THE System SHALL mark it as abandoned during cleanup
5. WHEN a user completes the flow, THE Convergence_Session SHALL be marked as completed with the final prompt
6. WHEN a user has an incomplete Convergence_Session from a previous visit, THE System SHALL prompt to resume or start fresh
7. THE System SHALL store generated images in permanent storage (GCS) before persisting URLs to the session to prevent URL expiration issues
8. THE System SHALL require authentication before starting a Convergence_Session
9. IF an unauthenticated user attempts to start a session, THEN THE System SHALL redirect to sign-in with return URL preserved
10. THE System SHALL allow only ONE active Convergence_Session per user at a time
11. WHEN a user starts a new session while one exists, THE System SHALL prompt to abandon the existing session or resume it

### Requirement 2: Direction Fork

**User Story:** As a user, I want to choose a creative direction from visual options, so that I can set the overall style of my video without writing prompts.

#### Acceptance Criteria

1. WHEN a user submits an initial intent, THE System SHALL generate one image per available direction option (cinematic, social, artistic, documentary)
2. WHEN generating direction images, THE System SHALL use Flux Schnell model for cost efficiency
3. WHEN generating direction images, THE System SHALL generate all images in parallel
4. WHEN a user selects a direction, THE System SHALL lock that direction and proceed to the mood dimension
5. IF image generation fails for any direction, THEN THE System SHALL retry up to 2 times before returning an error

### Requirement 3: Dimension Selection Flow

**User Story:** As a user, I want to progressively refine my video's visual style through guided choices, so that I can achieve my creative vision without technical knowledge.

#### Acceptance Criteria

1. WHEN a user selects a dimension option, THE System SHALL lock that dimension and generate one image per available option for the next dimension
2. WHEN generating dimension preview images, THE System SHALL incorporate all previously locked dimensions into the prompt
3. THE Prompt_Builder_Service SHALL construct prompts by combining intent, direction fragments, and locked dimension fragments
4. WHEN building prompts, THE Prompt_Builder_Service SHALL select 2 fragments per dimension to avoid prompt bloat
5. THE System SHALL process dimensions in order: mood → framing → lighting → camera_motion
6. WHEN the lighting dimension is locked, THE System SHALL transition to camera motion selection

### Requirement 4: Prompt Building

**User Story:** As a developer, I want prompts to be built systematically from dimension selections, so that the generated images accurately reflect user choices.

#### Acceptance Criteria

1. THE Prompt_Builder_Service SHALL maintain a library of prompt fragments for each dimension option
2. WHEN building a full prompt, THE Prompt_Builder_Service SHALL combine: intent, direction fragments (2), locked dimension fragments (2 each), and subject motion
3. WHEN building a preview prompt, THE Prompt_Builder_Service SHALL emphasize the preview dimension with 2 fragments while using 1 fragment for locked dimensions
4. THE Prompt_Builder_Service SHALL exclude camera_motion fragments from image generation prompts
5. FOR ALL valid dimension configurations, building then parsing a prompt SHALL preserve the semantic intent

### Requirement 5: Depth Estimation and Camera Motion

**User Story:** As a user, I want to preview different camera movements on my image, so that I can choose how the camera moves without generating expensive videos.

#### Acceptance Criteria

1. WHEN the lighting dimension is locked, THE System SHALL generate a depth map from the last generated image using Depth Anything v2
2. THE Depth_Estimation_Service SHALL use Replicate API to run the depth estimation model
3. WHEN depth estimation completes, THE System SHALL return the depth map URL and available camera paths
4. THE System SHALL provide at least 6 camera path options: static, pan_left, pan_right, push_in, pull_back, crane_up
5. IF depth estimation fails, THEN THE System SHALL offer text-only camera motion selection as fallback

### Requirement 6: Client-Side Camera Motion Rendering

**User Story:** As a user, I want to see smooth camera motion previews instantly, so that I can quickly compare different camera movements.

#### Acceptance Criteria

1. THE Camera_Motion_Renderer SHALL use Three.js to create depth-displaced mesh from the image and depth map
2. WHEN rendering a camera path, THE Camera_Motion_Renderer SHALL animate the camera position using ease-in-out interpolation
3. THE Camera_Motion_Renderer SHALL render previews at 320x180 resolution and 15fps for performance
4. WHEN a user hovers over a camera motion option, THE System SHALL play the preview animation
5. THE Camera_Motion_Renderer SHALL render camera path previews lazily on hover, not all on mount
6. THE Camera_Motion_Renderer SHALL animate frames directly with requestAnimationFrame instead of encoding to video (Safari compatibility)

### Requirement 7: Subject Motion Preview

**User Story:** As a user, I want to optionally describe how my subject moves and see a preview, so that I can verify the motion before final generation.

#### Acceptance Criteria

1. THE subject motion step SHALL be OPTIONAL - users may skip to finalization with empty subject motion
2. WHEN a user enters subject motion text and submits, THE System SHALL generate a Wan 2.2 preview video
3. WHEN generating the subject motion preview, THE System SHALL use the full prompt including all locked dimensions and subject motion
4. THE System SHALL display the generated preview video to the user
5. WHEN the preview is generated, THE System SHALL store the final prompt in the session
6. IF subject motion preview generation fails, THEN THE System SHALL allow user to proceed to final generation without preview
7. WHEN a user skips subject motion, THE System SHALL proceed to finalization with an empty subject motion field

### Requirement 8: Session Finalization

**User Story:** As a user, I want to finalize my session and proceed to video generation, so that I can create my final video with my chosen settings.

#### Acceptance Criteria

1. WHEN a user finalizes the session, THE System SHALL return the complete prompt, locked dimensions, preview image URL, camera motion, and subject motion
2. WHEN finalizing, THE System SHALL mark the session as completed
3. THE System SHALL validate that direction, mood, framing, lighting, and camera motion have been selected before allowing finalization
4. IF the session is incomplete, THEN THE System SHALL return an error indicating missing selections
5. WHEN a user clicks "Generate Now", THE System SHALL call the existing video generation API with the finalized prompt and locked dimension metadata
6. THE System SHALL pass the converged prompt to VideoGenerationService.generate() with the selected model from the control bar
7. WHEN a user clicks "Edit in Studio", THE System SHALL switch tools and pre-fill the converged prompt

### Requirement 9: Frontend State Management

**User Story:** As a developer, I want predictable state management for the convergence flow, so that the UI accurately reflects the current step and selections.

#### Acceptance Criteria

1. THE useConvergenceSession hook SHALL manage all convergence state using useReducer pattern
2. WHEN an API call is in progress, THE State SHALL reflect loading status
3. WHEN an API call fails, THE State SHALL capture the error message
4. THE State SHALL track: sessionId, current step, intent, direction, locked dimensions, current images, current options, depth map URL, camera paths, selected camera motion, subject motion, final prompt, and regeneration counts per dimension as a Map<DimensionType, number>
5. WHEN reset is called, THE State SHALL return to initial values
6. THE State SHALL support GO_BACK, REGENERATE, CANCEL_GENERATION, and JUMP_TO_STEP actions
7. THE State SHALL track loading status per operation type (imageGeneration, depthEstimation, videoPreview) to enable appropriate UI feedback
8. THE State SHALL preserve previously generated images for each dimension to enable restoration on back navigation

### Requirement 10: API Layer

**User Story:** As a developer, I want a centralized API layer for convergence operations, so that API calls are consistent and maintainable.

#### Acceptance Criteria

1. THE convergenceApi module SHALL provide methods for: startSession, selectOption, generateCameraMotion, selectCameraMotion, generateSubjectMotion, regenerate, and finalize
2. WHEN an API response is not OK, THE convergenceApi SHALL throw an error with the response message
3. THE convergenceApi SHALL use JSON content type for all requests
4. FOR ALL API methods, the request and response types SHALL match the backend contract
5. THE convergenceApi SHALL support request cancellation via AbortController for in-flight requests

### Requirement 11: Error Handling and Recovery

**User Story:** As a user, I want clear error messages and recovery options, so that I can continue my creative process when issues occur.

#### Acceptance Criteria

1. WHEN an error occurs during image generation, THE System SHALL display a user-friendly error message
2. WHEN an error occurs, THE System SHALL preserve the current session state
3. THE System SHALL provide retry functionality for failed operations
4. IF a session cannot be found, THEN THE System SHALL prompt the user to start a new session
5. IF image generation fails, THEN THE System SHALL retry up to 2 times before showing error
6. IF depth estimation fails, THEN THE System SHALL offer text-only camera motion selection as fallback
7. IF Wan preview fails, THEN THE System SHALL allow user to proceed to final generation without preview
8. IF network disconnects mid-flow, THE System SHALL recover session on reconnect

### Requirement 12: Mobile Responsiveness and Accessibility

**User Story:** As a user, I want to use the convergence flow on mobile devices and with keyboard navigation, so that I can create videos from anywhere using my preferred input method.

#### Acceptance Criteria

1. THE ConvergenceFlow component SHALL display images in a responsive grid (2 columns on mobile, 4 on desktop)
2. THE CameraMotionPicker component SHALL display camera options in a responsive grid (2 columns on mobile, 3-4 on desktop)
3. WHEN on mobile, THE System SHALL use touch-friendly interaction patterns
4. THE UI components SHALL maintain usability at viewport widths from 375px to 1920px
5. THE System SHALL support keyboard navigation: Enter to select highlighted option, Escape to go back, Arrow keys to move between options
6. THE System SHALL provide visible focus indicators for keyboard navigation

### Requirement 13: Navigation and Revision

**User Story:** As a user, I want to go back and change previous selections, so that I can explore different creative directions without starting over.

#### Acceptance Criteria

1. WHEN a user is on any step after direction, THE System SHALL display a "Back" control
2. WHEN a user clicks back, THE System SHALL unlock the most recent dimension and return to that step
3. WHEN a user goes back, THE System SHALL preserve all previously generated images for that step
4. WHEN a user re-selects a different option, THE System SHALL regenerate subsequent dimension images with the new selection
5. WHEN a user goes back and selects the SAME option as before, THE System SHALL NOT regenerate and SHALL restore the previously generated images for subsequent dimensions
6. WHEN a user is on the direction step, THE System SHALL allow editing the intent text and regenerating direction options
7. IF a user navigates back while generation is in progress, THE System SHALL cancel the in-flight request and not consume credits

### Requirement 14: Regeneration

**User Story:** As a user, I want to regenerate options when none match my vision, so that I'm not forced into choices I don't want.

#### Acceptance Criteria

1. WHEN viewing any dimension's options, THE System SHALL display a "Regenerate" control
2. WHEN a user clicks regenerate, THE System SHALL generate new images for all options in the current dimension
3. WHEN regenerating, THE System SHALL shuffle which 2 of 5 prompt fragments are selected, and MAY add a random seed modifier
4. THE System SHALL limit regeneration to 3 times per dimension per session to prevent credit abuse
5. THE System SHALL display remaining regeneration count to the user

### Requirement 15: Credit Visibility

**User Story:** As a user, I want to see credit costs throughout the flow, so that I can make informed decisions about spending.

#### Acceptance Criteria

1. WHEN starting a session, THE System SHALL display estimated total credit cost for completion
2. WHEN generating images at each step, THE System SHALL display credits consumed
3. WHEN generating the Wan preview, THE System SHALL display the preview credit cost before generation
4. WHEN finalizing, THE System SHALL display the final generation cost for each available model
5. IF a user has insufficient credits, THEN THE System SHALL block generation and prompt to purchase
6. THE System SHALL reserve credits at request time and refund automatically on failure
7. WHEN a user goes back and selects a different option, THE System SHALL charge credits for newly generated images
8. WHEN a user goes back and selects the same option (restoring cached images), THE System SHALL NOT charge credits

### Requirement 16: Tool Panel Integration

**User Story:** As a user, I want to access Visual Convergence from the left tool panel, so that it integrates naturally with my existing workflow.

#### Acceptance Criteria

1. THE System SHALL add a "Create" icon to the left tool panel above the current editor tool
2. THE System SHALL rename the current "Tool" icon to "Studio"
3. WHEN a user clicks "Create", THE System SHALL display the Visual Convergence flow in the main workspace
4. WHEN a user clicks "Studio", THE System SHALL display the advanced prompt editor in the main workspace
5. THE System SHALL preserve the bottom control bar (model selector, aspect ratio, Generate button) for both tools
6. THE System SHALL NOT change routes - both tools render at / based on active selection
7. WHEN no session is active, THE Create tool SHALL display the IntentInput component with placeholder text and example prompts

### Requirement 17: Tool Switching and Handoff

**User Story:** As a user, I want to seamlessly move between Create and Studio modes, so that I can use guided creation or advanced editing as needed.

#### Acceptance Criteria

1. WHEN Visual Convergence completes, THE System SHALL offer "Generate Now" and "Edit in Studio" options
2. WHEN a user clicks "Edit in Studio", THE System SHALL switch to Studio mode with the converged prompt pre-filled
3. WHEN switching to Studio, THE System SHALL preserve locked dimension metadata for reference
4. THE System SHALL allow switching between Create and Studio at any time via the left panel
5. WHEN switching away from an incomplete Convergence session, THE System SHALL preserve session state for return
6. THE handoff SHALL pass data via shared React context, NOT URL parameters, to avoid URL length limits and preserve complex metadata
7. IF a user attempts to switch tools while generation is in progress, THE System SHALL warn and require confirmation

### Requirement 18: Progress Indicator

**User Story:** As a user, I want to see my progress through the convergence flow, so that I know how many steps remain and can navigate to previous steps.

#### Acceptance Criteria

1. THE System SHALL display a progress indicator showing completed steps, current step, and remaining steps
2. THE progress indicator SHALL allow clicking completed steps to navigate back
3. THE progress indicator SHALL visually distinguish between completed, current, and future steps
4. THE progress indicator SHALL display the label for each step (Direction, Mood, Framing, Lighting, Camera, Motion, Preview)
5. WHEN a user clicks a completed step that is not immediately previous, THE System SHALL unlock all dimensions after the target step
