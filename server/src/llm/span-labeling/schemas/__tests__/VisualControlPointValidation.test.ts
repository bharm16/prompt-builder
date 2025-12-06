/**
 * @test {Visual Control Point Extraction}
 * @description Validation tests for the visual control point extraction system.
 * 
 * These tests validate that the span labeling system correctly:
 * 1. Extracts renderable visual elements (things that change the video)
 * 2. Skips abstract concepts (determination, hope, etc.)
 * 3. Skips narrative intent (inviting the viewer, etc.)
 * 4. Skips meta-commentary (enhancing authenticity, etc.)
 * 
 * Run these tests after making changes to GroqSchema.ts to validate behavior.
 * 
 * Test Prompt (from first-principles analysis):
 * "A Point-of-View Shot of a man confidently driving a car with determination. 
 *  The road ahead stretches out, illuminated by Natural lighting, creating soft 
 *  highlights on the contours of the man's face, reflecting his focused demeanor 
 *  as he navigates the road."
 * 
 * Expected Results:
 * - SHOULD EXTRACT: POV Shot, man, driving, road ahead, Natural lighting, 
 *   soft highlights, focused demeanor, navigates the road
 * - SHOULD SKIP: determination (abstract), reflecting (narrative connector)
 */

import { describe, it, expect } from 'vitest';
import {
  GROQ_FULL_SYSTEM_PROMPT,
  GROQ_FEW_SHOT_EXAMPLES,
} from '../GroqSchema.js';

describe('Visual Control Point Validation', () => {
  
  // ============================================
  // Prompt Content Tests
  // ============================================
  
  describe('Prompt contains correct guidance', () => {
    it('should define visual control point clearly', () => {
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('What IS a Visual Control Point?');
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('would produce a visually different video');
    });

    it('should explicitly list "determination" as something to EXCLUDE', () => {
      // The prompt should explicitly mention determination as an example of what to skip
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('"determination"');
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('Internal states');
    });

    it('should have the visual control point test with checkmarks', () => {
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('✅');
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('❌');
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('abstract internal state');
    });

    it('should distinguish renderable emotions from abstract ones', () => {
      // "focused demeanor" is a facial expression - should be included
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('"focused demeanor"');
      // but it should be in the context of renderable elements
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('Facial expressions that manifest visually');
    });

    it('should have granularity guidance', () => {
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('Span Granularity');
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('Replaceable unit');
    });

    it('should have "What to SKIP" section', () => {
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('What to SKIP');
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('Not Visual Control Points');
    });
  });

  // ============================================
  // Few-Shot Example Tests
  // ============================================

  describe('Few-shot examples demonstrate correct behavior', () => {
    const assistantResponses = GROQ_FEW_SHOT_EXAMPLES
      .filter(m => m.role === 'assistant')
      .map(m => JSON.parse(m.content));

    it('should NOT have "determination" as a span in any example', () => {
      for (const response of assistantResponses) {
        const spanTexts = response.spans.map((s: { text: string }) => s.text.toLowerCase());
        expect(spanTexts).not.toContain('determination');
      }
    });

    it('should have "jaw set" as a renderable emotion in Example 4', () => {
      // Example 4 should show extracting "jaw set" instead of "determination"
      const example4Response = assistantResponses[3]; // Index 3 = 4th assistant response
      const hasJawSet = example4Response.spans.some(
        (s: { text: string }) => s.text.toLowerCase().includes('jaw set')
      );
      expect(hasJawSet).toBe(true);
    });

    it('should have analysis_trace explaining why determination was skipped', () => {
      const hasExplanation = assistantResponses.some(response => {
        const trace = response.analysis_trace?.toLowerCase() || '';
        return trace.includes('determination') && 
               (trace.includes('skip') || trace.includes('abstract'));
      });
      expect(hasExplanation).toBe(true);
    });

    it('should have a negative example (Example 5) with narrative/meta-commentary', () => {
      const userInputs = GROQ_FEW_SHOT_EXAMPLES
        .filter(m => m.role === 'user')
        .map(m => m.content);
      
      // Example 5 should have all three things to skip
      const hasNegativeExample = userInputs.some(input => 
        input.includes('determination') && 
        input.includes('inviting the viewer') &&
        input.includes('authenticity')
      );
      expect(hasNegativeExample).toBe(true);
    });

    it('should have notes explaining what was skipped in negative example', () => {
      // The last example (Example 5) should have notes about skipped concepts
      const lastResponse = assistantResponses[assistantResponses.length - 1];
      const notes = lastResponse.meta?.notes?.toLowerCase() || '';
      
      expect(notes).toContain('skip');
      expect(notes).toContain('determination');
    });
  });

  // ============================================
  // Driver Prompt Expected Behavior
  // ============================================

  describe('Driver Prompt Test Case', () => {
    /**
     * This is the test case from the first-principles analysis.
     * We can't actually run the LLM in unit tests, but we document
     * the expected behavior here for manual validation.
     */
    
    const driverPrompt = `A Point-of-View Shot of a man confidently driving a car with determination. The road ahead stretches out, illuminated by Natural lighting, creating soft highlights on the contours of the man's face, reflecting his focused demeanor as he navigates the road.`;

    const expectedExtractions = [
      { text: 'A Point-of-View Shot', role: 'shot.type' },
      { text: 'man', role: 'subject.identity' },
      { text: 'driving a car', role: 'action.movement' },
      { text: 'The road ahead', role: 'environment.location' },
      { text: 'Natural lighting', role: 'lighting.source' },
      { text: 'soft highlights on the contours', role: 'lighting.quality' },
      { text: "the man's face", role: 'subject.appearance' },
      { text: 'focused demeanor', role: 'subject.emotion' },
      { text: 'navigates the road', role: 'action.movement' },
    ];

    const expectedSkips = [
      { text: 'determination', reason: 'Abstract internal state' },
      { text: 'reflecting', reason: 'Narrative connector' },
      { text: 'confidently', reason: 'Abstract adverb (could be included if visible in posture)' },
    ];

    it('documents expected extractions for manual validation', () => {
      // This test documents what SHOULD be extracted
      // Actual validation requires running the LLM
      expect(expectedExtractions.length).toBeGreaterThan(0);
      console.log('\n📋 DRIVER PROMPT TEST CASE');
      console.log('=' .repeat(60));
      console.log('\nInput:', driverPrompt);
      console.log('\n✅ Expected Extractions:');
      for (const e of expectedExtractions) {
        console.log(`  - "${e.text}" → ${e.role}`);
      }
      console.log('\n❌ Expected Skips:');
      for (const s of expectedSkips) {
        console.log(`  - "${s.text}" (${s.reason})`);
      }
      console.log('\n' + '='.repeat(60));
    });

    it('documents expected skips for manual validation', () => {
      expect(expectedSkips.length).toBeGreaterThan(0);
      // "determination" should definitely be skipped
      const hasDetermination = expectedSkips.some(s => s.text === 'determination');
      expect(hasDetermination).toBe(true);
    });
  });

  // ============================================
  // Edge Case Tests
  // ============================================

  describe('Edge cases in prompt guidance', () => {
    it('should handle compound visual+abstract phrases', () => {
      // The prompt should guide the model to extract "focused demeanor" 
      // (visual) but skip "with determination" (abstract)
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('focused demeanor');
      
      // The ❌ examples should show abstract concepts being skipped
      const hasAbstractSkip = GROQ_FULL_SYSTEM_PROMPT.includes('❌') && 
        GROQ_FULL_SYSTEM_PROMPT.includes('determination');
      expect(hasAbstractSkip).toBe(true);
    });

    it('should provide granularity guidance for lighting descriptions', () => {
      // "soft highlights on the contours" should be one span
      // not split into "soft" + "highlights" + "contours"
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('soft highlights on the contours');
    });

    it('should not mix categories in coarse spans', () => {
      // The granularity section should warn against mixing categories
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('Too Coarse');
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('Mixes lighting + subject');
    });
  });
});
