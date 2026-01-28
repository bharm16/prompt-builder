import { useCallback } from 'react';
import { ExportService } from '@/services/exportService';
import { convertExportFormat } from '../utils/exportFormatConversion';
import type { ExportFormat } from '../../types';
import type { useDebugLogger } from '@hooks/useDebugLogger';
import type { useToast } from '@components/Toast';

interface UsePromptExportOptions {
  inputPrompt: string;
  displayedPrompt: string | null;
  qualityScore: number | null;
  selectedMode: string;
  setShowExportMenu: (value: boolean) => void;
  toast: ReturnType<typeof useToast>;
  debug: ReturnType<typeof useDebugLogger>;
}

export const usePromptExport = ({
  inputPrompt,
  displayedPrompt,
  qualityScore,
  selectedMode,
  setShowExportMenu,
  toast,
  debug,
}: UsePromptExportOptions): ((format: ExportFormat) => void) =>
  useCallback(
    (format: ExportFormat): void => {
      debug.logAction('export', { format, mode: selectedMode });
      debug.startTimer('export');

      const exportFormat = convertExportFormat(format);

      try {
        ExportService.export(exportFormat, {
          inputPrompt,
          displayedPrompt: displayedPrompt ?? '',
          ...(qualityScore !== null && { qualityScore }),
          selectedMode,
        });
        setShowExportMenu(false);
        debug.endTimer('export', `Export as ${exportFormat} successful`);
        toast.success(`Exported as ${exportFormat.toUpperCase()}`);
      } catch (error) {
        debug.endTimer('export');
        debug.logError('Export failed', error as Error);
        toast.error('Export failed');
      }
    },
    [
      inputPrompt,
      displayedPrompt,
      qualityScore,
      selectedMode,
      setShowExportMenu,
      toast,
      debug,
    ]
  );
