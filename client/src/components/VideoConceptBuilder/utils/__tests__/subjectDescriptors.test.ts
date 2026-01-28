import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import {
  buildComposedElements,
  composeSubjectValue,
  decomposeSubjectValue,
  normalizeDescriptor,
  splitDescriptorSegments,
} from '../subjectDescriptors';
import { SUBJECT_DESCRIPTOR_KEYS } from '../../config/constants';

describe('subjectDescriptors utilities', () => {
  describe('error handling', () => {
    it('normalizes undefined and punctuation-only values to empty strings', () => {
      expect(normalizeDescriptor(undefined)).toBe('');
      expect(normalizeDescriptor(' ,;:-  ')).toBe('');
    });

    it('decomposes undefined subject into empty subject and padded descriptors', () => {
      const result = decomposeSubjectValue(undefined);
      expect(result.subject).toBe('');
      expect(result.descriptors).toHaveLength(SUBJECT_DESCRIPTOR_KEYS.length);
      expect(result.descriptors.every((value) => value === '')).toBe(true);
    });

    it('returns empty composed value when both subject and descriptors are empty', () => {
      const result = composeSubjectValue(undefined, ['', undefined]);
      expect(result).toBe('');
    });
  });

  describe('edge cases', () => {
    it('splits descriptor segments using connector words', () => {
      const segments = splitDescriptorSegments('with red cape and blue hat');
      expect(segments).toEqual(['with red cape', 'and blue hat']);
    });

    it('composes descriptors when base subject is empty', () => {
      const result = composeSubjectValue('', ['with a lantern', 'wearing boots']);
      expect(result).toBe('with a lantern, wearing boots');
    });

    it('builds composed elements with normalized descriptor list', () => {
      const composed = buildComposedElements({
        subject: 'cat',
        subjectDescriptor1: ' with hat',
        subjectDescriptor2: ',tall',
        subjectDescriptor3: '',
        action: 'running',
      });

      expect(composed.subject).toBe('cat with hat, tall');
      expect(composed.subjectDescriptors).toEqual(['with hat', 'tall']);
    });
  });

  describe('core behavior', () => {
    it('decomposes subject text into base subject and unique descriptors', () => {
      const result = decomposeSubjectValue('cat with hat, wearing coat, with hat');
      expect(result.subject).toBe('cat');
      expect(result.descriptors).toContain('with hat');
      expect(result.descriptors).toContain('wearing coat');
      expect(result.descriptors.filter(Boolean)).toHaveLength(2);
    });

    it('ensures composed subject starts with base when base is provided', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.array(fc.string({ maxLength: 15 }), { minLength: 0, maxLength: 3 }),
          (subject, descriptors) => {
            const result = composeSubjectValue(subject, descriptors);
            expect(result.startsWith(subject.trim())).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
