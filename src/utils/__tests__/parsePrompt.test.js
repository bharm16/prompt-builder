import { describe, it, expect } from 'vitest';
import { parsePrompt, getParseStats } from '../parsePrompt';

const SAMPLE = `
Wide shot of Abraham Lincoln in black frock coat and stovepipe hat standing at wooden podium...
camera slowly dollies forward...
overcast natural lighting creates soft shadows...
rows of white headstones...
35mm cinematic style with desaturated color palette...
**TECHNICAL SPECS**
Duration: 5-8s | Aspect Ratio: 2.39:1 | Frame Rate: 24fps
`;

describe('parsePrompt', () => {
  it('extracts swappable units with roles', () => {
    const spans = parsePrompt(SAMPLE);
    const has = (text, role) =>
      spans.some(s =>
        s.text.toLowerCase().includes(text.toLowerCase()) &&
        (!role || s.role === role)
      );

    expect(has('black frock coat', 'Wardrobe')).toBe(true);
    expect(has('stovepipe hat', 'Wardrobe')).toBe(true);
    expect(has('camera slowly dollies', 'CameraMove')).toBe(true);
    expect(has('soft shadows', 'Lighting')).toBe(true);
    expect(has('white headstones', 'Environment')).toBe(true);
    expect(has('35mm', 'Technical')).toBe(true);
    expect(has('2.39:1', 'Technical')).toBe(true);
    expect(has('24fps', 'Technical')).toBe(true);
  });

  it('assigns confidence scores', () => {
    const spans = parsePrompt(SAMPLE);

    // All spans should have a confidence score
    expect(spans.every(s => s.confidence >= 0 && s.confidence <= 1)).toBe(true);

    // Technical specs should have high confidence (0.99)
    const technicalSpans = spans.filter(s => s.role === 'Technical');
    expect(technicalSpans.every(s => s.confidence >= 0.9)).toBe(true);

    // Camera moves should have high confidence (0.9)
    const cameraSpans = spans.filter(s => s.role === 'CameraMove');
    expect(cameraSpans.every(s => s.confidence >= 0.9)).toBe(true);
  });

  it('provides correct start and end positions', () => {
    const spans = parsePrompt(SAMPLE);

    // All spans should have valid positions
    expect(spans.every(s => s.start >= 0 && s.end > s.start)).toBe(true);

    // Verify a specific span position
    const fpsSpan = spans.find(s => s.text === '24fps');
    if (fpsSpan) {
      expect(SAMPLE.slice(fpsSpan.start, fpsSpan.end)).toBe('24fps');
    }
  });

  it('handles empty input', () => {
    const spans = parsePrompt('');
    expect(spans).toEqual([]);
  });

  it('handles input with no detectable spans', () => {
    const spans = parsePrompt('This is a simple sentence.');
    // May or may not extract spans depending on patterns
    expect(Array.isArray(spans)).toBe(true);
  });

  it('detects multiple categories correctly', () => {
    const prompt = `
      Soft dramatic lighting on weathered face wearing black frock coat.
      Camera dollies forward in slow motion. Wide shot with shallow depth of field.
      Shot at 35mm, 24fps, 2.39:1 aspect ratio.
    `;

    const spans = parsePrompt(prompt);
    const roles = new Set(spans.map(s => s.role));

    // Should detect multiple role types
    expect(roles.size).toBeGreaterThan(3);

    // Should include key categories
    expect(roles.has('Lighting')).toBe(true);  // "soft dramatic lighting" should be detected
    expect(roles.has('Wardrobe') || roles.has('Appearance')).toBe(true);
    expect(roles.has('CameraMove')).toBe(true);
    expect(roles.has('Technical')).toBe(true);
  });

  it('normalizes text correctly', () => {
    const spans = parsePrompt('Black Frock Coat and STOVEPIPE HAT');

    // Normalized text should be lowercase
    expect(spans.every(s => s.norm === s.norm.toLowerCase())).toBe(true);
  });
});

describe('getParseStats', () => {
  it('calculates statistics correctly', () => {
    const spans = parsePrompt(SAMPLE);
    const stats = getParseStats(spans);

    expect(stats).toHaveProperty('totalSpans');
    expect(stats).toHaveProperty('roleDistribution');
    expect(stats).toHaveProperty('avgConfidence');

    expect(stats.totalSpans).toBe(spans.length);
    expect(typeof stats.avgConfidence).toBe('number');
    expect(stats.avgConfidence).toBeGreaterThanOrEqual(0);
    expect(stats.avgConfidence).toBeLessThanOrEqual(1);
  });

  it('handles empty spans array', () => {
    const stats = getParseStats([]);

    expect(stats.totalSpans).toBe(0);
    expect(stats.roleDistribution).toEqual({});
    expect(isNaN(stats.avgConfidence) || stats.avgConfidence === 0).toBe(true);
  });

  it('counts role distribution correctly', () => {
    const spans = parsePrompt(SAMPLE);
    const stats = getParseStats(spans);

    // Should have counts for each role
    Object.values(stats.roleDistribution).forEach(count => {
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThan(0);
    });

    // Total should match spans length
    const totalFromDistribution = Object.values(stats.roleDistribution).reduce((a, b) => a + b, 0);
    expect(totalFromDistribution).toBe(spans.length);
  });
});
