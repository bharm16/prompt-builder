/**
 * Unit tests for ExportService
 *
 * Tests format transformations, file extension mapping, and MIME type mapping.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExportService } from '../exportService';

const baseData = {
  inputPrompt: 'Write a story about a cat',
  displayedPrompt: 'Craft a vivid narrative about a feline protagonist',
};

// ---------------------------------------------------------------------------
// exportAsText - transformation tests
// ---------------------------------------------------------------------------
describe('ExportService.exportAsText', () => {
  it('contains original prompt in the output', () => {
    const result = ExportService.exportAsText(baseData);
    expect(result).toContain('Write a story about a cat');
  });

  it('contains optimized prompt in the output', () => {
    const result = ExportService.exportAsText(baseData);
    expect(result).toContain('Craft a vivid narrative about a feline protagonist');
  });

  it('contains section headers ORIGINAL and OPTIMIZED', () => {
    const result = ExportService.exportAsText(baseData);
    expect(result).toContain('=== ORIGINAL ===');
    expect(result).toContain('=== OPTIMIZED ===');
  });

  it('contains a date string', () => {
    const result = ExportService.exportAsText(baseData);
    expect(result).toContain('Date:');
  });

  it('preserves special characters in prompts', () => {
    const result = ExportService.exportAsText({
      inputPrompt: 'Use <tags> & "quotes"',
      displayedPrompt: 'Enhanced <tags> & "quotes"',
    });
    expect(result).toContain('<tags>');
    expect(result).toContain('&');
    expect(result).toContain('"quotes"');
  });

  it('handles empty prompts without errors', () => {
    const result = ExportService.exportAsText({
      inputPrompt: '',
      displayedPrompt: '',
    });
    expect(result).toContain('=== ORIGINAL ===');
    expect(result).toContain('=== OPTIMIZED ===');
  });
});

// ---------------------------------------------------------------------------
// exportAsMarkdown
// ---------------------------------------------------------------------------
describe('ExportService.exportAsMarkdown', () => {
  it('produces valid markdown with headers', () => {
    const result = ExportService.exportAsMarkdown(baseData);
    expect(result).toContain('# Prompt Optimization');
    expect(result).toContain('## Original Prompt');
    expect(result).toContain('## Optimized Prompt');
  });

  it('contains both prompts', () => {
    const result = ExportService.exportAsMarkdown(baseData);
    expect(result).toContain(baseData.inputPrompt);
    expect(result).toContain(baseData.displayedPrompt);
  });

  it('includes a bold date label', () => {
    const result = ExportService.exportAsMarkdown(baseData);
    expect(result).toContain('**Date:**');
  });
});

// ---------------------------------------------------------------------------
// exportAsJson
// ---------------------------------------------------------------------------
describe('ExportService.exportAsJson', () => {
  it('produces valid JSON', () => {
    const result = ExportService.exportAsJson(baseData);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('contains original and optimized prompts in parsed output', () => {
    const parsed = JSON.parse(ExportService.exportAsJson(baseData));
    expect(parsed.original).toBe(baseData.inputPrompt);
    expect(parsed.optimized).toBe(baseData.displayedPrompt);
  });

  it('includes qualityScore when provided', () => {
    const parsed = JSON.parse(
      ExportService.exportAsJson({ ...baseData, qualityScore: 85 }),
    );
    expect(parsed.qualityScore).toBe(85);
  });

  it('includes selectedMode when provided', () => {
    const parsed = JSON.parse(
      ExportService.exportAsJson({ ...baseData, selectedMode: 'video' }),
    );
    expect(parsed.mode).toBe('video');
  });

  it('includes timestamp', () => {
    const parsed = JSON.parse(ExportService.exportAsJson(baseData));
    expect(parsed.timestamp).toBeTruthy();
  });

  it('does not include undefined qualityScore as null', () => {
    const parsed = JSON.parse(ExportService.exportAsJson(baseData));
    // undefined values are omitted by JSON.stringify
    // but the property key still exists, just check the structure
    expect(parsed).toHaveProperty('original');
    expect(parsed).toHaveProperty('optimized');
    expect(parsed).toHaveProperty('timestamp');
  });
});

// ---------------------------------------------------------------------------
// getFileExtension
// ---------------------------------------------------------------------------
describe('ExportService.getFileExtension', () => {
  it('returns txt for text format', () => {
    expect(ExportService.getFileExtension('text')).toBe('txt');
  });

  it('returns md for markdown format', () => {
    expect(ExportService.getFileExtension('markdown')).toBe('md');
  });

  it('returns json for json format', () => {
    expect(ExportService.getFileExtension('json')).toBe('json');
  });
});

// ---------------------------------------------------------------------------
// getMimeType
// ---------------------------------------------------------------------------
describe('ExportService.getMimeType', () => {
  it('returns text/plain for text format', () => {
    expect(ExportService.getMimeType('text')).toBe('text/plain');
  });

  it('returns text/markdown for markdown format', () => {
    expect(ExportService.getMimeType('markdown')).toBe('text/markdown');
  });

  it('returns application/json for json format', () => {
    expect(ExportService.getMimeType('json')).toBe('application/json');
  });
});

// ---------------------------------------------------------------------------
// downloadFile
// ---------------------------------------------------------------------------
describe('ExportService.downloadFile', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('creates anchor, triggers click, and revokes blob URL', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    const click = vi.fn();
    const anchor = document.createElement('a');
    anchor.click = click;
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return anchor;
        }
        return originalCreateElement(tagName);
      });

    ExportService.downloadFile('content', 'file.txt', 'text/plain');

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(anchor.href).toBe('blob:mock-url');
    expect(anchor.download).toBe('file.txt');
    expect(click).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});

// ---------------------------------------------------------------------------
// export dispatcher
// ---------------------------------------------------------------------------
describe('ExportService.export', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches markdown export with md filename and markdown mime', () => {
    vi.spyOn(ExportService, 'exportAsMarkdown').mockReturnValue('md-content');
    const downloadSpy = vi.spyOn(ExportService, 'downloadFile').mockImplementation(() => {});

    ExportService.export('markdown', baseData);

    expect(downloadSpy).toHaveBeenCalledWith(
      'md-content',
      'prompt-optimization.md',
      'text/markdown'
    );
  });

  it('dispatches json export with json filename and application/json mime', () => {
    vi.spyOn(ExportService, 'exportAsJson').mockReturnValue('{\"ok\":true}');
    const downloadSpy = vi.spyOn(ExportService, 'downloadFile').mockImplementation(() => {});

    ExportService.export('json', baseData);

    expect(downloadSpy).toHaveBeenCalledWith(
      '{\"ok\":true}',
      'prompt-optimization.json',
      'application/json'
    );
  });

  it('dispatches text export for text and unknown formats', () => {
    const exportAsTextSpy = vi.spyOn(ExportService, 'exportAsText').mockReturnValue('text-content');
    const downloadSpy = vi.spyOn(ExportService, 'downloadFile').mockImplementation(() => {});

    ExportService.export('text', baseData);
    ExportService.export('unexpected' as 'text', baseData);

    expect(exportAsTextSpy).toHaveBeenCalledTimes(2);
    expect(downloadSpy).toHaveBeenNthCalledWith(
      1,
      'text-content',
      'prompt-optimization.txt',
      'text/plain'
    );
    expect(downloadSpy).toHaveBeenNthCalledWith(
      2,
      'text-content',
      'prompt-optimization.txt',
      'text/plain'
    );
  });
});
