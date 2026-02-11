import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
  ContinuitySession,
  ContinuityShot,
  StyleReference,
} from '@features/continuity/types';
import { useStyleReference } from '../useStyleReference';

const primaryStyleRef: StyleReference = {
  id: 'style-primary',
  frameUrl: 'https://cdn/style-primary.png',
  frameTimestamp: 0,
  resolution: { width: 1280, height: 720 },
  aspectRatio: '16:9',
};

const referencedStyleRef: StyleReference = {
  id: 'style-shot-2',
  frameUrl: 'https://cdn/style-shot-2.png',
  frameTimestamp: 1,
  resolution: { width: 1280, height: 720 },
  aspectRatio: '16:9',
};

const shotA: ContinuityShot = {
  id: 'shot-a',
  sessionId: 'session-1',
  sequenceIndex: 0,
  userPrompt: 'Shot A',
  continuityMode: 'style-match',
  styleStrength: 0.7,
  styleReferenceId: null,
  modelId: 'sora-2',
  status: 'draft',
  createdAt: '2025-01-01T00:00:00.000Z',
};

const shotB: ContinuityShot = {
  ...shotA,
  id: 'shot-b',
  styleReference: referencedStyleRef,
};

const session: ContinuitySession = {
  id: 'session-1',
  userId: 'user-1',
  name: 'Session',
  primaryStyleReference: primaryStyleRef,
  shots: [shotA, shotB],
  defaultSettings: {
    generationMode: 'continuity',
    defaultContinuityMode: 'style-match',
    defaultStyleStrength: 0.7,
    defaultModel: 'sora-2',
    autoExtractFrameBridge: true,
    useCharacterConsistency: true,
  },
  status: 'active',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('useStyleReference', () => {
  it('returns null when session is missing', () => {
    const { result } = renderHook(() => useStyleReference(null, shotA));
    expect(result.current).toBeNull();
  });

  it('returns primary style reference when shot is missing', () => {
    const { result } = renderHook(() => useStyleReference(session, null));
    expect(result.current).toEqual(primaryStyleRef);
  });

  it('returns primary style when shot has no styleReferenceId', () => {
    const { result } = renderHook(() => useStyleReference(session, shotA));
    expect(result.current).toEqual(primaryStyleRef);
  });

  it('returns referenced shot style when styleReferenceId points to another shot', () => {
    const selectedShot: ContinuityShot = {
      ...shotA,
      id: 'shot-c',
      styleReferenceId: 'shot-b',
    };

    const { result } = renderHook(() => useStyleReference(session, selectedShot));
    expect(result.current).toEqual(referencedStyleRef);
  });

  it('falls back to primary style when referenced shot has no styleReference', () => {
    const selectedShot: ContinuityShot = {
      ...shotA,
      styleReferenceId: 'shot-a',
    };

    const { result } = renderHook(() => useStyleReference(session, selectedShot));
    expect(result.current).toEqual(primaryStyleRef);
  });
});
