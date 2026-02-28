import { describe, expect, it } from 'vitest';
import { VideoPromptDetectionService } from '@services/video-prompt-analysis/services/detection/VideoPromptDetectionService';

describe('VideoPromptDetectionService regression', () => {
  it('detects natural-language cinematographic prompts without template markers', () => {
    const service = new VideoPromptDetectionService();
    const prompt =
      'A baby sits in a car seat while the camera captures a close-up at eye-level with shallow depth of field.';

    expect(service.isVideoPrompt(prompt)).toBe(true);
  });

  it('requires at least two cinematographic cues to avoid single-word false positives', () => {
    const service = new VideoPromptDetectionService();

    expect(service.isVideoPrompt('The camera is on the table.')).toBe(false);
  });
});
