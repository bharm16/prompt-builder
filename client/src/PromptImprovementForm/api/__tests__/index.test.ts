import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockBuildFirebaseAuthHeaders } = vi.hoisted(() => ({
  mockBuildFirebaseAuthHeaders: vi.fn(),
}));

vi.mock('@/services/http/firebaseAuth', () => ({
  buildFirebaseAuthHeaders: mockBuildFirebaseAuthHeaders,
}));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import { fetchGeneratedQuestions } from '../index';

describe('PromptImprovementForm api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildFirebaseAuthHeaders.mockResolvedValue({
      Authorization: 'Bearer firebase-token',
    });
  });

  it('sends request with auth headers and parses question schema', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          questions: [
            {
              id: 1,
              title: 'What should be emphasized?',
              description: 'Focus areas for the result',
              field: 'specificAspects',
              examples: ['Practical use cases', 'Edge cases'],
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const questions = await fetchGeneratedQuestions('Improve this prompt');

    expect(fetchMock).toHaveBeenCalledWith('/api/generate-questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer firebase-token',
      },
      body: JSON.stringify({ prompt: 'Improve this prompt' }),
    });
    expect(questions).toEqual([
      {
        id: 1,
        title: 'What should be emphasized?',
        description: 'Focus areas for the result',
        field: 'specificAspects',
        examples: ['Practical use cases', 'Edge cases'],
      },
    ]);
  });

  it('throws status-based error when API responds non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('service unavailable', {
          status: 503,
        })
      )
    );

    await expect(fetchGeneratedQuestions('Prompt')).rejects.toThrow('Failed to generate questions: 503');
  });

  it('throws when response schema is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            questions: [{ id: 'wrong-type' }],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }
        )
      )
    );

    await expect(fetchGeneratedQuestions('Prompt')).rejects.toThrow();
  });
});
