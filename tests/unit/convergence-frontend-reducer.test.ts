/**
 * Unit tests for convergenceReducer state transitions
 *
 * Tests all action types and state transitions in the convergence reducer.
 *
 * Requirements tested:
 * - 9.1: Manage all convergence state using useReducer pattern
 * - 9.2-9.8: Track loading status, errors, session state, and image history
 * - 13.1-13.7: Support back navigation and image restoration
 *
 * Task: 33.1 Test convergenceReducer state transitions for all action types
 *
 * @module convergence-frontend-reducer.test
 */

import { describe, it, expect } from 'vitest';
import {
  convergenceReducer,
  initialState,
  type ConvergenceState,
  type ConvergenceAction,
} from '@features/convergence/hooks/useConvergenceSession';
import type {
  GeneratedImage,
  LockedDimension,
  CameraPath,
  SelectionOption,
  ConvergenceSession,
} from '@features/convergence/types';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a test generated image
 */
function createTestImage(overrides: Partial<GeneratedImage> = {}): GeneratedImage {
  return {
    id: 'test-image-' + Math.random().toString(36).substring(7),
    url: 'https://storage.googleapis.com/bucket/test-image.png',
    dimension: 'direction',
    optionId: 'cinematic',
    prompt: 'A beautiful sunset, cinematic composition',
    generatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Creates a test locked dimension
 */
function createTestLockedDimension(
  overrides: Partial<LockedDimension> = {}
): LockedDimension {
  return {
    type: 'mood',
    optionId: 'dramatic',
    label: 'Dramatic',
    promptFragments: ['high contrast lighting', 'deep shadows'],
    ...overrides,
  };
}


/**
 * Creates a test camera path
 */
function createTestCameraPath(overrides: Partial<CameraPath> = {}): CameraPath {
  return {
    id: 'push_in',
    label: 'Push In',
    category: 'dolly',
    start: { position: { x: 0, y: 0, z: -0.1 }, rotation: { pitch: 0, yaw: 0, roll: 0 } },
    end: { position: { x: 0, y: 0, z: 0.25 }, rotation: { pitch: 0, yaw: 0, roll: 0 } },
    duration: 3,
    ...overrides,
  };
}

/**
 * Creates a test selection option
 */
function createTestOption(overrides: Partial<SelectionOption> = {}): SelectionOption {
  return {
    id: 'cinematic',
    label: 'Cinematic',
    ...overrides,
  };
}

/**
 * Creates a test convergence session
 */
function createTestSession(overrides: Partial<ConvergenceSession> = {}): ConvergenceSession {
  return {
    id: 'test-session-id',
    userId: 'test-user-id',
    intent: 'A beautiful sunset over the ocean',
    aspectRatio: '16:9',
    direction: 'cinematic',
    lockedDimensions: [createTestLockedDimension()],
    currentStep: 'framing',
    generatedImages: [createTestImage()],
    imageHistory: {
      direction: [createTestImage({ dimension: 'direction' })],
      mood: [createTestImage({ dimension: 'mood' })],
    },
    regenerationCounts: { direction: 1 },
    startingPointMode: 'converge',
    finalFrameUrl: null,
    finalFrameRegenerations: 0,
    uploadedImageUrl: null,
    depthMapUrl: null,
    cameraMotion: null,
    subjectMotion: null,
    finalPrompt: null,
    status: 'active',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('convergenceReducer', () => {
  describe('Initial State', () => {
    it('should have correct initial state', () => {
      expect(initialState.sessionId).toBeNull();
      expect(initialState.step).toBe('intent');
      expect(initialState.intent).toBe('');
      expect(initialState.direction).toBeNull();
      expect(initialState.lockedDimensions).toEqual([]);
      expect(initialState.currentImages).toEqual([]);
      expect(initialState.currentOptions).toEqual([]);
      expect(initialState.isLoading).toBe(false);
      expect(initialState.loadingOperation).toBeNull();
      expect(initialState.error).toBeNull();
      expect(initialState.regenerationCounts).toBeInstanceOf(Map);
      expect(initialState.imageHistory).toBeInstanceOf(Map);
      expect(initialState.abortController).toBeNull();
      expect(initialState.pendingResumeSession).toBeNull();
      expect(initialState.insufficientCreditsModal).toBeNull();
      expect(initialState.focusedOptionIndex).toBe(0);
    });
  });


  describe('Session Lifecycle Actions', () => {
    describe('SET_INTENT', () => {
      it('should update intent and clear error', () => {
        const state: ConvergenceState = {
          ...initialState,
          error: 'Previous error',
        };

        const result = convergenceReducer(state, {
          type: 'SET_INTENT',
          payload: 'A beautiful sunset',
        });

        expect(result.intent).toBe('A beautiful sunset');
        expect(result.error).toBeNull();
      });
    });

    describe('SET_ABORT_CONTROLLER', () => {
      it('should set abort controller', () => {
        const controller = new AbortController();

        const result = convergenceReducer(initialState, {
          type: 'SET_ABORT_CONTROLLER',
          payload: controller,
        });

        expect(result.abortController).toBe(controller);
      });
    });

    describe('START_SESSION_REQUEST', () => {
      it('should set loading state for startSession', () => {
        const result = convergenceReducer(initialState, {
          type: 'START_SESSION_REQUEST',
        });

        expect(result.isLoading).toBe(true);
        expect(result.loadingOperation).toBe('startSession');
        expect(result.error).toBeNull();
      });
    });

    describe('START_SESSION_SUCCESS', () => {
      it('should update state with session data', () => {
        const images = [createTestImage(), createTestImage()];
        const options = [createTestOption(), createTestOption({ id: 'social', label: 'Social' })];

        const result = convergenceReducer(initialState, {
          type: 'START_SESSION_SUCCESS',
          payload: {
            sessionId: 'session-123',
            images,
            options,
          },
        });

        expect(result.sessionId).toBe('session-123');
        expect(result.step).toBe('starting_point');
        expect(result.currentImages).toEqual(images);
        expect(result.currentOptions).toEqual(options);
        expect(result.isLoading).toBe(false);
        expect(result.loadingOperation).toBeNull();
        expect(result.abortController).toBeNull();
        expect(result.focusedOptionIndex).toBe(0);
        expect(result.imageHistory.size).toBe(0);
      });
    });

    describe('START_SESSION_FAILURE', () => {
      it('should set error and clear loading state', () => {
        const state: ConvergenceState = {
          ...initialState,
          isLoading: true,
          loadingOperation: 'startSession',
          abortController: new AbortController(),
        };

        const result = convergenceReducer(state, {
          type: 'START_SESSION_FAILURE',
          payload: 'Failed to start session',
        });

        expect(result.isLoading).toBe(false);
        expect(result.loadingOperation).toBeNull();
        expect(result.error).toBe('Failed to start session');
        expect(result.abortController).toBeNull();
      });
    });
  });


  describe('Select Option Actions', () => {
    describe('SELECT_OPTION_REQUEST', () => {
      it('should set loading state for selectOption', () => {
        const result = convergenceReducer(initialState, {
          type: 'SELECT_OPTION_REQUEST',
        });

        expect(result.isLoading).toBe(true);
        expect(result.loadingOperation).toBe('selectOption');
        expect(result.error).toBeNull();
      });
    });

    describe('SELECT_OPTION_SUCCESS', () => {
      it('should update state with new dimension data', () => {
        const state: ConvergenceState = {
          ...initialState,
          sessionId: 'session-123',
          step: 'direction',
          isLoading: true,
        };

        const images = [createTestImage({ dimension: 'mood' })];
        const lockedDimensions = [createTestLockedDimension()];
        const options = [createTestOption({ id: 'dramatic', label: 'Dramatic' })];

        const result = convergenceReducer(state, {
          type: 'SELECT_OPTION_SUCCESS',
          payload: {
            images,
            lockedDimensions,
            currentDimension: 'mood',
            options,
            direction: 'cinematic',
          },
        });

        expect(result.step).toBe('mood');
        expect(result.direction).toBe('cinematic');
        expect(result.lockedDimensions).toEqual(lockedDimensions);
        expect(result.currentImages).toEqual(images);
        expect(result.currentOptions).toEqual(options);
        expect(result.isLoading).toBe(false);
        expect(result.loadingOperation).toBeNull();
        expect(result.focusedOptionIndex).toBe(0);
        expect(result.imageHistory.get('mood')).toEqual(images);
      });

      it('should handle camera_motion transition', () => {
        const state: ConvergenceState = {
          ...initialState,
          sessionId: 'session-123',
          step: 'lighting',
          direction: 'cinematic',
        };

        const result = convergenceReducer(state, {
          type: 'SELECT_OPTION_SUCCESS',
          payload: {
            images: [],
            lockedDimensions: [],
            currentDimension: 'camera_motion',
          },
        });

        expect(result.step).toBe('camera_motion');
      });

      it('should handle subject_motion transition', () => {
        const state: ConvergenceState = {
          ...initialState,
          sessionId: 'session-123',
          step: 'camera_motion',
        };

        const result = convergenceReducer(state, {
          type: 'SELECT_OPTION_SUCCESS',
          payload: {
            images: [],
            lockedDimensions: [],
            currentDimension: 'subject_motion',
          },
        });

        expect(result.step).toBe('subject_motion');
      });

      it('should preserve existing direction if not provided', () => {
        const state: ConvergenceState = {
          ...initialState,
          direction: 'cinematic',
        };

        const result = convergenceReducer(state, {
          type: 'SELECT_OPTION_SUCCESS',
          payload: {
            images: [],
            lockedDimensions: [],
            currentDimension: 'mood',
          },
        });

        expect(result.direction).toBe('cinematic');
      });
    });

    describe('SELECT_OPTION_FAILURE', () => {
      it('should set error and clear loading state', () => {
        const state: ConvergenceState = {
          ...initialState,
          isLoading: true,
          loadingOperation: 'selectOption',
        };

        const result = convergenceReducer(state, {
          type: 'SELECT_OPTION_FAILURE',
          payload: 'Selection failed',
        });

        expect(result.isLoading).toBe(false);
        expect(result.loadingOperation).toBeNull();
        expect(result.error).toBe('Selection failed');
      });
    });

    describe('RESTORE_CACHED_IMAGES', () => {
      it('should restore images from cache', () => {
        const cachedImages = [createTestImage({ dimension: 'mood' })];
        const options = [createTestOption({ id: 'dramatic', label: 'Dramatic' })];

        const result = convergenceReducer(initialState, {
          type: 'RESTORE_CACHED_IMAGES',
          payload: {
            dimension: 'mood',
            images: cachedImages,
            options,
          },
        });

        expect(result.step).toBe('mood');
        expect(result.currentImages).toEqual(cachedImages);
        expect(result.currentOptions).toEqual(options);
        expect(result.focusedOptionIndex).toBe(0);
      });
    });
  });


  describe('Regenerate Actions', () => {
    describe('REGENERATE_REQUEST', () => {
      it('should set loading state for regenerate', () => {
        const result = convergenceReducer(initialState, {
          type: 'REGENERATE_REQUEST',
        });

        expect(result.isLoading).toBe(true);
        expect(result.loadingOperation).toBe('regenerate');
        expect(result.error).toBeNull();
      });
    });

    describe('REGENERATE_SUCCESS', () => {
      it('should update images and increment regeneration count', () => {
        const state: ConvergenceState = {
          ...initialState,
          step: 'direction',
          regenerationCounts: new Map([['direction', 1]]),
        };

        const newImages = [createTestImage(), createTestImage()];

        const result = convergenceReducer(state, {
          type: 'REGENERATE_SUCCESS',
          payload: {
            images: newImages,
            remainingRegenerations: 1,
            dimension: 'direction',
          },
        });

        expect(result.currentImages).toEqual(newImages);
        expect(result.regenerationCounts.get('direction')).toBe(2);
        expect(result.imageHistory.get('direction')).toEqual(newImages);
        expect(result.isLoading).toBe(false);
        expect(result.loadingOperation).toBeNull();
      });

      it('should initialize regeneration count if not present', () => {
        const state: ConvergenceState = {
          ...initialState,
          step: 'mood',
          regenerationCounts: new Map(),
        };

        const result = convergenceReducer(state, {
          type: 'REGENERATE_SUCCESS',
          payload: {
            images: [],
            remainingRegenerations: 2,
            dimension: 'mood',
          },
        });

        expect(result.regenerationCounts.get('mood')).toBe(1);
      });
    });

    describe('REGENERATE_FAILURE', () => {
      it('should set error and clear loading state', () => {
        const state: ConvergenceState = {
          ...initialState,
          isLoading: true,
          loadingOperation: 'regenerate',
        };

        const result = convergenceReducer(state, {
          type: 'REGENERATE_FAILURE',
          payload: 'Regeneration limit exceeded',
        });

        expect(result.isLoading).toBe(false);
        expect(result.error).toBe('Regeneration limit exceeded');
      });
    });
  });

  describe('Camera Motion Actions', () => {
    describe('GENERATE_CAMERA_MOTION_REQUEST', () => {
      it('should set loading state for depth estimation', () => {
        const result = convergenceReducer(initialState, {
          type: 'GENERATE_CAMERA_MOTION_REQUEST',
        });

        expect(result.isLoading).toBe(true);
        expect(result.loadingOperation).toBe('depthEstimation');
        expect(result.error).toBeNull();
      });
    });

    describe('GENERATE_CAMERA_MOTION_SUCCESS', () => {
      it('should update camera motion state', () => {
        const cameraPaths = [createTestCameraPath(), createTestCameraPath({ id: 'pan_left' })];

        const result = convergenceReducer(initialState, {
          type: 'GENERATE_CAMERA_MOTION_SUCCESS',
          payload: {
            depthMapUrl: 'https://storage.googleapis.com/depth.png',
            cameraPaths,
            fallbackMode: false,
          },
        });

        expect(result.depthMapUrl).toBe('https://storage.googleapis.com/depth.png');
        expect(result.cameraPaths).toEqual(cameraPaths);
        expect(result.cameraMotionFallbackMode).toBe(false);
        expect(result.isLoading).toBe(false);
        expect(result.focusedOptionIndex).toBe(0);
      });

      it('should handle fallback mode', () => {
        const result = convergenceReducer(initialState, {
          type: 'GENERATE_CAMERA_MOTION_SUCCESS',
          payload: {
            depthMapUrl: null,
            cameraPaths: [createTestCameraPath()],
            fallbackMode: true,
          },
        });

        expect(result.depthMapUrl).toBeNull();
        expect(result.cameraMotionFallbackMode).toBe(true);
      });
    });

    describe('GENERATE_CAMERA_MOTION_FAILURE', () => {
      it('should set error and clear loading state', () => {
        const result = convergenceReducer(initialState, {
          type: 'GENERATE_CAMERA_MOTION_FAILURE',
          payload: 'Depth estimation failed',
        });

        expect(result.isLoading).toBe(false);
        expect(result.error).toBe('Depth estimation failed');
      });
    });

    describe('SELECT_CAMERA_MOTION', () => {
      it('should set selected camera motion and advance to subject_motion', () => {
        const result = convergenceReducer(initialState, {
          type: 'SELECT_CAMERA_MOTION',
          payload: 'push_in',
        });

        expect(result.selectedCameraMotion).toBe('push_in');
        expect(result.step).toBe('subject_motion');
      });
    });
  });


  describe('Subject Motion Actions', () => {
    describe('SET_SUBJECT_MOTION', () => {
      it('should update subject motion text', () => {
        const result = convergenceReducer(initialState, {
          type: 'SET_SUBJECT_MOTION',
          payload: 'walking slowly',
        });

        expect(result.subjectMotion).toBe('walking slowly');
      });
    });

    describe('GENERATE_SUBJECT_MOTION_REQUEST', () => {
      it('should set loading state for video preview', () => {
        const result = convergenceReducer(initialState, {
          type: 'GENERATE_SUBJECT_MOTION_REQUEST',
        });

        expect(result.isLoading).toBe(true);
        expect(result.loadingOperation).toBe('videoPreview');
        expect(result.error).toBeNull();
      });
    });

    describe('GENERATE_SUBJECT_MOTION_SUCCESS', () => {
      it('should update video URL and advance to preview', () => {
        const result = convergenceReducer(initialState, {
          type: 'GENERATE_SUBJECT_MOTION_SUCCESS',
          payload: {
            videoUrl: 'https://storage.googleapis.com/video.mp4',
            prompt: 'Final prompt with motion',
          },
        });

        expect(result.subjectMotionVideoUrl).toBe('https://storage.googleapis.com/video.mp4');
        expect(result.finalPrompt).toBe('Final prompt with motion');
        expect(result.step).toBe('preview');
        expect(result.isLoading).toBe(false);
      });
    });

    describe('GENERATE_SUBJECT_MOTION_FAILURE', () => {
      it('should set error and clear loading state', () => {
        const result = convergenceReducer(initialState, {
          type: 'GENERATE_SUBJECT_MOTION_FAILURE',
          payload: 'Video generation failed',
        });

        expect(result.isLoading).toBe(false);
        expect(result.error).toBe('Video generation failed');
      });
    });

    describe('SKIP_SUBJECT_MOTION', () => {
      it('should advance to preview with empty subject motion', () => {
        const state: ConvergenceState = {
          ...initialState,
          subjectMotion: 'some text',
        };

        const result = convergenceReducer(state, {
          type: 'SKIP_SUBJECT_MOTION',
        });

        expect(result.step).toBe('preview');
        expect(result.subjectMotion).toBe('');
      });
    });
  });

  describe('Finalize Actions', () => {
    describe('FINALIZE_REQUEST', () => {
      it('should set loading state for finalize', () => {
        const result = convergenceReducer(initialState, {
          type: 'FINALIZE_REQUEST',
        });

        expect(result.isLoading).toBe(true);
        expect(result.loadingOperation).toBe('finalize');
        expect(result.error).toBeNull();
      });
    });

    describe('FINALIZE_SUCCESS', () => {
      it('should update final state and mark complete', () => {
        const lockedDimensions = [createTestLockedDimension()];

        const result = convergenceReducer(initialState, {
          type: 'FINALIZE_SUCCESS',
          payload: {
            finalPrompt: 'Complete final prompt',
            lockedDimensions,
          },
        });

        expect(result.finalPrompt).toBe('Complete final prompt');
        expect(result.lockedDimensions).toEqual(lockedDimensions);
        expect(result.step).toBe('complete');
        expect(result.isLoading).toBe(false);
      });
    });

    describe('FINALIZE_FAILURE', () => {
      it('should set error and clear loading state', () => {
        const result = convergenceReducer(initialState, {
          type: 'FINALIZE_FAILURE',
          payload: 'Incomplete session',
        });

        expect(result.isLoading).toBe(false);
        expect(result.error).toBe('Incomplete session');
      });
    });
  });


  describe('Navigation Actions', () => {
    describe('GO_BACK', () => {
      it('should go back from mood to direction', () => {
        const state: ConvergenceState = {
          ...initialState,
          step: 'mood',
          direction: 'cinematic',
          lockedDimensions: [],
          imageHistory: new Map([
            ['direction', [createTestImage({ dimension: 'direction' })]],
          ]),
        };

        const result = convergenceReducer(state, { type: 'GO_BACK' });

        expect(result.step).toBe('direction');
        expect(result.direction).toBeNull();
        expect(result.focusedOptionIndex).toBe(0);
        expect(result.error).toBeNull();
      });

      it('should go back from framing to mood and unlock mood', () => {
        const moodDimension = createTestLockedDimension({ type: 'mood' });
        const moodImages = [createTestImage({ dimension: 'mood' })];
        const state: ConvergenceState = {
          ...initialState,
          step: 'framing',
          direction: 'cinematic',
          lockedDimensions: [moodDimension],
          imageHistory: new Map([
            ['mood', moodImages],
          ]),
        };

        const result = convergenceReducer(state, { type: 'GO_BACK' });

        expect(result.step).toBe('mood');
        expect(result.lockedDimensions).toEqual([moodDimension]);
        expect(result.currentImages).toEqual(moodImages);
      });

      it('should restore cached images when going back', () => {
        const cachedImages = [createTestImage({ dimension: 'direction' })];
        const state: ConvergenceState = {
          ...initialState,
          step: 'mood',
          imageHistory: new Map([['direction', cachedImages]]),
        };

        const result = convergenceReducer(state, { type: 'GO_BACK' });

        expect(result.currentImages).toEqual(cachedImages);
      });

      it('should preserve selected camera motion when going back to camera_motion', () => {
        const state: ConvergenceState = {
          ...initialState,
          step: 'subject_motion',
          selectedCameraMotion: 'push_in',
        };

        const result = convergenceReducer(state, { type: 'GO_BACK' });

        expect(result.step).toBe('camera_motion');
        expect(result.selectedCameraMotion).toBe('push_in');
      });
    });

    describe('JUMP_TO_STEP', () => {
      it('should jump to a specific step and unlock subsequent dimensions', () => {
        const moodDimension = createTestLockedDimension({ type: 'mood' });
        const framingDimension = createTestLockedDimension({ type: 'framing' });
        const state: ConvergenceState = {
          ...initialState,
          step: 'lighting',
          direction: 'cinematic',
          lockedDimensions: [moodDimension, framingDimension],
          imageHistory: new Map([
            ['mood', [createTestImage({ dimension: 'mood' })]],
          ]),
        };

        const result = convergenceReducer(state, {
          type: 'JUMP_TO_STEP',
          payload: {
            step: 'mood',
            lockedDimensions: [],
          },
        });

        expect(result.step).toBe('mood');
        expect(result.lockedDimensions).toEqual([]);
        expect(result.focusedOptionIndex).toBe(0);
        expect(result.error).toBeNull();
      });

      it('should clear direction when jumping to direction step', () => {
        const state: ConvergenceState = {
          ...initialState,
          step: 'mood',
          direction: 'cinematic',
        };

        const result = convergenceReducer(state, {
          type: 'JUMP_TO_STEP',
          payload: {
            step: 'direction',
            lockedDimensions: [],
          },
        });

        expect(result.direction).toBeNull();
      });

      it('should clear camera motion when jumping to step before camera_motion', () => {
        const state: ConvergenceState = {
          ...initialState,
          step: 'preview',
          selectedCameraMotion: 'push_in',
        };

        const result = convergenceReducer(state, {
          type: 'JUMP_TO_STEP',
          payload: {
            step: 'lighting',
            lockedDimensions: [],
          },
        });

        expect(result.selectedCameraMotion).toBeNull();
      });

      it('should restore cached images for target step', () => {
        const cachedImages = [createTestImage({ dimension: 'mood' })];
        const state: ConvergenceState = {
          ...initialState,
          step: 'lighting',
          imageHistory: new Map([['mood', cachedImages]]),
        };

        const result = convergenceReducer(state, {
          type: 'JUMP_TO_STEP',
          payload: {
            step: 'mood',
            lockedDimensions: [],
          },
        });

        expect(result.currentImages).toEqual(cachedImages);
      });
    });
  });


  describe('Cancellation Action', () => {
    describe('CANCEL_GENERATION', () => {
      it('should clear loading state and abort controller', () => {
        const state: ConvergenceState = {
          ...initialState,
          isLoading: true,
          loadingOperation: 'selectOption',
          abortController: new AbortController(),
        };

        const result = convergenceReducer(state, { type: 'CANCEL_GENERATION' });

        expect(result.isLoading).toBe(false);
        expect(result.loadingOperation).toBeNull();
        expect(result.abortController).toBeNull();
        expect(result.error).toBeNull();
      });
    });
  });

  describe('Resume Session Actions', () => {
    describe('PROMPT_RESUME', () => {
      it('should set pending resume session', () => {
        const session = createTestSession();

        const result = convergenceReducer(initialState, {
          type: 'PROMPT_RESUME',
          payload: session,
        });

        expect(result.pendingResumeSession).toEqual(session);
      });
    });

    describe('RESUME_SESSION', () => {
      it('should restore session state from pending session', () => {
        const session = createTestSession();
        const state: ConvergenceState = {
          ...initialState,
          pendingResumeSession: session,
        };

        const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

        expect(result.sessionId).toBe(session.id);
        expect(result.step).toBe(session.currentStep);
        expect(result.intent).toBe(session.intent);
        expect(result.direction).toBe(session.direction);
        expect(result.lockedDimensions).toEqual(session.lockedDimensions);
        expect(result.pendingResumeSession).toBeNull();
        expect(result.focusedOptionIndex).toBe(0);
      });

      it('should convert imageHistory from Record to Map', () => {
        const session = createTestSession({
          imageHistory: {
            direction: [createTestImage({ dimension: 'direction' })],
            mood: [createTestImage({ dimension: 'mood' })],
          },
        });
        const state: ConvergenceState = {
          ...initialState,
          pendingResumeSession: session,
        };

        const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

        expect(result.imageHistory).toBeInstanceOf(Map);
        expect(result.imageHistory.get('direction')).toHaveLength(1);
        expect(result.imageHistory.get('mood')).toHaveLength(1);
      });

      it('should convert regenerationCounts from Record to Map', () => {
        const session = createTestSession({
          regenerationCounts: { direction: 2, mood: 1 },
        });
        const state: ConvergenceState = {
          ...initialState,
          pendingResumeSession: session,
        };

        const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

        expect(result.regenerationCounts).toBeInstanceOf(Map);
        expect(result.regenerationCounts.get('direction')).toBe(2);
        expect(result.regenerationCounts.get('mood')).toBe(1);
      });

      it('should do nothing if no pending session', () => {
        const result = convergenceReducer(initialState, { type: 'RESUME_SESSION' });

        expect(result).toEqual(initialState);
      });
    });

    describe('ABANDON_SESSION', () => {
      it('should reset to initial state', () => {
        const state: ConvergenceState = {
          ...initialState,
          sessionId: 'session-123',
          step: 'mood',
          pendingResumeSession: createTestSession(),
        };

        const result = convergenceReducer(state, { type: 'ABANDON_SESSION' });

        expect(result.sessionId).toBeNull();
        expect(result.step).toBe('intent');
        expect(result.pendingResumeSession).toBeNull();
      });
    });
  });


  describe('Credits Modal Actions', () => {
    describe('SHOW_CREDITS_MODAL', () => {
      it('should show credits modal with details', () => {
        const state: ConvergenceState = {
          ...initialState,
          isLoading: true,
          loadingOperation: 'startSession',
        };

        const result = convergenceReducer(state, {
          type: 'SHOW_CREDITS_MODAL',
          payload: {
            required: 10,
            available: 5,
            operation: 'startSession',
          },
        });

        expect(result.insufficientCreditsModal).toEqual({
          required: 10,
          available: 5,
          operation: 'startSession',
        });
        expect(result.isLoading).toBe(false);
        expect(result.loadingOperation).toBeNull();
      });
    });

    describe('HIDE_CREDITS_MODAL', () => {
      it('should hide credits modal', () => {
        const state: ConvergenceState = {
          ...initialState,
          insufficientCreditsModal: {
            required: 10,
            available: 5,
            operation: 'startSession',
          },
        };

        const result = convergenceReducer(state, { type: 'HIDE_CREDITS_MODAL' });

        expect(result.insufficientCreditsModal).toBeNull();
      });
    });
  });

  describe('Keyboard Navigation Actions', () => {
    describe('MOVE_FOCUS', () => {
      it('should move focus left', () => {
        const state: ConvergenceState = {
          ...initialState,
          focusedOptionIndex: 2,
          currentOptions: [
            createTestOption(),
            createTestOption({ id: 'social' }),
            createTestOption({ id: 'artistic' }),
            createTestOption({ id: 'documentary' }),
          ],
        };

        const result = convergenceReducer(state, {
          type: 'MOVE_FOCUS',
          payload: 'ArrowLeft',
        });

        expect(result.focusedOptionIndex).toBe(1);
      });

      it('should wrap around when moving left from first option', () => {
        const state: ConvergenceState = {
          ...initialState,
          focusedOptionIndex: 0,
          currentOptions: [
            createTestOption(),
            createTestOption({ id: 'social' }),
            createTestOption({ id: 'artistic' }),
            createTestOption({ id: 'documentary' }),
          ],
        };

        const result = convergenceReducer(state, {
          type: 'MOVE_FOCUS',
          payload: 'ArrowLeft',
        });

        expect(result.focusedOptionIndex).toBe(3);
      });

      it('should move focus right', () => {
        const state: ConvergenceState = {
          ...initialState,
          focusedOptionIndex: 1,
          currentOptions: [
            createTestOption(),
            createTestOption({ id: 'social' }),
            createTestOption({ id: 'artistic' }),
            createTestOption({ id: 'documentary' }),
          ],
        };

        const result = convergenceReducer(state, {
          type: 'MOVE_FOCUS',
          payload: 'ArrowRight',
        });

        expect(result.focusedOptionIndex).toBe(2);
      });

      it('should wrap around when moving right from last option', () => {
        const state: ConvergenceState = {
          ...initialState,
          focusedOptionIndex: 3,
          currentOptions: [
            createTestOption(),
            createTestOption({ id: 'social' }),
            createTestOption({ id: 'artistic' }),
            createTestOption({ id: 'documentary' }),
          ],
        };

        const result = convergenceReducer(state, {
          type: 'MOVE_FOCUS',
          payload: 'ArrowRight',
        });

        expect(result.focusedOptionIndex).toBe(0);
      });

      it('should move focus up in grid', () => {
        const state: ConvergenceState = {
          ...initialState,
          step: 'direction',
          focusedOptionIndex: 5,
          currentOptions: Array(8).fill(null).map((_, i) => createTestOption({ id: `opt-${i}` })),
        };

        const result = convergenceReducer(state, {
          type: 'MOVE_FOCUS',
          payload: 'ArrowUp',
        });

        // 3 columns for <=9 options, so 5 - 3 = 2
        expect(result.focusedOptionIndex).toBe(2);
      });

      it('should not move up if already in first row', () => {
        const state: ConvergenceState = {
          ...initialState,
          step: 'direction',
          focusedOptionIndex: 2,
          currentOptions: Array(8).fill(null).map((_, i) => createTestOption({ id: `opt-${i}` })),
        };

        const result = convergenceReducer(state, {
          type: 'MOVE_FOCUS',
          payload: 'ArrowUp',
        });

        expect(result.focusedOptionIndex).toBe(2);
      });

      it('should move focus down in grid', () => {
        const state: ConvergenceState = {
          ...initialState,
          step: 'direction',
          focusedOptionIndex: 1,
          currentOptions: Array(8).fill(null).map((_, i) => createTestOption({ id: `opt-${i}` })),
        };

        const result = convergenceReducer(state, {
          type: 'MOVE_FOCUS',
          payload: 'ArrowDown',
        });

        // 3 columns for <=9 options, so 1 + 3 = 4
        expect(result.focusedOptionIndex).toBe(4);
      });

      it('should not move down if already in last row', () => {
        const state: ConvergenceState = {
          ...initialState,
          step: 'direction',
          focusedOptionIndex: 6,
          currentOptions: Array(8).fill(null).map((_, i) => createTestOption({ id: `opt-${i}` })),
        };

        const result = convergenceReducer(state, {
          type: 'MOVE_FOCUS',
          payload: 'ArrowDown',
        });

        expect(result.focusedOptionIndex).toBe(6);
      });

      it('should use 3 columns for camera_motion step', () => {
        const state: ConvergenceState = {
          ...initialState,
          step: 'camera_motion',
          focusedOptionIndex: 4,
          cameraPaths: Array(6).fill(null).map((_, i) => createTestCameraPath({ id: `path-${i}` })),
        };

        const result = convergenceReducer(state, {
          type: 'MOVE_FOCUS',
          payload: 'ArrowUp',
        });

        // 3 columns for <=9 options, so 4 - 3 = 1
        expect(result.focusedOptionIndex).toBe(1);
      });

      it('should do nothing if no options', () => {
        const state: ConvergenceState = {
          ...initialState,
          focusedOptionIndex: 0,
          currentOptions: [],
        };

        const result = convergenceReducer(state, {
          type: 'MOVE_FOCUS',
          payload: 'ArrowRight',
        });

        expect(result.focusedOptionIndex).toBe(0);
      });
    });

    describe('RESET_FOCUS', () => {
      it('should reset focus to first option', () => {
        const state: ConvergenceState = {
          ...initialState,
          focusedOptionIndex: 3,
        };

        const result = convergenceReducer(state, { type: 'RESET_FOCUS' });

        expect(result.focusedOptionIndex).toBe(0);
      });
    });
  });


  describe('Reset Action', () => {
    describe('RESET', () => {
      it('should reset to initial state', () => {
        const state: ConvergenceState = {
          ...initialState,
          sessionId: 'session-123',
          step: 'preview',
          intent: 'A beautiful sunset',
          direction: 'cinematic',
          lockedDimensions: [createTestLockedDimension()],
          currentImages: [createTestImage()],
          isLoading: true,
          error: 'Some error',
        };

        const result = convergenceReducer(state, { type: 'RESET' });

        expect(result).toEqual(initialState);
      });
    });
  });

  describe('Generic Error Action', () => {
    describe('GENERIC_ERROR', () => {
      it('should set error and clear loading state', () => {
        const state: ConvergenceState = {
          ...initialState,
          isLoading: true,
          loadingOperation: 'selectOption',
          abortController: new AbortController(),
        };

        const result = convergenceReducer(state, {
          type: 'GENERIC_ERROR',
          payload: 'An unexpected error occurred',
        });

        expect(result.isLoading).toBe(false);
        expect(result.loadingOperation).toBeNull();
        expect(result.error).toBe('An unexpected error occurred');
        expect(result.abortController).toBeNull();
      });
    });
  });

  describe('Unknown Action', () => {
    it('should return current state for unknown action', () => {
      const state: ConvergenceState = {
        ...initialState,
        sessionId: 'session-123',
      };

      // @ts-expect-error - Testing unknown action type
      const result = convergenceReducer(state, { type: 'UNKNOWN_ACTION' });

      expect(result).toEqual(state);
    });
  });
});
