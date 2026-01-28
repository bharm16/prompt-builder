import { describe, it, expect } from 'vitest';
import { runWithRequestContext, getRequestContext } from '../requestContext';

describe('requestContext', () => {
  describe('error handling', () => {
    it('returns undefined when no context is active', () => {
      expect(getRequestContext()).toBeUndefined();
    });

    it('does not leak context outside the run scope', () => {
      runWithRequestContext({ requestId: 'scoped' }, () => {
        expect(getRequestContext()).toEqual({ requestId: 'scoped' });
      });

      expect(getRequestContext()).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('restores the previous context after nested runs', () => {
      runWithRequestContext({ requestId: 'outer' }, () => {
        expect(getRequestContext()?.requestId).toBe('outer');

        runWithRequestContext({ requestId: 'inner' }, () => {
          expect(getRequestContext()?.requestId).toBe('inner');
        });

        expect(getRequestContext()?.requestId).toBe('outer');
      });
    });
  });

  describe('core behavior', () => {
    it('provides context to the callback and returns its result', () => {
      const result = runWithRequestContext({ requestId: 'abc' }, () => {
        return getRequestContext()?.requestId;
      });

      expect(result).toBe('abc');
    });
  });
});
