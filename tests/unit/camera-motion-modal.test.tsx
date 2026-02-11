import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { CameraMotionModal } from '@components/modals/CameraMotionModal';
import type { CameraPath } from '@/features/convergence/types';
import { useCameraMotion } from '@/hooks/useCameraMotion';
import { useResolvedMediaUrl } from '@/hooks/useResolvedMediaUrl';

const mockPickerRender = vi.fn();

vi.mock('@/features/convergence/components/CameraMotionPicker', () => ({
  CameraMotionPickerWithErrorBoundary: (props: unknown) => {
    mockPickerRender(props);
    return <div data-testid="camera-motion-picker" />;
  },
}));

vi.mock('@/hooks/useCameraMotion', () => ({
  useCameraMotion: vi.fn(),
}));

vi.mock('@/hooks/useResolvedMediaUrl', () => ({
  useResolvedMediaUrl: vi.fn(),
}));

const mockUseCameraMotion = vi.mocked(useCameraMotion);
const mockUseResolvedMediaUrl = vi.mocked(useResolvedMediaUrl);

const cameraPath: CameraPath = {
  id: 'static',
  label: 'Static',
  category: 'static',
  start: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { pitch: 0, yaw: 0, roll: 0 },
  },
  end: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { pitch: 0, yaw: 0, roll: 0 },
  },
  duration: 3,
};

describe('CameraMotionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses resolved keyframe URL for camera motion preview image source', async () => {
    const estimateDepth = vi.fn().mockResolvedValue(undefined);
    const reset = vi.fn();

    mockUseCameraMotion.mockReturnValue({
      state: {
        isEstimatingDepth: false,
        error: null,
        depthMapUrl: 'https://fal.media/files/depth.png',
        cameraPaths: [cameraPath],
        fallbackMode: false,
        hasEstimated: false,
        selectedCameraMotion: null,
        subjectMotion: '',
      },
      actions: {
        estimateDepth,
        selectCameraMotion: vi.fn(),
        clearSelection: vi.fn(),
        setSubjectMotion: vi.fn(),
        reset,
      },
    });

    const staleSignedUrl =
      'https://storage.googleapis.com/vidra-media-prod/users/user-1/previews/images/stale.jpg?X-Goog-Date=20260131T223719Z&X-Goog-Expires=3600';
    const refreshedSignedUrl =
      'https://storage.googleapis.com/vidra-media-prod/users/user-1/previews/images/stale.jpg?X-Goog-Date=20260211T222000Z&X-Goog-Expires=3600';

    mockUseResolvedMediaUrl.mockReturnValue({
      url: refreshedSignedUrl,
      expiresAt: null,
      loading: false,
      error: null,
      refresh: vi.fn().mockResolvedValue({
        url: refreshedSignedUrl,
        source: 'storage',
      }),
    });

    render(
      <CameraMotionModal
        isOpen={true}
        onClose={vi.fn()}
        imageUrl={staleSignedUrl}
        imageStoragePath="users/user-1/previews/images/stale.jpg"
        onSelect={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(mockPickerRender).toHaveBeenCalled();
    });

    const pickerProps = mockPickerRender.mock.calls.at(-1)?.[0] as { imageUrl?: string };
    expect(pickerProps.imageUrl).toBe(refreshedSignedUrl);
    expect(estimateDepth).toHaveBeenCalledWith(staleSignedUrl);
    expect(reset).toHaveBeenCalled();
  });
});
