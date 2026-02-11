import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockApiClient,
} = vi.hoisted(() => ({
  mockApiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/services/ApiClient', () => ({
  apiClient: mockApiClient,
}));

vi.mock('../../services/LoggingService', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import { PromptRepository } from '../PromptRepository';
import { PromptRepositoryError } from '../promptRepositoryTypes';

const uuid = '11111111-1111-4111-8111-111111111111';

describe('PromptRepository', () => {
  let repository: PromptRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new PromptRepository();
  });

  it('save posts session payload and returns id/uuid', async () => {
    mockApiClient.post.mockResolvedValue({
      data: {
        id: 'session_1',
        prompt: { uuid },
      },
    });

    const result = await repository.save('user-1', {
      uuid,
      title: 'My Prompt',
      input: 'input',
      output: 'output',
      score: 90,
      mode: 'video',
    });

    expect(mockApiClient.post).toHaveBeenCalledWith('/v2/sessions', {
      name: 'My Prompt',
      prompt: expect.objectContaining({
        uuid,
        title: 'My Prompt',
        input: 'input',
        output: 'output',
        score: 90,
        mode: 'video',
      }),
    });
    expect(result).toEqual({ id: 'session_1', uuid });
  });

  it('getUserPrompts maps session DTOs and filters missing prompt payloads', async () => {
    mockApiClient.get.mockResolvedValue({
      data: [
        {
          id: 'session_1',
          updatedAt: '2025-01-01T00:00:00.000Z',
          prompt: {
            uuid,
            title: 'T',
            input: 'in',
            output: 'out',
            score: 70,
            mode: 'video',
            versions: [],
          },
        },
        {
          id: 'session_2',
          updatedAt: '2025-01-01T00:00:01.000Z',
          prompt: null,
        },
      ],
    });

    const result = await repository.getUserPrompts('user-1', 25);

    expect(mockApiClient.get).toHaveBeenCalledWith(
      '/v2/sessions?limit=25&includeContinuity=false&includePrompt=true'
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'session_1',
      uuid,
      title: 'T',
      input: 'in',
      output: 'out',
      score: 70,
      mode: 'video',
      versions: [],
    });
  });

  it('getById routes uuid lookup through by-prompt endpoint', async () => {
    mockApiClient.get.mockResolvedValue({
      data: {
        id: 'session_uuid',
        updatedAt: '2025-01-01T00:00:00.000Z',
        prompt: {
          uuid,
          input: 'input',
          output: 'output',
        },
      },
    });

    const result = await repository.getById(uuid);

    expect(mockApiClient.get).toHaveBeenCalledWith(`/v2/sessions/by-prompt/${encodeURIComponent(uuid)}`);
    expect(result).toMatchObject({ id: 'session_uuid', uuid, input: 'input', output: 'output' });
  });

  it('getById routes non-uuid lookup through sessions endpoint', async () => {
    mockApiClient.get.mockResolvedValue({
      data: {
        id: 'session_abc',
        updatedAt: '2025-01-01T00:00:00.000Z',
        prompt: {
          uuid: 'abc',
          input: 'in',
          output: 'out',
        },
      },
    });

    const result = await repository.getById('session_abc');

    expect(mockApiClient.get).toHaveBeenCalledWith('/v2/sessions/session_abc');
    expect(result).toMatchObject({ id: 'session_abc', input: 'in', output: 'out' });
  });

  it('resolves uuid to session id once and reuses cached resolution for later writes', async () => {
    mockApiClient.get.mockResolvedValue({ data: { id: 'session_cached' } });
    mockApiClient.patch.mockResolvedValue(undefined);

    await repository.updatePrompt(uuid, { input: 'first' });
    await repository.updateOutput(uuid, 'second');

    expect(mockApiClient.get).toHaveBeenCalledTimes(1);
    expect(mockApiClient.patch).toHaveBeenNthCalledWith(
      1,
      '/v2/sessions/session_cached/prompt',
      { input: 'first' }
    );
    expect(mockApiClient.patch).toHaveBeenNthCalledWith(
      2,
      '/v2/sessions/session_cached/output',
      { output: 'second' }
    );
  });

  it('deduplicates in-flight session resolution for concurrent updates', async () => {
    let resolveLookup: ((value: unknown) => void) | undefined;
    mockApiClient.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve;
        })
    );
    mockApiClient.patch.mockResolvedValue(undefined);

    const p1 = repository.updatePrompt(uuid, { title: 't1' });
    const p2 = repository.updateOutput(uuid, 'out-2');

    expect(mockApiClient.get).toHaveBeenCalledTimes(1);

    resolveLookup?.({ data: { id: 'session_inflight' } });
    await Promise.all([p1, p2]);

    expect(mockApiClient.patch).toHaveBeenCalledWith('/v2/sessions/session_inflight/prompt', {
      title: 't1',
    });
    expect(mockApiClient.patch).toHaveBeenCalledWith('/v2/sessions/session_inflight/output', {
      output: 'out-2',
    });
  });

  it('throws PromptRepositoryError for invalid save responses', async () => {
    mockApiClient.post.mockResolvedValue({ data: null });

    await expect(
      repository.save('user-1', {
        input: 'a',
        output: 'b',
      })
    ).rejects.toBeInstanceOf(PromptRepositoryError);
  });

  it('throws PromptRepositoryError when deleteById receives empty id', async () => {
    await expect(repository.deleteById('')).rejects.toBeInstanceOf(PromptRepositoryError);
  });
});
