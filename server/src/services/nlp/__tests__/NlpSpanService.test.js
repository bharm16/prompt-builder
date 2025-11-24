import { describe, it, expect, beforeAll } from 'vitest';
import { extractKnownSpans, getVocabStats, estimateCoverage } from '../NlpSpanService.js';

/**
 * NLP Span Service Test Suite
 * 
 * Tests dictionary-based span extraction with emphasis on:
 * 1. Vocabulary matching across all taxonomy categories
 * 2. Disambiguation rules (pan, truck, roll)
 * 3. Multi-word term handling
 * 4. Character offset accuracy
 * 5. Overlap resolution
 */

describe('NlpSpanService - Vocabulary Matching', () => {
  
  it('should extract camera movement terms', () => {
    const text = 'Camera pans left as it dollies forward';
    const spans = extractKnownSpans(text);
    
    expect(spans.length).toBeGreaterThanOrEqual(2);
    
    const panSpan = spans.find(s => s.text.toLowerCase().includes('pan'));
    expect(panSpan).toBeDefined();
    expect(panSpan.role).toBe('camera.movement');
    expect(panSpan.confidence).toBe(1.0);
    
    const dollySpan = spans.find(s => s.text.toLowerCase().includes('doll'));
    expect(dollySpan).toBeDefined();
    expect(dollySpan.role).toBe('camera.movement');
  });
  
  it('should extract shot type terms', () => {
    const text = 'Wide shot transitions to close-up';
    const spans = extractKnownSpans(text);
    
    expect(spans.length).toBeGreaterThanOrEqual(2);
    
    const wideSpan = spans.find(s => s.text.toLowerCase().includes('wide shot'));
    expect(wideSpan).toBeDefined();
    expect(wideSpan.role).toBe('shot.type');
    
    const closeUpSpan = spans.find(s => s.text.toLowerCase().includes('close-up'));
    expect(closeUpSpan).toBeDefined();
    expect(closeUpSpan.role).toBe('shot.type');
  });
  
  it('should extract lighting quality terms', () => {
    const text = 'Rembrandt lighting with soft light during golden hour';
    const spans = extractKnownSpans(text);
    
    expect(spans.length).toBeGreaterThanOrEqual(2);
    
    const rembrandtSpan = spans.find(s => s.text.toLowerCase().includes('rembrandt'));
    expect(rembrandtSpan).toBeDefined();
    expect(rembrandtSpan.role).toBe('lighting.quality');
    
    const softLightSpan = spans.find(s => s.text.toLowerCase().includes('soft light'));
    expect(softLightSpan).toBeDefined();
    expect(softLightSpan.role).toBe('lighting.quality');
  });
  
  it('should extract lighting time of day terms', () => {
    const text = 'Shot during golden hour with blue hour transition';
    const spans = extractKnownSpans(text);
    
    const goldenHourSpan = spans.find(s => s.text.toLowerCase().includes('golden hour'));
    expect(goldenHourSpan).toBeDefined();
    expect(goldenHourSpan.role).toBe('lighting.timeOfDay');
  });
  
  it('should extract film stock terms', () => {
    const text = 'Shot on Kodak Portra 400 with cinematic look';
    const spans = extractKnownSpans(text);
    
    expect(spans.length).toBeGreaterThanOrEqual(1);
    
    // Try to find any Kodak film stock
    const filmStockSpan = spans.find(s => s.role === 'style.filmStock');
    expect(filmStockSpan).toBeDefined();
    expect(filmStockSpan.role).toBe('style.filmStock');
  });
  
  it('should extract technical aspect ratios', () => {
    const text = 'Shot in 16:9 aspect ratio, can also do 2.39:1';
    const spans = extractKnownSpans(text);
    
    expect(spans.length).toBeGreaterThanOrEqual(2);
    
    const sixteenNineSpan = spans.find(s => s.text === '16:9');
    expect(sixteenNineSpan).toBeDefined();
    expect(sixteenNineSpan.role).toBe('technical.aspectRatio');
    
    const cinemaSpan = spans.find(s => s.text === '2.39:1');
    expect(cinemaSpan).toBeDefined();
    expect(cinemaSpan.role).toBe('technical.aspectRatio');
  });
  
  it('should extract resolution terms', () => {
    const text = 'Rendered in 4K resolution, upscaled to 8K';
    const spans = extractKnownSpans(text);
    
    expect(spans.length).toBeGreaterThanOrEqual(2);
    
    const fourKSpan = spans.find(s => s.text === '4K');
    expect(fourKSpan).toBeDefined();
    expect(fourKSpan.role).toBe('technical.resolution');
    
    const eightKSpan = spans.find(s => s.text === '8K');
    expect(eightKSpan).toBeDefined();
    expect(eightKSpan.role).toBe('technical.resolution');
  });
  
  it('should extract lens focal lengths', () => {
    const text = 'Shot with 35mm lens and 85mm portrait lens';
    const spans = extractKnownSpans(text);
    
    expect(spans.length).toBeGreaterThanOrEqual(2);
    
    const thirtyFiveSpan = spans.find(s => s.text === '35mm');
    expect(thirtyFiveSpan).toBeDefined();
    expect(thirtyFiveSpan.role).toBe('camera.lens');
    
    const eightyFiveSpan = spans.find(s => s.text === '85mm');
    expect(eightyFiveSpan).toBeDefined();
    expect(eightyFiveSpan.role).toBe('camera.lens');
  });
});

describe('NlpSpanService - Disambiguation Rules', () => {
  
  it('should correctly disambiguate "pan" in camera context', () => {
    const text = 'Camera pans across the scene';
    const spans = extractKnownSpans(text);
    
    const panSpan = spans.find(s => s.text.toLowerCase().includes('pan'));
    expect(panSpan).toBeDefined();
    expect(panSpan.role).toBe('camera.movement');
  });
  
  it('should avoid false positive for "pan" in cooking context', () => {
    const text = 'Chef cooks vegetables in a frying pan';
    const spans = extractKnownSpans(text);
    
    // "pan" should be excluded due to cooking context
    const panSpan = spans.find(s => s.text.toLowerCase() === 'pan' && s.role === 'camera.movement');
    expect(panSpan).toBeUndefined();
  });
  
  it('should correctly disambiguate "truck" in camera context', () => {
    const text = 'Camera trucks right alongside the subject';
    const spans = extractKnownSpans(text);
    
    const truckSpan = spans.find(s => s.text.toLowerCase().includes('truck'));
    expect(truckSpan).toBeDefined();
    expect(truckSpan.role).toBe('camera.movement');
  });
  
  it('should avoid false positive for "truck" in vehicle context', () => {
    const text = 'Delivery truck drives down the road';
    const spans = extractKnownSpans(text);
    
    // "truck" should be excluded due to vehicle context
    const truckSpan = spans.find(s => s.text.toLowerCase() === 'truck' && s.role === 'camera.movement');
    expect(truckSpan).toBeUndefined();
  });
  
  it('should correctly disambiguate "roll" in camera context', () => {
    const text = 'Camera rolls slightly to create tension';
    const spans = extractKnownSpans(text);
    
    const rollSpan = spans.find(s => s.text.toLowerCase().includes('roll'));
    expect(rollSpan).toBeDefined();
    expect(rollSpan.role).toBe('camera.movement');
  });
  
  it('should avoid false positive for "roll" with bread', () => {
    const text = 'Fresh bread roll on the table';
    const spans = extractKnownSpans(text);
    
    // "roll" should be excluded due to bread context
    const rollSpan = spans.find(s => s.text.toLowerCase() === 'roll' && s.role === 'camera.movement');
    expect(rollSpan).toBeUndefined();
  });
  
  it('should avoid false positive for "roll" as verb without camera context', () => {
    const text = 'The dog rolls over';
    const spans = extractKnownSpans(text);
    
    // "rolls" should NOT be tagged as camera.movement (no camera context)
    const rollSpan = spans.find(s => s.text.toLowerCase().includes('roll') && s.role === 'camera.movement');
    expect(rollSpan).toBeUndefined();
  });
  
  it('should correctly tag "roll" as camera.movement when camera context exists', () => {
    const text = 'Camera rolls slightly to create tension';
    const spans = extractKnownSpans(text);
    
    // "rolls" should be tagged as camera.movement (has camera context)
    const rollSpan = spans.find(s => s.text.toLowerCase().includes('roll'));
    expect(rollSpan).toBeDefined();
    expect(rollSpan.role).toBe('camera.movement');
  });
  
  it('should correctly tag "pan" with camera context', () => {
    const text = 'Pan left with camera movement';
    const spans = extractKnownSpans(text);
    
    // "Pan" should be tagged as camera.movement (has camera context)
    const panSpan = spans.find(s => s.text.toLowerCase().includes('pan') && s.role === 'camera.movement');
    expect(panSpan).toBeDefined();
  });
  
  it('should avoid false positive for "pan" without camera context', () => {
    const text = 'Pan out the vegetables';
    const spans = extractKnownSpans(text);
    
    // "Pan" should NOT be tagged as camera.movement (no camera context, cooking context)
    const panSpan = spans.find(s => s.text.toLowerCase() === 'pan' && s.role === 'camera.movement');
    expect(panSpan).toBeUndefined();
  });
  
  it('should avoid false positive for "drone" without camera context', () => {
    const text = 'A drone flying overhead';
    const spans = extractKnownSpans(text);
    
    // "drone" should NOT be tagged as camera.movement (no camera context)
    const droneSpan = spans.find(s => s.text.toLowerCase() === 'drone' && s.role === 'camera.movement');
    expect(droneSpan).toBeUndefined();
  });
  
  it('should correctly tag "drone" as camera.movement with camera context', () => {
    const text = 'Shot with drone camera flying overhead';
    const spans = extractKnownSpans(text);
    
    // "drone" should be tagged as camera.movement (has camera context)
    const droneSpan = spans.find(s => s.text.toLowerCase() === 'drone' && s.role === 'camera.movement');
    expect(droneSpan).toBeDefined();
  });
});

describe('NlpSpanService - Multi-word Terms', () => {
  
  it('should extract multi-word lighting terms', () => {
    const text = 'Using three-point lighting setup';
    const spans = extractKnownSpans(text);
    
    const lightingSpan = spans.find(s => s.text.toLowerCase().includes('three-point lighting'));
    expect(lightingSpan).toBeDefined();
    expect(lightingSpan.role).toBe('lighting.quality');
  });
  
  it('should extract multi-word shot types', () => {
    const text = 'Over-the-shoulder shot during conversation';
    const spans = extractKnownSpans(text);
    
    const shotSpan = spans.find(s => s.text.toLowerCase().includes('over-the-shoulder'));
    expect(shotSpan).toBeDefined();
    expect(shotSpan.role).toBe('shot.type');
  });
  
  it('should extract complex film stock names', () => {
    const text = 'Shot on Kodak Vision3 250D 5207';
    const spans = extractKnownSpans(text);
    
    const filmStockSpan = spans.find(s => s.text.includes('Kodak Vision3 250D 5207'));
    expect(filmStockSpan).toBeDefined();
    expect(filmStockSpan.role).toBe('style.filmStock');
  });
});

describe('NlpSpanService - Character Offsets', () => {
  
  it('should provide accurate character offsets', () => {
    const text = 'A wide shot with rembrandt lighting in 16:9';
    const spans = extractKnownSpans(text);
    
    spans.forEach(span => {
      const extractedText = text.substring(span.start, span.end);
      expect(extractedText.toLowerCase()).toBe(span.text.toLowerCase());
    });
  });
  
  it('should handle offsets at start of text', () => {
    const text = 'Close-up of character';
    const spans = extractKnownSpans(text);
    
    const closeUpSpan = spans.find(s => s.text.toLowerCase().includes('close-up'));
    expect(closeUpSpan).toBeDefined();
    expect(closeUpSpan.start).toBe(0);
  });
  
  it('should handle offsets at end of text', () => {
    const text = 'Shot in 4K';
    const spans = extractKnownSpans(text);
    
    const fourKSpan = spans.find(s => s.text === '4K');
    expect(fourKSpan).toBeDefined();
    expect(fourKSpan.end).toBe(text.length);
  });
});

describe('NlpSpanService - Overlap Resolution', () => {
  
  it('should handle non-overlapping spans', () => {
    const text = 'Wide shot with dolly movement in 16:9';
    const spans = extractKnownSpans(text);
    
    // Check that no spans overlap
    for (let i = 0; i < spans.length; i++) {
      for (let j = i + 1; j < spans.length; j++) {
        const overlap = 
          (spans[i].start < spans[j].end && spans[i].end > spans[j].start);
        expect(overlap).toBe(false);
      }
    }
  });
  
  it('should prefer longer spans when overlapping', () => {
    // If there's an overlap, the longer, more specific term should win
    const text = 'Extreme wide shot setup';
    const spans = extractKnownSpans(text);
    
    // Should match "Extreme Wide Shot" rather than just "Wide Shot"
    const extremeWideSpan = spans.find(s => s.text.toLowerCase().includes('extreme wide'));
    const wideOnlySpan = spans.find(s => s.text.toLowerCase() === 'wide shot');
    
    // Only one should be present
    if (extremeWideSpan) {
      expect(wideOnlySpan).toBeUndefined();
    }
  });
});

describe('NlpSpanService - Edge Cases', () => {
  
  it('should handle empty text', () => {
    const spans = extractKnownSpans('');
    expect(spans).toEqual([]);
  });
  
  it('should handle null/undefined input', () => {
    expect(extractKnownSpans(null)).toEqual([]);
    expect(extractKnownSpans(undefined)).toEqual([]);
  });
  
  it('should handle text with no matches', () => {
    const text = 'Some random text without any technical terms';
    const spans = extractKnownSpans(text);
    expect(spans).toEqual([]);
  });
  
  it('should be case-insensitive', () => {
    const text = 'WIDE SHOT with DOLLY movement';
    const spans = extractKnownSpans(text);
    
    expect(spans.length).toBeGreaterThanOrEqual(2);
    
    const wideSpan = spans.find(s => s.role === 'shot.type');
    expect(wideSpan).toBeDefined();
    
    const dollySpan = spans.find(s => s.role === 'camera.movement');
    expect(dollySpan).toBeDefined();
  });
});

describe('NlpSpanService - Complex Prompts', () => {
  
  it('should handle realistic video prompt', () => {
    const text = 'Wide shot of cyberpunk cityscape, camera dollies forward through neon-lit streets. Shot on Kodak Portra 400, 2.39:1 aspect ratio, rendered in 4K. Golden hour lighting with volumetric fog.';
    const spans = extractKnownSpans(text);
    
    // Should find multiple spans (at least 4 categories)
    expect(spans.length).toBeGreaterThanOrEqual(4);
    
    // Verify key terms are found
    const categories = new Set(spans.map(s => s.role));
    expect(categories.has('shot.type')).toBe(true);
    expect(categories.has('technical.aspectRatio')).toBe(true);
    expect(categories.has('technical.resolution')).toBe(true);
  });
  
  it('should extract all taxonomy categories when present', () => {
    const text = 'Wide shot using 35mm lens, camera pans left with steadicam. Rembrandt lighting during golden hour. Shot on Kodak Portra 400 in 16:9 at 4K resolution.';
    const spans = extractKnownSpans(text);
    
    const categories = new Set(spans.map(s => s.role));
    
    // Check we got multiple taxonomy categories
    expect(categories.size).toBeGreaterThanOrEqual(5);
    expect(categories.has('shot.type')).toBe(true);
    expect(categories.has('camera.lens')).toBe(true);
    expect(categories.has('camera.movement')).toBe(true);
    expect(categories.has('lighting.quality')).toBe(true);
    expect(categories.has('lighting.timeOfDay')).toBe(true);
  });
});

describe('NlpSpanService - Utility Functions', () => {
  
  it('should return vocabulary statistics', () => {
    const stats = getVocabStats();
    
    expect(stats).toBeDefined();
    expect(stats.totalCategories).toBeGreaterThan(0);
    expect(stats.totalTerms).toBeGreaterThan(0);
    expect(stats.categories).toBeDefined();
    
    // Check that categories include our main ones
    expect(stats.categories['camera.movement']).toBeDefined();
    expect(stats.categories['shot.type']).toBeDefined();
    expect(stats.categories['lighting.quality']).toBeDefined();
  });
  
  it('should estimate coverage percentage', () => {
    const text = 'Wide shot with dolly movement in 16:9';
    const coverage = estimateCoverage(text);
    
    expect(coverage).toBeGreaterThan(0);
    expect(coverage).toBeLessThanOrEqual(100);
  });
  
  it('should return 0 coverage for empty text', () => {
    const coverage = estimateCoverage('');
    expect(coverage).toBe(0);
  });
  
  it('should return high coverage for technical prompt', () => {
    const text = 'Wide shot dolly zoom 4K 16:9';
    const coverage = estimateCoverage(text);
    
    // Most words are technical terms
    expect(coverage).toBeGreaterThan(50);
  });
});

describe('NlpSpanService - Performance', () => {
  
  it('should process spans quickly', () => {
    const text = 'Wide shot of cyberpunk cityscape, camera dollies forward. Shot on Kodak Vision3 500T in 2.39:1 at 4K with golden hour lighting.';
    
    const startTime = Date.now();
    const spans = extractKnownSpans(text);
    const endTime = Date.now();
    
    const latency = endTime - startTime;
    
    // Should be under 50ms (target is ~5ms but allow buffer)
    expect(latency).toBeLessThan(50);
    expect(spans.length).toBeGreaterThan(0);
  });
  
  it('should handle large prompts efficiently', () => {
    const text = 'Wide shot dolly pan tilt zoom steadicam gimbal crane '.repeat(10) + 
                 'Kodak Vision3 500T Portra 400 CineStill 800T '.repeat(5) +
                 '16:9 4K 8K 1080p '.repeat(5);
    
    const startTime = Date.now();
    const spans = extractKnownSpans(text);
    const endTime = Date.now();
    
    const latency = endTime - startTime;
    
    // Should still be fast even with repeated terms
    expect(latency).toBeLessThan(100);
    expect(spans.length).toBeGreaterThan(0);
  });
});

