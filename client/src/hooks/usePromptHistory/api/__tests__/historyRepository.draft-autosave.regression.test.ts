import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetPromptRepositoryForUser } = vi.hoisted(() => ({
  mockGetPromptRepositoryForUser: vi.fn(),
}));

vi.mock('../../../../repositories', () => ({
  getPromptRepositoryForUser: mockGetPromptRepositoryForUser,
  getLocalPromptRepository: vi.fn(),
}));

vi.mock('../../../../services/LoggingService', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    startTimer: vi.fn(),
    endTimer: vi.fn(),
  },
}));

import { updateHighlights, updateOutput, updatePrompt } from '../historyRepository';

describe('regression: authenticated draft prompt autosave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not call remote repository update while entry is still draft-only', async () => {
    const repository = { updatePrompt: vi.fn().mockResolvedValue(undefined) };
    mockGetPromptRepositoryForUser.mockReturnValue(repository);

    await updatePrompt('user-1', 'draft-uuid-1', 'draft-123', { input: 'updated draft input' });

    expect(repository.updatePrompt).not.toHaveBeenCalled();
  });

  it('does not call remote highlight persistence while entry is still draft-only', async () => {
    const repository = { updateHighlights: vi.fn().mockResolvedValue(undefined) };
    mockGetPromptRepositoryForUser.mockReturnValue(repository);

    await updateHighlights('user-1', 'draft-uuid-1', 'draft-123', { spans: [] });

    expect(repository.updateHighlights).not.toHaveBeenCalled();
  });

  it('does not call remote output persistence while entry is still draft-only', async () => {
    const repository = { updateOutput: vi.fn().mockResolvedValue(undefined) };
    mockGetPromptRepositoryForUser.mockReturnValue(repository);

    await updateOutput('user-1', 'draft-uuid-1', 'draft-123', 'updated output');

    expect(repository.updateOutput).not.toHaveBeenCalled();
  });
});
