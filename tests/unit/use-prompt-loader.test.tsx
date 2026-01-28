import { describe, expect, it, beforeEach, vi, type MockedFunction } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { NavigateFunction } from 'react-router-dom';

import { usePromptLoader } from '@features/prompt-optimizer/PromptOptimizerContainer/hooks/usePromptLoader';
import { getPromptRepository } from '@repositories/index';
import { createHighlightSignature } from '@features/span-highlighting';
import type { Toast } from '@hooks/types';

const logSpies = {
  warn: vi.fn(),
  error: vi.fn(),
};

class PromptContextMock {
  elements: Record<string, unknown>;
  metadata: Record<string, unknown>;

  constructor(elements: Record<string, unknown> = {}, metadata: Record<string, unknown> = {}) {
    this.elements = elements;
    this.metadata = metadata;
  }

  toJSON(): { elements: Record<string, unknown>; metadata: Record<string, unknown> } {
    return { elements: this.elements, metadata: this.metadata };
  }

  static fromJSON(data: Record<string, unknown> | null | undefined): PromptContextMock | null {
    if (!data) return null;
    const { elements = {}, metadata = {} } = data as {
      elements?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    };
    return new PromptContextMock(elements, metadata);
  }
}

vi.mock('@repositories/index', () => ({
  getPromptRepository: vi.fn(),
}));

vi.mock('@features/span-highlighting', () => ({
  createHighlightSignature: vi.fn(),
}));

vi.mock('@utils/PromptContext', () => ({
  PromptContext: PromptContextMock,
}));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => logSpies,
  },
}));

const mockGetPromptRepository = vi.mocked(getPromptRepository);
const mockCreateHighlightSignature = vi.mocked(createHighlightSignature);

type UsePromptLoaderParams = Parameters<typeof usePromptLoader>[0];

type PromptOptimizer = UsePromptLoaderParams['promptOptimizer'];

type SetDisplayedPromptSilently = UsePromptLoaderParams['setDisplayedPromptSilently'];
type ApplyInitialHighlightSnapshot = UsePromptLoaderParams['applyInitialHighlightSnapshot'];
type ResetEditStacks = UsePromptLoaderParams['resetEditStacks'];
type ResetVersionEdits = UsePromptLoaderParams['resetVersionEdits'];
type SetCurrentPromptDocId = UsePromptLoaderParams['setCurrentPromptDocId'];
type SetCurrentPromptUuid = UsePromptLoaderParams['setCurrentPromptUuid'];
type SetShowResults = UsePromptLoaderParams['setShowResults'];
type SetSelectedModel = UsePromptLoaderParams['setSelectedModel'];
type SetPromptContext = UsePromptLoaderParams['setPromptContext'];

type PromptRepository = {
  getByUuid: (uuid: string) => Promise<
    | {
        id?: string;
        uuid: string;
        input?: string;
        output?: string;
        targetModel?: string | null;
        highlightCache?: {
          signature?: string;
          updatedAt?: string;
          [key: string]: unknown;
        } | null;
        brainstormContext?: string | Record<string, unknown> | null;
      }
    | null
  >;
};

const createPromptOptimizer = (): PromptOptimizer => {
  const setInputPrompt: MockedFunction<PromptOptimizer['setInputPrompt']> = vi.fn();
  const setOptimizedPrompt: MockedFunction<PromptOptimizer['setOptimizedPrompt']> = vi.fn();
  const setDisplayedPrompt: MockedFunction<PromptOptimizer['setDisplayedPrompt']> = vi.fn();
  const setGenericOptimizedPrompt: MockedFunction<NonNullable<PromptOptimizer['setGenericOptimizedPrompt']>> =
    vi.fn();
  const setPreviewPrompt: MockedFunction<NonNullable<PromptOptimizer['setPreviewPrompt']>> = vi.fn();
  const setPreviewAspectRatio: MockedFunction<NonNullable<PromptOptimizer['setPreviewAspectRatio']>> = vi.fn();

  return {
    setInputPrompt,
    setOptimizedPrompt,
    setDisplayedPrompt,
    setGenericOptimizedPrompt,
    setPreviewPrompt,
    setPreviewAspectRatio,
    displayedPrompt: '',
  };
};

const createToast = (): Toast => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
});

const createDefaults = (overrides: Partial<UsePromptLoaderParams> = {}): UsePromptLoaderParams => {
  const setDisplayedPromptSilently: MockedFunction<SetDisplayedPromptSilently> = vi.fn();
  const applyInitialHighlightSnapshot: MockedFunction<ApplyInitialHighlightSnapshot> = vi.fn();
  const resetEditStacks: MockedFunction<ResetEditStacks> = vi.fn();
  const resetVersionEdits: MockedFunction<ResetVersionEdits> = vi.fn();
  const setCurrentPromptDocId: MockedFunction<SetCurrentPromptDocId> = vi.fn();
  const setCurrentPromptUuid: MockedFunction<SetCurrentPromptUuid> = vi.fn();
  const setShowResults: MockedFunction<SetShowResults> = vi.fn();
  const setSelectedModel: MockedFunction<SetSelectedModel> = vi.fn();
  const setPromptContext: MockedFunction<SetPromptContext> = vi.fn();

  return {
    uuid: 'uuid-1',
    currentPromptUuid: null,
    navigate: vi.fn() as NavigateFunction,
    toast: createToast(),
    promptOptimizer: createPromptOptimizer(),
    setDisplayedPromptSilently,
    applyInitialHighlightSnapshot,
    resetEditStacks,
    resetVersionEdits,
    setCurrentPromptDocId,
    setCurrentPromptUuid,
    setShowResults,
    setSelectedModel,
    setPromptContext,
    skipLoadFromUrlRef: { current: false },
    ...overrides,
  };
};

describe('usePromptLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateHighlightSignature.mockReturnValue('computed-signature');
  });

  it('loads prompt data and restores context', async () => {
    const getByUuid: MockedFunction<PromptRepository['getByUuid']> = vi.fn();
    const promptRepository: PromptRepository = { getByUuid };

    mockGetPromptRepository.mockReturnValue(promptRepository);

    getByUuid.mockResolvedValue({
      id: 'doc-1',
      uuid: 'uuid-1',
      input: 'Input prompt',
      output: 'Output prompt',
      targetModel: 'model-x',
      highlightCache: { spans: [], updatedAt: '2024-01-01T00:00:00.000Z' },
      brainstormContext: JSON.stringify({
        elements: { subject: 'cat' },
        metadata: { format: 'detailed' },
      }),
    });

    const params = createDefaults();

    const { result } = renderHook(() => usePromptLoader(params));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(params.promptOptimizer.setInputPrompt).toHaveBeenCalledWith('Input prompt');
    expect(params.promptOptimizer.setOptimizedPrompt).toHaveBeenCalledWith('Output prompt');
    expect(params.setDisplayedPromptSilently).toHaveBeenCalledWith('Output prompt');
    expect(params.promptOptimizer.setGenericOptimizedPrompt).toHaveBeenCalledWith(null);
    expect(params.promptOptimizer.setPreviewPrompt).toHaveBeenCalledWith(null);
    expect(params.promptOptimizer.setPreviewAspectRatio).toHaveBeenCalledWith(null);
    expect(params.setCurrentPromptUuid).toHaveBeenCalledWith('uuid-1');
    expect(params.setCurrentPromptDocId).toHaveBeenCalledWith('doc-1');
    expect(params.setShowResults).toHaveBeenCalledWith(true);
    expect(params.setSelectedModel).toHaveBeenCalledWith('model-x');
    expect(params.applyInitialHighlightSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        signature: 'computed-signature',
      }),
      { bumpVersion: true, markPersisted: true }
    );
    expect(params.resetVersionEdits).toHaveBeenCalled();
    expect(params.resetEditStacks).toHaveBeenCalled();
    expect(params.setPromptContext).toHaveBeenCalledWith(expect.any(PromptContextMock));
  });

  it('warns and clears context when brainstorm JSON is invalid', async () => {
    const getByUuid: MockedFunction<PromptRepository['getByUuid']> = vi.fn();
    const promptRepository: PromptRepository = { getByUuid };

    mockGetPromptRepository.mockReturnValue(promptRepository);

    getByUuid.mockResolvedValue({
      id: 'doc-2',
      uuid: 'uuid-2',
      input: 'Input prompt',
      output: 'Output prompt',
      brainstormContext: '{invalid-json',
    });

    const params = createDefaults({ uuid: 'uuid-2' });

    renderHook(() => usePromptLoader(params));

    await waitFor(() => {
      expect(params.toast.warning).toHaveBeenCalledWith(
        'Could not restore video context. The prompt will still load.'
      );
    });

    expect(logSpies.warn).toHaveBeenCalled();
    expect(params.setPromptContext).toHaveBeenCalledWith(null);
  });

  it('navigates home when prompt does not exist', async () => {
    const getByUuid: MockedFunction<PromptRepository['getByUuid']> = vi.fn();
    const promptRepository: PromptRepository = { getByUuid };

    mockGetPromptRepository.mockReturnValue(promptRepository);
    getByUuid.mockResolvedValue(null);

    const params = createDefaults({ uuid: 'missing-uuid' });

    renderHook(() => usePromptLoader(params));

    await waitFor(() => {
      expect(params.navigate).toHaveBeenCalledWith('/', { replace: true });
    });

    expect(logSpies.warn).toHaveBeenCalled();
  });

  it('handles repository errors by showing a toast and redirecting', async () => {
    const getByUuid: MockedFunction<PromptRepository['getByUuid']> = vi.fn();
    const promptRepository: PromptRepository = { getByUuid };

    mockGetPromptRepository.mockReturnValue(promptRepository);
    getByUuid.mockRejectedValue(new Error('Boom'));

    const params = createDefaults({ uuid: 'uuid-error' });

    renderHook(() => usePromptLoader(params));

    await waitFor(() => {
      expect(params.toast.error).toHaveBeenCalledWith('Failed to load prompt');
    });

    expect(params.navigate).toHaveBeenCalledWith('/', { replace: true });
    expect(logSpies.error).toHaveBeenCalled();
  });
});
