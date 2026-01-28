import type { VideoPromptIR } from '../../types';

export function createEmptyIR(raw: string): VideoPromptIR {
  return {
    subjects: [],
    actions: [],
    camera: {
      movements: [],
    },
    environment: {
      setting: '',
      lighting: [],
    },
    audio: {},
    meta: {
      mood: [],
      style: [],
    },
    technical: {},
    raw,
  };
}
