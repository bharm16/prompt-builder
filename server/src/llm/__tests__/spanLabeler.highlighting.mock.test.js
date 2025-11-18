import { describe, it, expect } from 'vitest';
import { labelSpans } from '../span-labeling/SpanLabelingService.js';

/**
 * Mock test to demonstrate what gets highlighted
 * This simulates the expected behavior after the system prompt fix
 */
describe('Span Labeling - Highlighting Demo (Mock)', () => {
  const MULTI_SECTION_PROMPT = `Wide shot of George Washington draped in a blue Revolutionary War uniform, standing amidst a leaf-strewn battlefield under overcast skies. He gestures emphatically to soldiers, rallying their spirits as fallen leaves swirl around him in the brisk wind. The camera slowly pans in from a distance, capturing the tension and urgency of the moment. Soft, diffused light filters through the clouds, creating a somber yet heroic atmosphere. The style is reminiscent of classic historical dramas, shot on 35mm film to evoke a timeless quality, with a shallow depth of field that softly blurs the background soldiers, emphasizing Washington's commanding presence.

TECHNICAL SPECS
- **Duration:** 4-8s
- **Aspect Ratio:** 16:9
- **Frame Rate:** 24fps
- **Audio:** Mute

ALTERNATIVE APPROACHES
- **Variation 1:** Close-up of George Washington's determined expression as he gestures emphatically to soldiers, framed by the leaf-strewn battlefield under overcast skies. The camera holds steady, capturing the intensity of his call to action.
- **Variation 2:** Medium shot of George Washington draped in a blue Revolutionary War uniform, gesturing emphatically to soldiers as bright, high-key lighting breaks through the clouds, illuminating the battlefield and creating a hopeful contrast to the somber surroundings.`;

  it('demonstrates expected highlighting across all sections', async () => {
    // Mock LLM response that shows highlighting in all three sections
    const mockCallFn = async () => {
      return JSON.stringify({
        spans: [
          // Main paragraph highlights
          { text: 'Wide shot', start: 0, end: 9, role: 'Framing', confidence: 0.95 },
          { text: 'blue Revolutionary War uniform', start: 40, end: 70, role: 'Wardrobe', confidence: 0.9 },
          { text: 'leaf-strewn battlefield', start: 94, end: 117, role: 'Environment', confidence: 0.85 },
          { text: 'overcast skies', start: 124, end: 138, role: 'Lighting', confidence: 0.88 },
          { text: 'camera slowly pans in', start: 241, end: 262, role: 'Camera', confidence: 0.92 },
          { text: 'Soft, diffused light', start: 324, end: 344, role: 'Lighting', confidence: 0.9 },
          { text: 'shot on 35mm film', start: 464, end: 481, role: 'Style', confidence: 0.95 },
          { text: 'shallow depth of field', start: 516, end: 538, role: 'Specs', confidence: 0.93 },

          // Technical Specs section highlights
          { text: '4-8s', start: 633, end: 637, role: 'Specs', confidence: 0.98 },
          { text: '16:9', start: 659, end: 663, role: 'Specs', confidence: 0.98 },
          { text: '24fps', start: 682, end: 687, role: 'Specs', confidence: 0.98 },

          // Alternative Approaches section highlights
          { text: 'Close-up', start: 739, end: 747, role: 'Framing', confidence: 0.95 },
          { text: 'leaf-strewn battlefield', start: 831, end: 854, role: 'Environment', confidence: 0.85 },
          { text: 'overcast skies', start: 861, end: 875, role: 'Lighting', confidence: 0.88 },
          { text: 'camera holds steady', start: 881, end: 900, role: 'Camera', confidence: 0.9 },
          { text: 'Medium shot', start: 961, end: 972, role: 'Framing', confidence: 0.95 },
          { text: 'blue Revolutionary War uniform', start: 1005, end: 1035, role: 'Wardrobe', confidence: 0.9 },
          { text: 'bright, high-key lighting', start: 1083, end: 1108, role: 'Lighting', confidence: 0.92 },
        ],
        meta: {
          version: 'v1',
          notes: 'Successfully analyzed all sections including main paragraph, technical specs, and alternative approaches'
        }
      });
    };

    const result = await labelSpans(
      {
        text: MULTI_SECTION_PROMPT,
        maxSpans: 60,
        minConfidence: 0.5,
      },
      { callFn: mockCallFn }
    );

    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 WHAT GETS HIGHLIGHTED - DEMO');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Total spans found: ${result.spans.length}\n`);

    // Group by section
    const sections = {
      'Main Paragraph': [],
      'Technical Specs': [],
      'Alternative Approaches': []
    };

    result.spans.forEach((span) => {
      const section = getSection(span.start, MULTI_SECTION_PROMPT);
      sections[section].push(span);
    });

    Object.entries(sections).forEach(([sectionName, spans]) => {
      console.log(`\n${getSectionEmoji(sectionName)} ${sectionName} (${spans.length} highlights):`);
      console.log('─'.repeat(60));
      spans.forEach((span, idx) => {
        console.log(`  ${idx + 1}. "${span.text}"`);
        console.log(`     Role: ${span.role} | Confidence: ${(span.confidence * 100).toFixed(0)}%`);
      });
    });

    // Group by role
    const roleGroups = {};
    result.spans.forEach((span) => {
      if (!roleGroups[span.role]) {
        roleGroups[span.role] = [];
      }
      roleGroups[span.role].push(span);
    });

    console.log('\n\n📋 By Category:');
    console.log('─'.repeat(60));
    Object.entries(roleGroups)
      .sort(([, a], [, b]) => b.length - a.length)
      .forEach(([role, spans]) => {
        console.log(`\n  ${role} (${spans.length}):`);
        spans.forEach((span) => {
          const section = getSection(span.start, MULTI_SECTION_PROMPT);
          console.log(`    • "${span.text}" [${section}]`);
        });
      });

    console.log('\n═══════════════════════════════════════════════════\n');

    // Assertions
    expect(result.spans.length).toBeGreaterThan(0);
    expect(sections['Main Paragraph'].length).toBeGreaterThan(0);
    expect(sections['Technical Specs'].length).toBeGreaterThan(0);
    expect(sections['Alternative Approaches'].length).toBeGreaterThan(0);

    // Verify we found technical specs
    const technicalSpans = result.spans.filter(s => s.role === 'Specs' || s.role === 'Style');
    expect(technicalSpans.length).toBeGreaterThan(0);

    // Verify we found camera and lighting in multiple sections
    const cameraSpans = result.spans.filter(s => s.role === 'Camera' || s.role === 'Framing');
    const cameraSections = new Set(cameraSpans.map(s => getSection(s.start, MULTI_SECTION_PROMPT)));
    expect(cameraSections.size).toBeGreaterThan(1);
  });
});

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

function getSectionEmoji(section) {
  const emojis = {
    'Main Paragraph': '📝',
    'Technical Specs': '⚙️',
    'Alternative Approaches': '🎨'
  };
  return emojis[section] || '📄';
}
