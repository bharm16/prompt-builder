import { describe, it, expect, vi } from 'vitest';
import { ConstitutionalAI } from '../ConstitutionalAI';

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function makeMockClient(responses: string[]) {
  let callIndex = 0;
  return {
    complete: vi.fn(async () => {
      const text = responses[callIndex++] ?? '';
      return { text };
    }),
  };
}

describe('ConstitutionalAI', () => {
  describe('getDefaultPrinciples', () => {
    it('returns a non-empty array of strings', () => {
      const principles = ConstitutionalAI.getDefaultPrinciples();
      expect(principles.length).toBeGreaterThan(0);
      for (const p of principles) {
        expect(typeof p).toBe('string');
        expect(p.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getPrinciplesForDomain', () => {
    describe('error handling and edge cases', () => {
      it('returns default principles for unknown domain', () => {
        // @ts-expect-error testing runtime fallback
        const result = ConstitutionalAI.getPrinciplesForDomain('unknown-domain');
        expect(result).toEqual(ConstitutionalAI.getDefaultPrinciples());
      });
    });

    describe('core behavior', () => {
      it('returns domain-specific principles for creative-content', () => {
        const result = ConstitutionalAI.getPrinciplesForDomain('creative-content');
        expect(result.length).toBeGreaterThan(ConstitutionalAI.getDefaultPrinciples().length);
        expect(result.some(p => p.includes('original'))).toBe(true);
      });

      it('returns domain-specific principles for technical-content', () => {
        const result = ConstitutionalAI.getPrinciplesForDomain('technical-content');
        expect(result.some(p => p.includes('best practices'))).toBe(true);
      });

      it('returns domain-specific principles for educational-content', () => {
        const result = ConstitutionalAI.getPrinciplesForDomain('educational-content');
        expect(result.some(p => p.includes('pedagogically'))).toBe(true);
      });

      it('returns domain-specific principles for business-content', () => {
        const result = ConstitutionalAI.getPrinciplesForDomain('business-content');
        expect(result.some(p => p.includes('professional'))).toBe(true);
      });

      it('all domains include default principles as prefix', () => {
        const defaults = ConstitutionalAI.getDefaultPrinciples();
        for (const domain of ['creative-content', 'technical-content', 'educational-content', 'business-content'] as const) {
          const result = ConstitutionalAI.getPrinciplesForDomain(domain);
          for (let i = 0; i < defaults.length; i++) {
            expect(result[i]).toBe(defaults[i]);
          }
        }
      });
    });
  });

  describe('applyConstitutionalReview', () => {
    describe('error handling', () => {
      it('throws when critique response is not valid JSON', async () => {
        const client = makeMockClient(['not json at all']);
        await expect(
          ConstitutionalAI.applyConstitutionalReview(client, 'prompt', 'output')
        ).rejects.toThrow('Failed to parse critique JSON');
      });

      it('throws when critique JSON fails schema validation', async () => {
        const client = makeMockClient([JSON.stringify({ invalid: true })]);
        await expect(
          ConstitutionalAI.applyConstitutionalReview(client, 'prompt', 'output')
        ).rejects.toThrow('Critique response validation failed');
      });

      it('throws when overallScore is wrong type', async () => {
        const client = makeMockClient([JSON.stringify({
          overallScore: 'not a number',
          assessment: 'ok',
          issues: [],
        })]);
        await expect(
          ConstitutionalAI.applyConstitutionalReview(client, 'prompt', 'output')
        ).rejects.toThrow('Critique response validation failed');
      });

      it('throws when issues contain invalid severity', async () => {
        const client = makeMockClient([JSON.stringify({
          overallScore: 0.5,
          assessment: 'ok',
          issues: [{ principle: 'p', severity: 'critical', description: 'd', suggestion: 's' }],
        })]);
        await expect(
          ConstitutionalAI.applyConstitutionalReview(client, 'prompt', 'output')
        ).rejects.toThrow('Critique response validation failed');
      });
    });

    describe('core behavior', () => {
      it('returns unrevised output when score >= threshold', async () => {
        const critique = { overallScore: 0.9, assessment: 'Good', issues: [] };
        const client = makeMockClient([JSON.stringify(critique)]);

        const result = await ConstitutionalAI.applyConstitutionalReview(client, 'prompt', 'original output');

        expect(result.output).toBe('original output');
        expect(result.revised).toBe(false);
        expect(result.critique.overallScore).toBe(0.9);
      });

      it('returns unrevised when autoRevise=false even with low score', async () => {
        const critique = {
          overallScore: 0.3,
          assessment: 'Poor',
          issues: [{ principle: 'p1', severity: 'major', description: 'd', suggestion: 's' }],
        };
        const client = makeMockClient([JSON.stringify(critique)]);

        const result = await ConstitutionalAI.applyConstitutionalReview(
          client, 'prompt', 'output', { autoRevise: false }
        );

        expect(result.revised).toBe(false);
        expect(result.output).toBe('output');
      });

      it('triggers revision when score < threshold', async () => {
        const critique = {
          overallScore: 0.4,
          assessment: 'Needs work',
          issues: [{ principle: 'p1', severity: 'moderate', description: 'd', suggestion: 's' }],
        };
        const client = makeMockClient([JSON.stringify(critique), 'revised output']);

        const result = await ConstitutionalAI.applyConstitutionalReview(client, 'prompt', 'original');

        expect(result.revised).toBe(true);
        expect(result.output).toBe('revised output');
        expect(result.improvements).toHaveLength(1);
        const firstImprovement = result.improvements?.[0];
        expect(firstImprovement).toBeDefined();
        expect(firstImprovement?.principle).toBe('p1');
      });

      it('strips markdown code fences from critique response', async () => {
        const critique = { overallScore: 0.95, assessment: 'Good', issues: [] };
        const wrapped = '```json\n' + JSON.stringify(critique) + '\n```';
        const client = makeMockClient([wrapped]);

        const result = await ConstitutionalAI.applyConstitutionalReview(client, 'prompt', 'output');
        expect(result.critique.overallScore).toBe(0.95);
      });

      it('uses custom threshold', async () => {
        const critique = {
          overallScore: 0.8,
          assessment: 'Decent',
          issues: [{ principle: 'p1', severity: 'minor', description: 'd', suggestion: 's' }],
        };
        const client = makeMockClient([JSON.stringify(critique), 'revised']);

        const result = await ConstitutionalAI.applyConstitutionalReview(
          client, 'prompt', 'original', { threshold: 0.9 }
        );
        expect(result.revised).toBe(true);
      });

      it('reads from content array when text is undefined', async () => {
        const critique = { overallScore: 0.95, assessment: 'Good', issues: [] };
        const client = {
          complete: vi.fn(async () => ({
            content: [{ text: JSON.stringify(critique) }],
          })),
        };

        const result = await ConstitutionalAI.applyConstitutionalReview(client, 'prompt', 'output');
        expect(result.critique.overallScore).toBe(0.95);
      });

      it('calls complete exactly once when no revision needed', async () => {
        const critique = { overallScore: 0.95, assessment: 'Good', issues: [] };
        const client = makeMockClient([JSON.stringify(critique)]);

        await ConstitutionalAI.applyConstitutionalReview(client, 'prompt', 'output');
        expect(client.complete).toHaveBeenCalledTimes(1);
      });

      it('calls complete twice when revision is triggered', async () => {
        const critique = {
          overallScore: 0.3,
          assessment: 'Bad',
          issues: [{ principle: 'p', severity: 'major', description: 'd', suggestion: 's' }],
        };
        const client = makeMockClient([JSON.stringify(critique), 'revised']);

        await ConstitutionalAI.applyConstitutionalReview(client, 'prompt', 'output');
        expect(client.complete).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('quickValidation', () => {
    describe('core behavior', () => {
      it('returns true when response is YES', async () => {
        expect(await ConstitutionalAI.quickValidation(makeMockClient(['YES']), 'output')).toBe(true);
      });

      it('returns true for lowercase yes', async () => {
        expect(await ConstitutionalAI.quickValidation(makeMockClient(['yes']), 'output')).toBe(true);
      });

      it('returns false when response is NO', async () => {
        expect(await ConstitutionalAI.quickValidation(makeMockClient(['NO']), 'output')).toBe(false);
      });

      it('returns false for unexpected response', async () => {
        expect(await ConstitutionalAI.quickValidation(makeMockClient(['MAYBE']), 'output')).toBe(false);
      });

      it('returns false for empty response', async () => {
        expect(await ConstitutionalAI.quickValidation(makeMockClient(['']), 'output')).toBe(false);
      });

      it('uses default principles when null passed', async () => {
        const client = makeMockClient(['YES']);
        await ConstitutionalAI.quickValidation(client, 'output', null);
        expect(client.complete).toHaveBeenCalledTimes(1);
        const calls = client.complete.mock.calls as unknown[][];
        const prompt = calls[0]?.[0];
        expect(typeof prompt).toBe('string');
        expect(prompt).toContain('helpful');
      });

      it('reads from content array fallback', async () => {
        const client = {
          complete: vi.fn(async () => ({ content: [{ text: 'YES' }] })),
        };
        expect(await ConstitutionalAI.quickValidation(client, 'output')).toBe(true);
      });
    });
  });
});
