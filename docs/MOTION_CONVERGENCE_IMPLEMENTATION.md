# Motion Convergence Implementation Plan

> Replace the Visual Convergence wizard (11-step flow at `/create`) with streamlined motion controls in the GenerationControlsPanel sidebar.

## Overview

The `/create` route remains but now shows the same workspace as Studio with motion controls enabled.

**User flow (Create mode only):**
1. User navigates to `/create`
2. Upload keyframe in sidebar
3. "Set Camera Motion" button appears
4. Click → modal opens with depth-based Three.js previews
5. Select camera motion → modal closes
6. Optionally type subject motion
7. Generate video with motion params

**Studio mode (`/`):** Unchanged - no motion controls.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                              Routes                                  │
├─────────────────────────────────────────────────────────────────────┤
│  /        → PromptOptimizerWorkspace (mode="studio")                │
│  /create  → PromptOptimizerWorkspace (mode="create")                │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     GenerationControlsPanel                          │
├─────────────────────────────────────────────────────────────────────┤
│  showMotionControls={mode === 'create'}                             │
│                                                                      │
│  If showMotionControls && keyframes[0]:                             │
│    - "Set Camera Motion" button                                      │
│    - Subject motion textarea                                         │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CameraMotionModal                               │
├─────────────────────────────────────────────────────────────────────┤
│  - Calls POST /api/motion/depth on open                             │
│  - Renders CameraMotionPicker (existing component)                  │
│  - Returns selected CameraPath on selection                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Backend Route

### CREATE: `server/src/routes/motion.routes.ts`

```typescript
/**
 * Motion API Routes
 * 
 * Lightweight endpoints for camera motion workflow.
 * Reuses existing depth estimation service.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '@infrastructure/Logger';
import { createDepthEstimationService } from '../services/convergence/depth';
import { createStorageService } from '../services/convergence/storage';
import { CAMERA_PATHS } from '../services/convergence/constants';

const router = Router();
const log = logger.child('motion-routes');

const DepthEstimationRequestSchema = z.object({
  imageUrl: z.string().url('Invalid image URL'),
});

/**
 * POST /api/motion/depth
 * 
 * Estimates depth from an image and returns camera path options.
 */
router.post(
  '/depth',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = DepthEstimationRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: 'Invalid request',
          details: parsed.error.errors,
        });
        return;
      }

      const { imageUrl } = parsed.data;
      log.info('Depth estimation requested', { imageUrl: imageUrl.slice(0, 100) });

      const storageService = createStorageService();
      const depthService = createDepthEstimationService({ storageService });

      if (!depthService.isAvailable()) {
        log.warn('Depth estimation service not available');
        res.json({
          success: true,
          data: {
            depthMapUrl: null,
            cameraPaths: CAMERA_PATHS,
            fallbackMode: true,
          },
        });
        return;
      }

      try {
        const depthMapUrl = await depthService.estimateDepth(imageUrl);
        res.json({
          success: true,
          data: {
            depthMapUrl,
            cameraPaths: CAMERA_PATHS,
            fallbackMode: false,
          },
        });
      } catch (depthError) {
        log.warn('Depth estimation failed, returning fallback mode', {
          error: depthError instanceof Error ? depthError.message : 'Unknown',
        });
        res.json({
          success: true,
          data: {
            depthMapUrl: null,
            cameraPaths: CAMERA_PATHS,
            fallbackMode: true,
          },
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

export default router;
```

### MODIFY: `server/src/routes/index.ts`

Add near other route imports:
```typescript
import motionRoutes from './motion.routes';
```

Add near other route registrations:
```typescript
router.use('/motion', motionRoutes);
```

---

## Phase 2: Frontend API

### CREATE: `client/src/api/motionApi.ts`

```typescript
/**
 * Motion API Client
 */

import type { CameraPath } from '@/features/convergence/types';

export interface DepthEstimationResponse {
  depthMapUrl: string | null;
  cameraPaths: CameraPath[];
  fallbackMode: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function estimateDepth(imageUrl: string): Promise<DepthEstimationResponse> {
  const response = await fetch('/api/motion/depth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  });

  if (!response.ok) {
    throw new Error(`Depth estimation failed: ${response.status}`);
  }

  const result: ApiResponse<DepthEstimationResponse> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Depth estimation failed');
  }

  return result.data;
}
```

---

## Phase 3: State Hook

### CREATE: `client/src/hooks/useCameraMotion.ts`

```typescript
/**
 * useCameraMotion Hook
 */

import { useCallback, useReducer } from 'react';
import type { CameraPath } from '@/features/convergence/types';
import { estimateDepth } from '@/api/motionApi';

interface State {
  isEstimatingDepth: boolean;
  error: string | null;
  depthMapUrl: string | null;
  cameraPaths: CameraPath[];
  fallbackMode: boolean;
  hasEstimated: boolean;
  selectedCameraMotion: CameraPath | null;
  subjectMotion: string;
}

const initialState: State = {
  isEstimatingDepth: false,
  error: null,
  depthMapUrl: null,
  cameraPaths: [],
  fallbackMode: false,
  hasEstimated: false,
  selectedCameraMotion: null,
  subjectMotion: '',
};

type Action =
  | { type: 'ESTIMATE_START' }
  | { type: 'ESTIMATE_SUCCESS'; depthMapUrl: string | null; cameraPaths: CameraPath[]; fallbackMode: boolean }
  | { type: 'ESTIMATE_ERROR'; error: string }
  | { type: 'SELECT'; cameraPath: CameraPath }
  | { type: 'CLEAR' }
  | { type: 'SET_SUBJECT_MOTION'; motion: string }
  | { type: 'RESET' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ESTIMATE_START':
      return { ...state, isEstimatingDepth: true, error: null };
    case 'ESTIMATE_SUCCESS':
      return {
        ...state,
        isEstimatingDepth: false,
        depthMapUrl: action.depthMapUrl,
        cameraPaths: action.cameraPaths,
        fallbackMode: action.fallbackMode,
        hasEstimated: true,
        error: null,
      };
    case 'ESTIMATE_ERROR':
      return { ...state, isEstimatingDepth: false, error: action.error, fallbackMode: true, hasEstimated: true };
    case 'SELECT':
      return { ...state, selectedCameraMotion: action.cameraPath };
    case 'CLEAR':
      return { ...state, selectedCameraMotion: null };
    case 'SET_SUBJECT_MOTION':
      return { ...state, subjectMotion: action.motion };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function useCameraMotion() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleEstimateDepth = useCallback(async (imageUrl: string) => {
    dispatch({ type: 'ESTIMATE_START' });
    try {
      const result = await estimateDepth(imageUrl);
      dispatch({
        type: 'ESTIMATE_SUCCESS',
        depthMapUrl: result.depthMapUrl,
        cameraPaths: result.cameraPaths,
        fallbackMode: result.fallbackMode,
      });
    } catch (error) {
      dispatch({
        type: 'ESTIMATE_ERROR',
        error: error instanceof Error ? error.message : 'Depth estimation failed',
      });
    }
  }, []);

  return {
    state,
    actions: {
      estimateDepth: handleEstimateDepth,
      selectCameraMotion: useCallback((cameraPath: CameraPath) => dispatch({ type: 'SELECT', cameraPath }), []),
      clearSelection: useCallback(() => dispatch({ type: 'CLEAR' }), []),
      setSubjectMotion: useCallback((motion: string) => dispatch({ type: 'SET_SUBJECT_MOTION', motion }), []),
      reset: useCallback(() => dispatch({ type: 'RESET' }), []),
    },
  };
}
```

---

## Phase 4: Modal Component

### CREATE: `client/src/components/modals/CameraMotionModal.tsx`

```typescript
/**
 * CameraMotionModal
 */

import React, { useEffect, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { CameraPath } from '@/features/convergence/types';
import { CameraMotionPickerWithErrorBoundary } from '@/features/convergence/components/CameraMotionPicker';
import { useCameraMotion } from '@/hooks/useCameraMotion';

export interface CameraMotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onSelect: (cameraPath: CameraPath) => void;
  initialSelection?: CameraPath | null;
}

export function CameraMotionModal({
  isOpen,
  onClose,
  imageUrl,
  onSelect,
  initialSelection = null,
}: CameraMotionModalProps): React.ReactElement | null {
  const { state, actions } = useCameraMotion();

  useEffect(() => {
    if (isOpen && imageUrl && !state.hasEstimated) {
      actions.estimateDepth(imageUrl);
    }
  }, [isOpen, imageUrl, state.hasEstimated, actions]);

  useEffect(() => {
    if (!isOpen) actions.reset();
  }, [isOpen, actions]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSelect = useCallback(
    (cameraMotionId: string) => {
      const selectedPath = state.cameraPaths.find((p) => p.id === cameraMotionId);
      if (selectedPath) {
        onSelect(selectedPath);
        onClose();
      }
    },
    [state.cameraPaths, onSelect, onClose]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'relative z-10 w-full max-w-5xl max-h-[90vh] overflow-auto',
        'bg-[#12131A] rounded-xl border border-[#29292D] shadow-2xl mx-4'
      )}>
        <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-[#12131A] border-b border-[#29292D]">
          <h2 className="text-lg font-semibold text-white">Choose Camera Motion</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-[#A1AFC5] hover:text-white hover:bg-[#1B1E23]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          {state.isEstimatingDepth ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#2C22FA] mb-4" />
              <p className="text-[#A1AFC5]">Analyzing image depth...</p>
            </div>
          ) : state.error && !state.fallbackMode ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-red-400 mb-4">{state.error}</p>
              <button type="button" onClick={() => actions.estimateDepth(imageUrl)} className="px-4 py-2 bg-[#2C22FA] text-white rounded-lg">
                Retry
              </button>
            </div>
          ) : (
            <CameraMotionPickerWithErrorBoundary
              cameraPaths={state.cameraPaths}
              imageUrl={imageUrl}
              depthMapUrl={state.depthMapUrl}
              selectedCameraMotion={initialSelection?.id ?? null}
              fallbackMode={state.fallbackMode}
              onSelect={handleSelect}
              onBack={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Phase 5: Context Integration

### MODIFY: `client/src/features/prompt-optimizer/context/GenerationControlsContext.tsx`

Add imports at top:
```typescript
import type { CameraPath } from '@/features/convergence/types';
```

Add to `GenerationControlsContextValue` interface:
```typescript
  cameraMotion: CameraPath | null;
  subjectMotion: string;
  setCameraMotion: (cameraPath: CameraPath | null) => void;
  setSubjectMotion: (motion: string) => void;
```

Add state in provider:
```typescript
const [cameraMotion, setCameraMotion] = useState<CameraPath | null>(null);
const [subjectMotion, setSubjectMotion] = useState('');
```

Add to provider value:
```typescript
cameraMotion,
subjectMotion,
setCameraMotion,
setSubjectMotion,
```

---

## Phase 6: Panel Integration

### MODIFY: `client/src/components/ToolSidebar/components/panels/GenerationControlsPanel.tsx`

**Add imports:**
```typescript
import { useState } from 'react'; // ensure useState is imported
import { CameraMotionModal } from '@/components/modals/CameraMotionModal';
import type { CameraPath } from '@/features/convergence/types';
```

**Add props to interface (around line 25):**
```typescript
  showMotionControls?: boolean;
  cameraMotion?: CameraPath | null;
  onCameraMotionChange?: (cameraPath: CameraPath | null) => void;
  subjectMotion?: string;
  onSubjectMotionChange?: (motion: string) => void;
```

**Add to destructured props:**
```typescript
  showMotionControls = false,
  cameraMotion = null,
  onCameraMotionChange,
  subjectMotion = '',
  onSubjectMotionChange,
```

**Add state (inside component, near other useState):**
```typescript
const [showCameraMotionModal, setShowCameraMotionModal] = useState(false);
```

**Add motion controls section after keyframe slots (around line 270, after the keyframe slot mapping in the video tab):**
```tsx
{/* Motion Controls - Create mode only */}
{showMotionControls && keyframes.length > 0 && (
  <div className="px-3 pt-3 space-y-3">
    <div>
      <label className="block text-xs font-medium text-[#7C839C] mb-1.5">
        Camera Motion
      </label>
      <button
        type="button"
        onClick={() => setShowCameraMotionModal(true)}
        className={cn(
          'w-full px-3 py-2 rounded-lg text-sm text-left transition-colors',
          'border bg-[#1B1E23] hover:bg-[#1E1F25]',
          cameraMotion ? 'border-[#2C22FA]/50' : 'border-[#29292D]'
        )}
      >
        {cameraMotion ? (
          <span className="flex items-center gap-2">
            <span className="text-[#2C22FA]">✓</span>
            <span className="text-white">{cameraMotion.label}</span>
          </span>
        ) : (
          <span className="text-[#7C839C]">Set camera motion...</span>
        )}
      </button>
    </div>

    <div>
      <label className="block text-xs font-medium text-[#7C839C] mb-1.5">
        Subject Motion <span className="text-[#7C839C]/60">(optional)</span>
      </label>
      <textarea
        value={subjectMotion}
        onChange={(e) => onSubjectMotionChange?.(e.target.value)}
        placeholder="Describe how your subject moves..."
        rows={2}
        className={cn(
          'w-full px-3 py-2 rounded-lg text-sm resize-none',
          'bg-[#1B1E23] border border-[#29292D]',
          'placeholder:text-[#7C839C]/60 text-white',
          'focus:outline-none focus:ring-2 focus:ring-[#2C22FA]/50 focus:border-[#2C22FA]'
        )}
      />
    </div>
  </div>
)}
```

**Add modal at end of component (before final `</div>`):**
```tsx
{showMotionControls && keyframes[0] && (
  <CameraMotionModal
    isOpen={showCameraMotionModal}
    onClose={() => setShowCameraMotionModal(false)}
    imageUrl={keyframes[0].url}
    onSelect={(path) => {
      onCameraMotionChange?.(path);
      setShowCameraMotionModal(false);
    }}
    initialSelection={cameraMotion}
  />
)}
```

---

## Phase 7: Wire Props Through

### MODIFY: `client/src/components/ToolSidebar/types.ts`

Add to `ToolSidebarProps`:
```typescript
import type { CameraPath } from '@/features/convergence/types';

// In the interface:
showMotionControls?: boolean;
cameraMotion?: CameraPath | null;
onCameraMotionChange?: (cameraPath: CameraPath | null) => void;
subjectMotion?: string;
onSubjectMotionChange?: (motion: string) => void;
```

### MODIFY: `client/src/components/ToolSidebar/ToolSidebar.tsx`

Destructure new props and pass to GenerationControlsPanel:
```typescript
// Destructure:
showMotionControls,
cameraMotion,
onCameraMotionChange,
subjectMotion,
onSubjectMotionChange,

// Pass to GenerationControlsPanel:
showMotionControls={showMotionControls}
cameraMotion={cameraMotion}
onCameraMotionChange={onCameraMotionChange}
subjectMotion={subjectMotion}
onSubjectMotionChange={onSubjectMotionChange}
```

### MODIFY: `client/src/components/navigation/AppShell/types.ts`

Add same props to `AppShellProps`.

### MODIFY: `client/src/components/navigation/AppShell/AppShell.tsx`

Destructure and pass to ToolSidebar.

### MODIFY: `client/src/features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace.tsx`

**Add mode prop to interface:**
```typescript
interface PromptOptimizerWorkspaceProps {
  convergenceHandoff?: ConvergenceHandoff | null;
  mode?: 'studio' | 'create';
}
```

**Accept mode in component:**
```typescript
function PromptOptimizerWorkspace({ convergenceHandoff, mode = 'studio' }: PromptOptimizerWorkspaceProps): React.ReactElement {
```

**In PromptOptimizerContent, get motion state from context:**
```typescript
const {
  controls: generationControls,
  keyframes,
  addKeyframe,
  removeKeyframe,
  clearKeyframes,
  cameraMotion,
  subjectMotion,
  setCameraMotion,
  setSubjectMotion,
} = useGenerationControlsContext();
```

**Pass to AppShell:**
```typescript
showMotionControls={mode === 'create'}
cameraMotion={cameraMotion}
onCameraMotionChange={setCameraMotion}
subjectMotion={subjectMotion}
onSubjectMotionChange={setSubjectMotion}
```

### MODIFY: `client/src/components/layout/MainWorkspace.tsx`

Pass mode to PromptOptimizerWorkspace:
```typescript
<PromptOptimizerWorkspace
  convergenceHandoff={activeTool === 'studio' ? convergenceHandoff : null}
  mode={activeTool}
/>
```

Remove CreateWorkspaceShell and ConvergenceFlow - both routes now use PromptOptimizerWorkspace:
```typescript
export function MainWorkspace(): React.ReactElement {
  const { activeTool, convergenceHandoff } = useAppShell();

  return (
    <GenerationControlsProvider>
      <PromptOptimizerWorkspace
        convergenceHandoff={activeTool === 'studio' ? convergenceHandoff : null}
        mode={activeTool}
      />
    </GenerationControlsProvider>
  );
}
```

---

## Phase 8: Delete Convergence Wizard

### DELETE directories:
```
client/src/features/convergence/components/ConvergenceFlow/
client/src/features/convergence/components/ConvergencePreview/
client/src/features/convergence/components/DimensionSelector/
client/src/features/convergence/components/DirectionFork/
client/src/features/convergence/components/FinalFrameConfirmation/
client/src/features/convergence/components/IntentInput/
client/src/features/convergence/components/ProgressIndicator/
client/src/features/convergence/components/StartingPointSelector/
client/src/features/convergence/components/modals/
client/src/features/convergence/api/
server/src/services/convergence/session/
server/src/services/convergence/prompt-builder/
```

### DELETE files:
```
server/src/routes/convergence.routes.ts
server/src/services/convergence/ConvergenceService.ts
```

### KEEP (reused):
```
client/src/features/convergence/components/CameraMotionPicker/
client/src/features/convergence/components/SubjectMotionInput/
client/src/features/convergence/components/shared/
client/src/features/convergence/types.ts
server/src/services/convergence/depth/
server/src/services/convergence/video-preview/
server/src/services/convergence/storage/
server/src/services/convergence/constants.ts
server/src/services/convergence/types.ts
server/src/services/convergence/helpers.ts
server/src/services/convergence/errors.ts
server/src/services/convergence/credits/
```

### MODIFY: `server/src/routes/index.ts`

Remove:
```typescript
import convergenceRoutes from './convergence.routes';
router.use('/convergence', convergenceRoutes);
```

### MODIFY: `client/src/features/convergence/components/index.ts`

Update to only export kept components:
```typescript
export { CameraMotionPicker, CameraMotionPickerWithErrorBoundary } from './CameraMotionPicker';
export { SubjectMotionInput } from './SubjectMotionInput';
export * from './shared';
```

---

## File Summary

| Action | File |
|--------|------|
| CREATE | `server/src/routes/motion.routes.ts` |
| CREATE | `client/src/api/motionApi.ts` |
| CREATE | `client/src/hooks/useCameraMotion.ts` |
| CREATE | `client/src/components/modals/CameraMotionModal.tsx` |
| MODIFY | `server/src/routes/index.ts` |
| MODIFY | `client/src/features/prompt-optimizer/context/GenerationControlsContext.tsx` |
| MODIFY | `client/src/components/ToolSidebar/types.ts` |
| MODIFY | `client/src/components/ToolSidebar/ToolSidebar.tsx` |
| MODIFY | `client/src/components/ToolSidebar/components/panels/GenerationControlsPanel.tsx` |
| MODIFY | `client/src/components/navigation/AppShell/types.ts` |
| MODIFY | `client/src/components/navigation/AppShell/AppShell.tsx` |
| MODIFY | `client/src/features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace.tsx` |
| MODIFY | `client/src/components/layout/MainWorkspace.tsx` |
| MODIFY | `client/src/features/convergence/components/index.ts` |
| DELETE | `client/src/features/convergence/components/ConvergenceFlow/` |
| DELETE | `client/src/features/convergence/components/ConvergencePreview/` |
| DELETE | `client/src/features/convergence/components/DimensionSelector/` |
| DELETE | `client/src/features/convergence/components/DirectionFork/` |
| DELETE | `client/src/features/convergence/components/FinalFrameConfirmation/` |
| DELETE | `client/src/features/convergence/components/IntentInput/` |
| DELETE | `client/src/features/convergence/components/ProgressIndicator/` |
| DELETE | `client/src/features/convergence/components/StartingPointSelector/` |
| DELETE | `client/src/features/convergence/components/modals/` |
| DELETE | `client/src/features/convergence/api/` |
| DELETE | `server/src/routes/convergence.routes.ts` |
| DELETE | `server/src/services/convergence/ConvergenceService.ts` |
| DELETE | `server/src/services/convergence/session/` |
| DELETE | `server/src/services/convergence/prompt-builder/` |

---

## Implementation Order

1. Phase 1: Backend route (`motion.routes.ts`)
2. Phase 2: Frontend API (`motionApi.ts`)
3. Phase 3: State hook (`useCameraMotion.ts`)
4. Phase 4: Modal component (`CameraMotionModal.tsx`)
5. Phase 5: Context integration
6. Phase 6: Panel integration
7. Phase 7: Wire props through tree
8. Phase 8: Delete convergence wizard code

---

## Testing Checklist

- [ ] `/` route (Studio) → no motion controls in sidebar
- [ ] `/create` route → motion controls appear when keyframe exists
- [ ] Upload keyframe → "Set Camera Motion" button appears
- [ ] Click button → modal opens, depth estimation runs
- [ ] Hover camera option → Three.js parallax preview plays
- [ ] Click option → modal closes, selection shown with checkmark
- [ ] Type subject motion → text stored
- [ ] Remove keyframe → motion controls hidden
- [ ] Depth estimation fails → fallback text mode
- [ ] `GET /api/convergence/*` → 404 (routes removed)
- [ ] No console errors from deleted imports
