import { describe, it, expect } from 'vitest';
import { createEmptyIR } from '@services/video-prompt-analysis/services/analysis/IrFactory';

describe('IrFactory - createEmptyIR', () => {
  describe('error handling', () => {
    it('handles empty string input', () => {
      const ir = createEmptyIR('');
      expect(ir.raw).toBe('');
    });
  });

  describe('core behavior', () => {
    it('stores the raw text in the IR', () => {
      const ir = createEmptyIR('A man walks through rain');
      expect(ir.raw).toBe('A man walks through rain');
    });

    it('initializes all arrays as empty', () => {
      const ir = createEmptyIR('test');
      expect(ir.subjects).toEqual([]);
      expect(ir.actions).toEqual([]);
      expect(ir.camera.movements).toEqual([]);
      expect(ir.environment.lighting).toEqual([]);
      expect(ir.meta.mood).toEqual([]);
      expect(ir.meta.style).toEqual([]);
    });

    it('initializes setting as empty string', () => {
      const ir = createEmptyIR('test');
      expect(ir.environment.setting).toBe('');
    });

    it('initializes technical as empty object', () => {
      const ir = createEmptyIR('test');
      expect(ir.technical).toEqual({});
    });

    it('initializes audio as empty object', () => {
      const ir = createEmptyIR('test');
      expect(ir.audio).toEqual({});
    });

    it('returns independent instances (no shared references)', () => {
      const ir1 = createEmptyIR('first');
      const ir2 = createEmptyIR('second');
      ir1.subjects.push({ text: 'test', attributes: [] });
      expect(ir2.subjects).toEqual([]);
    });
  });
});
