# Tasks: Visual Convergence

## Phase 1: Backend Core Infrastructure

- [x] 1. Create convergence service directory structure and types
  - [x] 1.1 Create `server/src/services/convergence/` directory structure
  - [x] 1.2 Implement `types.ts` with all type definitions (Direction, DimensionType, ConvergenceSession, LockedDimension, GeneratedImage, CameraPath, etc.)
  - [x] 1.3 Implement `ConvergenceError` class with all error codes (SESSION_NOT_FOUND, UNAUTHORIZED, INSUFFICIENT_CREDITS, etc.)
  - [x] 1.4 Implement helper functions: getNextDimension, getPreviousDimension, getDimensionOrder, getStepOrder, getNextStep, getPreviousStep, stepToDimension, dimensionToStep
  - [x] 1.5 Add DIRECTION_OPTIONS constant with 4 direction options
  - [x] 1.6 Add credit cost constants:
    - [x] 1.6.1 CONVERGENCE_COSTS (DIRECTION_IMAGES, DIMENSION_IMAGES, DEPTH_ESTIMATION, WAN_PREVIEW, REGENERATION, ESTIMATED_TOTAL)
    - [x] 1.6.2 GENERATION_COSTS with model pricing (sora-2: 80, veo-3: 30, kling-v2.1: 35, luma-ray-3: 40, wan-2.2: 15, runway-gen4: 50)
  - [x] 1.7 Add CAMERA_PATHS constant for Three.js rendering (static, pan_left, pan_right, push_in, pull_back, crane_up)
  - [x] 1.8 Add CAMERA_MOTION_DESCRIPTIONS constant for fallback mode text

- [x] 2. Implement SessionStore (Firestore persistence)
  - [x] 2.1 Create `session/SessionStore.ts` with CRUD operations (create, get, update, delete)
  - [x] 2.2 Implement `getActiveByUserId()` for single active session check per user
  - [x] 2.3 Implement `getByUserId()` for session history
  - [x] 2.4 Implement `cleanupExpired()` for 24-hour TTL cleanup
  - [x] 2.5 Create Firestore indexes: userId+status+updatedAt DESC, updatedAt+status

- [x] 2.6 Implement session cleanup for abandoned sessions
  - [x] 2.6.1 Create cleanup method triggered by abandonAndStartFresh or scheduled job
  - [x] 2.6.2 Call StorageService.delete() for session images
  - [x] 2.6.3 Mark session status as 'abandoned'

- [x] 3. Implement PromptBuilderService
  - [x] 3.1 Create `prompt-builder/DimensionFragments.ts` with all fragment data:
    - [x] 3.1.1 DIRECTION_FRAGMENTS (cinematic, social, artistic, documentary)
    - [x] 3.1.2 MOOD_DIMENSION config (dramatic, peaceful, mysterious, nostalgic)
    - [x] 3.1.3 FRAMING_DIMENSION config (wide, medium, closeup, extreme_closeup)
    - [x] 3.1.4 LIGHTING_DIMENSION config (golden_hour, blue_hour, high_key, low_key)
    - [x] 3.1.5 CAMERA_MOTION_DIMENSION config (static, pan_left, pan_right, push_in, pull_back, crane_up)
  - [x] 3.2 Implement `PromptBuilderService.buildPrompt()` combining intent, direction, locked dimensions, subject motion
  - [x] 3.3 Implement `buildDimensionPreviewPrompt()` with emphasis on preview dimension
  - [x] 3.4 Implement `buildDirectionPrompts()` for direction fork (4 prompts)

- [x] 4. Implement CreditsService interface integration
  - [x] 4.1 Define CreditsService interface with CreditReservation type
  - [x] 4.2 Implement reserve(), commit(), refund(), getBalance(), debit() methods
  - [x] 4.3 Implement `withCreditReservation()` wrapper in ConvergenceService
  - [x] 4.4 Add `checkCredits()` helper for pre-operation balance check


## Phase 2: Backend Services

- [x] 5. Implement StorageService for GCS
  - [x] 5.1 Create StorageService interface
  - [x] 5.2 Implement GCSStorageService class
  - [x] 5.3 Implement `upload()` for single image upload from temp URL to GCS
  - [x] 5.4 Implement `uploadBatch()` for parallel image uploads
  - [x] 5.5 Implement `delete()` for cleanup on session abandonment

- [x] 6. Implement DepthEstimationService
  - [x] 6.1 Create `depth/DepthEstimationService.ts`
  - [x] 6.2 Integrate with Replicate API for Depth Anything v2
  - [x] 6.3 Implement `estimateDepth()` with GCS upload of result
  - [x] 6.4 Implement `isAvailable()` check for API token
  - [x] 6.5 Add `withRetry()` wrapper usage for resilience

- [x] 7. Implement VideoPreviewService for Wan 2.2
  - [x] 7.1 Create `video-preview/VideoPreviewService.ts` interface
  - [x] 7.2 Integrate with Wan 2.2 via Replicate API
  - [x] 7.3 Implement `generatePreview()` with duration and aspectRatio options
  - [x] 7.4 Upload generated video to GCS for permanent storage
  - [x] 7.5 Implement `isAvailable()` check
  - [x] 7.6 Add `withRetry()` wrapper usage for resilience

- [x] 8. Implement ConvergenceService core methods
  - [x] 8.1 Implement `getSessionWithOwnershipCheck()` helper for all session operations
  - [x] 8.2 Implement `generateAndPersistImages()` with GCS upload, aspectRatio, and withRetry()
  - [x] 8.3 Implement `startSession()`:
    - [x] 8.3.1 Check for existing active session (throw ACTIVE_SESSION_EXISTS)
    - [x] 8.3.2 Create session in Firestore
    - [x] 8.3.3 Reserve credits and generate direction images
    - [x] 8.3.4 Upload to GCS and update session
  - [x] 8.4 Implement `getSession()` and `getActiveSession(userId)` for resume flow

- [x] 9. Implement ConvergenceService selectOption (handles both direction and dimensions)
  - [x] 9.1 Validate session ownership
  - [x] 9.2 Handle direction selection branch:
    - [x] 9.2.1 Lock direction in session
    - [x] 9.2.2 Generate mood dimension images
    - [x] 9.2.3 Return response with direction field set
  - [x] 9.3 Handle dimension selection branch (mood, framing, lighting):
    - [x] 9.3.1 Add to lockedDimensions
    - [x] 9.3.2 Generate next dimension images (or transition to camera_motion)
    - [x] 9.3.3 Update imageHistory for back navigation

- [x] 10. Implement ConvergenceService regenerate
  - [x] 10.1 Validate session ownership
  - [x] 10.2 Check regeneration limit (max 3 per dimension)
  - [x] 10.3 Shuffle fragment selection for variety
  - [x] 10.4 Generate new images with credit reservation
  - [x] 10.5 Update regenerationCounts in session

- [x] 11. Implement ConvergenceService camera and subject motion
  - [x] 11.1 Implement `generateCameraMotion()`:
    - [x] 11.1.1 Get last generated image
    - [x] 11.1.2 Call DepthEstimationService with retry
    - [x] 11.1.3 On failure: return fallbackMode=true with null depthMapUrl
    - [x] 11.1.4 Return cameraPaths constant
  - [x] 11.2 Implement `selectCameraMotion()` - lock selection in session
  - [x] 11.3 Implement `generateSubjectMotion()`:
    - [x] 11.3.1 Build full prompt with all locked dimensions
    - [x] 11.3.2 Call VideoPreviewService with credit reservation
    - [x] 11.3.3 Store finalPrompt in session
  - [x] 11.4 Implement `finalizeSession()`:
    - [x] 11.4.1 Validate all required dimensions are locked
    - [x] 11.4.2 Build final prompt
    - [x] 11.4.3 Calculate total credits consumed with `calculateTotalCredits()` helper
    - [x] 11.4.4 Mark session as completed


## Phase 3: Backend Routes

- [x] 12. Create convergence routes
  - [x] 12.1 Create `routes/convergence/convergence.routes.ts`
  - [x] 12.2 Apply authMiddleware to all routes
  - [x] 12.3 Implement POST `/start` handler (pass aspectRatio from request body)
  - [x] 12.4 Implement POST `/select` handler
  - [x] 12.5 Implement POST `/regenerate` handler
  - [x] 12.6 Implement POST `/camera-motion` handler
  - [x] 12.7 Implement POST `/camera-motion/select` handler
  - [x] 12.8 Implement POST `/subject-motion` handler
  - [x] 12.9 Implement POST `/finalize` handler
  - [x] 12.10 Implement GET `/session/active` handler for resume flow

- [x] 13. Integrate routes with app
  - [x] 13.1 Register convergence routes in `app.ts` at `/api/convergence`
  - [x] 13.2 Initialize ConvergenceService with all dependencies
  - [x] 13.3 Add error handling middleware for ConvergenceError → HTTP status mapping

## Phase 4: Frontend Core Infrastructure

- [x] 14. Create convergence feature directory structure
  - [x] 14.1 Create `client/src/features/convergence/` directory structure (api/, hooks/, components/, utils/, config/)
  - [x] 14.2 Implement `types.ts` with frontend type definitions
  - [x] 14.3 Implement helper functions in `utils/helpers.ts`:
    - [x] 14.3.1 getStepOrder, getNextStep, getPreviousStep
    - [x] 14.3.2 getDimensionOrder, getNextDimension, getPreviousDimension
    - [x] 14.3.3 stepToDimension, dimensionToStep
  - [x] 14.4 Export feature from `index.ts`

- [x] 15. Implement convergenceApi
  - [x] 15.1 Create `api/convergenceApi.ts` with all API methods
  - [x] 15.2 Add AbortSignal support to: startSession, selectOption, regenerate, generateCameraMotion, generateSubjectMotion
  - [x] 15.3 Implement error response handling with ConvergenceError parsing
  - [x] 15.4 Add `getActiveSession()` for resume flow

- [x] 16. Implement AppShell context (required before ConvergenceFlow)
  - [x] 16.1 Create AppShellContext with activeTool state ('create' | 'studio')
  - [x] 16.2 Add convergenceHandoff state for Studio handoff (ConvergenceHandoff type)
  - [x] 16.3 Add setActiveTool with generation-in-progress warning
  - [x] 16.4 Create useAppShell hook

- [x] 17. Implement useConvergenceSession hook
  - [x] 17.1 Define ConvergenceState interface with all fields including:
    - [x] 17.1.1 abortController for cancellation
    - [x] 17.1.2 insufficientCreditsModal state
    - [x] 17.1.3 pendingResumeSession for resume flow
    - [x] 17.1.4 cameraMotionFallbackMode
    - [x] 17.1.5 focusedOptionIndex for keyboard nav
  - [x] 17.2 Define ConvergenceAction union type (all action types)
  - [x] 17.3 Implement convergenceReducer with all cases:
    - [x] 17.3.1 Session lifecycle actions
    - [x] 17.3.2 SELECT_OPTION_SUCCESS with direction state update
    - [x] 17.3.3 RESUME_SESSION with proper imageHistory Map conversion
    - [x] 17.3.4 Navigation actions (GO_BACK, JUMP_TO_STEP)
    - [x] 17.3.5 MOVE_FOCUS for keyboard navigation
  - [x] 17.4 Implement action creators:
    - [x] 17.4.1 startSession with AbortController
    - [x] 17.4.2 selectOption with direction check fix (check state.direction for direction, lockedDimensions for others)
    - [x] 17.4.3 regenerate, goBack, jumpToStep
    - [x] 17.4.4 cancelGeneration
    - [x] 17.4.5 resumeSession, abandonAndStartFresh
  - [x] 17.5 Implement handleApiError for INSUFFICIENT_CREDITS and other errors


## Phase 5: Frontend Components - Selection Flow

- [x] 18. Implement shared components
  - [x] 18.1 Create ImageSkeleton component for loading state
  - [x] 18.2 Create ImageOption component with focus ring and selected state
  - [x] 18.3 Create ImageGrid component with loading/loaded states
  - [x] 18.4 Create StepCreditBadge component
  - [x] 18.5 Create EstimatedCostBadge component
  - [x] 18.6 Create RegenerateButton with remaining count and cost display

- [x] 19. Implement IntentInput component
  - [x] 19.1 Create text input with placeholder
  - [x] 19.2 Add example prompts section
  - [x] 19.3 Add EstimatedCostBadge showing ~22 credits
  - [x] 19.4 Handle submit with Enter key
  - [x] 19.5 Add loading state during session start

- [x] 20. Implement DirectionFork component
  - [x] 20.1 Create layout with title and StepCreditBadge
  - [x] 20.2 Add ImageGrid with 4 direction options
  - [x] 20.3 Add ImageSkeleton for loading state
  - [x] 20.4 Add RegenerateButton with remaining count
  - [x] 20.5 Add keyboard focus support with focusedOptionIndex

- [x] 21. Implement DimensionSelector component
  - [x] 21.1 Create reusable component accepting dimension type prop
  - [x] 21.2 Add ImageGrid with 4 options
  - [x] 21.3 Add BackButton
  - [x] 21.4 Add StepCreditBadge and RegenerateButton
  - [x] 21.5 Add keyboard focus support

## Phase 6: Frontend Components - Camera Motion

- [x] 22. Implement cameraMotionRenderer utility
  - [x] 22.1 Create Three.js scene setup with PerspectiveCamera
  - [x] 22.2 Create depth-displaced PlaneGeometry mesh with custom shaders
  - [x] 22.3 Implement texture loading for image and depth map
  - [x] 22.4 Implement `renderCameraMotionFrames()` with camera path interpolation
  - [x] 22.5 Add ease-in-out interpolation function for smooth motion
  - [x] 22.6 Implement `createFrameAnimator()` for requestAnimationFrame playback
  - [x] 22.7 Create FrameAnimator React component wrapper for animation playback
  - [x] 22.8 Implement cleanup/dispose function for Three.js resources (geometry, material, textures, renderer)

- [x] 23. Implement CameraMotionPicker component
  - [x] 23.1 Create grid layout for camera motion options (2 cols mobile, 3 cols desktop)
  - [x] 23.2 Implement CameraMotionOption component:
    - [x] 23.2.1 Normal mode: Three.js preview with lazy render on hover
    - [x] 23.2.2 Fallback mode: text description from CAMERA_MOTION_DESCRIPTIONS
  - [x] 23.3 Add loading spinner during frame rendering
  - [x] 23.4 Add selected state indicator
  - [x] 23.5 Create CameraMotionErrorBoundary that falls back to text mode
  - [x] 23.6 Wrap with CameraMotionPickerWithErrorBoundary
  - [x] 23.7 Add keyboard focus support


## Phase 7: Frontend Components - Subject Motion & Preview

- [x] 24. Implement SubjectMotionInput component
  - [x] 24.1 Create text input for motion description
  - [x] 24.2 Add GeneratePreviewButton with cost display (5 credits)
  - [x] 24.3 Add SkipButton (proceeds without preview)
  - [x] 24.4 Add VideoPlayer for preview display when available
  - [x] 24.5 Add BackButton
  - [x] 24.6 Add StepCreditBadge

- [x] 25. Implement ConvergencePreview component
  - [x] 25.1 Create preview display with video or image
  - [x] 25.2 Add PromptDisplay showing final prompt
  - [x] 25.3 Add DimensionSummary with locked selections as badges
  - [x] 25.4 Add TotalCreditsSummary showing credits consumed
  - [x] 25.5 Implement GenerateNowButton:
    - [x] 25.5.1 Wire useBottomControlBar() for selectedModel and aspectRatio (verify hook exists, create if needed)
    - [x] 25.5.2 Wire useVideoGeneration() for generateVideo (verify hook exists, create if needed)
    - [x] 25.5.3 Pass convergence metadata to generation
    - [x] 25.5.4 Show model cost from GENERATION_COSTS constant
  - [x] 25.6 Implement EditInStudioButton:
    - [x] 25.6.1 Call setConvergenceHandoff with prompt and metadata
    - [x] 25.6.2 Call setActiveTool('studio')
  - [x] 25.7 Add ModelCostTable showing all model costs

- [x] 26. Implement ProgressIndicator component
  - [x] 26.1 Create horizontal step indicator showing all steps
  - [x] 26.2 Add clickable completed steps for jumpToStep navigation
  - [x] 26.3 Add visual distinction: completed (checkmark), current (highlight), future (dimmed)
  - [x] 26.4 Add step labels (Direction, Mood, Framing, Lighting, Camera, Motion, Preview)

## Phase 8: Frontend Components - Modals

- [x] 27. Implement ResumeSessionModal
  - [x] 27.1 Create modal showing existing session info (intent, last updated)
  - [x] 27.2 Add Resume button calling resumeSession action
  - [x] 27.3 Add Start Fresh button calling abandonAndStartFresh action

- [x] 28. Implement InsufficientCreditsModal
  - [x] 28.1 Create modal showing credit requirement vs available
  - [x] 28.2 Add Purchase Credits button navigating to /pricing
  - [x] 28.3 Add Cancel button dispatching HIDE_CREDITS_MODAL

## Phase 9: Frontend Orchestration

- [x] 29. Implement ConvergenceFlow orchestrator
  - [x] 29.1 Create main component with useConvergenceSession hook
  - [x] 29.2 Add useEffect for session resume check on mount (call getActiveSession)
  - [x] 29.3 Add useEffect for keyboard navigation handler (Enter, Escape, Arrow keys)
  - [x] 29.4 Add step routing to render correct component based on state.step
  - [x] 29.5 Add error display for state.error
  - [x] 29.6 Add ResumeSessionModal when pendingResumeSession exists
  - [x] 29.7 Add InsufficientCreditsModal when insufficientCreditsModal exists
  - [x] 29.8 Add ProgressIndicator at top


## Phase 10: Tool Panel Integration

- [x] 30. Update ToolPanel
  - [x] 30.1 Add "Create" icon/button above Studio
  - [x] 30.2 Rename existing "Tool" to "Studio"
  - [x] 30.3 Wire up tool switching via useAppShell().setActiveTool

- [x] 31. Update AppShell/MainWorkspace
  - [x] 31.1 Wrap app with AppShellContext.Provider
  - [x] 31.2 Conditionally render ConvergenceFlow or Studio based on activeTool
  - [x] 31.3 Ensure BottomControlBar is shared between both tools
  - [x] 31.4 Update Studio to receive and use convergenceHandoff for prompt pre-fill

## Phase 11: Testing

- [x] 32. Backend unit tests
  - [x] 32.1 Test SessionStore CRUD operations and getActiveByUserId
  - [x] 32.2 Test PromptBuilderService prompt construction (all methods)
  - [x] 32.3 Test ConvergenceService session lifecycle (start, select, finalize)
  - [x] 32.4 Test credit reservation pattern (reserve, commit, refund on error)
  - [x] 32.5 Test ownership validation (UNAUTHORIZED error)
  - [x] 32.6 Test regeneration limit (REGENERATION_LIMIT_EXCEEDED error)
  - [x] 32.7 Test finalization validation (INCOMPLETE_SESSION error)

- [x] 33. Frontend unit tests
  - [x] 33.1 Test convergenceReducer state transitions for all action types
  - [x] 33.2 Test selectOption direction check fix (direction vs lockedDimensions)
  - [x] 33.3 Test RESUME_SESSION imageHistory Map conversion
  - [x] 33.4 Test helper functions (getNextStep, getDimensionOrder, etc.)
  - [x] 33.5 Test convergenceApi error handling

- [x] 34. Integration tests
  - [x] 34.1 Test full convergence flow end-to-end (intent → finalize)
  - [x] 34.2 Test session resume flow
  - [x] 34.3 Test credit deduction and refund on failure
  - [x] 34.4 Test tool switching with handoff to Studio

## Phase 12: Polish & Accessibility

- [x] 35. Mobile responsiveness
  - [x] 35.1 Ensure 2-column grid on mobile, 4-column on desktop for images
  - [x] 35.2 Ensure 2-column grid on mobile, 3-column on desktop for camera motion
  - [x] 35.3 Test at 375px, 768px, 1024px, 1920px viewport widths
  - [x] 35.4 Add touch-friendly tap targets (min 44px)

- [x] 36. Keyboard accessibility
  - [x] 36.1 Ensure all interactive elements are focusable
  - [x] 36.2 Add visible focus indicators (ring-2 ring-blue-500)
  - [x] 36.3 Test Enter/Escape/Arrow key navigation end-to-end
  - [x] 36.4 Add ARIA labels to ImageOption, CameraMotionOption

- [x] 37. Error handling polish
  - [x] 37.1 Add user-friendly error messages for all ConvergenceErrorCodes
  - [x] 37.2 Add retry buttons for failed operations
  - [x] 37.3 Add network disconnect detection and recovery prompt
  - [x] 37.4 Add session expiry handling (24-hour TTL)
