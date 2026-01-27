import { describe, it, expect } from 'vitest';
import { vocabPath, modelPath } from '../paths';
import { join, isAbsolute } from 'path';

describe('paths', () => {
  describe('vocabPath', () => {
    it('is an absolute path', () => {
      expect(isAbsolute(vocabPath)).toBe(true);
    });

    it('points to vocab.json file', () => {
      expect(vocabPath.endsWith('vocab.json')).toBe(true);
    });

    it('is in the nlp directory', () => {
      expect(vocabPath).toContain('nlp');
    });
  });

  describe('modelPath', () => {
    it('is an absolute path', () => {
      expect(isAbsolute(modelPath)).toBe(true);
    });

    it('points to model.onnx file', () => {
      expect(modelPath.endsWith('model.onnx')).toBe(true);
    });

    it('is in the models subdirectory', () => {
      expect(modelPath).toContain(join('models', 'model.onnx'));
    });
  });

  describe('path consistency', () => {
    it('vocabPath and modelPath share the same base directory', () => {
      // Both should be under the nlp directory
      const vocabDir = vocabPath.replace('vocab.json', '');
      const modelDir = modelPath.replace(join('models', 'model.onnx'), '');

      expect(vocabDir).toBe(modelDir);
    });
  });
});
