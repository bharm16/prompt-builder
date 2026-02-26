import { describe, it, expect } from 'vitest';
import { enrichFromTechnicalSpecs, enrichIR } from '@services/video-prompt-analysis/services/analysis/IrEnricher';
import { createEmptyIR } from '@services/video-prompt-analysis/services/analysis/IrFactory';

describe('IrEnricher', () => {
  // ===========================================================================
  // enrichFromTechnicalSpecs
  // ===========================================================================
  describe('enrichFromTechnicalSpecs', () => {
    describe('error handling', () => {
      it('does not crash with empty technical specs', () => {
        const ir = createEmptyIR('test');
        enrichFromTechnicalSpecs({}, ir);
        expect(ir.camera.shotType).toBeUndefined();
        expect(ir.environment.lighting).toEqual([]);
      });

      it('does not overwrite existing shotType from camera spec', () => {
        const ir = createEmptyIR('test');
        ir.camera.shotType = 'existing shot';
        enrichFromTechnicalSpecs({ camera: 'wide angle establishing' }, ir);
        expect(ir.camera.shotType).toBe('existing shot');
      });

      it('does not overwrite existing angle from camera spec', () => {
        const ir = createEmptyIR('test');
        ir.camera.angle = 'existing angle';
        enrichFromTechnicalSpecs({ camera: 'high-angle view' }, ir);
        expect(ir.camera.angle).toBe('existing angle');
      });

      it('does not add lighting if lighting array already has entries', () => {
        const ir = createEmptyIR('test');
        ir.environment.lighting.push('existing light');
        enrichFromTechnicalSpecs({ lighting: 'golden hour' }, ir);
        expect(ir.environment.lighting).toEqual(['existing light']);
      });

      it('does not add duplicate styles', () => {
        const ir = createEmptyIR('test');
        ir.meta.style.push('cinematic');
        enrichFromTechnicalSpecs({ style: 'cinematic' }, ir);
        expect(ir.meta.style.filter((s) => s === 'cinematic').length).toBe(1);
      });
    });

    describe('edge cases', () => {
      it('extracts close-up shot type from camera spec', () => {
        const ir = createEmptyIR('test');
        enrichFromTechnicalSpecs({ camera: 'close-up shot' }, ir);
        expect(ir.camera.shotType).toBe('close-up');
      });

      it('extracts wide shot type from camera spec', () => {
        const ir = createEmptyIR('test');
        enrichFromTechnicalSpecs({ camera: 'wide establishing shot' }, ir);
        expect(ir.camera.shotType).toBe('wide shot');
      });

      it('extracts high angle from camera spec', () => {
        const ir = createEmptyIR('test');
        enrichFromTechnicalSpecs({ camera: 'high-angle overhead' }, ir);
        expect(ir.camera.angle).toBe('high angle');
      });

      it('extracts low angle from camera spec', () => {
        const ir = createEmptyIR('test');
        enrichFromTechnicalSpecs({ camera: 'low-angle dramatic' }, ir);
        expect(ir.camera.angle).toBe('low angle');
      });
    });

    describe('core behavior', () => {
      it('adds lighting from technical specs', () => {
        const ir = createEmptyIR('test');
        enrichFromTechnicalSpecs({ lighting: 'golden hour' }, ir);
        expect(ir.environment.lighting).toContain('golden hour');
      });

      it('adds style from technical specs', () => {
        const ir = createEmptyIR('test');
        enrichFromTechnicalSpecs({ style: 'noir' }, ir);
        expect(ir.meta.style).toContain('noir');
      });

      it('maps audio with "music" keyword to ir.audio.music', () => {
        const ir = createEmptyIR('test');
        enrichFromTechnicalSpecs({ audio: 'Orchestral music' }, ir);
        expect(ir.audio.music).toBe('Orchestral music');
      });

      it('maps audio with "score" keyword to ir.audio.music', () => {
        const ir = createEmptyIR('test');
        enrichFromTechnicalSpecs({ audio: 'Dramatic score' }, ir);
        expect(ir.audio.music).toBe('Dramatic score');
      });

      it('maps audio with "dialogue" keyword to ir.audio.dialogue', () => {
        const ir = createEmptyIR('test');
        enrichFromTechnicalSpecs({ audio: 'Whispered dialogue' }, ir);
        expect(ir.audio.dialogue).toBe('Whispered dialogue');
      });

      it('maps unrecognized audio to ir.audio.sfx', () => {
        const ir = createEmptyIR('test');
        enrichFromTechnicalSpecs({ audio: 'Rain and thunder' }, ir);
        expect(ir.audio.sfx).toBe('Rain and thunder');
      });
    });
  });

  // ===========================================================================
  // enrichIR
  // ===========================================================================
  describe('enrichIR', () => {
    describe('error handling', () => {
      it('does not crash on empty IR', () => {
        const ir = createEmptyIR('test');
        enrichIR(ir);
        expect(ir).toBeDefined();
      });

      it('does not add lighting if already present', () => {
        const ir = createEmptyIR('test');
        ir.meta.style.push('cyberpunk');
        ir.environment.lighting.push('existing light');
        enrichIR(ir);
        expect(ir.environment.lighting).toEqual(['existing light']);
      });

      it('does not add camera movement if already present', () => {
        const ir = createEmptyIR('test');
        ir.actions.push('running');
        ir.camera.movements.push('existing movement');
        enrichIR(ir);
        expect(ir.camera.movements).toEqual(['existing movement']);
      });
    });

    describe('core behavior', () => {
      it('infers neon lighting from cyberpunk style', () => {
        const ir = createEmptyIR('test');
        ir.meta.style.push('cyberpunk');
        enrichIR(ir);
        expect(ir.environment.lighting).toContain('neon lighting');
      });

      it('infers dramatic lighting from cinematic style', () => {
        const ir = createEmptyIR('test');
        ir.meta.style.push('cinematic');
        enrichIR(ir);
        expect(ir.environment.lighting).toContain('dramatic lighting');
      });

      it('infers tracking shot from running action', () => {
        const ir = createEmptyIR('test');
        ir.actions.push('running');
        enrichIR(ir);
        expect(ir.camera.movements).toContain('tracking shot');
      });

      it('does not infer camera movement from non-running actions', () => {
        const ir = createEmptyIR('test');
        ir.actions.push('sitting');
        enrichIR(ir);
        expect(ir.camera.movements).toEqual([]);
      });

      it('does not infer lighting from non-cyberpunk/cinematic styles', () => {
        const ir = createEmptyIR('test');
        ir.meta.style.push('noir');
        enrichIR(ir);
        expect(ir.environment.lighting).toEqual([]);
      });
    });
  });
});
