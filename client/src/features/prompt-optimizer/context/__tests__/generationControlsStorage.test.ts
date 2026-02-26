import { beforeEach, describe, expect, it } from 'vitest';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import type { CameraPath } from '@/features/convergence/types';
import {
  loadCameraMotion,
  loadKeyframes,
  loadSubjectMotion,
  persistCameraMotion,
  persistKeyframes,
  persistSubjectMotion,
} from '../generationControlsStorage';

const SAMPLE_CAMERA_MOTION: CameraPath = {
  id: 'pan_left',
  label: 'Pan Left',
  category: 'pan_tilt',
  start: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { pitch: 0, yaw: 0, roll: 0 },
  },
  end: {
    position: { x: 1, y: 0, z: 0 },
    rotation: { pitch: 0, yaw: 0.1, roll: 0 },
  },
  duration: 1,
};

beforeEach(() => {
  localStorage.clear();
});

describe('generationControlsStorage', () => {
  it('persists and loads camera motion', () => {
    persistCameraMotion(SAMPLE_CAMERA_MOTION);
    expect(loadCameraMotion()).toEqual(SAMPLE_CAMERA_MOTION);
  });

  it('returns null for corrupted camera motion data', () => {
    localStorage.setItem('generation-controls:cameraMotion', 'not json');
    expect(loadCameraMotion()).toBeNull();

    localStorage.setItem('generation-controls:cameraMotion', JSON.stringify({ id: 'bad' }));
    expect(loadCameraMotion()).toBeNull();
  });

  it('clears camera motion when persisted null', () => {
    persistCameraMotion(SAMPLE_CAMERA_MOTION);
    persistCameraMotion(null);
    expect(loadCameraMotion()).toBeNull();
    expect(localStorage.getItem('generation-controls:cameraMotion')).toBeNull();
  });

  it('persists and loads subject motion', () => {
    persistSubjectMotion('Walks forward');
    expect(loadSubjectMotion()).toBe('Walks forward');
  });

  it('clears subject motion when empty', () => {
    persistSubjectMotion('Spin');
    persistSubjectMotion('');
    expect(loadSubjectMotion()).toBe('');
    expect(localStorage.getItem('generation-controls:subjectMotion')).toBeNull();
  });

  describe('keyframes', () => {
    const SAMPLE_KEYFRAMES: KeyframeTile[] = [
      {
        id: 'kf-1',
        url: 'https://storage.example.com/frame1.png',
        source: 'upload',
        storagePath: 'uploads/frame1.png',
      },
      {
        id: 'kf-2',
        url: 'https://storage.example.com/frame2.png',
        source: 'asset',
        assetId: 'asset-123',
      },
    ];

    it('persists and loads keyframes', () => {
      persistKeyframes(SAMPLE_KEYFRAMES);
      expect(loadKeyframes()).toEqual(SAMPLE_KEYFRAMES);
    });

    it('returns empty array for corrupted keyframes data', () => {
      localStorage.setItem('generation-controls:keyframes', 'not json');
      expect(loadKeyframes()).toEqual([]);

      localStorage.setItem('generation-controls:keyframes', JSON.stringify([{ id: 'bad' }]));
      expect(loadKeyframes()).toEqual([]);
    });

    it('clears keyframes when persisted empty array', () => {
      persistKeyframes(SAMPLE_KEYFRAMES);
      persistKeyframes([]);
      expect(loadKeyframes()).toEqual([]);
      expect(localStorage.getItem('generation-controls:keyframes')).toBeNull();
    });

    it('loads single keyframe', () => {
      persistKeyframes(SAMPLE_KEYFRAMES.slice(0, 1));
      const loaded = loadKeyframes();
      expect(loaded).toHaveLength(1);
      expect(loaded[0]?.id).toBe('kf-1');
    });
  });
});
