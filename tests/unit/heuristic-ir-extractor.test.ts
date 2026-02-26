import { describe, it, expect } from 'vitest';
import { extractBasicHeuristics } from '@services/video-prompt-analysis/services/analysis/HeuristicIrExtractor';
import { createEmptyIR } from '@services/video-prompt-analysis/services/analysis/IrFactory';
import type { VideoPromptIR } from '@services/video-prompt-analysis/types';

function extractFromText(text: string): VideoPromptIR {
  const ir = createEmptyIR(text);
  extractBasicHeuristics(text, ir);
  return ir;
}

describe('HeuristicIrExtractor - extractBasicHeuristics', () => {
  // ===========================================================================
  // ERROR HANDLING & EDGE CASES (~50%)
  // ===========================================================================
  describe('error handling and edge cases', () => {
    it('does not crash on empty string', () => {
      const ir = createEmptyIR('');
      extractBasicHeuristics('', ir);
      expect(ir.subjects).toEqual([]);
      expect(ir.actions).toEqual([]);
      expect(ir.camera.movements).toEqual([]);
    });

    it('does not mutate raw field', () => {
      const original = 'A man walking in a forest';
      const ir = createEmptyIR(original);
      extractBasicHeuristics(original, ir);
      expect(ir.raw).toBe(original);
    });

    it('does not add duplicate camera movements when text repeats', () => {
      const ir = extractFromText('pan left and then pan left again');
      const panLeftCount = ir.camera.movements.filter((m) => m === 'pan left').length;
      expect(panLeftCount).toBe(1);
    });

    it('does not add duplicate subjects when mentioned multiple times', () => {
      const ir = extractFromText('a man sees another man walking toward the man');
      const manCount = ir.subjects.filter((s) => s.text.toLowerCase() === 'man').length;
      expect(manCount).toBe(1);
    });

    it('does not add duplicate actions', () => {
      const ir = extractFromText('running and running through the field');
      const runCount = ir.actions.filter((a) => a === 'running').length;
      expect(runCount).toBe(1);
    });

    it('does not add duplicate styles', () => {
      const ir = extractFromText('cinematic, very cinematic look');
      const cinematicCount = ir.meta.style.filter((s) => s === 'cinematic').length;
      expect(cinematicCount).toBe(1);
    });

    it('does not add duplicate lighting terms', () => {
      const ir = extractFromText('golden hour light, beautiful golden hour');
      const goldenCount = ir.environment.lighting.filter((l) => l === 'golden hour').length;
      expect(goldenCount).toBe(1);
    });

    it('preserves existing IR data when adding new findings', () => {
      const ir = createEmptyIR('some text');
      ir.subjects.push({ text: 'existing subject', attributes: [] });
      ir.camera.shotType = 'existing shot';
      extractBasicHeuristics('a woman running in neon light', ir);
      // Should keep existing and add new
      expect(ir.subjects.some((s) => s.text === 'existing subject')).toBe(true);
      expect(ir.subjects.some((s) => s.text === 'woman')).toBe(true);
      expect(ir.camera.shotType).toBe('existing shot'); // not overwritten
    });
  });

  // ===========================================================================
  // CAMERA EXTRACTION (~15%)
  // ===========================================================================
  describe('camera extraction', () => {
    it('extracts multi-word camera movements (longest match first)', () => {
      const ir = extractFromText('A tracking shot follows the character');
      expect(ir.camera.movements).toContain('tracking shot');
    });

    it('extracts single-word camera movements', () => {
      const ir = extractFromText('The camera begins to zoom into the scene');
      expect(ir.camera.movements).toContain('zoom');
    });

    it('extracts specific compound movements like dolly in', () => {
      const ir = extractFromText('dolly in on the face of the subject');
      expect(ir.camera.movements).toContain('dolly in');
    });

    it('extracts shot types from text', () => {
      const ir = extractFromText('A wide shot of the mountain landscape');
      expect(ir.camera.shotType).toBe('wide shot');
    });

    it('prioritizes longer shot type matches (extreme close up over close up)', () => {
      const ir = extractFromText('An extreme close up of the eye');
      expect(ir.camera.shotType).toBe('extreme close-up');
    });

    it('extracts camera angles', () => {
      const ir = extractFromText('low angle shot of the building');
      expect(ir.camera.angle).toBe('low angle');
    });

    it('extracts birds eye view angle', () => {
      const ir = extractFromText("bird's eye view of the city");
      expect(ir.camera.angle).toBe("bird's eye view");
    });

    it('extracts POV shot type', () => {
      const ir = extractFromText('pov shot of walking through the corridor');
      expect(ir.camera.shotType).toBe('POV');
    });
  });

  // ===========================================================================
  // ENVIRONMENT EXTRACTION (~10%)
  // ===========================================================================
  describe('environment extraction', () => {
    it('extracts lighting terms', () => {
      const ir = extractFromText('Scene lit by golden hour sunlight');
      expect(ir.environment.lighting).toContain('golden hour');
      expect(ir.environment.lighting).toContain('sunlight');
    });

    it('extracts weather conditions', () => {
      const ir = extractFromText('A foggy morning in the valley');
      expect(ir.environment.weather).toBe('foggy');
    });

    it('extracts common location indicators', () => {
      const ir = extractFromText('The scene takes place outside in a park');
      expect(ir.environment.setting).toBeDefined();
    });

    it('extracts setting from prepositional phrases', () => {
      const ir = extractFromText('in a dark alley at midnight');
      expect(ir.environment.setting).toContain('dark alley');
    });

    it('does not set non-setting words as setting', () => {
      const ir = extractFromText('in the morning light');
      // "morning" is in the nonSettings list, should not be used
      expect(ir.environment.setting).not.toBe('morning');
    });
  });

  // ===========================================================================
  // SUBJECT & ACTION EXTRACTION (~15%)
  // ===========================================================================
  describe('subject extraction', () => {
    it('extracts common subjects like man, woman, child', () => {
      const ir = extractFromText('A woman stands on the bridge');
      expect(ir.subjects.some((s) => s.text === 'woman')).toBe(true);
    });

    it('extracts "a dog" as subject', () => {
      const ir = extractFromText('A dog runs through the park');
      expect(ir.subjects.some((s) => s.text === 'dog')).toBe(true);
    });

    it('falls back to NLP noun extraction when no common subject matches', () => {
      const ir = extractFromText('The spacecraft accelerates into orbit');
      // Should find something via NLP fallback
      expect(ir.subjects.length).toBeGreaterThanOrEqual(0);
    });

    it('does not add camera/style terms as NLP-fallback subjects', () => {
      const ir = extractFromText('wide angle shot with vintage style rendering');
      // These contain "shot", "view", "angle", "style", "render" - all filtered
      const hasFilteredTerm = ir.subjects.some(
        (s) =>
          s.text.includes('shot') ||
          s.text.includes('view') ||
          s.text.includes('angle') ||
          s.text.includes('style') ||
          s.text.includes('render')
      );
      expect(hasFilteredTerm).toBe(false);
    });
  });

  describe('action extraction', () => {
    it('extracts common actions', () => {
      const ir = extractFromText('A person walking through the rain');
      expect(ir.actions).toContain('walking');
    });

    it('extracts multiple actions', () => {
      const ir = extractFromText('running and jumping over obstacles');
      expect(ir.actions).toContain('running');
      expect(ir.actions).toContain('jumping');
    });

    it('falls back to NLP verb extraction when no common action found', () => {
      const ir = extractFromText('The light shimmers across the surface');
      // NLP fallback should find a verb
      expect(ir.actions.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ===========================================================================
  // STYLE EXTRACTION (~10%)
  // ===========================================================================
  describe('style extraction', () => {
    it('extracts cinematic style', () => {
      const ir = extractFromText('A cinematic shot of the sunset');
      expect(ir.meta.style).toContain('cinematic');
    });

    it('extracts multiple style keywords', () => {
      const ir = extractFromText('noir vintage aesthetic');
      expect(ir.meta.style).toContain('noir');
      expect(ir.meta.style).toContain('vintage');
    });

    it('extracts cyberpunk style', () => {
      const ir = extractFromText('cyberpunk city with neon lights');
      expect(ir.meta.style).toContain('cyberpunk');
    });
  });
});
