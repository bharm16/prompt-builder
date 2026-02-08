/**
 * Unit tests for useSharedPrompt
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useSharedPrompt } from '@components/SharedPrompt/hooks/useSharedPrompt';
import { getPromptRepository } from '@repositories/index';
import { PromptContext } from '@/utils/PromptContext';
import { logger } from '@/services/LoggingService';
import { useToast } from '@components/Toast';

vi.mock('@repositories/index', () => ({
  getPromptRepository: vi.fn(),
}));

vi.mock('@/utils/PromptContext', () => ({
  PromptContext: {
    fromJSON: vi.fn(),
  },
}));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    error: vi.fn(),
  },
}));

const debugLogger = vi.hoisted(() => ({
  logEffect: vi.fn(),
  logAction: vi.fn(),
  logError: vi.fn(),
  startTimer: vi.fn(),
  endTimer: vi.fn(),
}));

vi.mock('@hooks/useDebugLogger', () => ({
  useDebugLogger: () => debugLogger,
}));

vi.mock('@components/Toast', () => ({
  useToast: vi.fn(),
}));

const mockGetPromptRepository = vi.mocked(getPromptRepository);
const mockPromptContext = vi.mocked(PromptContext);
const mockLogger = vi.mocked(logger);
const mockUseToast = vi.mocked(useToast);

describe('useSharedPrompt', () => {
  const toastApi = {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };
  let originalClipboard: typeof navigator.clipboard | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseToast.mockReturnValue(toastApi);
    originalClipboard = navigator.clipboard;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });
  });

  describe('error handling', () => {
    it('returns an error when uuid is missing', async () => {
      const { result } = renderHook(() => useSharedPrompt({ uuid: undefined }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Invalid prompt ID');
      expect(result.current.prompt).toBeNull();
    });

    it('sets error when repository throws', async () => {
      const getByUuid = vi.fn().mockRejectedValue(new Error('boom'));
      mockGetPromptRepository.mockReturnValue({ getByUuid } as never);

      const { result } = renderHook(() => useSharedPrompt({ uuid: 'uuid-123' }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load prompt');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('logs and warns when context restoration fails', async () => {
      const getByUuid = vi.fn().mockResolvedValue({
        uuid: 'uuid-456',
        input: 'input',
        output: 'output',
        mode: 'optimize',
        timestamp: new Date().toISOString(),
        brainstormContext: '{bad json',
      });
      mockGetPromptRepository.mockReturnValue({ getByUuid } as never);

      const { result } = renderHook(() => useSharedPrompt({ uuid: 'uuid-456' }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.prompt).not.toBeNull();
      expect(result.current.promptContext).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(toastApi.warning).toHaveBeenCalledWith(
        'Some context data could not be loaded. The prompt will still display.'
      );
    });
  });

  describe('edge cases', () => {
    it('reports prompt not found when repository returns null', async () => {
      const getByUuid = vi.fn().mockResolvedValue(null);
      mockGetPromptRepository.mockReturnValue({ getByUuid } as never);

      const { result } = renderHook(() => useSharedPrompt({ uuid: 'missing' }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Prompt not found');
      expect(result.current.prompt).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('hydrates prompt context and formats output', async () => {
      const context = { id: 'context' };
      mockPromptContext.fromJSON.mockReturnValue(context as never);

      const promptData = {
        uuid: 'uuid-789',
        input: 'input text',
        output: '<script>alert("x")</script>',
        mode: 'optimize',
        timestamp: new Date().toISOString(),
        brainstormContext: JSON.stringify({ elements: { subject: 'cat' } }),
      };

      const getByUuid = vi.fn().mockResolvedValue(promptData);
      mockGetPromptRepository.mockReturnValue({ getByUuid } as never);

      const { result } = renderHook(() => useSharedPrompt({ uuid: 'uuid-789' }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.prompt).toEqual(promptData);
      expect(result.current.promptContext).toBe(context);
      expect(result.current.formattedOutput.html).toContain('&lt;script&gt;');
    });

    it('copies output to clipboard and resets copied state', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });

      const promptData = {
        uuid: 'uuid-000',
        input: 'input text',
        output: 'copy me',
        mode: 'optimize',
        timestamp: new Date().toISOString(),
      };

      const getByUuid = vi.fn().mockResolvedValue(promptData);
      mockGetPromptRepository.mockReturnValue({ getByUuid } as never);

      const { result } = renderHook(() => useSharedPrompt({ uuid: 'uuid-000' }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      vi.useFakeTimers();

      await act(async () => {
        await result.current.handleCopy();
      });

      expect(writeText).toHaveBeenCalledWith('copy me');
      expect(toastApi.success).toHaveBeenCalledWith('Copied to clipboard!');
      expect(result.current.copied).toBe(true);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.copied).toBe(false);
      vi.useRealTimers();
    });
  });
});
