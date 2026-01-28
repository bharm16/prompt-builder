import { describe, expect, it, vi, type MockedFunction, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { usePromptExport } from '@features/prompt-optimizer/PromptCanvas/hooks/usePromptExport';
import { ExportService } from '@/services/exportService';
import { convertExportFormat } from '@features/prompt-optimizer/PromptCanvas/utils/exportFormatConversion';
import type { useDebugLogger } from '@hooks/useDebugLogger';
import type { useToast } from '@components/Toast';

vi.mock('@/services/exportService', () => ({
  ExportService: {
    export: vi.fn(),
  },
}));

vi.mock('@features/prompt-optimizer/PromptCanvas/utils/exportFormatConversion', () => ({
  convertExportFormat: vi.fn(),
}));

const mockExportService = vi.mocked(ExportService);
const mockConvertExportFormat = vi.mocked(convertExportFormat);

type DebugLogger = ReturnType<typeof useDebugLogger>;
type Toast = ReturnType<typeof useToast>;

const createDebugLogger = (): DebugLogger => ({
  logState: vi.fn(),
  logEffect: vi.fn(),
  logAction: vi.fn(),
  logError: vi.fn(),
  startTimer: vi.fn(),
  endTimer: vi.fn(),
});

const createToast = (): Toast => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
});

describe('usePromptExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports prompt and closes menu on success', () => {
    const setShowExportMenu: MockedFunction<(value: boolean) => void> = vi.fn();
    const toast = createToast();
    const debug = createDebugLogger();

    mockConvertExportFormat.mockReturnValue('markdown');

    const { result } = renderHook(() =>
      usePromptExport({
        inputPrompt: 'Input',
        displayedPrompt: 'Displayed',
        qualityScore: 92,
        selectedMode: 'video',
        setShowExportMenu,
        toast,
        debug,
      })
    );

    act(() => {
      result.current('markdown');
    });

    expect(mockConvertExportFormat).toHaveBeenCalledWith('markdown');
    expect(mockExportService.export).toHaveBeenCalledWith('markdown', {
      inputPrompt: 'Input',
      displayedPrompt: 'Displayed',
      qualityScore: 92,
      selectedMode: 'video',
    });
    expect(setShowExportMenu).toHaveBeenCalledWith(false);
    expect(debug.logAction).toHaveBeenCalledWith('export', { format: 'markdown', mode: 'video' });
    expect(debug.startTimer).toHaveBeenCalledWith('export');
    expect(debug.endTimer).toHaveBeenCalledWith('export', 'Export as markdown successful');
    expect(toast.success).toHaveBeenCalledWith('Exported as MARKDOWN');
  });

  it('reports errors when export fails', () => {
    const setShowExportMenu: MockedFunction<(value: boolean) => void> = vi.fn();
    const toast = createToast();
    const debug = createDebugLogger();

    mockConvertExportFormat.mockReturnValue('json');
    mockExportService.export.mockImplementation(() => {
      throw new Error('export failed');
    });

    const { result } = renderHook(() =>
      usePromptExport({
        inputPrompt: 'Input',
        displayedPrompt: 'Displayed',
        qualityScore: null,
        selectedMode: 'text',
        setShowExportMenu,
        toast,
        debug,
      })
    );

    act(() => {
      result.current('json');
    });

    expect(debug.endTimer).toHaveBeenCalledWith('export');
    expect(debug.logError).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Export failed');
    expect(setShowExportMenu).not.toHaveBeenCalled();
  });
});
