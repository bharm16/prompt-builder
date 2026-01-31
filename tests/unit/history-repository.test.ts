import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/LoggingService', () => ({
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

const mockRepository = {
  getUserPrompts: vi.fn(),
  save: vi.fn(),
  deleteById: vi.fn(),
  clear: vi.fn(),
  syncEntries: vi.fn(),
  updatePrompt: vi.fn(),
  updateHighlights: vi.fn(),
  updateOutput: vi.fn(),
  updateVersions: vi.fn(),
  collectionName: 'prompts',
};

vi.mock('@repositories/index', () => ({
  getPromptRepositoryForUser: vi.fn(() => mockRepository),
  getLocalPromptRepository: vi.fn(() => mockRepository),
}));

import {
  normalizeEntries,
  loadFromFirestore,
  saveEntry,
  deleteEntry,
  clearAll,
  updatePrompt,
  updateOutput,
  updateVersions,
} from '@hooks/usePromptHistory/api/historyRepository';
import type { PromptHistoryEntry } from '@hooks/types';

describe('normalizeEntries', () => {
  describe('error and edge cases', () => {
    it('returns empty array for empty input', () => {
      expect(normalizeEntries([])).toEqual([]);
    });

    it('fills in all optional fields with defaults when missing', () => {
      const sparse = [{ input: 'test', output: 'result' }] as PromptHistoryEntry[];
      const normalized = normalizeEntries(sparse);

      expect(normalized[0].title).toBeNull();
      expect(normalized[0].brainstormContext).toBeNull();
      expect(normalized[0].generationParams).toBeNull();
      expect(normalized[0].keyframes).toBeNull();
      expect(normalized[0].highlightCache).toBeNull();
      expect(normalized[0].versions).toEqual([]);
    });
  });

  describe('core behavior', () => {
    it('preserves existing values when they are defined', () => {
      const entry: PromptHistoryEntry = {
        input: 'test',
        output: 'result',
        title: 'My Prompt',
        brainstormContext: { key: 'val' },
        generationParams: { fps: 24 },
        keyframes: [{ url: 'http://example.com/img.png' }],
        highlightCache: { cached: true },
        versions: [{ versionId: 'v1', signature: 'sig', prompt: 'p', timestamp: 't' }],
      };

      const normalized = normalizeEntries([entry]);
      expect(normalized[0].title).toBe('My Prompt');
      expect(normalized[0].versions).toHaveLength(1);
      expect(normalized[0].keyframes).toHaveLength(1);
    });
  });
});

describe('loadFromFirestore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('propagates repository errors', async () => {
      mockRepository.getUserPrompts.mockRejectedValueOnce(new Error('Firestore unavailable'));
      await expect(loadFromFirestore('user-1')).rejects.toThrow('Firestore unavailable');
    });
  });

  describe('core behavior', () => {
    it('normalizes entries returned from repository', async () => {
      mockRepository.getUserPrompts.mockResolvedValueOnce([
        { input: 'hello', output: 'world' },
      ]);
      const result = await loadFromFirestore('user-1');
      expect(result[0].title).toBeNull();
      expect(result[0].versions).toEqual([]);
    });
  });
});

describe('saveEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('propagates save errors', async () => {
      mockRepository.save.mockRejectedValueOnce(new Error('Quota exceeded'));
      await expect(
        saveEntry('user-1', { input: 'test', output: 'out', score: null, mode: 'video' }),
      ).rejects.toThrow('Quota exceeded');
    });
  });

  describe('core behavior', () => {
    it('returns uuid and id from repository result', async () => {
      mockRepository.save.mockResolvedValueOnce({ uuid: 'abc', id: 'doc-1' });

      const result = await saveEntry('user-1', {
        input: 'my prompt',
        output: 'optimized',
        score: 85,
        mode: 'video',
      });

      expect(result).toEqual({ uuid: 'abc', id: 'doc-1' });
    });

    it('passes optional fields when provided', async () => {
      mockRepository.save.mockResolvedValueOnce({ uuid: 'x', id: 'y' });

      await saveEntry('user-1', {
        uuid: 'existing-uuid',
        title: 'My Title',
        input: 'in',
        output: 'out',
        score: 90,
        mode: 'video',
        targetModel: 'kling',
        brainstormContext: { style: 'cinematic' },
      });

      const callArg = mockRepository.save.mock.calls[0][1];
      expect(callArg.uuid).toBe('existing-uuid');
      expect(callArg.title).toBe('My Title');
      expect(callArg.targetModel).toBe('kling');
    });
  });
});

describe('deleteEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('propagates delete errors', async () => {
    mockRepository.deleteById.mockRejectedValueOnce(new Error('Not found'));
    await expect(deleteEntry('user-1', 'entry-1')).rejects.toThrow('Not found');
  });

  it('calls deleteById with the entry id', async () => {
    mockRepository.deleteById.mockResolvedValueOnce(undefined);
    await deleteEntry('user-1', 'entry-123');
    expect(mockRepository.deleteById).toHaveBeenCalledWith('entry-123');
  });
});

describe('updatePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips Firestore update when docId starts with draft-', async () => {
    await updatePrompt('user-1', 'uuid-1', 'draft-123', { input: 'new' });
    expect(mockRepository.updatePrompt).not.toHaveBeenCalled();
  });

  it('skips Firestore update when docId is null', async () => {
    await updatePrompt('user-1', 'uuid-1', null, { input: 'new' });
    expect(mockRepository.updatePrompt).not.toHaveBeenCalled();
  });

  it('calls updatePrompt with docId for valid Firestore doc', async () => {
    mockRepository.updatePrompt.mockResolvedValueOnce(undefined);
    await updatePrompt('user-1', 'uuid-1', 'real-doc-id', { input: 'updated' });
    expect(mockRepository.updatePrompt).toHaveBeenCalledWith('real-doc-id', { input: 'updated' });
  });
});

describe('updateOutput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure repository has the method
    mockRepository.updateOutput = vi.fn().mockResolvedValue(undefined);
  });

  it('skips when docId is a draft id for Firestore repo', async () => {
    await updateOutput('user-1', 'uuid-1', 'draft-456', 'new output');
    expect(mockRepository.updateOutput).not.toHaveBeenCalled();
  });
});

describe('updateVersions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository.updateVersions = vi.fn().mockResolvedValue(undefined);
  });

  it('skips Firestore write when docId is draft', async () => {
    await updateVersions('user-1', 'uuid-1', 'draft-789', []);
    expect(mockRepository.updateVersions).not.toHaveBeenCalled();
  });
});

describe('clearAll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls clear on repository when method exists', async () => {
    mockRepository.clear.mockResolvedValueOnce(undefined);
    await clearAll('user-1');
    expect(mockRepository.clear).toHaveBeenCalled();
  });
});
