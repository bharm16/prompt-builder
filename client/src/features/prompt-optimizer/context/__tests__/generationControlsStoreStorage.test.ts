import { beforeEach, describe, expect, it } from 'vitest';
import type { GenerationControlsState } from '../generationControlsStoreTypes';
import {
  loadGenerationControlsStoreState,
  persistGenerationControlsStoreState,
} from '../generationControlsStoreStorage';

const SAMPLE_STATE: GenerationControlsState = {
  domain: {
    selectedModel: 'model-1',
    generationParams: { aspect_ratio: '16:9', duration_s: 5 },
    videoTier: 'draft',
    keyframes: [
      {
        id: 'kf-1',
        url: 'https://storage.example.com/frame1.png',
        source: 'upload',
        storagePath: 'uploads/frame1.png',
      },
    ],
    cameraMotion: {
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
    },
    subjectMotion: 'Walk forward',
  },
  ui: {
    activeTab: 'image',
    imageSubTab: 'styles',
    constraintMode: 'flexible',
  },
};

beforeEach(() => {
  localStorage.clear();
});

describe('generationControlsStoreStorage', () => {
  it('loads from new storage key when present', () => {
    localStorage.setItem('prompt-optimizer:generationControlsStore', JSON.stringify(SAMPLE_STATE));
    expect(loadGenerationControlsStoreState()).toEqual(SAMPLE_STATE);
  });

  it('migrates from legacy keys when new key is missing', () => {
    localStorage.setItem('prompt-optimizer:selectedModel', 'legacy-model');
    localStorage.setItem('prompt-optimizer:generationParams', JSON.stringify({ aspect_ratio: '9:16' }));
    localStorage.setItem('prompt-optimizer:videoTier', 'render');
    localStorage.setItem(
      'generation-controls:keyframes',
      JSON.stringify([
        {
          id: 'legacy-kf',
          url: 'https://example.com/legacy.png',
          source: 'upload',
        },
      ])
    );
    localStorage.setItem(
      'generation-controls:cameraMotion',
      JSON.stringify({
        id: 'static',
        label: 'Static',
        category: 'static',
        start: { position: { x: 0, y: 0, z: 0 }, rotation: { pitch: 0, yaw: 0, roll: 0 } },
        end: { position: { x: 0, y: 0, z: 0 }, rotation: { pitch: 0, yaw: 0, roll: 0 } },
        duration: 1,
      })
    );
    localStorage.setItem('generation-controls:subjectMotion', 'Legacy motion');
    localStorage.setItem('generation-controls:activeTab', 'video');
    localStorage.setItem('generation-controls:imageSubTab', 'references');
    localStorage.setItem('generation-controls:constraintMode', 'strict');

    const loaded = loadGenerationControlsStoreState();
    expect(loaded.domain.selectedModel).toBe('legacy-model');
    expect(loaded.domain.generationParams).toEqual({ aspect_ratio: '9:16' });
    expect(loaded.domain.videoTier).toBe('render');
    expect(loaded.domain.keyframes).toHaveLength(1);
    expect(loaded.domain.cameraMotion?.id).toBe('static');
    expect(loaded.domain.subjectMotion).toBe('Legacy motion');
    expect(loaded.ui.activeTab).toBe('video');
    expect(loaded.ui.imageSubTab).toBe('references');
    expect(loaded.ui.constraintMode).toBe('strict');
  });

  it('falls back to legacy keys when new key is invalid', () => {
    localStorage.setItem('prompt-optimizer:generationControlsStore', 'not json');
    localStorage.setItem('prompt-optimizer:selectedModel', 'legacy-model');

    const loaded = loadGenerationControlsStoreState();
    expect(loaded.domain.selectedModel).toBe('legacy-model');
  });

  it('persists to new key only', () => {
    persistGenerationControlsStoreState(SAMPLE_STATE);

    const stored = localStorage.getItem('prompt-optimizer:generationControlsStore');
    expect(stored).not.toBeNull();

    expect(localStorage.getItem('prompt-optimizer:selectedModel')).toBeNull();
    expect(localStorage.getItem('prompt-optimizer:generationParams')).toBeNull();
    expect(localStorage.getItem('prompt-optimizer:videoTier')).toBeNull();
    expect(localStorage.getItem('generation-controls:keyframes')).toBeNull();
    expect(localStorage.getItem('generation-controls:cameraMotion')).toBeNull();
    expect(localStorage.getItem('generation-controls:subjectMotion')).toBeNull();
    expect(localStorage.getItem('generation-controls:activeTab')).toBeNull();
    expect(localStorage.getItem('generation-controls:imageSubTab')).toBeNull();
    expect(localStorage.getItem('generation-controls:constraintMode')).toBeNull();
  });
});
