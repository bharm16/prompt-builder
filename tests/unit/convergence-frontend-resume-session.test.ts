/**
 * Unit tests for RESUME_SESSION imageHistory Map conversion
 *
 * Tests the RESUME_SESSION action to ensure it correctly converts
 * imageHistory and regenerationCounts from Record (JSON) to Map.
 *
 * Requirements tested:
 * - 1.6: Resume incomplete sessions from previous visits
 * - 9.4: Track regeneration counts per dimension as Map
 * - 9.8: Preserve previously generated images for each dimension
 *
 * Task: 33.3 Test RESUME_SESSION imageHistory Map conversion
 *
 * @module convergence-frontend-resume-session.test
 */

import { describe, it, expect } from 'vitest';
import {
  convergenceReducer,
  initialState,
  type ConvergenceState,
} from '@features/convergence/hooks/useConvergenceSession';
import type {
  GeneratedImage,
  LockedDimension,
  ConvergenceSession,
  DimensionType,
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
 * Creates a test convergence session with Record-based imageHistory
 * (as it would come from the backend/JSON)
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
    // Backend returns Record, not Map
    imageHistory: {
      direction: [createTestImage({ dimension: 'direction', optionId: 'cinematic' })],
      mood: [createTestImage({ dimension: 'mood', optionId: 'dramatic' })],
    },
    // Backend returns Record, not Map
    regenerationCounts: { direction: 1, mood: 2 },
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

describe('RESUME_SESSION imageHistory Map Conversion', () => {
  describe('imageHistory Conversion', () => {
    it('should convert imageHistory from Record to Map', () => {
      const session = createTestSession({
        imageHistory: {
          direction: [createTestImage({ dimension: 'direction' })],
          mood: [createTestImage({ dimension: 'mood' })],
          framing: [createTestImage({ dimension: 'framing' })],
        },
      });

      const state: ConvergenceState = {
        ...initialState,
        pendingResumeSession: session,
      };

      const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

      // Verify it's a Map
      expect(result.imageHistory).toBeInstanceOf(Map);

      // Verify all entries are present
      expect(result.imageHistory.size).toBe(3);
      expect(result.imageHistory.has('direction')).toBe(true);
      expect(result.imageHistory.has('mood')).toBe(true);
      expect(result.imageHistory.has('framing')).toBe(true);
    });

    it('should preserve image data during conversion', () => {
      const directionImage = createTestImage({
        dimension: 'direction',
        optionId: 'cinematic',
        url: 'https://storage.googleapis.com/direction.png',
      });
      const moodImage = createTestImage({
        dimension: 'mood',
        optionId: 'dramatic',
        url: 'https://storage.googleapis.com/mood.png',
      });

      const session = createTestSession({
        imageHistory: {
          direction: [directionImage],
          mood: [moodImage],
        },
      });

      const state: ConvergenceState = {
        ...initialState,
        pendingResumeSession: session,
      };

      const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

      // Verify image data is preserved
      const directionImages = result.imageHistory.get('direction');
      expect(directionImages).toHaveLength(1);
      expect(directionImages?.[0]?.url).toBe('https://storage.googleapis.com/direction.png');
      expect(directionImages?.[0]?.optionId).toBe('cinematic');

      const moodImages = result.imageHistory.get('mood');
      expect(moodImages).toHaveLength(1);
      expect(moodImages?.[0]?.url).toBe('https://storage.googleapis.com/mood.png');
      expect(moodImages?.[0]?.optionId).toBe('dramatic');
    });

    it('should handle empty imageHistory', () => {
      const session = createTestSession({
        imageHistory: {},
      });

      const state: ConvergenceState = {
        ...initialState,
        pendingResumeSession: session,
      };

      const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

      expect(result.imageHistory).toBeInstanceOf(Map);
      expect(result.imageHistory.size).toBe(0);
    });

    it('should handle null/undefined imageHistory', () => {
      const session = createTestSession();
      // @ts-expect-error - Testing null case
      session.imageHistory = null;

      const state: ConvergenceState = {
        ...initialState,
        pendingResumeSession: session,
      };

      const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

      expect(result.imageHistory).toBeInstanceOf(Map);
      expect(result.imageHistory.size).toBe(0);
    });

    it('should handle multiple images per dimension', () => {
      const session = createTestSession({
        imageHistory: {
          direction: [
            createTestImage({ dimension: 'direction', optionId: 'cinematic' }),
            createTestImage({ dimension: 'direction', optionId: 'social' }),
            createTestImage({ dimension: 'direction', optionId: 'artistic' }),
            createTestImage({ dimension: 'direction', optionId: 'documentary' }),
          ],
        },
      });

      const state: ConvergenceState = {
        ...initialState,
        pendingResumeSession: session,
      };

      const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

      const directionImages = result.imageHistory.get('direction');
      expect(directionImages).toHaveLength(4);
    });

    it('should correctly type dimension keys', () => {
      const session = createTestSession({
        imageHistory: {
          direction: [createTestImage({ dimension: 'direction' })],
          mood: [createTestImage({ dimension: 'mood' })],
          framing: [createTestImage({ dimension: 'framing' })],
          lighting: [createTestImage({ dimension: 'lighting' })],
          camera_motion: [createTestImage({ dimension: 'camera_motion' })],
        },
      });

      const state: ConvergenceState = {
        ...initialState,
        pendingResumeSession: session,
      };

      const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

      // All dimension types should be accessible
      const dimensions: Array<DimensionType | 'direction'> = [
        'direction',
        'mood',
        'framing',
        'lighting',
        'camera_motion',
      ];

      for (const dim of dimensions) {
        expect(result.imageHistory.has(dim)).toBe(true);
      }
    });
  });


  describe('regenerationCounts Conversion', () => {
    it('should convert regenerationCounts from Record to Map', () => {
      const session = createTestSession({
        regenerationCounts: {
          direction: 2,
          mood: 1,
          framing: 3,
        },
      });

      const state: ConvergenceState = {
        ...initialState,
        pendingResumeSession: session,
      };

      const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

      // Verify it's a Map
      expect(result.regenerationCounts).toBeInstanceOf(Map);

      // Verify all entries are present
      expect(result.regenerationCounts.size).toBe(3);
      expect(result.regenerationCounts.get('direction')).toBe(2);
      expect(result.regenerationCounts.get('mood')).toBe(1);
      expect(result.regenerationCounts.get('framing')).toBe(3);
    });

    it('should handle empty regenerationCounts', () => {
      const session = createTestSession({
        regenerationCounts: {},
      });

      const state: ConvergenceState = {
        ...initialState,
        pendingResumeSession: session,
      };

      const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

      expect(result.regenerationCounts).toBeInstanceOf(Map);
      expect(result.regenerationCounts.size).toBe(0);
    });

    it('should handle null/undefined regenerationCounts', () => {
      const session = createTestSession();
      // @ts-expect-error - Testing null case
      session.regenerationCounts = null;

      const state: ConvergenceState = {
        ...initialState,
        pendingResumeSession: session,
      };

      const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

      expect(result.regenerationCounts).toBeInstanceOf(Map);
      expect(result.regenerationCounts.size).toBe(0);
    });

    it('should preserve count values during conversion', () => {
      const session = createTestSession({
        regenerationCounts: {
          direction: 0,
          mood: 1,
          framing: 2,
          lighting: 3,
        },
      });

      const state: ConvergenceState = {
        ...initialState,
        pendingResumeSession: session,
      };

      const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

      expect(result.regenerationCounts.get('direction')).toBe(0);
      expect(result.regenerationCounts.get('mood')).toBe(1);
      expect(result.regenerationCounts.get('framing')).toBe(2);
      expect(result.regenerationCounts.get('lighting')).toBe(3);
    });
  });

  describe('Full Session Restoration', () => {
    it('should restore all session state correctly', () => {
      const session = createTestSession({
        id: 'restored-session-id',
        intent: 'A cat walking in the rain',
        direction: 'artistic',
        currentStep: 'lighting',
        lockedDimensions: [
          createTestLockedDimension({ type: 'mood', optionId: 'mysterious' }),
          createTestLockedDimension({ type: 'framing', optionId: 'closeup' }),
        ],
        depthMapUrl: 'https://storage.googleapis.com/depth.png',
        cameraMotion: 'push_in',
        subjectMotion: 'walking slowly',
        finalPrompt: 'A cat walking in the rain, artistic style',
        imageHistory: {
          direction: [createTestImage({ dimension: 'direction' })],
          mood: [createTestImage({ dimension: 'mood' })],
          framing: [createTestImage({ dimension: 'framing' })],
        },
        regenerationCounts: { direction: 1, mood: 2 },
      });

      const state: ConvergenceState = {
        ...initialState,
        pendingResumeSession: session,
      };

      const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

      // Verify all state is restored
      expect(result.sessionId).toBe('restored-session-id');
      expect(result.intent).toBe('A cat walking in the rain');
      expect(result.direction).toBe('artistic');
      expect(result.step).toBe('lighting');
      expect(result.lockedDimensions).toHaveLength(2);
      expect(result.depthMapUrl).toBe('https://storage.googleapis.com/depth.png');
      expect(result.selectedCameraMotion).toBe('push_in');
      expect(result.subjectMotion).toBe('walking slowly');
      expect(result.finalPrompt).toBe('A cat walking in the rain, artistic style');

      // Verify Maps are correctly converted
      expect(result.imageHistory).toBeInstanceOf(Map);
      expect(result.imageHistory.size).toBe(3);
      expect(result.regenerationCounts).toBeInstanceOf(Map);
      expect(result.regenerationCounts.size).toBe(2);

      // Verify pending session is cleared
      expect(result.pendingResumeSession).toBeNull();

      // Verify focus is reset
      expect(result.focusedOptionIndex).toBe(0);
    });

    it('should set currentImages from imageHistory based on currentStep', () => {
      const framingImages = [
        createTestImage({ dimension: 'framing', optionId: 'wide' }),
        createTestImage({ dimension: 'framing', optionId: 'medium' }),
      ];

      const session = createTestSession({
        currentStep: 'framing',
        imageHistory: {
          direction: [createTestImage({ dimension: 'direction' })],
          mood: [createTestImage({ dimension: 'mood' })],
          framing: framingImages,
        },
        generatedImages: [createTestImage()], // Fallback
      });

      const state: ConvergenceState = {
        ...initialState,
        pendingResumeSession: session,
      };

      const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

      // Should use images from imageHistory for current step
      expect(result.currentImages).toEqual(framingImages);
    });

    it('should fallback to generatedImages if no history for current step', () => {
      const generatedImages = [createTestImage()];

      const session = createTestSession({
        currentStep: 'lighting',
        imageHistory: {
          direction: [createTestImage({ dimension: 'direction' })],
          mood: [createTestImage({ dimension: 'mood' })],
          // No lighting images in history
        },
        generatedImages,
      });

      const state: ConvergenceState = {
        ...initialState,
        pendingResumeSession: session,
      };

      const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

      // Should fallback to generatedImages
      expect(result.currentImages).toEqual(generatedImages);
    });

    it('should handle non-dimension steps (subject_motion, preview)', () => {
      const generatedImages = [createTestImage()];

      const session = createTestSession({
        currentStep: 'subject_motion',
        imageHistory: {
          direction: [createTestImage({ dimension: 'direction' })],
        },
        generatedImages,
      });

      const state: ConvergenceState = {
        ...initialState,
        pendingResumeSession: session,
      };

      const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

      // For non-dimension steps, should use generatedImages
      expect(result.currentImages).toEqual(generatedImages);
    });
  });

  describe('Edge Cases', () => {
    it('should do nothing if no pending session', () => {
      const result = convergenceReducer(initialState, { type: 'RESUME_SESSION' });

      expect(result).toEqual(initialState);
    });

    it('should handle session with null subjectMotion', () => {
      const session = createTestSession({
        subjectMotion: null,
      });

      const state: ConvergenceState = {
        ...initialState,
        pendingResumeSession: session,
      };

      const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

      expect(result.subjectMotion).toBe('');
    });

    it('should handle session with empty string subjectMotion', () => {
      const session = createTestSession({
        subjectMotion: '',
      });

      const state: ConvergenceState = {
        ...initialState,
        pendingResumeSession: session,
      };

      const result = convergenceReducer(state, { type: 'RESUME_SESSION' });

      expect(result.subjectMotion).toBe('');
    });
  });
});
