# Design Document: Visual Convergence

## Overview

The Visual Convergence feature transforms PromptCanvas into a visual-first video creation platform. Users make creative decisions by selecting from generated images rather than writing prompts. The system guides users through a progressive refinement flow: Direction → Mood → Framing → Lighting → Camera Motion → Subject Motion → Final Generation.

The architecture follows a client-server model with:
- **Backend**: Express.js services for session management, image generation orchestration, depth estimation, and prompt building
- **Frontend**: React components with useReducer state management, Three.js for camera motion rendering

Key design decisions:
1. **Session-based persistence**: Firestore stores session state with 24-hour TTL
2. **Parallel image generation**: All dimension options generated simultaneously for speed
3. **Client-side camera motion**: Three.js depth parallax avoids expensive video generation
4. **Fragment-based prompts**: Modular prompt construction from dimension-specific fragments
5. **GCS image storage**: Permanent storage prevents URL expiration issues
6. **Credit reservation pattern**: Reserve credits before operations, refund on failure
7. **Single active session**: Only one active convergence session per user
8. **Authentication required**: All convergence routes require authenticated user
9. **Retry with backoff**: Failed operations retry up to 2 times with exponential backoff

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (React)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────────┐ │
│  │ ConvergenceFlow │  │ useConvergence   │  │ convergenceApi              │ │
│  │ (Orchestrator)  │──│ Session (State)  │──│ (API Layer)                 │ │
│  └────────┬────────┘  └──────────────────┘  └──────────────┬──────────────┘ │
│           │                                                 │                │
│  ┌────────┴────────────────────────────────────────────────┐│                │
│  │ Components: IntentInput, DirectionFork, DimensionSelector││                │
│  │ CameraMotionPicker, SubjectMotionInput, ConvergencePreview│                │
│  └─────────────────────────────────────────────────────────┘│                │
│           │                                                 │                │
│  ┌────────┴────────┐                                        │                │
│  │ cameraMotion    │  Three.js depth parallax rendering     │                │
│  │ Renderer        │                                        │                │
│  └─────────────────┘                                        │                │
└─────────────────────────────────────────────────────────────┼────────────────┘
                                                              │
                                                              │ HTTP/JSON
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Backend (Express.js)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │              /api/convergence routes (authMiddleware)                    ││
│  │  POST /start | /select | /regenerate | /camera-motion | /subject-motion ││
│  │  POST /camera-motion/select | /finalize | GET /session/active           ││
│  └────────────────────────────────┬────────────────────────────────────────┘│
│                                   │                                          │
│  ┌────────────────────────────────┴────────────────────────────────────────┐│
│  │                      ConvergenceService (Orchestrator)                   ││
│  │  - startSession(req, userId)  - selectOption()  - regenerate()           ││
│  │  - generateCameraMotion()  - selectCameraMotion()                        ││
│  │  - generateSubjectMotion()  - finalizeSession()                          ││
│  │  - withCreditReservation()  - withRetry()                                ││
│  └───────┬──────────────────┬──────────────────┬──────────────────┬────────┘│
│          │                  │                  │                  │          │
│  ┌───────┴───────┐  ┌───────┴───────┐  ┌───────┴───────┐  ┌───────┴───────┐ │
│  │ SessionStore  │  │ PromptBuilder │  │ DepthEstimate │  │ ImageGen +    │ │
│  │ (Firestore)   │  │ Service       │  │ Service       │  │ StorageService│ │
│  └───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘ │
│          │                                     │                  │          │
│          ▼                                     ▼                  ▼          │
│     Firestore                            Replicate API      Flux + GCS      │
│                                          (Depth Anything)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```


### Request Flow

```
User enters intent
        │
        ▼
┌───────────────────┐
│ Check active      │──► convergenceApi.getActiveSession()
│ session on mount  │           │
└───────────────────┘           ├──► If exists: dispatch({ type: 'PROMPT_RESUME', payload: session })
        │                       └──► If none: continue to IntentInput
        ▼
┌───────────────────┐
│ POST /start       │──► authMiddleware ──► ConvergenceService.startSession(req, userId)
└───────────────────┘           │
        │                       ├──► SessionStore.getActiveByUserId(userId)
        │                       │    └──► If exists: throw ConflictError('ACTIVE_SESSION_EXISTS')
        │                       ├──► SessionStore.create()
        │                       ├──► withCreditReservation(userId, cost, async () => {
        │                       │        ├──► PromptBuilder.buildDirectionPrompts()
        │                       │        ├──► withRetry(() => ImageGenerationService.generatePreview()) x4
        │                       │        └──► StorageService.uploadBatch(replicateUrls) → GCS URLs
        │                       │    })
        │                       └──► SessionStore.update({ images: gcsUrls })
        ▼
┌───────────────────┐
│ User selects      │
│ direction         │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ POST /select      │──► authMiddleware ──► ConvergenceService.selectOption()
└───────────────────┘           │
        │                       ├──► SessionStore.update()
        │                       ├──► withCreditReservation(userId, cost, async () => {
        │                       │        ├──► PromptBuilder.buildDimensionPreviewPrompt() x4
        │                       │        ├──► withRetry(() => ImageGenerationService.generatePreview()) x4
        │                       │        └──► StorageService.uploadBatch(replicateUrls) → GCS URLs
        │                       │    })
        │                       └──► SessionStore.update({ images: gcsUrls, imageHistory })
        ▼
   [Repeat for mood, framing, lighting]
        │
        ▼
┌───────────────────┐
│ POST /camera-     │──► authMiddleware ──► ConvergenceService.generateCameraMotion()
│ motion            │           │
└───────────────────┘           ├──► withRetry(() => DepthEstimationService.estimateDepth())
        │                       │    └──► On failure: return { fallbackMode: true, depthMapUrl: null }
        │                       └──► Return depth map + camera paths + fallbackMode
        ▼
┌───────────────────┐
│ Client renders    │  Three.js depth parallax (no server call)
│ camera previews   │  OR text-only selection if fallbackMode
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ POST /camera-     │──► authMiddleware ──► ConvergenceService.selectCameraMotion()
│ motion/select     │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ POST /subject-    │──► authMiddleware ──► ConvergenceService.generateSubjectMotion()
│ motion (optional) │           │
└───────────────────┘           ├──► withCreditReservation(userId, cost, async () => {
        │                       │        ├──► PromptBuilder.buildPrompt()
        │                       │        └──► withRetry(() => VideoPreviewService.generatePreview())
        │                       │    })
        │                       └──► On failure: allow proceed without preview
        ▼
┌───────────────────┐
│ POST /finalize    │──► authMiddleware ──► ConvergenceService.finalizeSession()
└───────────────────┘           │
        │                       └──► SessionStore.update(status: 'completed')
        ▼
   Generate or Edit in Studio
```

## Components and Interfaces

### Error Types

```typescript
type ConvergenceErrorCode = 
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'ACTIVE_SESSION_EXISTS'
  | 'INSUFFICIENT_CREDITS'
  | 'REGENERATION_LIMIT_EXCEEDED'
  | 'DEPTH_ESTIMATION_FAILED'
  | 'IMAGE_GENERATION_FAILED'
  | 'VIDEO_GENERATION_FAILED'
  | 'INCOMPLETE_SESSION'
  | 'UNAUTHORIZED';

class ConvergenceError extends Error {
  constructor(
    public code: ConvergenceErrorCode,
    public details?: Record<string, unknown>
  ) {
    super(code);
    this.name = 'ConvergenceError';
  }
}
```

### Utility Functions

```typescript
/**
 * Retry wrapper with exponential backoff
 * Requirement 2.5, 11.5: Retry up to 2 times before returning error
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await operation();
    } catch (e) {
      lastError = e as Error;
      if (i < maxRetries) {
        await sleep(baseDelay * Math.pow(2, i)); // Exponential backoff
      }
    }
  }
  throw lastError!;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```


### Backend Services

#### Routes Configuration

```typescript
// All convergence routes require authentication (Requirement 1.8-1.9)
import { authMiddleware } from '@middleware/auth';

const router = Router();

// Apply auth middleware to all convergence routes
router.use(authMiddleware);

router.post('/start', asyncHandler(startSessionHandler));
router.post('/select', asyncHandler(selectOptionHandler));
router.post('/regenerate', asyncHandler(regenerateHandler));
router.post('/camera-motion', asyncHandler(generateCameraMotionHandler));
router.post('/camera-motion/select', asyncHandler(selectCameraMotionHandler));
router.post('/subject-motion', asyncHandler(generateSubjectMotionHandler));
router.post('/finalize', asyncHandler(finalizeHandler));
router.get('/session/active', asyncHandler(getActiveSessionHandler)); // For resume flow
```

#### ConvergenceService

The main orchestrator service coordinating all convergence operations.

```typescript
interface ConvergenceServiceDeps {
  imageGenerationService: ImageGenerationService;
  depthEstimationService: DepthEstimationService;
  sessionStore: SessionStore;
  promptBuilder: PromptBuilderService;
  creditsService: CreditsService;
  storageService: StorageService;
  videoPreviewService?: VideoPreviewService;
}

class ConvergenceService {
  constructor(deps: ConvergenceServiceDeps);
  
  // Session lifecycle - userId from auth middleware (Requirement 1.8)
  startSession(request: StartSessionRequest, userId: string): Promise<StartSessionResponse>;
  getSession(sessionId: string): Promise<ConvergenceSession | null>;
  getActiveSession(userId: string): Promise<ConvergenceSession | null>; // For resume flow (Requirement 1.6)
  finalizeSession(sessionId: string, userId: string): Promise<FinalizeSessionResponse>;
  
  // Dimension selection
  selectOption(request: SelectOptionRequest, userId: string): Promise<SelectOptionResponse>;
  regenerate(request: RegenerateRequest, userId: string): Promise<RegenerateResponse>;
  
  // Camera motion
  generateCameraMotion(request: GenerateCameraMotionRequest, userId: string): Promise<GenerateCameraMotionResponse>;
  selectCameraMotion(request: SelectCameraMotionRequest, userId: string): Promise<void>;
  
  // Subject motion
  generateSubjectMotion(request: GenerateSubjectMotionRequest, userId: string): Promise<GenerateSubjectMotionResponse>;
  
  // Credit reservation pattern (Requirement 15.6)
  private async withCreditReservation<T>(
    userId: string,
    creditAmount: number,
    operation: () => Promise<T>
  ): Promise<T> {
    const reservation = await this.creditsService.reserve(userId, creditAmount);
    try {
      const result = await operation();
      await this.creditsService.commit(reservation.id);
      return result;
    } catch (error) {
      await this.creditsService.refund(reservation.id);
      throw error;
    }
  }
  
  // Image generation with GCS persistence (Requirement 1.7)
  private async generateAndPersistImages(
    prompts: Array<{ prompt: string; dimension: string; optionId: string }>,
    userId: string
  ): Promise<GeneratedImage[]> {
    // Generate images with retry
    const tempUrls = await Promise.all(
      prompts.map(p => withRetry(() => this.imageGenerationService.generatePreview(p.prompt)))
    );
    
    // Upload to GCS for permanent storage
    const permanentUrls = await this.storageService.uploadBatch(
      tempUrls.map(r => r.imageUrl),
      `convergence/${userId}`
    );
    
    return permanentUrls.map((url, i) => ({
      id: uuidv4(),
      url,
      dimension: prompts[i].dimension,
      optionId: prompts[i].optionId,
      prompt: prompts[i].prompt,
      generatedAt: new Date(),
    }));
  }
}
```

#### startSession Implementation

```typescript
async startSession(request: StartSessionRequest, userId: string): Promise<StartSessionResponse> {
  // Check for existing active session (Requirement 1.10-1.11)
  const existing = await this.sessionStore.getActiveByUserId(userId);
  if (existing) {
    throw new ConvergenceError('ACTIVE_SESSION_EXISTS', { sessionId: existing.id });
  }
  
  const sessionId = uuidv4();
  
  // Create session first
  const session: ConvergenceSession = {
    id: sessionId,
    userId,
    intent: request.intent,
    direction: null,
    lockedDimensions: [],
    currentStep: 'direction',
    generatedImages: [],
    imageHistory: {},
    regenerationCounts: {},
    depthMapUrl: null,
    cameraMotion: null,
    subjectMotion: null,
    finalPrompt: null,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  await this.sessionStore.create(session);
  
  // Generate direction images with credit reservation
  const directionPrompts = this.promptBuilder.buildDirectionPrompts(request.intent);
  const estimatedCost = DIRECTION_IMAGE_COST * 4;
  
  const images = await this.withCreditReservation(userId, estimatedCost, async () => {
    return this.generateAndPersistImages(
      directionPrompts.map(d => ({
        prompt: d.prompt,
        dimension: 'direction',
        optionId: d.direction,
      })),
      userId
    );
  });
  
  // Update session with images
  await this.sessionStore.update(sessionId, { 
    generatedImages: images,
    imageHistory: { direction: images },
  });
  
  return {
    sessionId,
    images,
    currentDimension: 'direction',
    options: DIRECTION_OPTIONS,
    estimatedCost,
  };
}
```


#### SessionStore

Repository for Firestore persistence of convergence sessions.

```typescript
class SessionStore {
  create(session: ConvergenceSession): Promise<void>;
  get(sessionId: string): Promise<ConvergenceSession | null>;
  update(sessionId: string, updates: Partial<ConvergenceSession>): Promise<void>;
  delete(sessionId: string): Promise<void>;
  getByUserId(userId: string, limit?: number): Promise<ConvergenceSession[]>;
  getActiveByUserId(userId: string): Promise<ConvergenceSession | null>; // For single session check
  cleanupExpired(): Promise<number>;
}
```

#### PromptBuilderService

Constructs prompts from dimension selections using fragment library.

```typescript
interface PromptBuildOptions {
  intent: string;
  direction: Direction;
  lockedDimensions: LockedDimension[];
  subjectMotion?: string;
}

class PromptBuilderService {
  buildPrompt(options: PromptBuildOptions): string;
  buildDimensionPreviewPrompt(
    intent: string,
    direction: Direction,
    lockedDimensions: LockedDimension[],
    previewDimension: { type: string; optionId: string; fragments: string[] }
  ): string;
  buildDirectionPrompts(intent: string): Array<{ direction: Direction; prompt: string }>;
}
```

#### DepthEstimationService

Integrates with Replicate API for Depth Anything v2.

```typescript
class DepthEstimationService {
  estimateDepth(imageUrl: string): Promise<string>;
  isAvailable(): boolean;
}
```

### Frontend Components

#### useConvergenceSession Hook

State management using useReducer pattern with AbortController support.

```typescript
interface ConvergenceState {
  sessionId: string | null;
  step: ConvergenceStep;
  intent: string;
  direction: Direction | null;
  lockedDimensions: LockedDimension[];
  currentImages: GeneratedImage[];
  currentOptions: Array<{ id: string; label: string }>;
  depthMapUrl: string | null;
  cameraPaths: CameraPath[];
  selectedCameraMotion: string | null;
  subjectMotion: string;
  subjectMotionVideoUrl: string | null;
  finalPrompt: string | null;
  isLoading: boolean;
  // More granular loading operation types (Requirement 9.7)
  loadingOperation: 'startSession' | 'selectOption' | 'regenerate' | 'depthEstimation' | 'videoPreview' | 'finalize' | null;
  error: string | null;
  regenerationCounts: Map<DimensionType | 'direction', number>;
  imageHistory: Map<DimensionType | 'direction', GeneratedImage[]>;
  // AbortController for cancellation support (Requirement 10.5)
  abortController: AbortController | null;
  // Resume prompt state (Requirement 1.6)
  pendingResumeSession: ConvergenceSession | null;
  // Fallback mode for depth estimation failure (Requirement 5.5)
  cameraMotionFallbackMode: boolean;
  // Focused option for keyboard navigation (Requirement 12.5-12.6)
  focusedOptionIndex: number;
}

interface ConvergenceActions {
  setIntent(intent: string): void;
  startSession(intent: string): Promise<void>;
  selectOption(dimension: DimensionType | 'direction', optionId: string): Promise<void>;
  regenerate(): Promise<void>;
  goBack(): void;
  jumpToStep(step: ConvergenceStep): void;
  selectCameraMotion(motionId: string): Promise<void>;
  setSubjectMotion(motion: string): void;
  generateSubjectMotionPreview(): Promise<void>;
  skipSubjectMotion(): void;
  finalize(): Promise<FinalizeResponse | null>;
  reset(): void;
  cancelGeneration(): void;
  // Resume flow actions (Requirement 1.6)
  resumeSession(): void;
  abandonAndStartFresh(): Promise<void>;
  // Keyboard navigation (Requirement 12.5-12.6)
  moveFocus(direction: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'): void;
  selectFocused(): void;
}

function useConvergenceSession(): {
  state: ConvergenceState;
  actions: ConvergenceActions;
};
```

#### Action Implementations with AbortController

```typescript
// startSession with AbortController (Requirement 10.5)
async startSession(intent: string): Promise<void> {
  const controller = new AbortController();
  dispatch({ type: 'SET_ABORT_CONTROLLER', payload: controller });
  dispatch({ type: 'START_SESSION_REQUEST' });
  
  try {
    const result = await convergenceApi.startSession(intent, controller.signal);
    dispatch({ type: 'START_SESSION_SUCCESS', payload: result });
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      dispatch({ type: 'CANCEL_GENERATION' });
      return;
    }
    dispatch({ type: 'START_SESSION_FAILURE', payload: (e as Error).message });
  }
}

// selectOption with image history restoration (Requirement 13.5)
async selectOption(dimension: DimensionType | 'direction', optionId: string): Promise<void> {
  const previousSelection = state.lockedDimensions.find(d => d.type === dimension);
  
  // Same option selected - restore from cache, no API call, no credits charged (Requirement 15.8)
  if (previousSelection?.optionId === optionId) {
    const nextDimension = getNextDimension(dimension);
    const cachedImages = state.imageHistory.get(nextDimension);
    if (cachedImages) {
      dispatch({ type: 'RESTORE_CACHED_IMAGES', payload: { dimension: nextDimension, images: cachedImages } });
      return;
    }
  }
  
  // Different option - call API
  const controller = new AbortController();
  dispatch({ type: 'SET_ABORT_CONTROLLER', payload: controller });
  dispatch({ type: 'SELECT_OPTION_REQUEST' });
  
  try {
    const result = await convergenceApi.selectOption(state.sessionId!, dimension, optionId, controller.signal);
    dispatch({ type: 'SELECT_OPTION_SUCCESS', payload: result });
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      dispatch({ type: 'CANCEL_GENERATION' });
      return;
    }
    dispatch({ type: 'SELECT_OPTION_FAILURE', payload: (e as Error).message });
  }
}

// cancelGeneration (Requirement 10.5, 13.7)
cancelGeneration(): void {
  state.abortController?.abort();
  dispatch({ type: 'CANCEL_GENERATION' });
}

// jumpToStep - client-side only, syncs on next action (Requirement 18.5)
jumpToStep(step: ConvergenceStep): void {
  const stepOrder = getStepOrder(step);
  const newLocked = state.lockedDimensions.filter(d => 
    getDimensionOrder(d.type) < stepOrder
  );
  dispatch({ type: 'JUMP_TO_STEP', payload: { step, lockedDimensions: newLocked } });
  // No API call - session updated on next selectOption
}
```


#### convergenceApi

Centralized API layer with AbortController support.

```typescript
const convergenceApi = {
  startSession(intent: string, signal?: AbortSignal): Promise<StartSessionResponse>;
  selectOption(sessionId: string, dimension: string, optionId: string, signal?: AbortSignal): Promise<SelectOptionResponse>;
  regenerate(sessionId: string, dimension: string, signal?: AbortSignal): Promise<RegenerateResponse>;
  generateCameraMotion(sessionId: string, signal?: AbortSignal): Promise<CameraMotionResponse>;
  selectCameraMotion(sessionId: string, cameraMotionId: string): Promise<void>;
  generateSubjectMotion(sessionId: string, subjectMotion: string, signal?: AbortSignal): Promise<SubjectMotionResponse>;
  finalize(sessionId: string): Promise<FinalizeResponse>;
  getSession(sessionId: string): Promise<ConvergenceSession>;
  // For resume flow (Requirement 1.6)
  getActiveSession(): Promise<ConvergenceSession | null>;
};
```

#### cameraMotionRenderer

Three.js utility for depth-based parallax rendering.

```typescript
interface RenderOptions {
  width?: number;
  height?: number;
  fps?: number;
  displacementScale?: number;
}

function renderCameraMotionFrames(
  imageUrl: string,
  depthMapUrl: string,
  cameraPath: CameraPath,
  options?: RenderOptions
): Promise<string[]>;

function createFrameAnimator(
  frames: string[],
  fps: number,
  onFrame: (frameDataUrl: string) => void
): {
  start(): void;
  stop(): void;
  isPlaying(): boolean;
};
```

### Component Hierarchy with Keyboard Navigation

```
ConvergenceFlow (orchestrator)
├── useEffect: checkExistingSession on mount (Requirement 1.6)
├── useEffect: keyboard navigation handler (Requirement 12.5-12.6)
│   └── handleKeyDown: Enter, Escape, Arrow keys
├── ResumeSessionModal (if pendingResumeSession)
│   ├── ResumeButton
│   └── StartFreshButton
├── ProgressIndicator
│   └── StepButton (clickable for completed steps - Requirement 18.5)
├── IntentInput (step: intent)
│   ├── TextInput
│   └── ExamplePrompts
├── DirectionFork (step: direction)
│   ├── ImageOption x4 (with focus ring for keyboard nav)
│   └── RegenerateButton
├── DimensionSelector (steps: mood, framing, lighting)
│   ├── ImageOption x4 (with focus ring for keyboard nav)
│   ├── RegenerateButton
│   └── BackButton
├── CameraMotionPicker (step: camera_motion)
│   ├── CameraMotionOption x6+ (with focus ring)
│   │   └── FrameAnimator (Three.js rendered) OR TextLabel (fallbackMode)
│   └── BackButton
├── SubjectMotionInput (step: subject_motion)
│   ├── TextInput
│   ├── GeneratePreviewButton
│   ├── SkipButton
│   ├── VideoPlayer (if preview generated)
│   └── BackButton
└── ConvergencePreview (step: preview)
    ├── VideoPlayer
    ├── PromptDisplay
    ├── DimensionSummary
    ├── GenerateNowButton
    ├── EditInStudioButton
    └── CreditCostDisplay
```

#### Keyboard Navigation Implementation

```typescript
// In ConvergenceFlow (Requirement 12.5-12.6)
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Don't handle if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    
    switch (e.key) {
      case 'Escape':
        actions.goBack();
        break;
      case 'Enter':
        actions.selectFocused();
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
        e.preventDefault();
        actions.moveFocus(e.key);
        break;
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [state.step, actions]);
```

#### Resume Session Flow

```typescript
// In ConvergenceFlow mount (Requirement 1.6)
useEffect(() => {
  const checkExistingSession = async () => {
    try {
      const session = await convergenceApi.getActiveSession();
      if (session && session.status === 'active') {
        dispatch({ type: 'PROMPT_RESUME', payload: session });
      }
    } catch (e) {
      // No active session or error, continue to IntentInput
      console.debug('No active session to resume');
    }
  };
  
  checkExistingSession();
}, []);

// ResumeSessionModal component
function ResumeSessionModal({ session, onResume, onStartFresh }) {
  return (
    <Modal>
      <h2>Resume your session?</h2>
      <p>You have an incomplete session from {formatDate(session.updatedAt)}</p>
      <p>Intent: "{session.intent}"</p>
      <Button onClick={onResume}>Resume</Button>
      <Button variant="secondary" onClick={onStartFresh}>Start Fresh</Button>
    </Modal>
  );
}
```


## Data Models

### Firestore Schema: convergence_sessions

```typescript
interface ConvergenceSessionDocument {
  id: string;                           // UUID v4
  userId: string;                       // Firebase Auth UID
  intent: string;                       // Original user input
  direction: Direction | null;          // 'cinematic' | 'social' | 'artistic' | 'documentary'
  lockedDimensions: LockedDimension[];  // Array of locked selections
  currentStep: ConvergenceStep;         // Current step in flow (renamed from currentDimension for clarity)
  generatedImages: GeneratedImage[];    // All generated images (GCS URLs)
  imageHistory: Record<string, GeneratedImage[]>; // Images per dimension for back nav (Requirement 13.5)
  regenerationCounts: Record<string, number>;     // Regen count per dimension (Requirement 14.4)
  depthMapUrl: string | null;           // GCS URL to depth map
  cameraMotion: string | null;          // Selected camera motion ID
  subjectMotion: string | null;         // User's subject motion text
  finalPrompt: string | null;           // Complete generated prompt
  status: 'active' | 'completed' | 'abandoned';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface LockedDimension {
  type: DimensionType;
  optionId: string;
  label: string;
  promptFragments: string[];
}

interface GeneratedImage {
  id: string;
  url: string;                          // GCS URL (permanent)
  dimension: DimensionType | 'direction';
  optionId: string;
  prompt: string;
  generatedAt: Timestamp;
}
```

### Firestore Indexes

```
convergence_sessions:
  - userId ASC, status ASC, updatedAt DESC  (for getActiveByUserId, getByUserId)
  - updatedAt ASC, status ASC               (for cleanupExpired)
```

### Type Definitions

```typescript
type Direction = 'cinematic' | 'social' | 'artistic' | 'documentary';

type DimensionType = 'mood' | 'framing' | 'lighting' | 'camera_motion';

type ConvergenceStep = 
  | 'intent'
  | 'direction'
  | 'mood'
  | 'framing'
  | 'lighting'
  | 'camera_motion'
  | 'subject_motion'
  | 'preview'
  | 'complete';

interface CameraPath {
  id: string;
  label: string;
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  duration: number;
}

interface DimensionOption {
  id: string;
  label: string;
  promptFragments: string[];
}

interface DimensionConfig {
  type: DimensionType;
  options: DimensionOption[];
}
```

### Dimension Fragment Data

```typescript
// Direction fragments
const DIRECTION_FRAGMENTS: Record<Direction, string[]> = {
  cinematic: ['cinematic composition', 'film-like quality', 'dramatic framing', 'movie production value', 'anamorphic lens feel'],
  social: ['social media ready', 'vibrant and engaging', 'eye-catching composition', 'scroll-stopping visual', 'high energy aesthetic'],
  artistic: ['artistic interpretation', 'creative visual style', 'expressive composition', 'aesthetic focus', 'painterly quality'],
  documentary: ['documentary style', 'naturalistic look', 'authentic atmosphere', 'observational framing', 'raw realism'],
};

// Mood options (4 options, 5 fragments each)
const MOOD_DIMENSION: DimensionConfig = {
  type: 'mood',
  options: [
    { id: 'dramatic', label: 'Dramatic', promptFragments: ['high contrast lighting', 'deep shadows', 'intense atmosphere', 'dramatic tension', 'bold visual statement'] },
    { id: 'peaceful', label: 'Peaceful', promptFragments: ['soft diffused light', 'gentle color palette', 'serene atmosphere', 'tranquil mood', 'calming visual tone'] },
    { id: 'mysterious', label: 'Mysterious', promptFragments: ['atmospheric haze', 'obscured details', 'enigmatic mood', 'subtle shadows', 'intriguing composition'] },
    { id: 'nostalgic', label: 'Nostalgic', promptFragments: ['warm vintage tones', 'soft focus edges', 'memory-like quality', 'wistful atmosphere', 'timeless feel'] },
  ],
};

// Framing options
const FRAMING_DIMENSION: DimensionConfig = {
  type: 'framing',
  options: [
    { id: 'wide', label: 'Wide Shot', promptFragments: ['wide establishing shot', 'environment visible', 'subject in context', 'expansive framing', 'full scene coverage'] },
    { id: 'medium', label: 'Medium Shot', promptFragments: ['medium shot framing', 'waist-up framing', 'balanced composition', 'conversational distance', 'natural perspective'] },
    { id: 'closeup', label: 'Close-up', promptFragments: ['intimate close-up shot', 'shallow depth of field', 'face fills frame', 'detailed features visible', 'emotional proximity'] },
    { id: 'extreme_closeup', label: 'Extreme Close-up', promptFragments: ['extreme close-up detail', 'macro-like framing', 'texture emphasis', 'ultra shallow focus', 'abstract detail shot'] },
  ],
};

// Lighting options
const LIGHTING_DIMENSION: DimensionConfig = {
  type: 'lighting',
  options: [
    { id: 'golden_hour', label: 'Golden Hour', promptFragments: ['warm golden hour sunlight', 'long shadows', 'orange and amber tones', 'soft directional light', 'magic hour glow'] },
    { id: 'blue_hour', label: 'Blue Hour', promptFragments: ['cool blue hour light', 'twilight atmosphere', 'soft ambient illumination', 'blue and purple tones', 'ethereal dusk lighting'] },
    { id: 'high_key', label: 'High Key', promptFragments: ['bright high-key lighting', 'minimal shadows', 'clean bright aesthetic', 'even illumination', 'airy light quality'] },
    { id: 'low_key', label: 'Low Key', promptFragments: ['dramatic low-key lighting', 'deep blacks', 'selective illumination', 'chiaroscuro effect', 'moody shadow play'] },
  ],
};

// Camera motion options
const CAMERA_MOTION_DIMENSION: DimensionConfig = {
  type: 'camera_motion',
  options: [
    { id: 'static', label: 'Static', promptFragments: ['locked off camera', 'stable tripod shot', 'no camera movement'] },
    { id: 'pan_left', label: 'Pan Left', promptFragments: ['camera pans left', 'horizontal pan movement', 'smooth lateral tracking'] },
    { id: 'pan_right', label: 'Pan Right', promptFragments: ['camera pans right', 'horizontal pan movement', 'smooth lateral tracking'] },
    { id: 'push_in', label: 'Push In', promptFragments: ['camera pushes in slowly', 'dolly forward movement', 'increasing intimacy'] },
    { id: 'pull_back', label: 'Pull Back', promptFragments: ['camera pulls back', 'dolly backward movement', 'revealing wider context'] },
    { id: 'crane_up', label: 'Crane Up', promptFragments: ['camera cranes upward', 'vertical ascending movement', 'elevated perspective reveal'] },
  ],
};

// Camera paths for Three.js rendering
const CAMERA_PATHS: CameraPath[] = [
  { id: 'static', label: 'Static', start: { x: 0, y: 0, z: 0 }, end: { x: 0, y: 0, z: 0 }, duration: 3 },
  { id: 'pan_left', label: 'Pan Left', start: { x: 0.15, y: 0, z: 0 }, end: { x: -0.15, y: 0, z: 0 }, duration: 3 },
  { id: 'pan_right', label: 'Pan Right', start: { x: -0.15, y: 0, z: 0 }, end: { x: 0.15, y: 0, z: 0 }, duration: 3 },
  { id: 'push_in', label: 'Push In', start: { x: 0, y: 0, z: -0.1 }, end: { x: 0, y: 0, z: 0.25 }, duration: 3 },
  { id: 'pull_back', label: 'Pull Back', start: { x: 0, y: 0, z: 0.2 }, end: { x: 0, y: 0, z: -0.15 }, duration: 3 },
  { id: 'crane_up', label: 'Crane Up', start: { x: 0, y: -0.1, z: 0 }, end: { x: 0, y: 0.15, z: 0.05 }, duration: 3 },
];
```


### API Request/Response Types

```typescript
// Start Session
interface StartSessionRequest {
  intent: string;
}

interface StartSessionResponse {
  sessionId: string;
  images: GeneratedImage[];
  currentDimension: 'direction';
  options: Array<{ id: Direction; label: string }>;
  estimatedCost: number;
}

// Select Option
interface SelectOptionRequest {
  sessionId: string;
  dimension: DimensionType | 'direction';
  optionId: string;
}

interface SelectOptionResponse {
  sessionId: string;
  images: GeneratedImage[];
  currentDimension: DimensionType | 'camera_motion' | 'subject_motion';
  lockedDimensions: LockedDimension[];
  options?: Array<{ id: string; label: string }>;
  creditsConsumed: number;
}

// Regenerate
interface RegenerateRequest {
  sessionId: string;
  dimension: DimensionType | 'direction';
}

interface RegenerateResponse {
  sessionId: string;
  images: GeneratedImage[];
  remainingRegenerations: number;
  creditsConsumed: number;
}

// Camera Motion (with fallback mode indicator - Requirement 5.5)
interface GenerateCameraMotionRequest {
  sessionId: string;
}

interface GenerateCameraMotionResponse {
  sessionId: string;
  depthMapUrl: string | null;  // null when fallbackMode is true
  cameraPaths: CameraPath[];
  fallbackMode: boolean;       // true if depth estimation failed
  creditsConsumed: number;
}

interface SelectCameraMotionRequest {
  sessionId: string;
  cameraMotionId: string;
}

// Subject Motion
interface GenerateSubjectMotionRequest {
  sessionId: string;
  subjectMotion: string;
}

interface GenerateSubjectMotionResponse {
  sessionId: string;
  videoUrl: string;
  prompt: string;
  creditsConsumed: number;
}

// Finalize
interface FinalizeSessionResponse {
  sessionId: string;
  finalPrompt: string;
  lockedDimensions: LockedDimension[];
  previewImageUrl: string;
  cameraMotion: string;
  subjectMotion: string;
  totalCreditsConsumed: number;
  generationCosts: Record<string, number>; // model -> cost
}
```

## Correctness Properties

### Property 1: Session Uniqueness
For any user, at most one active convergence session exists at any time.

```typescript
// Property: Single active session per user
forAll(userId: string, sessions: ConvergenceSession[]) {
  const activeSessions = sessions.filter(s => s.userId === userId && s.status === 'active');
  return activeSessions.length <= 1;
}
```

### Property 2: Credit Reservation Consistency
Credits reserved for an operation are either committed on success or refunded on failure, never lost.

```typescript
// Property: Credit reservation is atomic
forAll(reservation: CreditReservation, operation: () => Promise<T>) {
  const initialBalance = getBalance(reservation.userId);
  try {
    await operation();
    // Success: credits committed
    return getBalance(reservation.userId) === initialBalance - reservation.amount;
  } catch {
    // Failure: credits refunded
    return getBalance(reservation.userId) === initialBalance;
  }
}
```

### Property 3: Image Persistence
All generated images are stored in GCS before being referenced in session state.

```typescript
// Property: Images are persisted before session update
forAll(session: ConvergenceSession) {
  return session.generatedImages.every(img => 
    img.url.startsWith('https://storage.googleapis.com/')
  );
}
```

### Property 4: Dimension Order Invariant
Locked dimensions always follow the defined order: direction → mood → framing → lighting → camera_motion.

```typescript
// Property: Dimension order is preserved
forAll(session: ConvergenceSession) {
  const order = ['direction', 'mood', 'framing', 'lighting', 'camera_motion'];
  const lockedTypes = session.lockedDimensions.map(d => d.type);
  return lockedTypes.every((type, i) => 
    i === 0 || order.indexOf(type) > order.indexOf(lockedTypes[i - 1])
  );
}
```

### Property 5: Regeneration Limit
No dimension can be regenerated more than 3 times per session.

```typescript
// Property: Regeneration limit enforced
forAll(session: ConvergenceSession, dimension: DimensionType | 'direction') {
  return (session.regenerationCounts[dimension] ?? 0) <= 3;
}
```

### Property 6: Authentication Invariant
All convergence API operations require a valid authenticated user.

```typescript
// Property: All operations have userId
forAll(request: ConvergenceRequest, handler: RequestHandler) {
  return request.userId !== undefined && request.userId !== null;
}
```


## Tool Panel Integration Architecture

### AppShell Context (Requirements 16-17)

```typescript
// Shared context for tool switching (Requirement 16.6, 17.6)
interface AppShellContextValue {
  activeTool: 'create' | 'studio';
  setActiveTool: (tool: 'create' | 'studio') => void;
  convergenceHandoff: ConvergenceHandoff | null;
  setConvergenceHandoff: (handoff: ConvergenceHandoff | null) => void;
}

interface ConvergenceHandoff {
  prompt: string;
  lockedDimensions: LockedDimension[];
  previewImageUrl: string;
  cameraMotion: string;
  subjectMotion: string;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) throw new Error('useAppShell must be used within AppShellProvider');
  return context;
}
```

### AppShell Component

```typescript
// In AppShell.tsx (Requirement 16.1-16.6)
function AppShell() {
  const [activeTool, setActiveTool] = useState<'create' | 'studio'>('studio');
  const [convergenceHandoff, setConvergenceHandoff] = useState<ConvergenceHandoff | null>(null);
  
  // Warn before switching tools during generation (Requirement 17.7)
  const handleToolChange = (tool: 'create' | 'studio') => {
    if (isGenerating && tool !== activeTool) {
      const confirmed = window.confirm('Generation in progress. Switch tools anyway?');
      if (!confirmed) return;
    }
    setActiveTool(tool);
  };
  
  return (
    <AppShellContext.Provider value={{ activeTool, setActiveTool: handleToolChange, convergenceHandoff, setConvergenceHandoff }}>
      <div className="flex h-screen">
        {/* Left tool panel (Requirement 16.1-16.4) */}
        <ToolPanel activeTool={activeTool} onToolChange={handleToolChange} />
        
        {/* Main workspace - renders at / based on active selection (Requirement 16.6) */}
        <MainWorkspace>
          {activeTool === 'create' ? (
            <ConvergenceFlow />
          ) : (
            <Studio handoff={convergenceHandoff} />
          )}
        </MainWorkspace>
        
        {/* Shared bottom control bar (Requirement 16.5) */}
        <BottomControlBar />
      </div>
    </AppShellContext.Provider>
  );
}
```

### ToolPanel Component

```typescript
// ToolPanel.tsx (Requirement 16.1-16.4)
function ToolPanel({ activeTool, onToolChange }: ToolPanelProps) {
  return (
    <div className="w-14 bg-gray-900 flex flex-col items-center py-4 gap-2">
      {/* Create icon - above Studio (Requirement 16.1) */}
      <ToolButton
        icon={<SparklesIcon />}
        label="Create"
        isActive={activeTool === 'create'}
        onClick={() => onToolChange('create')}
      />
      
      {/* Studio icon - renamed from "Tool" (Requirement 16.2) */}
      <ToolButton
        icon={<PencilIcon />}
        label="Studio"
        isActive={activeTool === 'studio'}
        onClick={() => onToolChange('studio')}
      />
      
      {/* Other existing tools... */}
    </div>
  );
}
```

### Edit in Studio Handoff (Requirement 17.2-17.3)

```typescript
// In ConvergencePreview component
function ConvergencePreview({ finalizeResponse }: ConvergencePreviewProps) {
  const { setActiveTool, setConvergenceHandoff } = useAppShell();
  
  const handleEditInStudio = () => {
    // Pass data via shared React context (Requirement 17.6)
    setConvergenceHandoff({
      prompt: finalizeResponse.finalPrompt,
      lockedDimensions: finalizeResponse.lockedDimensions,
      previewImageUrl: finalizeResponse.previewImageUrl,
      cameraMotion: finalizeResponse.cameraMotion,
      subjectMotion: finalizeResponse.subjectMotion,
    });
    setActiveTool('studio');
  };
  
  return (
    // ...
    <Button onClick={handleEditInStudio}>Edit in Studio</Button>
    // ...
  );
}

// In Studio component - receive handoff
function Studio({ handoff }: { handoff: ConvergenceHandoff | null }) {
  const [prompt, setPrompt] = useState('');
  
  // Pre-fill prompt from convergence handoff (Requirement 17.2)
  useEffect(() => {
    if (handoff) {
      setPrompt(handoff.prompt);
      // Optionally show locked dimensions as reference (Requirement 17.3)
    }
  }, [handoff]);
  
  // ...
}
```

## Additional Backend Services

### StorageService Interface

```typescript
interface StorageService {
  /**
   * Upload a single image from temporary URL to GCS
   * @param tempUrl Temporary Replicate URL
   * @param destination GCS path (e.g., "convergence/userId123/image.jpg")
   * @returns Permanent GCS URL
   */
  upload(tempUrl: string, destination: string): Promise<string>;
  
  /**
   * Upload multiple images in parallel
   * @param tempUrls Array of temporary Replicate URLs
   * @param destinationPrefix GCS path prefix (e.g., "convergence/userId123")
   * @returns Array of permanent GCS URLs in same order
   */
  uploadBatch(tempUrls: string[], destinationPrefix: string): Promise<string[]>;
  
  /**
   * Delete images (for cleanup on session abandonment)
   */
  delete(gcsUrls: string[]): Promise<void>;
}

class GCSStorageService implements StorageService {
  constructor(private bucket: Bucket) {}
  
  async upload(tempUrl: string, destination: string): Promise<string> {
    const response = await fetch(tempUrl);
    const buffer = await response.arrayBuffer();
    
    const file = this.bucket.file(destination);
    await file.save(Buffer.from(buffer), {
      contentType: 'image/png',
      public: true,
    });
    
    return `https://storage.googleapis.com/${this.bucket.name}/${destination}`;
  }
  
  async uploadBatch(tempUrls: string[], destinationPrefix: string): Promise<string[]> {
    return Promise.all(
      tempUrls.map((url, i) => 
        this.upload(url, `${destinationPrefix}/${uuidv4()}.png`)
      )
    );
  }
  
  async delete(gcsUrls: string[]): Promise<void> {
    await Promise.all(
      gcsUrls.map(url => {
        const path = url.replace(`https://storage.googleapis.com/${this.bucket.name}/`, '');
        return this.bucket.file(path).delete().catch(() => {}); // Ignore if already deleted
      })
    );
  }
}
```

## Credit Cost Constants

```typescript
// Credit costs for convergence operations
const CONVERGENCE_COSTS = {
  DIRECTION_IMAGES: 4,        // 4 images × 1 credit each
  DIMENSION_IMAGES: 4,        // 4 images × 1 credit each
  DEPTH_ESTIMATION: 1,        // Depth Anything v2
  WAN_PREVIEW: 5,             // Wan 2.2 video preview
  REGENERATION: 4,            // Same as dimension images
  
  // Estimated total for full flow (without regenerations)
  ESTIMATED_TOTAL: 4 + 4 + 4 + 4 + 1 + 5, // 22 credits
} as const;

// Final generation costs (from existing model pricing)
const GENERATION_COSTS: Record<string, number> = {
  'sora-2': 80,
  'veo-3': 30,
  'kling-v2.1': 35,
  'luma-ray-3': 40,
  'wan-2.2': 15,
  'runway-gen4': 50,
};

// Get cost for current step
function getStepCost(step: ConvergenceStep): number {
  switch (step) {
    case 'direction':
    case 'mood':
    case 'framing':
    case 'lighting':
      return CONVERGENCE_COSTS.DIMENSION_IMAGES;
    case 'camera_motion':
      return CONVERGENCE_COSTS.DEPTH_ESTIMATION;
    case 'subject_motion':
      return CONVERGENCE_COSTS.WAN_PREVIEW;
    default:
      return 0;
  }
}
```


## Finalization Validation

```typescript
// In ConvergenceService.finalizeSession (Requirement 8.3-8.4)
async finalizeSession(sessionId: string, userId: string): Promise<FinalizeSessionResponse> {
  const session = await this.sessionStore.get(sessionId);
  
  if (!session) {
    throw new ConvergenceError('SESSION_NOT_FOUND');
  }
  if (session.userId !== userId) {
    throw new ConvergenceError('UNAUTHORIZED');
  }
  
  // Validate required selections (Requirement 8.3)
  const requiredDimensions: DimensionType[] = ['mood', 'framing', 'lighting', 'camera_motion'];
  const lockedTypes = new Set(session.lockedDimensions.map(d => d.type));
  
  const missing: string[] = [];
  if (!session.direction) missing.push('direction');
  for (const dim of requiredDimensions) {
    if (!lockedTypes.has(dim)) missing.push(dim);
  }
  if (!session.cameraMotion) missing.push('camera_motion');
  
  if (missing.length > 0) {
    throw new ConvergenceError('INCOMPLETE_SESSION', { missingDimensions: missing });
  }
  
  // Build final prompt
  const finalPrompt = this.promptBuilder.buildPrompt({
    intent: session.intent,
    direction: session.direction!,
    lockedDimensions: session.lockedDimensions,
    subjectMotion: session.subjectMotion || undefined,
  });
  
  // Mark session as completed
  await this.sessionStore.update(sessionId, {
    status: 'completed',
    finalPrompt,
  });
  
  // Get the preview image URL
  const lastImage = session.generatedImages[session.generatedImages.length - 1];
  
  // Calculate total credits consumed
  const totalCreditsConsumed = this.calculateTotalCredits(session);
  
  return {
    sessionId,
    finalPrompt,
    lockedDimensions: session.lockedDimensions,
    previewImageUrl: lastImage?.url ?? '',
    cameraMotion: session.cameraMotion!,
    subjectMotion: session.subjectMotion ?? '',
    totalCreditsConsumed,
    generationCosts: GENERATION_COSTS,
  };
}

private calculateTotalCredits(session: ConvergenceSession): number {
  let total = CONVERGENCE_COSTS.DIRECTION_IMAGES; // Initial direction images
  
  // Add dimension image costs
  const dimensionSteps = ['mood', 'framing', 'lighting'];
  total += dimensionSteps.length * CONVERGENCE_COSTS.DIMENSION_IMAGES;
  
  // Add depth estimation if used
  if (session.depthMapUrl) {
    total += CONVERGENCE_COSTS.DEPTH_ESTIMATION;
  }
  
  // Add Wan preview if used
  if (session.subjectMotion) {
    total += CONVERGENCE_COSTS.WAN_PREVIEW;
  }
  
  // Add regeneration costs
  const regenCounts = session.regenerationCounts || {};
  for (const count of Object.values(regenCounts)) {
    total += count * CONVERGENCE_COSTS.REGENERATION;
  }
  
  return total;
}
```

## Insufficient Credits Flow (Requirement 15.5)

### State Extension

```typescript
interface ConvergenceState {
  // ... existing fields
  
  // Insufficient credits modal state
  insufficientCreditsModal: {
    isOpen: boolean;
    required: number;
    available: number;
    operation: string;
  } | null;
}
```

### Error Handling in Actions

```typescript
// In useConvergenceSession error handling
function handleApiError(error: Error, dispatch: Dispatch<ConvergenceAction>) {
  if (error instanceof ConvergenceError) {
    switch (error.code) {
      case 'INSUFFICIENT_CREDITS':
        dispatch({
          type: 'SHOW_CREDITS_MODAL',
          payload: {
            required: error.details?.required as number,
            available: error.details?.available as number,
          },
        });
        return; // Don't dispatch failure, show modal instead
        
      case 'ACTIVE_SESSION_EXISTS':
        dispatch({
          type: 'PROMPT_RESUME',
          payload: error.details?.existingSession as ConvergenceSession,
        });
        return;
        
      // ... other error codes
    }
  }
  
  // Generic error
  dispatch({ type: 'GENERIC_ERROR', payload: error.message });
}
```

### InsufficientCreditsModal Component

```typescript
function InsufficientCreditsModal({ 
  isOpen, 
  required, 
  available, 
  onClose,
  onPurchase 
}: InsufficientCreditsModalProps) {
  const navigate = useNavigate();
  
  if (!isOpen) return null;
  
  const handlePurchase = () => {
    onClose();
    navigate('/pricing');
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4">Insufficient Credits</h2>
        <p className="text-gray-600 mb-4">
          This operation requires <strong>{required} credits</strong>. 
          You currently have <strong>{available} credits</strong>.
        </p>
        <p className="text-gray-600 mb-6">
          You need <strong>{required - available} more credits</strong> to continue.
        </p>
        <div className="flex gap-3">
          <Button variant="primary" onClick={handlePurchase}>
            Purchase Credits
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

### Backend Credit Check

```typescript
// In ConvergenceService - check credits before reservation
private async checkCredits(userId: string, required: number): Promise<void> {
  const balance = await this.creditsService.getBalance(userId);
  if (balance < required) {
    throw new ConvergenceError('INSUFFICIENT_CREDITS', {
      required,
      available: balance,
    });
  }
}

// Usage in startSession
async startSession(request: StartSessionRequest, userId: string): Promise<StartSessionResponse> {
  // Check credits first (Requirement 15.5)
  await this.checkCredits(userId, CONVERGENCE_COSTS.DIRECTION_IMAGES);
  
  // ... rest of implementation
}
```

## Helper Functions

```typescript
// Step and dimension ordering utilities

const STEP_ORDER: ConvergenceStep[] = [
  'intent', 'direction', 'mood', 'framing', 'lighting',
  'camera_motion', 'subject_motion', 'preview', 'complete'
];

const DIMENSION_ORDER = ['direction', 'mood', 'framing', 'lighting', 'camera_motion'] as const;

function getStepOrder(step: ConvergenceStep): number {
  return STEP_ORDER.indexOf(step);
}

function getDimensionOrder(dimension: DimensionType | 'direction'): number {
  return DIMENSION_ORDER.indexOf(dimension);
}

function getNextDimension(current: DimensionType | 'direction'): DimensionType | null {
  const flow: Record<string, DimensionType> = {
    'direction': 'mood',
    'mood': 'framing',
    'framing': 'lighting',
    'lighting': 'camera_motion',
  };
  return flow[current] || null;
}

function getPreviousDimension(current: DimensionType | 'direction'): DimensionType | 'direction' | null {
  const flow: Record<string, DimensionType | 'direction'> = {
    'mood': 'direction',
    'framing': 'mood',
    'lighting': 'framing',
    'camera_motion': 'lighting',
  };
  return flow[current] || null;
}

function getNextStep(current: ConvergenceStep): ConvergenceStep {
  const idx = getStepOrder(current);
  return STEP_ORDER[idx + 1] || 'complete';
}

function getPreviousStep(current: ConvergenceStep): ConvergenceStep {
  const idx = getStepOrder(current);
  return STEP_ORDER[Math.max(0, idx - 1)];
}

function stepToDimension(step: ConvergenceStep): DimensionType | 'direction' | null {
  if (step === 'direction') return 'direction';
  if (['mood', 'framing', 'lighting', 'camera_motion'].includes(step)) {
    return step as DimensionType;
  }
  return null;
}

function dimensionToStep(dimension: DimensionType | 'direction'): ConvergenceStep {
  return dimension as ConvergenceStep;
}
```


## Reducer Action Types and Implementation

```typescript
type ConvergenceAction =
  // Intent
  | { type: 'SET_INTENT'; payload: string }
  
  // AbortController
  | { type: 'SET_ABORT_CONTROLLER'; payload: AbortController }
  
  // Start Session
  | { type: 'START_SESSION_REQUEST' }
  | { type: 'START_SESSION_SUCCESS'; payload: StartSessionResponse }
  | { type: 'START_SESSION_FAILURE'; payload: string }
  
  // Select Option
  | { type: 'SELECT_OPTION_REQUEST' }
  | { type: 'SELECT_OPTION_SUCCESS'; payload: SelectOptionResponse }
  | { type: 'SELECT_OPTION_FAILURE'; payload: string }
  | { type: 'RESTORE_CACHED_IMAGES'; payload: { dimension: DimensionType; images: GeneratedImage[] } }
  
  // Regenerate
  | { type: 'REGENERATE_REQUEST' }
  | { type: 'REGENERATE_SUCCESS'; payload: RegenerateResponse }
  | { type: 'REGENERATE_FAILURE'; payload: string }
  
  // Camera Motion
  | { type: 'CAMERA_MOTION_REQUEST' }
  | { type: 'CAMERA_MOTION_SUCCESS'; payload: GenerateCameraMotionResponse }
  | { type: 'CAMERA_MOTION_FAILURE'; payload: string }
  | { type: 'SELECT_CAMERA_MOTION'; payload: string }
  
  // Subject Motion
  | { type: 'SET_SUBJECT_MOTION'; payload: string }
  | { type: 'SUBJECT_MOTION_PREVIEW_REQUEST' }
  | { type: 'SUBJECT_MOTION_PREVIEW_SUCCESS'; payload: GenerateSubjectMotionResponse }
  | { type: 'SUBJECT_MOTION_PREVIEW_FAILURE'; payload: string }
  | { type: 'SKIP_SUBJECT_MOTION' }
  
  // Finalize
  | { type: 'FINALIZE_REQUEST' }
  | { type: 'FINALIZE_SUCCESS'; payload: FinalizeSessionResponse }
  | { type: 'FINALIZE_FAILURE'; payload: string }
  
  // Navigation
  | { type: 'GO_BACK' }
  | { type: 'JUMP_TO_STEP'; payload: { step: ConvergenceStep; lockedDimensions: LockedDimension[] } }
  | { type: 'CANCEL_GENERATION' }
  
  // Resume Flow
  | { type: 'PROMPT_RESUME'; payload: ConvergenceSession }
  | { type: 'RESUME_SESSION' }
  | { type: 'ABANDON_SESSION' }
  
  // Keyboard Navigation
  | { type: 'MOVE_FOCUS'; payload: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' }
  
  // Credits Modal
  | { type: 'SHOW_CREDITS_MODAL'; payload: { required: number; available: number } }
  | { type: 'HIDE_CREDITS_MODAL' }
  
  // Reset
  | { type: 'RESET' };

function convergenceReducer(state: ConvergenceState, action: ConvergenceAction): ConvergenceState {
  switch (action.type) {
    case 'SET_INTENT':
      return { ...state, intent: action.payload };
      
    case 'SET_ABORT_CONTROLLER':
      return { ...state, abortController: action.payload };
      
    case 'START_SESSION_REQUEST':
      return { ...state, isLoading: true, loadingOperation: 'startSession', error: null };
      
    case 'START_SESSION_SUCCESS':
      return {
        ...state,
        isLoading: false,
        loadingOperation: null,
        sessionId: action.payload.sessionId,
        currentImages: action.payload.images,
        currentOptions: action.payload.options,
        step: 'direction',
        imageHistory: new Map([['direction', action.payload.images]]),
      };
      
    case 'START_SESSION_FAILURE':
      return { ...state, isLoading: false, loadingOperation: null, error: action.payload };
      
    case 'SELECT_OPTION_REQUEST':
      return { ...state, isLoading: true, loadingOperation: 'selectOption', error: null };
      
    case 'SELECT_OPTION_SUCCESS': {
      const nextStep = getNextStep(state.step);
      const newHistory = new Map(state.imageHistory);
      newHistory.set(stepToDimension(nextStep) || nextStep, action.payload.images);
      
      return {
        ...state,
        isLoading: false,
        loadingOperation: null,
        currentImages: action.payload.images,
        currentOptions: action.payload.options || [],
        lockedDimensions: action.payload.lockedDimensions,
        step: nextStep,
        imageHistory: newHistory,
      };
    }
      
    case 'SELECT_OPTION_FAILURE':
      return { ...state, isLoading: false, loadingOperation: null, error: action.payload };
      
    case 'RESTORE_CACHED_IMAGES':
      return {
        ...state,
        currentImages: action.payload.images,
        step: dimensionToStep(action.payload.dimension),
      };
      
    case 'REGENERATE_REQUEST':
      return { ...state, isLoading: true, loadingOperation: 'regenerate', error: null };
      
    case 'REGENERATE_SUCCESS': {
      const dim = stepToDimension(state.step);
      const newCounts = new Map(state.regenerationCounts);
      if (dim) {
        newCounts.set(dim, (newCounts.get(dim) || 0) + 1);
      }
      const newHistory = new Map(state.imageHistory);
      if (dim) {
        newHistory.set(dim, action.payload.images);
      }
      
      return {
        ...state,
        isLoading: false,
        loadingOperation: null,
        currentImages: action.payload.images,
        regenerationCounts: newCounts,
        imageHistory: newHistory,
      };
    }
      
    case 'REGENERATE_FAILURE':
      return { ...state, isLoading: false, loadingOperation: null, error: action.payload };
      
    case 'CAMERA_MOTION_REQUEST':
      return { ...state, isLoading: true, loadingOperation: 'depthEstimation', error: null };
      
    case 'CAMERA_MOTION_SUCCESS':
      return {
        ...state,
        isLoading: false,
        loadingOperation: null,
        depthMapUrl: action.payload.depthMapUrl,
        cameraPaths: action.payload.cameraPaths,
        cameraMotionFallbackMode: action.payload.fallbackMode,
        step: 'camera_motion',
      };
      
    case 'CAMERA_MOTION_FAILURE':
      return { ...state, isLoading: false, loadingOperation: null, error: action.payload };
      
    case 'SELECT_CAMERA_MOTION':
      return { ...state, selectedCameraMotion: action.payload, step: 'subject_motion' };
      
    case 'SET_SUBJECT_MOTION':
      return { ...state, subjectMotion: action.payload };
      
    case 'SUBJECT_MOTION_PREVIEW_REQUEST':
      return { ...state, isLoading: true, loadingOperation: 'videoPreview', error: null };
      
    case 'SUBJECT_MOTION_PREVIEW_SUCCESS':
      return {
        ...state,
        isLoading: false,
        loadingOperation: null,
        subjectMotionVideoUrl: action.payload.videoUrl,
        finalPrompt: action.payload.prompt,
        step: 'preview',
      };
      
    case 'SUBJECT_MOTION_PREVIEW_FAILURE':
      return { ...state, isLoading: false, loadingOperation: null, error: action.payload };
      
    case 'SKIP_SUBJECT_MOTION':
      return { ...state, step: 'preview' };
      
    case 'FINALIZE_REQUEST':
      return { ...state, isLoading: true, loadingOperation: 'finalize', error: null };
      
    case 'FINALIZE_SUCCESS':
      return {
        ...state,
        isLoading: false,
        loadingOperation: null,
        finalPrompt: action.payload.finalPrompt,
        step: 'complete',
      };
      
    case 'FINALIZE_FAILURE':
      return { ...state, isLoading: false, loadingOperation: null, error: action.payload };
      
    case 'GO_BACK': {
      const prevStep = getPreviousStep(state.step);
      const prevDim = stepToDimension(prevStep);
      const cachedImages = prevDim ? state.imageHistory.get(prevDim) : undefined;
      
      return {
        ...state,
        step: prevStep,
        currentImages: cachedImages || state.currentImages,
        lockedDimensions: state.lockedDimensions.filter(d => 
          getDimensionOrder(d.type) < getDimensionOrder(prevDim || 'direction')
        ),
      };
    }
      
    case 'JUMP_TO_STEP': {
      const targetDim = stepToDimension(action.payload.step);
      const cachedImages = targetDim ? state.imageHistory.get(targetDim) : undefined;
      
      return {
        ...state,
        step: action.payload.step,
        lockedDimensions: action.payload.lockedDimensions,
        currentImages: cachedImages || state.currentImages,
      };
    }
      
    case 'CANCEL_GENERATION':
      return {
        ...state,
        isLoading: false,
        loadingOperation: null,
        abortController: null,
      };
      
    case 'PROMPT_RESUME':
      return { ...state, pendingResumeSession: action.payload };
      
    case 'RESUME_SESSION': {
      const session = state.pendingResumeSession;
      if (!session) return state;
      
      return {
        ...state,
        sessionId: session.id,
        intent: session.intent,
        direction: session.direction,
        lockedDimensions: session.lockedDimensions,
        step: session.currentStep as ConvergenceStep,
        depthMapUrl: session.depthMapUrl,
        selectedCameraMotion: session.cameraMotion,
        subjectMotion: session.subjectMotion || '',
        pendingResumeSession: null,
        // Restore image history from session
        imageHistory: new Map(Object.entries(session.imageHistory || {})),
      };
    }
      
    case 'ABANDON_SESSION':
      return { ...state, pendingResumeSession: null };
      
    case 'MOVE_FOCUS': {
      const optionCount = state.currentOptions.length || state.cameraPaths.length;
      const cols = state.step === 'camera_motion' ? 3 : 2; // Grid columns
      let newIndex = state.focusedOptionIndex;
      
      switch (action.payload) {
        case 'ArrowLeft':
          newIndex = Math.max(0, newIndex - 1);
          break;
        case 'ArrowRight':
          newIndex = Math.min(optionCount - 1, newIndex + 1);
          break;
        case 'ArrowUp':
          newIndex = Math.max(0, newIndex - cols);
          break;
        case 'ArrowDown':
          newIndex = Math.min(optionCount - 1, newIndex + cols);
          break;
      }
      
      return { ...state, focusedOptionIndex: newIndex };
    }
      
    case 'SHOW_CREDITS_MODAL':
      return {
        ...state,
        insufficientCreditsModal: {
          isOpen: true,
          required: action.payload.required,
          available: action.payload.available,
          operation: state.loadingOperation || 'unknown',
        },
        isLoading: false,
        loadingOperation: null,
      };
      
    case 'HIDE_CREDITS_MODAL':
      return { ...state, insufficientCreditsModal: null };
      
    case 'RESET':
      return initialConvergenceState;
      
    default:
      return state;
  }
}

const initialConvergenceState: ConvergenceState = {
  sessionId: null,
  step: 'intent',
  intent: '',
  direction: null,
  lockedDimensions: [],
  currentImages: [],
  currentOptions: [],
  depthMapUrl: null,
  cameraPaths: [],
  selectedCameraMotion: null,
  subjectMotion: '',
  subjectMotionVideoUrl: null,
  finalPrompt: null,
  isLoading: false,
  loadingOperation: null,
  error: null,
  regenerationCounts: new Map(),
  imageHistory: new Map(),
  abortController: null,
  pendingResumeSession: null,
  cameraMotionFallbackMode: false,
  focusedOptionIndex: 0,
  insufficientCreditsModal: null,
};
```


## Camera Motion Fallback UI (Requirement 5.5)

```typescript
// CameraMotionPicker.tsx - handles both depth-based and fallback modes
interface CameraMotionPickerProps {
  cameraPaths: CameraPath[];
  fallbackMode: boolean;
  depthMapUrl: string | null;
  selectedImage: string;
  selectedMotion: string | null;
  focusedOptionIndex: number;
  onSelect: (motionId: string) => void;
}

function CameraMotionPicker({
  cameraPaths,
  fallbackMode,
  depthMapUrl,
  selectedImage,
  selectedMotion,
  focusedOptionIndex,
  onSelect,
}: CameraMotionPickerProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Choose Camera Motion</h2>
        {fallbackMode && (
          <p className="text-sm text-amber-600 mt-1">
            Depth estimation unavailable. Select from text descriptions.
          </p>
        )}
      </div>
      
      <div className={cn(
        "grid gap-4",
        fallbackMode ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-3"
      )}>
        {cameraPaths.map((path, index) => (
          <CameraMotionOption
            key={path.id}
            path={path}
            fallbackMode={fallbackMode}
            depthMapUrl={depthMapUrl}
            selectedImage={selectedImage}
            isSelected={selectedMotion === path.id}
            isFocused={focusedOptionIndex === index}
            onSelect={() => onSelect(path.id)}
          />
        ))}
      </div>
    </div>
  );
}

// Camera motion descriptions for fallback mode
const CAMERA_MOTION_DESCRIPTIONS: Record<string, string> = {
  static: 'Camera remains fixed in place. Best for dialogue or contemplative scenes.',
  pan_left: 'Camera rotates horizontally to the left. Reveals new elements or follows action.',
  pan_right: 'Camera rotates horizontally to the right. Reveals new elements or follows action.',
  push_in: 'Camera moves forward toward subject. Creates intimacy or tension.',
  pull_back: 'Camera moves backward from subject. Reveals context or creates distance.',
  crane_up: 'Camera rises vertically. Creates grandeur or reveals overhead perspective.',
};

interface CameraMotionOptionProps {
  path: CameraPath;
  fallbackMode: boolean;
  depthMapUrl: string | null;
  selectedImage: string;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: () => void;
}

function CameraMotionOption({
  path,
  fallbackMode,
  depthMapUrl,
  selectedImage,
  isSelected,
  isFocused,
  onSelect,
}: CameraMotionOptionProps) {
  if (fallbackMode) {
    // Text-only fallback (Requirement 5.5)
    return (
      <button
        className={cn(
          "p-4 border rounded-lg text-left transition-all",
          isSelected && "border-blue-500 bg-blue-50",
          isFocused && "ring-2 ring-blue-500 ring-offset-2",
          !isSelected && !isFocused && "border-gray-200 hover:border-gray-300"
        )}
        onClick={onSelect}
      >
        <div className="text-lg font-medium">{path.label}</div>
        <div className="text-sm text-gray-500 mt-1">
          {CAMERA_MOTION_DESCRIPTIONS[path.id]}
        </div>
        {isSelected && (
          <div className="mt-2 text-blue-600 text-sm font-medium">✓ Selected</div>
        )}
      </button>
    );
  }
  
  // Normal Three.js rendered preview (Requirement 6.1-6.6)
  return (
    <CameraMotionPreview
      path={path}
      depthMapUrl={depthMapUrl!}
      selectedImage={selectedImage}
      isSelected={isSelected}
      isFocused={isFocused}
      onSelect={onSelect}
    />
  );
}

// Three.js preview component (renders on hover - Requirement 6.5)
function CameraMotionPreview({
  path,
  depthMapUrl,
  selectedImage,
  isSelected,
  isFocused,
  onSelect,
}: Omit<CameraMotionOptionProps, 'fallbackMode'> & { depthMapUrl: string }) {
  const [isHovering, setIsHovering] = useState(false);
  const [frames, setFrames] = useState<string[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  
  // Lazy render on hover (Requirement 6.5)
  useEffect(() => {
    if (isHovering && frames.length === 0 && !isRendering) {
      setIsRendering(true);
      renderCameraMotionFrames(selectedImage, depthMapUrl, path, {
        width: 320,
        height: 180,
        fps: 15,
      }).then(setFrames).finally(() => setIsRendering(false));
    }
  }, [isHovering, frames.length, isRendering, selectedImage, depthMapUrl, path]);
  
  return (
    <button
      className={cn(
        "relative aspect-video border rounded-lg overflow-hidden transition-all",
        isSelected && "border-blue-500 ring-2 ring-blue-500",
        isFocused && "ring-2 ring-blue-500 ring-offset-2",
        !isSelected && !isFocused && "border-gray-200 hover:border-gray-300"
      )}
      onClick={onSelect}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Static image or animated frames */}
      {isHovering && frames.length > 0 ? (
        <FrameAnimator frames={frames} fps={15} />
      ) : (
        <img src={selectedImage} alt={path.label} className="w-full h-full object-cover" />
      )}
      
      {/* Loading indicator */}
      {isRendering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Spinner className="w-6 h-6 text-white" />
        </div>
      )}
      
      {/* Label overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <div className="text-white font-medium">{path.label}</div>
      </div>
      
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
          <CheckIcon className="w-4 h-4" />
        </div>
      )}
    </button>
  );
}
```

## Generate Now Integration (Requirements 8.5-8.6)

```typescript
// ConvergencePreview.tsx - final preview with generation options
interface ConvergencePreviewProps {
  finalizeResponse: FinalizeSessionResponse;
  onEditInStudio: () => void;
}

function ConvergencePreview({ finalizeResponse, onEditInStudio }: ConvergencePreviewProps) {
  const { selectedModel, aspectRatio } = useBottomControlBar();
  const { generateVideo, isGenerating } = useVideoGeneration();
  const navigate = useNavigate();
  
  // Get cost for selected model
  const generationCost = GENERATION_COSTS[selectedModel] || 0;
  
  const handleGenerateNow = async () => {
    // Requirement 8.5-8.6: Use existing video generation with control bar settings
    try {
      await generateVideo({
        prompt: finalizeResponse.finalPrompt,
        model: selectedModel,
        aspectRatio,
        // Pass convergence metadata for potential model-specific optimizations
        metadata: {
          source: 'convergence',
          cameraMotion: finalizeResponse.cameraMotion,
          lockedDimensions: finalizeResponse.lockedDimensions,
        },
      });
      
      // Navigate to generations view after starting
      navigate('/generations');
    } catch (error) {
      // Error handled by useVideoGeneration hook
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Preview video or image */}
      <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden">
        {finalizeResponse.previewImageUrl && (
          <img 
            src={finalizeResponse.previewImageUrl} 
            alt="Preview" 
            className="w-full h-full object-cover"
          />
        )}
      </div>
      
      {/* Final prompt display */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-500 mb-2">Final Prompt</h3>
        <p className="text-gray-900">{finalizeResponse.finalPrompt}</p>
      </div>
      
      {/* Dimension summary */}
      <div className="flex flex-wrap gap-2">
        {finalizeResponse.lockedDimensions.map(dim => (
          <span key={dim.type} className="px-3 py-1 bg-gray-100 rounded-full text-sm">
            {dim.label}
          </span>
        ))}
        {finalizeResponse.cameraMotion && (
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            {finalizeResponse.cameraMotion}
          </span>
        )}
      </div>
      
      {/* Credit summary */}
      <div className="text-sm text-gray-500">
        Total credits used: {finalizeResponse.totalCreditsConsumed}
      </div>
      
      {/* Action buttons */}
      <div className="flex gap-4">
        <Button
          variant="primary"
          size="lg"
          onClick={handleGenerateNow}
          disabled={isGenerating}
          className="flex-1"
        >
          {isGenerating ? (
            <>
              <Spinner className="w-4 h-4 mr-2" />
              Generating...
            </>
          ) : (
            <>
              Generate Now
              <span className="ml-2 text-sm opacity-75">({generationCost} credits)</span>
            </>
          )}
        </Button>
        
        <Button
          variant="secondary"
          size="lg"
          onClick={onEditInStudio}
          disabled={isGenerating}
        >
          Edit in Studio
        </Button>
      </div>
      
      {/* Model selection hint */}
      <p className="text-xs text-gray-400 text-center">
        Using {selectedModel} • Change model in the control bar below
      </p>
    </div>
  );
}
```

## Credit Display at Each Step (Requirements 15.1-15.2)

### Updated Component Hierarchy with Credit Badges

```
ConvergenceFlow (orchestrator)
├── useEffect: checkExistingSession on mount
├── useEffect: keyboard navigation handler
├── ResumeSessionModal (if pendingResumeSession)
├── InsufficientCreditsModal (if insufficientCreditsModal)
├── ProgressIndicator
│   └── StepButton (clickable for completed steps)
├── IntentInput (step: intent)
│   ├── TextInput
│   ├── ExamplePrompts
│   └── EstimatedCostBadge (total: ~22 credits)  // Requirement 15.1
├── DirectionFork (step: direction)
│   ├── StepCreditBadge (cost: 4 credits)        // Requirement 15.2
│   ├── ImageOption x4 (with focus ring)
│   └── RegenerateButton (remaining: X, cost: 4) // Shows remaining + cost
├── DimensionSelector (steps: mood, framing, lighting)
│   ├── StepCreditBadge (cost: 4 credits)        // Requirement 15.2
│   ├── ImageOption x4 (with focus ring)
│   ├── RegenerateButton (remaining: X, cost: 4) // Shows remaining + cost
│   └── BackButton
├── CameraMotionPicker (step: camera_motion)
│   ├── StepCreditBadge (cost: 1 credit)         // Requirement 15.2
│   ├── CameraMotionOption x6+
│   └── BackButton
├── SubjectMotionInput (step: subject_motion)
│   ├── StepCreditBadge (cost: 5 credits)        // Requirement 15.3
│   ├── TextInput
│   ├── GeneratePreviewButton (shows cost)
│   ├── SkipButton (0 credits)
│   ├── VideoPlayer (if preview generated)
│   └── BackButton
└── ConvergencePreview (step: preview)
    ├── VideoPlayer
    ├── PromptDisplay
    ├── DimensionSummary
    ├── TotalCreditsSummary                      // Shows total consumed
    ├── GenerateNowButton (shows model cost)     // Requirement 15.4
    ├── EditInStudioButton
    └── ModelCostTable                           // Requirement 15.4
```

### Credit Badge Components

```typescript
// Estimated total cost at start (Requirement 15.1)
function EstimatedCostBadge() {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <CreditIcon className="w-4 h-4" />
      <span>Estimated total: ~{CONVERGENCE_COSTS.ESTIMATED_TOTAL} credits</span>
    </div>
  );
}

// Cost for current step (Requirement 15.2)
function StepCreditBadge({ step }: { step: ConvergenceStep }) {
  const cost = getStepCost(step);
  if (cost === 0) return null;
  
  return (
    <div className="flex items-center gap-1 text-xs text-gray-500">
      <CreditIcon className="w-3 h-3" />
      <span>This step: {cost} credits</span>
    </div>
  );
}

// Regenerate button with remaining count and cost
function RegenerateButton({ 
  dimension, 
  regenerationCount, 
  onRegenerate,
  isLoading,
}: RegenerateButtonProps) {
  const remaining = 3 - (regenerationCount || 0);
  const disabled = remaining <= 0 || isLoading;
  
  return (
    <button
      onClick={onRegenerate}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
        disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100"
      )}
    >
      <RefreshIcon className="w-4 h-4" />
      <span>Regenerate</span>
      <span className="text-gray-400">
        ({remaining} left • {CONVERGENCE_COSTS.REGENERATION} credits)
      </span>
    </button>
  );
}

// Model cost table in preview (Requirement 15.4)
function ModelCostTable({ selectedModel }: { selectedModel: string }) {
  return (
    <div className="text-sm">
      <h4 className="font-medium mb-2">Generation Costs</h4>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(GENERATION_COSTS).map(([model, cost]) => (
          <div 
            key={model}
            className={cn(
              "flex justify-between px-2 py-1 rounded",
              model === selectedModel && "bg-blue-50"
            )}
          >
            <span>{model}</span>
            <span className="text-gray-500">{cost} credits</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```


## Additional Constants and Interfaces

### Direction Options Constant

```typescript
const DIRECTION_OPTIONS: Array<{ id: Direction; label: string }> = [
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'social', label: 'Social Media' },
  { id: 'artistic', label: 'Artistic' },
  { id: 'documentary', label: 'Documentary' },
];
```

### CreditsService Interface

```typescript
interface CreditReservation {
  id: string;
  userId: string;
  amount: number;
  createdAt: Date;
  status: 'pending' | 'committed' | 'refunded';
}

interface CreditsService {
  /**
   * Get current credit balance for user
   */
  getBalance(userId: string): Promise<number>;
  
  /**
   * Reserve credits for an operation (holds but doesn't deduct)
   * @throws ConvergenceError('INSUFFICIENT_CREDITS') if balance < amount
   */
  reserve(userId: string, amount: number): Promise<CreditReservation>;
  
  /**
   * Commit a reservation (actually deducts credits)
   */
  commit(reservationId: string): Promise<void>;
  
  /**
   * Refund a reservation (releases hold without deducting)
   */
  refund(reservationId: string): Promise<void>;
  
  /**
   * Direct debit for committed operations (no reservation)
   */
  debit(userId: string, amount: number, reason: string): Promise<void>;
}
```

### VideoPreviewService Interface

```typescript
interface VideoPreviewOptions {
  duration?: number;      // seconds, default 3
  aspectRatio?: string;   // e.g., '16:9', '9:16', '1:1'
}

interface VideoPreviewService {
  /**
   * Generate a Wan 2.2 preview video
   * @param prompt The full prompt for video generation
   * @param options Generation options
   * @returns URL to generated video (GCS permanent URL)
   */
  generatePreview(prompt: string, options?: VideoPreviewOptions): Promise<string>;
  
  /**
   * Check if preview service is available
   */
  isAvailable(): boolean;
}
```

## Corrected Action Implementations

### selectOption with Correct Direction Check

```typescript
// Fixed selectOption - handles direction stored separately from lockedDimensions
async selectOption(dimension: DimensionType | 'direction', optionId: string): Promise<void> {
  // Check for same selection (Requirement 13.5)
  // Direction is stored in state.direction, not lockedDimensions
  const previousOptionId = dimension === 'direction'
    ? state.direction
    : state.lockedDimensions.find(d => d.type === dimension)?.optionId;
  
  if (previousOptionId === optionId) {
    // Same option selected - restore from cache, no API call, no credits charged
    const nextDimension = getNextDimension(dimension);
    const cachedImages = nextDimension ? state.imageHistory.get(nextDimension) : undefined;
    if (cachedImages) {
      dispatch({ 
        type: 'RESTORE_CACHED_IMAGES', 
        payload: { dimension: nextDimension, images: cachedImages } 
      });
      return;
    }
  }
  
  // Different option - call API
  const controller = new AbortController();
  dispatch({ type: 'SET_ABORT_CONTROLLER', payload: controller });
  dispatch({ type: 'SELECT_OPTION_REQUEST' });
  
  try {
    const result = await convergenceApi.selectOption(
      state.sessionId!, 
      dimension, 
      optionId, 
      controller.signal
    );
    dispatch({ type: 'SELECT_OPTION_SUCCESS', payload: result });
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      dispatch({ type: 'CANCEL_GENERATION' });
      return;
    }
    handleApiError(e as Error, dispatch);
  }
}
```

### Updated SelectOptionResponse with Direction

```typescript
// Updated response type - includes direction when set
interface SelectOptionResponse {
  sessionId: string;
  images: GeneratedImage[];
  currentDimension: DimensionType | 'camera_motion' | 'subject_motion';
  lockedDimensions: LockedDimension[];
  direction?: Direction;  // Included when direction was just selected
  options?: Array<{ id: string; label: string }>;
  creditsConsumed: number;
}
```

### Updated Reducer with Direction State

```typescript
case 'SELECT_OPTION_SUCCESS': {
  const response = action.payload;
  const nextStep = getNextStep(state.step);
  
  // Update image history
  const newHistory = new Map(state.imageHistory);
  const nextDim = stepToDimension(nextStep);
  if (nextDim) {
    newHistory.set(nextDim, response.images);
  }
  
  return {
    ...state,
    isLoading: false,
    loadingOperation: null,
    // Update direction if it was just selected
    direction: response.direction ?? state.direction,
    currentImages: response.images,
    currentOptions: response.options || [],
    lockedDimensions: response.lockedDimensions,
    step: nextStep,
    imageHistory: newHistory,
    focusedOptionIndex: 0, // Reset focus on step change
  };
}
```

### Fixed imageHistory Type Conversion on Resume

```typescript
case 'RESUME_SESSION': {
  const session = state.pendingResumeSession;
  if (!session) return state;
  
  // Properly typed conversion from Record to Map
  const imageHistory = new Map<DimensionType | 'direction', GeneratedImage[]>();
  if (session.imageHistory) {
    for (const [key, images] of Object.entries(session.imageHistory)) {
      // Validate key is a valid dimension type
      if (['direction', 'mood', 'framing', 'lighting', 'camera_motion'].includes(key)) {
        imageHistory.set(key as DimensionType | 'direction', images);
      }
    }
  }
  
  // Restore current images from history based on current step
  const currentDim = stepToDimension(session.currentStep as ConvergenceStep);
  const currentImages = currentDim ? imageHistory.get(currentDim) : undefined;
  
  return {
    ...state,
    sessionId: session.id,
    intent: session.intent,
    direction: session.direction,
    lockedDimensions: session.lockedDimensions,
    step: session.currentStep as ConvergenceStep,
    currentImages: currentImages || [],
    depthMapUrl: session.depthMapUrl,
    selectedCameraMotion: session.cameraMotion,
    subjectMotion: session.subjectMotion || '',
    pendingResumeSession: null,
    imageHistory,
    regenerationCounts: new Map(Object.entries(session.regenerationCounts || {})),
  };
}
```

## Session Ownership Validation

All session-modifying methods must validate ownership:

```typescript
// Helper for ownership validation
private async getSessionWithOwnershipCheck(
  sessionId: string, 
  userId: string
): Promise<ConvergenceSession> {
  const session = await this.sessionStore.get(sessionId);
  if (!session) {
    throw new ConvergenceError('SESSION_NOT_FOUND');
  }
  if (session.userId !== userId) {
    throw new ConvergenceError('UNAUTHORIZED');
  }
  return session;
}

// selectOption with ownership check
async selectOption(request: SelectOptionRequest, userId: string): Promise<SelectOptionResponse> {
  const session = await this.getSessionWithOwnershipCheck(request.sessionId, userId);
  
  // ... rest of implementation
}

// regenerate with ownership and limit check
async regenerate(request: RegenerateRequest, userId: string): Promise<RegenerateResponse> {
  const session = await this.getSessionWithOwnershipCheck(request.sessionId, userId);
  
  // Check regeneration limit (Requirement 14.4)
  const count = session.regenerationCounts?.[request.dimension] || 0;
  if (count >= 3) {
    throw new ConvergenceError('REGENERATION_LIMIT_EXCEEDED', {
      dimension: request.dimension,
      current: count,
      max: 3,
    });
  }
  
  // ... rest of implementation
}

// generateCameraMotion with ownership check
async generateCameraMotion(request: GenerateCameraMotionRequest, userId: string): Promise<GenerateCameraMotionResponse> {
  const session = await this.getSessionWithOwnershipCheck(request.sessionId, userId);
  
  // ... rest of implementation
}

// selectCameraMotion with ownership check
async selectCameraMotion(request: SelectCameraMotionRequest, userId: string): Promise<void> {
  const session = await this.getSessionWithOwnershipCheck(request.sessionId, userId);
  
  // ... rest of implementation
}

// generateSubjectMotion with ownership check
async generateSubjectMotion(request: GenerateSubjectMotionRequest, userId: string): Promise<GenerateSubjectMotionResponse> {
  const session = await this.getSessionWithOwnershipCheck(request.sessionId, userId);
  
  // ... rest of implementation
}
```

## Image Generation with Aspect Ratio

```typescript
// Updated generateAndPersistImages with aspect ratio support
private async generateAndPersistImages(
  prompts: Array<{ prompt: string; dimension: string; optionId: string }>,
  userId: string,
  aspectRatio: string = '16:9'
): Promise<GeneratedImage[]> {
  // Generate images with retry and aspect ratio
  const tempUrls = await Promise.all(
    prompts.map(p => withRetry(() => 
      this.imageGenerationService.generatePreview(p.prompt, { 
        aspectRatio,
        model: 'flux-schnell', // Cost-efficient model for previews
      })
    ))
  );
  
  // Upload to GCS for permanent storage
  const permanentUrls = await this.storageService.uploadBatch(
    tempUrls.map(r => r.imageUrl),
    `convergence/${userId}`
  );
  
  return permanentUrls.map((url, i) => ({
    id: uuidv4(),
    url,
    dimension: prompts[i].dimension as DimensionType | 'direction',
    optionId: prompts[i].optionId,
    prompt: prompts[i].prompt,
    generatedAt: new Date(),
  }));
}

// Usage in startSession - pass aspect ratio from request
async startSession(request: StartSessionRequest, userId: string): Promise<StartSessionResponse> {
  // ... validation ...
  
  const images = await this.withCreditReservation(userId, CONVERGENCE_COSTS.DIRECTION_IMAGES, async () => {
    return this.generateAndPersistImages(
      directionPrompts.map(d => ({
        prompt: d.prompt,
        dimension: 'direction',
        optionId: d.direction,
      })),
      userId,
      request.aspectRatio || '16:9'  // Use requested aspect ratio
    );
  });
  
  // ... rest
}
```

## Loading Skeleton Component

```typescript
// ImageSkeleton - shows while images are generating
function ImageSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="aspect-square bg-gray-200 rounded-lg animate-pulse flex items-center justify-center"
        >
          <div className="text-gray-400">
            <ImageIcon className="w-8 h-8" />
          </div>
        </div>
      ))}
    </>
  );
}

// Updated ImageGrid with loading state
function ImageGrid({ 
  images, 
  isLoading, 
  expectedCount = 4,
  onSelect,
  focusedIndex,
}: ImageGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ImageSkeleton count={expectedCount} />
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {images.map((image, index) => (
        <ImageOption
          key={image.id}
          image={image}
          isFocused={focusedIndex === index}
          onSelect={() => onSelect(image.optionId)}
        />
      ))}
    </div>
  );
}

// Updated DirectionFork with skeleton
function DirectionFork({ 
  images, 
  options, 
  isLoading,
  focusedIndex,
  onSelect,
  onRegenerate,
  regenerationCount,
}: DirectionForkProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Choose a Direction</h2>
        <StepCreditBadge step="direction" />
      </div>
      
      <ImageGrid
        images={images}
        isLoading={isLoading}
        expectedCount={4}
        onSelect={onSelect}
        focusedIndex={focusedIndex}
      />
      
      <div className="flex justify-center">
        <RegenerateButton
          dimension="direction"
          regenerationCount={regenerationCount}
          onRegenerate={onRegenerate}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
```

## Error Boundary for Three.js

```typescript
// Error boundary specifically for camera motion rendering
class CameraMotionErrorBoundary extends React.Component<
  { children: React.ReactNode; fallbackProps: CameraMotionPickerProps },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Camera motion rendering failed:', error, errorInfo);
    // Optionally report to error tracking service
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI with text-only camera motion selection
      return (
        <CameraMotionPicker
          {...this.props.fallbackProps}
          fallbackMode={true}
          depthMapUrl={null}
        />
      );
    }

    return this.props.children;
  }
}

// Wrapper component that uses error boundary
function CameraMotionPickerWithErrorBoundary(props: CameraMotionPickerProps) {
  return (
    <CameraMotionErrorBoundary fallbackProps={{ ...props, fallbackMode: true }}>
      <CameraMotionPicker {...props} />
    </CameraMotionErrorBoundary>
  );
}

// Usage in ConvergenceFlow
{state.step === 'camera_motion' && (
  <CameraMotionPickerWithErrorBoundary
    cameraPaths={state.cameraPaths}
    fallbackMode={state.cameraMotionFallbackMode}
    depthMapUrl={state.depthMapUrl}
    selectedImage={state.currentImages[state.currentImages.length - 1]?.url || ''}
    selectedMotion={state.selectedCameraMotion}
    focusedOptionIndex={state.focusedOptionIndex}
    onSelect={actions.selectCameraMotion}
  />
)}
```

## Updated StartSessionRequest with Aspect Ratio

```typescript
interface StartSessionRequest {
  intent: string;
  aspectRatio?: string;  // Optional, defaults to '16:9'
}
```
