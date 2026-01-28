import { describe, it, expect } from 'vitest';
import { SYSTEM_PROMPT } from '../roleClassifierPrompt';

describe('SYSTEM_PROMPT', () => {
  describe('error handling', () => {
    it('explicitly requires valid JSON output', () => {
      expect(SYSTEM_PROMPT).toContain('Return ONLY valid JSON');
    });
  });

  describe('edge cases', () => {
    it('lists taxonomy category IDs for specificity', () => {
      expect(SYSTEM_PROMPT).toContain('subject.wardrobe');
      expect(SYSTEM_PROMPT).toContain('camera.movement');
    });
  });

  describe('core behavior', () => {
    it('includes labeling rules to avoid span mutation', () => {
      expect(SYSTEM_PROMPT).toContain('Do not merge or split spans');
      expect(SYSTEM_PROMPT).toContain('Do not change "text", "start", or "end" values');
    });
  });
});
