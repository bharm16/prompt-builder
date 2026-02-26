import { describe, it, expect } from 'vitest';
import { VideoPromptDetectionService } from '@services/video-prompt-analysis/services/detection/VideoPromptDetectionService';

function createService(): VideoPromptDetectionService {
  return new VideoPromptDetectionService();
}

describe('VideoPromptDetectionService', () => {
  // ===========================================================================
  // ERROR HANDLING & INVALID INPUT (~50%)
  // ===========================================================================
  describe('error handling and invalid input', () => {
    it('returns false for null input', () => {
      const service = createService();
      expect(service.isVideoPrompt(null)).toBe(false);
    });

    it('returns false for undefined input', () => {
      const service = createService();
      expect(service.isVideoPrompt(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      const service = createService();
      expect(service.isVideoPrompt('')).toBe(false);
    });

    it('returns false for whitespace-only string', () => {
      const service = createService();
      expect(service.isVideoPrompt('   \n\t  ')).toBe(false);
    });

    it('returns false for non-string input', () => {
      const service = createService();
      expect(service.isVideoPrompt(42 as unknown as string)).toBe(false);
    });

    it('returns false for plain prose without any video markers', () => {
      const service = createService();
      expect(
        service.isVideoPrompt('The weather is nice today and I went for a walk in the park')
      ).toBe(false);
    });

    it('returns false for text with only one technical field (insufficient)', () => {
      const service = createService();
      expect(service.isVideoPrompt('duration: 5 seconds')).toBe(false);
    });

    it('returns false for text with technical specs header but only 1 field', () => {
      const service = createService();
      expect(
        service.isVideoPrompt('technical specs\nduration: 5s')
      ).toBe(false);
    });
  });

  // ===========================================================================
  // EDGE CASES (~30%)
  // ===========================================================================
  describe('edge cases', () => {
    it('detection is case-insensitive', () => {
      const service = createService();
      expect(service.isVideoPrompt('**MAIN PROMPT:**\nA sunset scene')).toBe(true);
    });

    it('detects JSON prompt structure with required fields', () => {
      const service = createService();
      const jsonPrompt = JSON.stringify({
        subject: 'a woman',
        camera: 'wide shot',
        environment: 'forest',
      });
      expect(service.isVideoPrompt(jsonPrompt)).toBe(true);
    });

    it('returns false for JSON missing subject field', () => {
      const service = createService();
      const jsonPrompt = JSON.stringify({
        camera: 'wide shot',
        environment: 'forest',
      });
      expect(service.isVideoPrompt(jsonPrompt)).toBe(false);
    });

    it('returns false for JSON with subject but missing camera and action', () => {
      const service = createService();
      const jsonPrompt = JSON.stringify({
        subject: 'a man',
        environment: 'city',
      });
      expect(service.isVideoPrompt(jsonPrompt)).toBe(false);
    });

    it('detects JSON with subject + action + lighting', () => {
      const service = createService();
      const jsonPrompt = JSON.stringify({
        subject: 'a dog',
        action: 'running',
        lighting: 'golden hour',
      });
      expect(service.isVideoPrompt(jsonPrompt)).toBe(true);
    });

    it('detects JSON with subject + shot + style', () => {
      const service = createService();
      const jsonPrompt = JSON.stringify({
        subject: 'a car',
        shot: 'wide',
        style: 'cinematic',
      });
      expect(service.isVideoPrompt(jsonPrompt)).toBe(true);
    });

    it('detects JSON with style_preset', () => {
      const service = createService();
      const jsonPrompt = JSON.stringify({
        subject: 'spaceship',
        action: 'landing',
        style_preset: 'sci-fi',
      });
      expect(service.isVideoPrompt(jsonPrompt)).toBe(true);
    });
  });

  // ===========================================================================
  // CORE BEHAVIOR - MARKER DETECTION (~20%)
  // ===========================================================================
  describe('legacy marker detection', () => {
    it('detects **main prompt:** marker', () => {
      const service = createService();
      expect(service.isVideoPrompt('**main prompt:**\nA sunset scene')).toBe(true);
    });

    it('detects **technical parameters:** marker', () => {
      const service = createService();
      expect(service.isVideoPrompt('**technical parameters:**\ncamera: wide shot')).toBe(true);
    });

    it('detects camera movement: marker', () => {
      const service = createService();
      expect(service.isVideoPrompt('camera movement: slow dolly in')).toBe(true);
    });
  });

  describe('modern marker detection', () => {
    it('detects **prompt:** marker', () => {
      const service = createService();
      expect(service.isVideoPrompt('**prompt:**\nA man walks through rain')).toBe(true);
    });

    it('detects **guiding principles marker', () => {
      const service = createService();
      expect(service.isVideoPrompt('**guiding principles for this scene...')).toBe(true);
    });

    it('detects **technical specs marker', () => {
      const service = createService();
      expect(service.isVideoPrompt('**technical specs\nduration: 5s\naspect ratio: 16:9')).toBe(
        true
      );
    });

    it('detects **alternative approaches marker', () => {
      const service = createService();
      expect(
        service.isVideoPrompt('**alternative approaches\nvariation 1: different camera')
      ).toBe(true);
    });

    it('detects variation 1 (different camera) marker', () => {
      const service = createService();
      expect(
        service.isVideoPrompt('variation 1 (different camera)\nWide shot from above')
      ).toBe(true);
    });
  });

  describe('technical field detection', () => {
    it('detects technical specs + 2 fields', () => {
      const service = createService();
      const text = 'technical specs\nduration: 5s\naspect ratio: 16:9';
      expect(service.isVideoPrompt(text)).toBe(true);
    });

    it('detects 3+ technical fields + alternative approaches', () => {
      const service = createService();
      const text =
        'duration: 5s\naspect ratio: 16:9\nframe rate: 24fps\nalternative approaches\nsome text';
      expect(service.isVideoPrompt(text)).toBe(true);
    });

    it('returns false for 2 technical fields + alternative approaches (needs 3)', () => {
      const service = createService();
      const text = 'duration: 5s\naspect ratio: 16:9\nalternative approaches\nsome text';
      expect(service.isVideoPrompt(text)).toBe(false);
    });
  });
});
