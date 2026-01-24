import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { StoryboardFramePlanner } from '../StoryboardFramePlanner';
import { buildFallbackDeltas } from '../prompts';
import { LLMClient } from '@clients/LLMClient';
import type { AIResponse } from '@interfaces/IAIClient';

const buildResponse = (text: string): AIResponse => ({
  text,
  metadata: {},
});

const createClient = () => {
  const completeMock: MockedFunction<
    (systemPrompt: string, options?: Record<string, unknown>) => Promise<AIResponse>
  > = vi.fn();

  const adapter = {
    complete: completeMock,
  };

  const client = new LLMClient({ adapter, providerName: 'test-llm', defaultTimeout: 1000 });

  return { client, completeMock };
};

describe('StoryboardFramePlanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('throws when the LLM request fails', async () => {
      const { client, completeMock } = createClient();
      completeMock.mockRejectedValueOnce(new Error('LLM timeout'));

      const planner = new StoryboardFramePlanner({ llmClient: client });

      await expect(planner.planDeltas('prompt', 4)).rejects.toThrow('LLM timeout');
    });

    it('falls back to default deltas when parsing fails twice', async () => {
      const { client, completeMock } = createClient();
      completeMock
        .mockResolvedValueOnce(buildResponse('not json'))
        .mockResolvedValueOnce(buildResponse('still not json'));

      const planner = new StoryboardFramePlanner({ llmClient: client });
      const result = await planner.planDeltas('prompt', 4);

      expect(result).toEqual(buildFallbackDeltas(3));
    });

    it('pads missing deltas with fallback when repair also returns too few', async () => {
      const { client, completeMock } = createClient();
      completeMock
        .mockResolvedValueOnce(buildResponse('{"deltas": ["first", "second"]}'))
        .mockResolvedValueOnce(buildResponse('{"deltas": ["only one"]}'));

      const planner = new StoryboardFramePlanner({ llmClient: client });
      const result = await planner.planDeltas('prompt', 4);

      const fallback = buildFallbackDeltas(3);
      expect(result).toEqual(['first', 'second', fallback[2]]);
    });

    it('recovers by using repair output after an invalid plan response', async () => {
      const { client, completeMock } = createClient();
      completeMock
        .mockResolvedValueOnce(buildResponse('invalid response'))
        .mockResolvedValueOnce(
          buildResponse('{"deltas": ["first change", "second change", "third change"]}')
        );

      const planner = new StoryboardFramePlanner({ llmClient: client });
      const result = await planner.planDeltas('prompt', 4);

      expect(result).toEqual(['first change', 'second change', 'third change']);
      expect(completeMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('returns an empty array for empty prompts', async () => {
      const { client, completeMock } = createClient();
      const planner = new StoryboardFramePlanner({ llmClient: client });

      const result = await planner.planDeltas('   ', 4);

      expect(result).toEqual([]);
      expect(completeMock).not.toHaveBeenCalled();
    });

    it('returns an empty array when the frame count is less than two', async () => {
      const { client, completeMock } = createClient();
      const planner = new StoryboardFramePlanner({ llmClient: client });

      const result = await planner.planDeltas('prompt', 1);

      expect(result).toEqual([]);
      expect(completeMock).not.toHaveBeenCalled();
    });
  });

  describe('core behavior', () => {
    it('returns truncated deltas when the plan includes extras', async () => {
      const { client, completeMock } = createClient();
      completeMock.mockResolvedValueOnce(
        buildResponse('{"deltas": ["one", "two", "three", "four"]}')
      );

      const planner = new StoryboardFramePlanner({ llmClient: client });
      const result = await planner.planDeltas('prompt', 4);

      expect(result).toEqual(['one', 'two', 'three']);
    });

    it('returns the planned deltas when counts match expectations', async () => {
      const { client, completeMock } = createClient();
      completeMock.mockResolvedValueOnce(
        buildResponse('{"deltas": ["wide shot", "close-up", "over-the-shoulder"]}')
      );

      const planner = new StoryboardFramePlanner({ llmClient: client });
      const result = await planner.planDeltas('prompt', 4);

      expect(result).toEqual(['wide shot', 'close-up', 'over-the-shoulder']);
    });
  });
});
