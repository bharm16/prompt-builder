import { describe, expect, it } from 'vitest';

import { convertExportFormat } from '@features/prompt-optimizer/PromptCanvas/utils/exportFormatConversion';

describe('exportFormatConversion', () => {
  it('converts known formats', () => {
    expect(convertExportFormat('md' as never)).toBe('markdown');
    expect(convertExportFormat('markdown')).toBe('markdown');
    expect(convertExportFormat('txt' as never)).toBe('text');
    expect(convertExportFormat('text')).toBe('text');
  });

  it('defaults to json for unknown formats', () => {
    expect(convertExportFormat('unknown' as never)).toBe('json');
  });
});
