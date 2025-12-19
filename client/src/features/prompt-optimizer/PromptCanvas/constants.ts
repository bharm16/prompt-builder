/**
 * Constants for PromptCanvas component
 */

export const EXPORT_FORMATS = ['text', 'markdown', 'json'] as const;
export type ExportFormatType = typeof EXPORT_FORMATS[number];

export const EXPORT_FORMAT_MAP = {
  md: 'markdown',
  markdown: 'markdown',
  txt: 'text',
  text: 'text',
  json: 'json',
} as const;

export const SUGGESTION_TRIGGERS = ['selection', 'highlight', 'bento-grid'] as const;
export type SuggestionTrigger = typeof SUGGESTION_TRIGGERS[number];

