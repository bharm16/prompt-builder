import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockEstimateDepth } = vi.hoisted(() => ({
  mockEstimateDepth: vi.fn(),
}));

vi.mock('@/api/motionApi', () => ({
  estimateDepth: mockEstimateDepth,
}));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import { useCameraMotion } from '../useCameraMotion';

const cameraPath = {
  id: 'orbit-left',
  label: 'Orbit Left',
  category: 'orbital' as const,
  duration: 4,
  start: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { pitch: 0, yaw: 0, roll: 0 },
  },
  end: {
    position: { x: 0.2, y: 0.1, z: -0.3 },
    rotation: { pitch: 0.1, yaw: 0.2, roll: 0 },
  },
};

describe('useCameraMotion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with expected initial reducer state', () => {
    const { result } = renderHook(() => useCameraMotion());

    expect(result.current.state).toMatchObject({
      isEstimatingDepth: false,
      error: null,
      depthMapUrl: null,
      cameraPaths: [],
      fallbackMode: false,
      hasEstimated: false,
      selectedCameraMotion: null,
      subjectMotion: '',
    });
  });

  it('handles estimateDepth success transition', async () => {
    mockEstimateDepth.mockResolvedValue({
      depthMapUrl: 'https://cdn/depth.png',
      cameraPaths: [cameraPath],
      fallbackMode: false,
    });

    const { result } = renderHook(() => useCameraMotion());

    await act(async () => {
      await result.current.actions.estimateDepth('  https://image/input.png  ');
    });

    expect(mockEstimateDepth).toHaveBeenCalledWith('https://image/input.png');
    expect(result.current.state).toMatchObject({
      isEstimatingDepth: false,
      error: null,
      depthMapUrl: 'https://cdn/depth.png',
      cameraPaths: [cameraPath],
      fallbackMode: false,
      hasEstimated: true,
    });
  });

  it('handles estimateDepth failure transition', async () => {
    mockEstimateDepth.mockRejectedValue(new Error('Depth service unavailable'));

    const { result } = renderHook(() => useCameraMotion());

    await act(async () => {
      await result.current.actions.estimateDepth('https://image/input.png');
    });

    expect(result.current.state).toMatchObject({
      isEstimatingDepth: false,
      error: 'Depth service unavailable',
      fallbackMode: true,
      hasEstimated: true,
    });
  });

  it('supports select/clear subject motion and reset actions', async () => {
    mockEstimateDepth.mockResolvedValue({
      depthMapUrl: 'https://cdn/depth.png',
      cameraPaths: [cameraPath],
      fallbackMode: false,
    });

    const { result } = renderHook(() => useCameraMotion());

    await act(async () => {
      await result.current.actions.estimateDepth('https://image/input.png');
    });

    act(() => {
      result.current.actions.selectCameraMotion(cameraPath);
      result.current.actions.setSubjectMotion('Actor steps forward');
    });

    expect(result.current.state.selectedCameraMotion).toEqual(cameraPath);
    expect(result.current.state.subjectMotion).toBe('Actor steps forward');

    act(() => {
      result.current.actions.clearSelection();
    });

    expect(result.current.state.selectedCameraMotion).toBeNull();

    act(() => {
      result.current.actions.reset();
    });

    await waitFor(() => {
      expect(result.current.state).toMatchObject({
        isEstimatingDepth: false,
        error: null,
        depthMapUrl: null,
        cameraPaths: [],
        fallbackMode: false,
        hasEstimated: false,
        selectedCameraMotion: null,
        subjectMotion: '',
      });
    });
  });
});
