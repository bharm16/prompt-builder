import { describe, it, expect } from 'vitest';
import { buildBaseHeader } from '../promptStrategyUtils';
import type { PromptBuildContext } from '../types';
import type { VideoPromptIR } from '../../../../types';

const makeIR = (overrides: Partial<VideoPromptIR> = {}): VideoPromptIR => ({
  subjects: [{ text: 'a cat', attributes: ['fluffy'] }],
  actions: ['running'],
  camera: { movements: ['pan left'], angle: 'low', shotType: 'wide' },
  environment: { setting: 'forest', lighting: ['natural'] },
  audio: {},
  meta: { mood: ['calm'], style: ['cinematic'] },
  technical: {},
  raw: 'a fluffy cat running in a forest',
  ...overrides,
});

const makeContext = (overrides: Partial<PromptBuildContext> = {}): PromptBuildContext => ({
  ir: makeIR(),
  modelId: 'test-model',
  constraints: {},
  ...overrides,
});

describe('buildBaseHeader', () => {
  describe('error handling and edge cases', () => {
    it('omits constraint block when constraints object is empty', () => {
      const result = buildBaseHeader(makeContext({ constraints: {} }));
      expect(result).not.toContain('CONSTRAINTS:');
    });

    it('omits constraint block when all arrays are empty', () => {
      const result = buildBaseHeader(
        makeContext({ constraints: { mandatory: [], suggested: [], avoid: [] } })
      );
      expect(result).not.toContain('CONSTRAINTS:');
    });

    it('handles IR with empty subjects array', () => {
      const result = buildBaseHeader(makeContext({ ir: makeIR({ subjects: [] }) }));
      expect(result).toContain('"subjects": []');
    });

    it('escapes special characters via JSON serialization', () => {
      const result = buildBaseHeader(
        makeContext({ ir: makeIR({ raw: 'text with "quotes" here' }) })
      );
      expect(result).toContain('text with \\"quotes\\" here');
    });
  });

  describe('constraint formatting', () => {
    it('renders mandatory section with correct header and items', () => {
      const result = buildBaseHeader(
        makeContext({ constraints: { mandatory: ['HDR', 'cinematic lighting'] } })
      );
      expect(result).toContain('MANDATORY CONSTRAINTS (must appear, paraphrased if needed):');
      expect(result).toContain('- HDR');
      expect(result).toContain('- cinematic lighting');
      expect(result).not.toContain('SUGGESTED');
      expect(result).not.toContain('AVOID');
    });

    it('renders suggested section with correct header', () => {
      const result = buildBaseHeader(
        makeContext({ constraints: { suggested: ['slow motion'] } })
      );
      expect(result).toContain('SUGGESTED CONSTRAINTS (include when natural):');
      expect(result).toContain('- slow motion');
      expect(result).not.toContain('MANDATORY');
    });

    it('renders avoid section with correct header', () => {
      const result = buildBaseHeader(
        makeContext({ constraints: { avoid: ['4k', '8k'] } })
      );
      expect(result).toContain('AVOID (do not include these words/phrases):');
      expect(result).toContain('- 4k');
      expect(result).not.toContain('MANDATORY');
    });

    it('renders all three sections together', () => {
      const result = buildBaseHeader(
        makeContext({
          constraints: { mandatory: ['HDR'], suggested: ['motion'], avoid: ['blur'] },
        })
      );
      expect(result).toContain('MANDATORY CONSTRAINTS');
      expect(result).toContain('SUGGESTED CONSTRAINTS');
      expect(result).toContain('AVOID');
    });

    it('joins multiple items with newline-dash separators', () => {
      const result = buildBaseHeader(
        makeContext({ constraints: { mandatory: ['first', 'second', 'third'] } })
      );
      expect(result).toContain('- first\n- second\n- third');
    });
  });

  describe('core prompt structure', () => {
    it('embeds model ID into the system prompt', () => {
      const result = buildBaseHeader(makeContext({ modelId: 'runway-gen45' }));
      expect(result).toContain('runway-gen45 video generation model');
    });

    it('wraps IR in a JSON code fence', () => {
      const result = buildBaseHeader(makeContext());
      expect(result).toContain('```json');
      expect(result).toContain('"subjects"');
    });

    it('includes system role description', () => {
      const result = buildBaseHeader(makeContext());
      expect(result).toContain('professional video prompt engineer');
    });

    it('serializes all IR fields into the output', () => {
      const ir = makeIR({
        subjects: [{ text: 'dragon', attributes: ['ancient'] }],
        environment: { setting: 'mountain peak', lighting: ['dramatic'], weather: 'stormy' },
      });
      const result = buildBaseHeader(makeContext({ ir }));
      expect(result).toContain('dragon');
      expect(result).toContain('mountain peak');
      expect(result).toContain('stormy');
    });

    it('produces distinct output for different model IDs', () => {
      const r1 = buildBaseHeader(makeContext({ modelId: 'kling-26' }));
      const r2 = buildBaseHeader(makeContext({ modelId: 'luma-ray3' }));
      expect(r1).toContain('kling-26');
      expect(r2).toContain('luma-ray3');
      expect(r1).not.toContain('luma-ray3');
    });
  });
});
