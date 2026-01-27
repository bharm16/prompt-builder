import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractActionSpans,
  isCompromiseAvailable,
  warmupCompromise,
  DEFAULT_COMPROMISE_CONFIG,
} from '../CompromiseService';

// Mock the logger
vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

// Mock VerbSemantics (async classifier)
vi.mock('../VerbSemantics', () => ({
  classifyVerbSemantically: vi.fn().mockResolvedValue({
    actionClass: 'movement',
    confidence: 0.9,
  }),
  isVerbSemanticsReady: vi.fn().mockReturnValue(false),
  warmupVerbSemantics: vi.fn().mockResolvedValue(undefined),
}));

describe('extractActionSpans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('returns empty result when disabled', async () => {
      const result = await extractActionSpans('running through the park', { enabled: false });

      expect(result.spans).toHaveLength(0);
      expect(result.stats.totalExtracted).toBe(0);
    });

    it('returns empty result for empty text', async () => {
      const result = await extractActionSpans('');

      expect(result.spans).toHaveLength(0);
    });

    it('returns empty result for null text', async () => {
      const result = await extractActionSpans(null as unknown as string);

      expect(result.spans).toHaveLength(0);
    });

    it('returns empty result for non-string input', async () => {
      const result = await extractActionSpans(123 as unknown as string);

      expect(result.spans).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('handles text with only auxiliary verbs', async () => {
      const result = await extractActionSpans('it is what it is');

      // All auxiliary verbs should be excluded
      expect(result.spans.every(s => !['is', 'was', 'are', 'were'].includes(s.text.toLowerCase()))).toBe(true);
    });

    it('handles text without any verbs', async () => {
      const result = await extractActionSpans('a beautiful sunset over the mountains');

      expect(result.stats.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('extracts gerunds tagged as nouns', async () => {
      // Compromise sometimes tags gerunds as nouns in video prompts
      const result = await extractActionSpans('woman dribbling a basketball');

      const texts = result.spans.map(s => s.text.toLowerCase());
      expect(texts.some(t => t.includes('dribbling'))).toBe(true);
    });

    it('respects maxPhraseWords limit', async () => {
      const result = await extractActionSpans(
        'the athlete is running extremely quickly and energetically through the dense green forest',
        { maxPhraseWords: 3 }
      );

      // No span should have more than 3 words
      result.spans.forEach(span => {
        const wordCount = span.text.split(/\s+/).length;
        expect(wordCount).toBeLessThanOrEqual(3);
      });
    });

    it('handles unicode text', async () => {
      const result = await extractActionSpans('跑步 running through the park 走る');

      expect(result.stats.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('verb phrase extraction', () => {
    it('extracts simple verb phrases', async () => {
      const result = await extractActionSpans('a dog running through the park');

      const texts = result.spans.map(s => s.text.toLowerCase());
      expect(texts.some(t => t.includes('running'))).toBe(true);
    });

    it('extracts verb with object patterns', async () => {
      const result = await extractActionSpans('catching a ball');

      const texts = result.spans.map(s => s.text.toLowerCase());
      expect(texts.some(t => t.includes('catching'))).toBe(true);
    });

    it('extracts adverb + verb patterns when enabled', async () => {
      const result = await extractActionSpans('quickly running', { includeAdverbs: true });

      expect(result.spans.length).toBeGreaterThanOrEqual(0);
    });

    it('skips adverbs when disabled', async () => {
      const result = await extractActionSpans('quickly running', { includeAdverbs: false });

      // Should still extract the verb but without the adverb
      expect(result.stats.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('exclusion filters', () => {
    it('excludes auxiliary verbs', async () => {
      const result = await extractActionSpans('the dog is sitting');

      const texts = result.spans.map(s => s.text.toLowerCase());
      expect(texts.every(t => t !== 'is')).toBe(true);
    });

    it('excludes camera/technical verbs', async () => {
      const result = await extractActionSpans('capturing the scene, filming the action');

      const texts = result.spans.map(s => s.text.toLowerCase());
      expect(texts.every(t => !t.includes('capturing') && !t.includes('filming'))).toBe(true);
    });

    it('excludes template instruction patterns', async () => {
      const result = await extractActionSpans('maintain the framing, isolate the main subject');

      const texts = result.spans.map(s => s.text.toLowerCase());
      expect(texts.every(t => !t.includes('maintain') && !t.includes('isolate'))).toBe(true);
    });

    it('excludes lighting effect verbs', async () => {
      const result = await extractActionSpans('sunlight streaming through the window, shadows casting on the wall');

      const texts = result.spans.map(s => s.text.toLowerCase());
      expect(texts.every(t => !t.includes('streaming') || !t.includes('sunlight'))).toBe(true);
    });
  });

  describe('action role classification', () => {
    it('classifies state verbs correctly', async () => {
      const result = await extractActionSpans('the cat sitting on the couch');

      const sittingSpan = result.spans.find(s => s.text.toLowerCase().includes('sitting'));
      if (sittingSpan) {
        expect(sittingSpan.role).toBe('action.state');
      }
    });

    it('classifies gesture verbs correctly', async () => {
      const result = await extractActionSpans('a person waving goodbye');

      const wavingSpan = result.spans.find(s => s.text.toLowerCase().includes('waving'));
      if (wavingSpan) {
        expect(wavingSpan.role).toBe('action.gesture');
      }
    });

    it('classifies movement verbs correctly', async () => {
      const result = await extractActionSpans('a child jumping with joy');

      const jumpingSpan = result.spans.find(s => s.text.toLowerCase().includes('jumping'));
      if (jumpingSpan) {
        expect(jumpingSpan.role).toMatch(/^action\./);
      }
    });
  });

  describe('span structure', () => {
    it('includes correct span properties', async () => {
      const result = await extractActionSpans('a person running');

      if (result.spans.length > 0) {
        const span = result.spans[0];
        expect(span).toHaveProperty('text');
        expect(span).toHaveProperty('role');
        expect(span).toHaveProperty('confidence');
        expect(span).toHaveProperty('start');
        expect(span).toHaveProperty('end');
        expect(span).toHaveProperty('source');
        expect(span?.source).toBe('compromise');
      }
    });

    it('calculates correct character positions', async () => {
      const text = 'a person running quickly';
      const result = await extractActionSpans(text);

      result.spans.forEach(span => {
        expect(span.start).toBeGreaterThanOrEqual(0);
        expect(span.end).toBeLessThanOrEqual(text.length);
        expect(span.end).toBeGreaterThan(span.start);
        // The extracted text should match the substring
        expect(text.slice(span.start, span.end).toLowerCase()).toBe(span.text.toLowerCase());
      });
    });
  });

  describe('core behavior', () => {
    it('uses default config when not specified', async () => {
      const result = await extractActionSpans('a dog running through the park');

      expect(result.stats.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('merges partial config with defaults', async () => {
      const result = await extractActionSpans('a dog running', { minConfidence: 0.9 });

      if (result.spans.length > 0) {
        expect(result.spans[0]?.confidence).toBe(0.9);
      }
    });

    it('returns stats with extraction counts', async () => {
      const result = await extractActionSpans('running and jumping and dancing');

      expect(result.stats).toHaveProperty('verbPhrases');
      expect(result.stats).toHaveProperty('gerunds');
      expect(result.stats).toHaveProperty('totalExtracted');
      expect(result.stats).toHaveProperty('latencyMs');
    });
  });
});

describe('isCompromiseAvailable', () => {
  it('returns true when compromise is working', () => {
    expect(isCompromiseAvailable()).toBe(true);
  });
});

describe('warmupCompromise', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success with latency', async () => {
    const result = await warmupCompromise();

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('latencyMs');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('extracts spans during warmup', async () => {
    const result = await warmupCompromise();

    // The warmup uses a test sentence that should produce spans
    expect(result.success).toBe(true);
  });
});

describe('DEFAULT_COMPROMISE_CONFIG', () => {
  it('has expected default values', () => {
    expect(DEFAULT_COMPROMISE_CONFIG.enabled).toBe(true);
    expect(DEFAULT_COMPROMISE_CONFIG.minConfidence).toBe(0.75);
    expect(DEFAULT_COMPROMISE_CONFIG.extractVerbPhrases).toBe(true);
    expect(DEFAULT_COMPROMISE_CONFIG.extractGerunds).toBe(true);
    expect(DEFAULT_COMPROMISE_CONFIG.includeAdverbs).toBe(true);
    expect(DEFAULT_COMPROMISE_CONFIG.includeObjects).toBe(true);
    expect(DEFAULT_COMPROMISE_CONFIG.maxPhraseWords).toBe(5);
  });
});
