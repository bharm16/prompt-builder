import { describe, it, expect, vi } from 'vitest';
import { I2VMotionStrategy } from '../I2VMotionStrategy';
import type { AIService } from '../../types';
import type { ImageObservation } from '@services/image-observation/types';

const createAIStub = (payload: Record<string, unknown>): AIService => ({
  execute: vi.fn().mockResolvedValue({
    text: JSON.stringify(payload),
    metadata: {},
  }),
});

const baseObservation: ImageObservation = {
  imageHash: 'hash',
  observedAt: new Date(),
  confidence: 0.9,
  subject: {
    type: 'person',
    description: 'elderly man',
    position: 'center',
    confidence: 0.9,
  },
  framing: {
    shotType: 'close-up',
    angle: 'eye-level',
    confidence: 0.9,
  },
  lighting: {
    quality: 'natural',
    timeOfDay: 'day',
    confidence: 0.9,
  },
  motion: {
    recommended: ['static'],
    risky: ['pan-left'],
    risks: [{ movement: 'pan-left', reason: 'risky' }],
  },
};

describe('I2VMotionStrategy', () => {
  it('removes visuals and blocks risky camera moves in strict mode', async () => {
    const ai = createAIStub({
      motion: {
        subjectAction: 'She reaches for the cup',
        cameraMovement: 'pan left',
        pacing: 'slow',
        emotional: null,
      },
      visual: {
        subjectDescription: 'young woman',
        lighting: 'warm',
        environment: 'kitchen',
        shotType: 'wide shot',
        timeOfDay: 'night',
      },
    });

    const strategy = new I2VMotionStrategy(ai);
    const result = await strategy.optimize({
      prompt: 'She reaches for the cup in a wide shot at night',
      observation: baseObservation,
      mode: 'strict',
      cameraMotionLocked: false,
    });

    expect(result.prompt).toContain('She reaches for the cup');
    expect(result.prompt).toContain('smooth gentle movement');
    expect(result.prompt.toLowerCase()).not.toContain('kitchen');
    expect(result.prompt.toLowerCase()).not.toContain('pan left');

    const categories = result.conflicts.map((conflict) => conflict.category);
    expect(categories).toEqual(
      expect.arrayContaining(['subject.identity', 'lighting', 'shot.type', 'camera.movement'])
    );
  });

  it('retains visuals and camera moves in flexible mode', async () => {
    const ai = createAIStub({
      motion: {
        subjectAction: 'She reaches for the cup',
        cameraMovement: 'pan left',
        pacing: 'slow',
        emotional: null,
      },
      visual: {
        subjectDescription: 'young woman',
        lighting: 'warm',
        environment: 'kitchen',
        shotType: 'wide shot',
        timeOfDay: 'night',
      },
    });

    const strategy = new I2VMotionStrategy(ai);
    const result = await strategy.optimize({
      prompt: 'She reaches for the cup in a wide shot at night',
      observation: baseObservation,
      mode: 'flexible',
      cameraMotionLocked: false,
    });

    const lower = result.prompt.toLowerCase();
    expect(lower).toContain('kitchen');
    expect(lower).toContain('pan left');
  });
});
