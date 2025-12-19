/**
 * Export Format Conversion Utility
 * 
 * Pure function for converting export format types.
 * Extracted from PromptCanvas component to improve separation of concerns.
 */

import type { ExportFormat } from '../../types';

/**
 * Converts ExportFormatType to internal export format
 */
export function convertExportFormat(format: ExportFormat): 'text' | 'markdown' | 'json' {
  const formatStr = format as string;
  if (formatStr === 'md' || formatStr === 'markdown') {
    return 'markdown';
  }
  if (formatStr === 'txt' || formatStr === 'text') {
    return 'text';
  }
  return 'json';
}

