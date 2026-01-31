import { describe, it, expect } from 'vitest';
import { defaultPromptStrategy } from '../DefaultPromptStrategy';
import { kling26PromptStrategy } from '../Kling26PromptStrategy';
import { lumaRay3PromptStrategy } from '../LumaRay3PromptStrategy';
import { runwayGen45PromptStrategy } from '../RunwayGen45PromptStrategy';
import { sora2PromptStrategy } from '../Sora2PromptStrategy';
import { veo4PromptStrategy } from '../Veo4PromptStrategy';
import { wan22PromptStrategy } from '../Wan22PromptStrategy';
import type { PromptBuildContext } from '../types';
import type { VideoPromptIR } from '../../../../types';

const makeIR = (): VideoPromptIR => ({
  subjects: [{ text: 'a woman', attributes: ['elegant'] }],
  actions: ['walking'],
  camera: { movements: ['dolly in'] },
  environment: { setting: 'garden', lighting: ['soft'] },
  audio: {},
  meta: { mood: ['serene'], style: ['cinematic'] },
  technical: {},
  raw: 'an elegant woman walking in a garden',
});

const makeContext = (overrides: Partial<PromptBuildContext> = {}): PromptBuildContext => ({
  ir: makeIR(),
  modelId: 'test',
  constraints: { mandatory: ['HDR'] },
  ...overrides,
});

const ALL_STRATEGIES = [
  defaultPromptStrategy,
  kling26PromptStrategy,
  lumaRay3PromptStrategy,
  runwayGen45PromptStrategy,
  sora2PromptStrategy,
  veo4PromptStrategy,
  wan22PromptStrategy,
];

describe('Model Prompt Strategies', () => {
  describe('error handling - each strategy builds a non-empty prompt', () => {
    for (const strategy of ALL_STRATEGIES) {
      it(`${strategy.modelId} returns non-empty string from buildPrompt`, () => {
        const result = strategy.buildPrompt(makeContext());
        expect(result.length).toBeGreaterThan(0);
      });
    }
  });

  describe('strategy identity and output format', () => {
    it('defaultPromptStrategy has modelId "default" and text format', () => {
      expect(defaultPromptStrategy.modelId).toBe('default');
      expect(defaultPromptStrategy.output.format).toBe('text');
    });

    it('kling26PromptStrategy has modelId "kling-26" and text format', () => {
      expect(kling26PromptStrategy.modelId).toBe('kling-26');
      expect(kling26PromptStrategy.output.format).toBe('text');
    });

    it('lumaRay3PromptStrategy has modelId "luma-ray3" and text format', () => {
      expect(lumaRay3PromptStrategy.modelId).toBe('luma-ray3');
      expect(lumaRay3PromptStrategy.output.format).toBe('text');
    });

    it('runwayGen45PromptStrategy has modelId "runway-gen45" and text format', () => {
      expect(runwayGen45PromptStrategy.modelId).toBe('runway-gen45');
      expect(runwayGen45PromptStrategy.output.format).toBe('text');
    });

    it('sora2PromptStrategy has modelId "sora-2" and text format', () => {
      expect(sora2PromptStrategy.modelId).toBe('sora-2');
      expect(sora2PromptStrategy.output.format).toBe('text');
    });

    it('wan22PromptStrategy has modelId "wan-2.2" and text format', () => {
      expect(wan22PromptStrategy.modelId).toBe('wan-2.2');
      expect(wan22PromptStrategy.output.format).toBe('text');
    });

    it('veo4PromptStrategy has modelId "veo-4" and structured format with schema', () => {
      expect(veo4PromptStrategy.modelId).toBe('veo-4');
      expect(veo4PromptStrategy.output.format).toBe('structured');
      if (veo4PromptStrategy.output.format === 'structured') {
        expect(veo4PromptStrategy.output.schema).toBeDefined();
        expect(veo4PromptStrategy.output.schema.type).toBe('object');
        const props = veo4PromptStrategy.output.schema.properties as Record<string, unknown>;
        expect(props).toHaveProperty('mode');
        expect(props).toHaveProperty('subject');
        expect(props).toHaveProperty('camera');
        expect(props).toHaveProperty('environment');
      }
    });

    it('veo4 schema requires mode, subject, camera, environment', () => {
      if (veo4PromptStrategy.output.format === 'structured') {
        const required = veo4PromptStrategy.output.schema.required as string[];
        expect(required).toContain('mode');
        expect(required).toContain('subject');
        expect(required).toContain('camera');
        expect(required).toContain('environment');
      }
    });
  });

  describe('core behavior - model-specific instructions embedded', () => {
    it('kling26 prompt includes Kling-specific structure instructions', () => {
      const result = kling26PromptStrategy.buildPrompt(makeContext());
      expect(result).toContain('Kling 2.6');
      expect(result).toContain('Subject');
      expect(result).toContain('Do NOT use screenplay format');
    });

    it('lumaRay3 prompt includes Luma-specific causal chain instructions', () => {
      const result = lumaRay3PromptStrategy.buildPrompt(makeContext());
      expect(result).toContain('Luma Ray-3');
      expect(result).toContain('causal chains');
    });

    it('runwayGen45 prompt includes Runway A2D instructions', () => {
      const result = runwayGen45PromptStrategy.buildPrompt(makeContext());
      expect(result).toContain('Runway Gen-4.5');
      expect(result).toContain('Camera Movement');
    });

    it('sora2 prompt includes Sora world-building instructions', () => {
      const result = sora2PromptStrategy.buildPrompt(makeContext());
      expect(result).toContain('Sora');
      expect(result).toContain('World-building');
    });

    it('veo4 prompt includes Veo JSON schema mapping instructions', () => {
      const result = veo4PromptStrategy.buildPrompt(makeContext());
      expect(result).toContain('Veo 4');
      expect(result).toContain('JSON schema');
    });

    it('wan22 prompt includes Wan structure and English-only instruction', () => {
      const result = wan22PromptStrategy.buildPrompt(makeContext());
      expect(result).toContain('Wan 2.2');
      expect(result).toContain('Subject + Scene + Motion');
      expect(result).toContain('English only');
    });

    it('default prompt includes generic optimization instruction', () => {
      const result = defaultPromptStrategy.buildPrompt(makeContext());
      expect(result).toContain('high-quality video generation');
    });
  });

  describe('constraint passthrough from context', () => {
    it('all strategies include mandatory constraint block from context', () => {
      const ctx = makeContext();
      for (const strategy of ALL_STRATEGIES) {
        const result = strategy.buildPrompt(ctx);
        expect(result).toContain('MANDATORY CONSTRAINTS');
        expect(result).toContain('- HDR');
      }
    });

    it('all strategies include IR JSON in output', () => {
      const ctx = makeContext();
      for (const strategy of ALL_STRATEGIES) {
        const result = strategy.buildPrompt(ctx);
        expect(result).toContain('"subjects"');
        expect(result).toContain('elegant');
      }
    });
  });
});
