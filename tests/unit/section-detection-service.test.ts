import { describe, it, expect } from 'vitest';
import { SectionDetectionService } from '@services/video-prompt-analysis/services/detection/SectionDetectionService';

function createService(): SectionDetectionService {
  return new SectionDetectionService();
}

describe('SectionDetectionService', () => {
  // ===========================================================================
  // ERROR HANDLING & INVALID INPUT (~50%)
  // ===========================================================================
  describe('error handling - detectSection', () => {
    it('returns main_prompt for null highlightedText', () => {
      const service = createService();
      expect(service.detectSection(null, 'some prompt', '')).toBe('main_prompt');
    });

    it('returns main_prompt for null fullPrompt', () => {
      const service = createService();
      expect(service.detectSection('some text', null, '')).toBe('main_prompt');
    });

    it('returns main_prompt for both null inputs', () => {
      const service = createService();
      expect(service.detectSection(null, null, '')).toBe('main_prompt');
    });

    it('returns main_prompt for undefined inputs', () => {
      const service = createService();
      expect(service.detectSection(undefined, undefined, '')).toBe('main_prompt');
    });

    it('defaults to main_prompt when highlight not found and no strong signals', () => {
      const service = createService();
      // When all scores are 0, main_prompt is the default
      // But position scoring may give non-zero scores; the highlight must be at the start
      // to avoid middle-position bonus for technical_specs
      const result = service.detectSection('xyz', 'xyz unrelated', '');
      // Position < 0.3 = early = +1 for main_prompt
      expect(result).toBe('main_prompt');
    });
  });

  describe('error handling - getSectionConstraints', () => {
    it('returns null for null section', () => {
      const service = createService();
      expect(service.getSectionConstraints(null)).toBeNull();
    });

    it('returns null for undefined section', () => {
      const service = createService();
      expect(service.getSectionConstraints(undefined)).toBeNull();
    });

    it('returns null for empty string section', () => {
      const service = createService();
      expect(service.getSectionConstraints('')).toBeNull();
    });

    it('returns null for unknown section name', () => {
      const service = createService();
      expect(service.getSectionConstraints('nonexistent_section')).toBeNull();
    });
  });

  describe('error handling - getSectionGuidance', () => {
    it('returns empty array for null section', () => {
      const service = createService();
      expect(service.getSectionGuidance(null, 'camera')).toEqual([]);
    });

    it('returns empty array for null category', () => {
      const service = createService();
      expect(service.getSectionGuidance('main_prompt', null)).toEqual([]);
    });

    it('returns empty array for unknown section', () => {
      const service = createService();
      expect(service.getSectionGuidance('unknown', 'camera')).toEqual([]);
    });
  });

  describe('error handling - formatSectionContext', () => {
    it('returns empty string for null section', () => {
      const service = createService();
      expect(service.formatSectionContext(null)).toBe('');
    });

    it('returns empty string for undefined section', () => {
      const service = createService();
      expect(service.formatSectionContext(undefined)).toBe('');
    });

    it('returns empty string for unknown section', () => {
      const service = createService();
      expect(service.formatSectionContext('nonexistent')).toBe('');
    });
  });

  // ===========================================================================
  // EDGE CASES (~30%)
  // ===========================================================================
  describe('edge cases', () => {
    it('position calculation returns 0.5 when highlight not found in prompt', () => {
      const service = createService();
      // The highlight is not in the full prompt, so position defaults to 0.5
      const result = service.detectSection('not in prompt', 'completely different text', '');
      // Should still return a valid section (default)
      expect(typeof result).toBe('string');
    });

    it('header in contextBefore is strong signal (10 points) vs header in prompt (3 points)', () => {
      const service = createService();
      // "technical specs" in contextBefore should strongly signal technical_specs
      const result = service.detectSection(
        'duration: 5s',
        'scene description\ntechnical specs\nduration: 5s',
        'technical specs'
      );
      expect(result).toBe('technical_specs');
    });

    it('position scoring: early position boosts main_prompt when describing is present', () => {
      const service = createService();
      // Place highlight at the very start and ensure main_prompt keywords score higher
      // "describing" matches main_prompt keyword, and position < 0.3 gives another point
      const prompt = 'describing a sunset over mountains and beautiful light across the valley';
      const result = service.detectSection('describing a sunset', prompt, '');
      expect(result).toBe('main_prompt');
    });
  });

  // ===========================================================================
  // CORE BEHAVIOR (~20%)
  // ===========================================================================
  describe('section detection', () => {
    it('detects main_prompt from header keyword in context', () => {
      const service = createService();
      const result = service.detectSection(
        'a sunset scene',
        'main prompt\na sunset scene\ntechnical specs\nduration 5s',
        'main prompt'
      );
      expect(result).toBe('main_prompt');
    });

    it('detects technical_specs from header keyword in context', () => {
      const service = createService();
      const result = service.detectSection(
        'duration: 5s',
        'scene description\ntechnical specifications\nduration: 5s',
        'technical specifications'
      );
      expect(result).toBe('technical_specs');
    });

    it('detects alternatives from header keyword', () => {
      const service = createService();
      const result = service.detectSection(
        'different angle',
        'main scene\nalternative approaches\ndifferent angle',
        'alternative approaches'
      );
      expect(result).toBe('alternatives');
    });

    it('detects style_direction from header keyword', () => {
      const service = createService();
      const result = service.detectSection(
        'film noir',
        'scene text\nvisual style\nfilm noir aesthetic',
        'visual style'
      );
      expect(result).toBe('style_direction');
    });
  });

  describe('getSectionConstraints', () => {
    it('returns constraints for main_prompt', () => {
      const service = createService();
      const constraints = service.getSectionConstraints('main_prompt');
      expect(constraints).not.toBeNull();
      expect(constraints!.tone).toBe('descriptive');
      expect(constraints!.creativity).toBe('high');
    });

    it('returns constraints for technical_specs', () => {
      const service = createService();
      const constraints = service.getSectionConstraints('technical_specs');
      expect(constraints).not.toBeNull();
      expect(constraints!.tone).toBe('technical');
      expect(constraints!.precision).toBe('high');
      expect(constraints!.creativity).toBe('low');
    });

    it('returns constraints for alternatives', () => {
      const service = createService();
      const constraints = service.getSectionConstraints('alternatives');
      expect(constraints).not.toBeNull();
      expect(constraints!.creativity).toBe('very high');
    });

    it('returns constraints for style_direction', () => {
      const service = createService();
      const constraints = service.getSectionConstraints('style_direction');
      expect(constraints).not.toBeNull();
      expect(constraints!.tone).toBe('referential');
    });
  });

  describe('getSectionGuidance', () => {
    it('returns narrative guidance for main_prompt', () => {
      const service = createService();
      const guidance = service.getSectionGuidance('main_prompt', 'general');
      expect(guidance.length).toBeGreaterThan(0);
      expect(guidance.some((g) => g.includes('descriptive'))).toBe(true);
    });

    it('returns technical guidance for technical_specs with camera category', () => {
      const service = createService();
      const guidance = service.getSectionGuidance('technical_specs', 'camera');
      expect(guidance.length).toBeGreaterThan(0);
      expect(guidance.some((g) => g.includes('lens') || g.includes('aperture'))).toBe(true);
    });

    it('returns lighting guidance for technical_specs with lighting category', () => {
      const service = createService();
      const guidance = service.getSectionGuidance('technical_specs', 'lighting');
      expect(guidance.length).toBeGreaterThan(0);
      expect(guidance.some((g) => g.includes('color temp'))).toBe(true);
    });

    it('returns action-specific guidance for main_prompt with action category', () => {
      const service = createService();
      const guidance = service.getSectionGuidance('main_prompt', 'action');
      expect(guidance.some((g) => g.includes('cinematic detail'))).toBe(true);
    });

    it('returns alternatives guidance for alternatives section', () => {
      const service = createService();
      const guidance = service.getSectionGuidance('alternatives', 'general');
      expect(guidance.some((g) => g.includes('different creative directions'))).toBe(true);
    });

    it('returns style-specific guidance for style_direction with style category', () => {
      const service = createService();
      const guidance = service.getSectionGuidance('style_direction', 'style');
      expect(guidance.some((g) => g.includes('noir') || g.includes('surrealism'))).toBe(true);
    });
  });

  describe('formatSectionContext', () => {
    it('formats main_prompt section context', () => {
      const service = createService();
      const context = service.formatSectionContext('main_prompt');
      expect(context).toContain('Main Prompt');
      expect(context).toContain('Tone:');
      expect(context).toContain('Requirements:');
      expect(context).toContain('Avoid:');
    });

    it('formats technical_specs section context', () => {
      const service = createService();
      const context = service.formatSectionContext('technical_specs');
      expect(context).toContain('Technical Specs');
      expect(context).toContain('Technical');
    });

    it('capitalizes section name words', () => {
      const service = createService();
      const context = service.formatSectionContext('style_direction');
      expect(context).toContain('Style Direction');
    });
  });
});
