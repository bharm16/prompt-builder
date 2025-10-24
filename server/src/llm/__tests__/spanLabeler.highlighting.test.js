import { describe, it, expect, beforeAll } from 'vitest';
import { labelSpans } from '../spanLabeler.js';

/**
 * Test to verify what content actually gets highlighted in multi-section prompts
 * This validates the fix for the issue where only the first paragraph was being analyzed
 */
describe('Span Labeling - What Gets Highlighted', () => {
  let result;

  const MULTI_SECTION_PROMPT = `Wide shot of George Washington draped in a blue Revolutionary War uniform, standing amidst a leaf-strewn battlefield under overcast skies. He gestures emphatically to soldiers, rallying their spirits as fallen leaves swirl around him in the brisk wind. The camera slowly pans in from a distance, capturing the tension and urgency of the moment. Soft, diffused light filters through the clouds, creating a somber yet heroic atmosphere. The style is reminiscent of classic historical dramas, shot on 35mm film to evoke a timeless quality, with a shallow depth of field that softly blurs the background soldiers, emphasizing Washington's commanding presence.

TECHNICAL SPECS
- **Duration:** 4-8s
- **Aspect Ratio:** 16:9
- **Frame Rate:** 24fps
- **Audio:** Mute

ALTERNATIVE APPROACHES
- **Variation 1:** Close-up of George Washington's determined expression as he gestures emphatically to soldiers, framed by the leaf-strewn battlefield under overcast skies. The camera holds steady, capturing the intensity of his call to action.
- **Variation 2:** Medium shot of George Washington draped in a blue Revolutionary War uniform, gesturing emphatically to soldiers as bright, high-key lighting breaks through the clouds, illuminating the battlefield and creating a hopeful contrast to the somber surroundings.`;

  beforeAll(async () => {
    // Run the actual span labeling on the multi-section prompt
    result = await labelSpans({
      text: MULTI_SECTION_PROMPT,
      maxSpans: 60,
      minConfidence: 0.5,
      policy: {
        nonTechnicalWordLimit: 6,
        allowOverlap: false,
      },
      templateVersion: 'v1',
    });
  }, 30000); // 30 second timeout for LLM call

  it('should return spans and meta', () => {
    expect(result).toBeDefined();
    expect(result.spans).toBeDefined();
    expect(Array.isArray(result.spans)).toBe(true);
    expect(result.meta).toBeDefined();
  });

  it('should find highlights in the main paragraph', () => {
    const mainParagraphHighlights = result.spans.filter((span) => {
      return span.start < 500; // First 500 chars is roughly the main paragraph
    });

    expect(mainParagraphHighlights.length).toBeGreaterThan(0);

    // Log what was found in main paragraph
    console.log('\n📝 Main Paragraph Highlights:');
    mainParagraphHighlights.forEach((span, idx) => {
      console.log(`  ${idx + 1}. "${span.text}" (${span.role}, confidence: ${span.confidence})`);
    });
  });

  it('should find highlights in TECHNICAL SPECS section', () => {
    // Find the start of TECHNICAL SPECS section
    const techSpecsStart = MULTI_SECTION_PROMPT.indexOf('TECHNICAL SPECS');
    const techSpecsEnd = MULTI_SECTION_PROMPT.indexOf('ALTERNATIVE APPROACHES');

    const techSpecsHighlights = result.spans.filter((span) => {
      return span.start >= techSpecsStart && span.start < techSpecsEnd;
    });

    expect(techSpecsHighlights.length).toBeGreaterThan(0);

    // Log what was found in technical specs
    console.log('\n🔧 Technical Specs Highlights:');
    techSpecsHighlights.forEach((span, idx) => {
      console.log(`  ${idx + 1}. "${span.text}" (${span.role}, confidence: ${span.confidence})`);
    });
  });

  it('should find highlights in ALTERNATIVE APPROACHES section', () => {
    const altStart = MULTI_SECTION_PROMPT.indexOf('ALTERNATIVE APPROACHES');

    const altHighlights = result.spans.filter((span) => {
      return span.start >= altStart;
    });

    expect(altHighlights.length).toBeGreaterThan(0);

    // Log what was found in alternatives
    console.log('\n🎨 Alternative Approaches Highlights:');
    altHighlights.forEach((span, idx) => {
      console.log(`  ${idx + 1}. "${span.text}" (${span.role}, confidence: ${span.confidence})`);
    });
  });

  it('should highlight expected camera-related terms across all sections', () => {
    const cameraTerms = result.spans.filter((span) =>
      span.role === 'CameraMove' || span.role === 'Framing'
    );

    expect(cameraTerms.length).toBeGreaterThan(0);

    console.log('\n📹 Camera-related Highlights:');
    cameraTerms.forEach((span) => {
      const section = getSection(span.start, MULTI_SECTION_PROMPT);
      console.log(`  - "${span.text}" (${span.role}) in ${section}`);
    });

    // We expect camera terms in multiple sections
    const sections = new Set(
      cameraTerms.map(span => getSection(span.start, MULTI_SECTION_PROMPT))
    );

    expect(sections.size).toBeGreaterThan(1);
  });

  it('should highlight expected lighting terms across all sections', () => {
    const lightingTerms = result.spans.filter((span) =>
      span.role === 'Lighting' || span.role === 'TimeOfDay'
    );

    expect(lightingTerms.length).toBeGreaterThan(0);

    console.log('\n💡 Lighting-related Highlights:');
    lightingTerms.forEach((span) => {
      const section = getSection(span.start, MULTI_SECTION_PROMPT);
      console.log(`  - "${span.text}" (${span.role}) in ${section}`);
    });
  });

  it('should highlight technical specs like frame rate and aspect ratio', () => {
    const technicalTerms = result.spans.filter((span) =>
      span.role === 'Technical'
    );

    expect(technicalTerms.length).toBeGreaterThan(0);

    console.log('\n⚙️ Technical Highlights:');
    technicalTerms.forEach((span) => {
      console.log(`  - "${span.text}" (confidence: ${span.confidence})`);
    });

    // Should find at least some of: 24fps, 16:9, 4-8s, 35mm film
    const technicalTexts = technicalTerms.map(s => s.text.toLowerCase());
    const foundExpected = technicalTexts.some(text =>
      text.includes('24fps') ||
      text.includes('16:9') ||
      text.includes('35mm') ||
      text.includes('4-8s')
    );

    expect(foundExpected).toBe(true);
  });

  it('should find wardrobe and appearance terms', () => {
    const appearanceTerms = result.spans.filter((span) =>
      span.role === 'Wardrobe' || span.role === 'Appearance'
    );

    if (appearanceTerms.length > 0) {
      console.log('\n👔 Wardrobe/Appearance Highlights:');
      appearanceTerms.forEach((span) => {
        const section = getSection(span.start, MULTI_SECTION_PROMPT);
        console.log(`  - "${span.text}" (${span.role}) in ${section}`);
      });
    }
  });

  it('should find environment and color terms', () => {
    const envColorTerms = result.spans.filter((span) =>
      span.role === 'Environment' || span.role === 'Color'
    );

    if (envColorTerms.length > 0) {
      console.log('\n🌍 Environment/Color Highlights:');
      envColorTerms.forEach((span) => {
        const section = getSection(span.start, MULTI_SECTION_PROMPT);
        console.log(`  - "${span.text}" (${span.role}) in ${section}`);
      });
    }
  });

  it('should provide a complete summary of what was highlighted', () => {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 COMPLETE HIGHLIGHTING SUMMARY');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Total spans found: ${result.spans.length}`);
    console.log(`Meta notes: ${result.meta?.notes || 'none'}`);

    // Count by role
    const roleCount = {};
    result.spans.forEach((span) => {
      roleCount[span.role] = (roleCount[span.role] || 0) + 1;
    });

    console.log('\nHighlights by Role:');
    Object.entries(roleCount)
      .sort(([, a], [, b]) => b - a)
      .forEach(([role, count]) => {
        console.log(`  ${role}: ${count}`);
      });

    // Count by section
    const sectionCount = {
      'Main Paragraph': 0,
      'Technical Specs': 0,
      'Alternative Approaches': 0,
    };

    result.spans.forEach((span) => {
      const section = getSection(span.start, MULTI_SECTION_PROMPT);
      sectionCount[section]++;
    });

    console.log('\nHighlights by Section:');
    Object.entries(sectionCount).forEach(([section, count]) => {
      console.log(`  ${section}: ${count}`);
    });

    console.log('\nAll Highlighted Text:');
    result.spans.forEach((span, idx) => {
      const section = getSection(span.start, MULTI_SECTION_PROMPT);
      console.log(`  ${idx + 1}. [${section}] "${span.text}" (${span.role})`);
    });

    console.log('═══════════════════════════════════════════════════\n');

    // Assert that we found highlights in all three sections
    expect(sectionCount['Main Paragraph']).toBeGreaterThan(0);
    expect(sectionCount['Technical Specs']).toBeGreaterThan(0);
    expect(sectionCount['Alternative Approaches']).toBeGreaterThan(0);
  });
});

/**
 * Helper to determine which section a span belongs to
 */
function getSection(offset, text) {
  const techSpecsStart = text.indexOf('TECHNICAL SPECS');
  const altStart = text.indexOf('ALTERNATIVE APPROACHES');

  if (offset < techSpecsStart) {
    return 'Main Paragraph';
  } else if (offset < altStart) {
    return 'Technical Specs';
  } else {
    return 'Alternative Approaches';
  }
}
