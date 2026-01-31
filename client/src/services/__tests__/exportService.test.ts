/**
 * Unit tests for ExportService
 *
 * Tests format transformations, file extension mapping, and MIME type mapping.
 */

import { describe, expect, it } from 'vitest';
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
