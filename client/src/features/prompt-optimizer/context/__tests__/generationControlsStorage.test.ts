import { beforeEach, describe, expect, it } from 'vitest';
import type { CameraPath } from '@/features/convergence/types';
import {
  loadCameraMotion,
  loadSubjectMotion,
  persistCameraMotion,
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
});
