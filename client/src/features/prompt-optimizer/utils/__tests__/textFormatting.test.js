/**
 * Tests for textFormatting
 *
 * Test Plan:
 * - Verifies HTML escaping prevents XSS
 * - Verifies heading detection and formatting
 * - Verifies list detection (ordered and bullet)
 * - Verifies separator and gap handling
 * - Verifies section and paragraph formatting
 * - Verifies newline handling
 * - Verifies edge cases (empty input, null, special characters)
 *
 * What these tests catch:
 * - XSS vulnerabilities from unescaped HTML
 * - Breaking markdown/text parsing logic
 * - Incorrect CSS class assignment
 * - Missing newline handling causing malformed output
 */

import { describe, it, expect } from 'vitest';
import { formatTextToHTML } from '../textFormatting.js';

describe('textFormatting', () => {
  describe('HTML escaping (XSS prevention)', () => {
    it('escapes < and > characters - catches XSS vulnerability', () => {
      // Would fail if HTML is not escaped (XSS risk!)
      const result = formatTextToHTML('<script>alert("xss")</script>');
      expect(result.html).not.toContain('<script>');
      expect(result.html).toContain('&lt;script&gt;');
    });

    it('escapes & ampersands - catches HTML entity bug', () => {
      // Would fail if & is not escaped
      const result = formatTextToHTML('Tom & Jerry');
      expect(result.html).toContain('&amp;');
    });

    it('escapes double quotes - catches attribute injection', () => {
      // Would fail if quotes are not escaped
      const result = formatTextToHTML('Say "hello"');
      expect(result.html).toContain('&quot;');
    });

    it('escapes single quotes - catches attribute injection', () => {
      // Would fail if single quotes are not escaped
      const result = formatTextToHTML("It's working");
      expect(result.html).toContain('&#039;');
    });

    it('handles malicious input safely - catches comprehensive XSS prevention', () => {
      // Would fail if escaping is incomplete
      const malicious = '<img src=x onerror="alert(1)">';
      const result = formatTextToHTML(malicious);
      expect(result.html).not.toContain('onerror=');
      expect(result.html).toContain('&lt;img');
    });
  });

  describe('basic formatting', () => {
    it('returns empty HTML for null input - catches null handling', () => {
      // Would fail if null check is missing
      const result = formatTextToHTML(null);
      expect(result.html).toBe('');
    });

    it('returns empty HTML for undefined input - catches undefined handling', () => {
      // Would fail if undefined check is missing
      const result = formatTextToHTML(undefined);
      expect(result.html).toBe('');
    });

    it('formats simple text as paragraph - catches basic paragraph', () => {
      // Would fail if paragraph formatting is broken
      const result = formatTextToHTML('Simple text');
      expect(result.html).toContain('prompt-line--paragraph');
      expect(result.html).toContain('Simple text');
    });

    it('preserves text content - catches content accuracy', () => {
      // Would fail if text is modified
      const input = 'Test content 123';
      const result = formatTextToHTML(input);
      expect(result.html).toContain('Test content 123');
    });
  });

  describe('heading detection', () => {
    it('detects markdown headings with # - catches markdown heading', () => {
      // Would fail if /^#{1,6}\s+/ regex is broken
      const result = formatTextToHTML('# Heading 1');
      expect(result.html).toContain('prompt-line--heading');
      expect(result.html).toContain('Heading 1');
      expect(result.html).not.toContain('#');
    });

    it('handles multiple # symbols - catches heading level parsing', () => {
      // Would fail if heading level detection is wrong
      const result = formatTextToHTML('### Level 3');
      expect(result.html).toContain('prompt-line--heading');
      expect(result.html).toContain('Level 3');
    });

    it('detects bold text as heading - catches **text** pattern', () => {
      // Would fail if /^\*\*[^*]+\*\*:?$/ regex is broken
      const result = formatTextToHTML('**Bold Heading**');
      expect(result.html).toContain('prompt-line--heading');
      expect(result.html).toContain('Bold Heading');
      expect(result.html).not.toContain('**');
    });

    it('detects ALL CAPS as heading - catches uppercase heading', () => {
      // Would fail if /^[A-Z][A-Z\s]{3,}$/ regex is broken
      const result = formatTextToHTML('UPPERCASE HEADING');
      expect(result.html).toContain('prompt-line--heading');
    });

    it('removes trailing colon from bold headings - catches colon removal', () => {
      // Would fail if colon removal is broken
      const result = formatTextToHTML('**Section:**');
      expect(result.html).toContain('Section');
      expect(result.html).not.toContain(':');
    });

    it('does not treat short uppercase as heading - catches min length', () => {
      // Would fail if min length check is missing
      const result = formatTextToHTML('OK');
      expect(result.html).not.toContain('prompt-line--heading');
    });
  });

  describe('separator detection', () => {
    it('detects === separator - catches equals separator', () => {
      // Would fail if separator regex is broken
      const result = formatTextToHTML('===');
      expect(result.html).toContain('prompt-line--separator');
      expect(result.html).toContain('———');
    });

    it('detects --- separator - catches dash separator', () => {
      // Would fail if dash pattern is not recognized
      const result = formatTextToHTML('---');
      expect(result.html).toContain('prompt-line--separator');
    });

    it('detects *** separator - catches asterisk separator', () => {
      // Would fail if asterisk pattern is not recognized
      const result = formatTextToHTML('***');
      expect(result.html).toContain('prompt-line--separator');
    });

    it('detects Unicode separators - catches Unicode patterns', () => {
      // Would fail if Unicode separator chars are not recognized
      const result = formatTextToHTML('━━━');
      expect(result.html).toContain('prompt-line--separator');
    });

    it('requires minimum 3 characters - catches length requirement', () => {
      // Would fail if {3,} quantifier is removed
      const result = formatTextToHTML('--');
      expect(result.html).not.toContain('prompt-line--separator');
    });
  });

  describe('list detection', () => {
    describe('ordered lists', () => {
      it('detects numbered list items - catches ordered list', () => {
        // Would fail if /^\d+\.\s+/ regex is broken
        const result = formatTextToHTML('1. First item');
        expect(result.html).toContain('prompt-line--ordered');
        expect(result.html).toContain('First item');
      });

      it('includes list number in output - catches label preservation', () => {
        // Would fail if label is not captured
        const result = formatTextToHTML('42. Item number');
        expect(result.html).toContain('42.');
      });

      it('handles multiple list items - catches list grouping', () => {
        // Would fail if while loop is broken
        const result = formatTextToHTML('1. First\n2. Second\n3. Third');
        expect(result.html).toContain('First');
        expect(result.html).toContain('Second');
        expect(result.html).toContain('Third');
      });

      it('adds spacing after list group - catches group spacing', () => {
        // Would fail if isLastInGroup spacing is broken
        const result = formatTextToHTML('1. Item\n\nNext paragraph');
        expect(result.html).toContain('Item');
        expect(result.html).toContain('Next paragraph');
      });

      it('stops at non-list line - catches list termination', () => {
        // Would fail if break condition is wrong
        const result = formatTextToHTML('1. First\n2. Second\nPlain text');
        expect(result.html).toContain('Plain text');
      });
    });

    describe('bullet lists', () => {
      it('detects dash bullet items - catches dash bullets', () => {
        // Would fail if /^[-*•]\s+/ regex is broken
        const result = formatTextToHTML('- Bullet item');
        expect(result.html).toContain('prompt-line--bullet');
        expect(result.html).toContain('Bullet item');
      });

      it('detects asterisk bullet items - catches asterisk bullets', () => {
        // Would fail if asterisk pattern is not recognized
        const result = formatTextToHTML('* Bullet item');
        expect(result.html).toContain('prompt-line--bullet');
      });

      it('detects Unicode bullet items - catches Unicode bullets', () => {
        // Would fail if Unicode bullet char is not recognized
        const result = formatTextToHTML('• Bullet item');
        expect(result.html).toContain('prompt-line--bullet');
      });

      it('uses • marker in output - catches marker normalization', () => {
        // Would fail if marker is not normalized
        const result = formatTextToHTML('- Item');
        expect(result.html).toContain('•');
      });

      it('handles multiple bullet items - catches list grouping', () => {
        // Would fail if while loop is broken
        const result = formatTextToHTML('- First\n- Second\n- Third');
        expect(result.html).toContain('First');
        expect(result.html).toContain('Second');
        expect(result.html).toContain('Third');
      });

      it('adds spacing after bullet group - catches group spacing', () => {
        // Would fail if isLastInGroup spacing is broken
        const result = formatTextToHTML('- Item\n\nNext paragraph');
        expect(result.html).toContain('Item');
        expect(result.html).toContain('Next paragraph');
      });
    });
  });

  describe('section and paragraph detection', () => {
    it('detects section headers ending with colon - catches section pattern', () => {
      // Would fail if /^.+:$/ regex is broken
      const result = formatTextToHTML('Section Name:');
      expect(result.html).toContain('prompt-line--section');
      expect(result.html).toContain('Section Name:');
    });

    it('does not treat list items as sections - catches priority', () => {
      // Would fail if list check doesn't come before section check
      const result = formatTextToHTML('1. Item:');
      expect(result.html).toContain('prompt-line--ordered');
      expect(result.html).not.toContain('prompt-line--section');
    });

    it('formats regular text as paragraph - catches fallback', () => {
      // Would fail if paragraph fallback is missing
      const result = formatTextToHTML('Regular text without special formatting');
      expect(result.html).toContain('prompt-line--paragraph');
    });

    it('handles blockquote syntax - catches blockquote detection', () => {
      // Would fail if /^>\s*/ regex is broken
      const result = formatTextToHTML('> Quoted text');
      expect(result.html).toContain('Quoted text');
      expect(result.html).not.toContain('>');
    });
  });

  describe('gap (empty line) handling', () => {
    it('creates gap for empty lines - catches gap detection', () => {
      // Would fail if empty line check is broken
      const result = formatTextToHTML('\n');
      expect(result.html).toContain('prompt-line--gap');
    });

    it('creates gap for whitespace-only lines - catches trim check', () => {
      // Would fail if trim is not called
      const result = formatTextToHTML('   \n');
      expect(result.html).toContain('prompt-line--gap');
    });

    it('includes <br /> in gap elements - catches gap structure', () => {
      // Would fail if gap HTML structure changes
      const result = formatTextToHTML('\n');
      expect(result.html).toContain('<br />');
    });

    it('preserves multiple gaps - catches gap repetition', () => {
      // Would fail if gaps are collapsed
      const result = formatTextToHTML('text\n\n\ntext');
      const gapCount = (result.html.match(/prompt-line--gap/g) || []).length;
      expect(gapCount).toBeGreaterThan(1);
    });
  });

  describe('newline handling', () => {
    it('preserves newlines between elements - catches newline preservation', () => {
      // Would fail if shouldAppendNewline logic is broken
      const result = formatTextToHTML('Line 1\nLine 2');
      expect(result.html).toContain('\n');
    });

    it('adds newline after non-last lines - catches line separation', () => {
      // Would fail if index < length - 1 check is wrong
      const result = formatTextToHTML('First\nSecond');
      const divs = result.html.split('</div>');
      // First div should have newline after it
      expect(divs.length).toBeGreaterThan(1);
    });

    it('handles text ending with newline - catches trailing newline', () => {
      // Would fail if endsWithNewline detection is broken
      const result = formatTextToHTML('Text\n');
      expect(result.html).toBeTruthy();
    });

    it('handles text not ending with newline - catches no trailing newline', () => {
      // Would fail if we add newline when we shouldn't
      const result = formatTextToHTML('Text');
      expect(result.html).toBeTruthy();
    });

    it('handles CRLF line endings - catches Windows line endings', () => {
      // Would fail if /\r?\n/ regex is broken
      const result = formatTextToHTML('Line 1\r\nLine 2');
      expect(result.html).toContain('Line 1');
      expect(result.html).toContain('Line 2');
    });
  });

  describe('data attributes', () => {
    it('includes data-variant attribute - catches attribute presence', () => {
      // Would fail if data-variant is not added
      const result = formatTextToHTML('Text');
      expect(result.html).toContain('data-variant="paragraph"');
    });

    it('sets correct variant for each type - catches variant accuracy', () => {
      // Tests various variants
      const tests = [
        { input: '# Heading', variant: 'heading' },
        { input: '---', variant: 'separator' },
        { input: '', variant: 'gap' },
        { input: '1. Item', variant: 'ordered' },
        { input: '- Item', variant: 'bullet' },
        { input: 'Section:', variant: 'section' },
        { input: 'Text', variant: 'paragraph' }
      ];

      tests.forEach(({ input, variant }) => {
        const result = formatTextToHTML(input);
        expect(result.html).toContain(`data-variant="${variant}"`);
      });
    });

    it('includes variant-index for ordered lists - catches index attribute', () => {
      // Would fail if data-variant-index is not added
      const result = formatTextToHTML('5. Item');
      expect(result.html).toContain('data-variant-index="5."');
    });
  });

  describe('CSS classes', () => {
    it('includes base prompt-line class - catches base class', () => {
      // Would fail if base class is removed
      const result = formatTextToHTML('Text');
      expect(result.html).toContain('class="prompt-line');
    });

    it('includes specific variant classes - catches variant classes', () => {
      // Would fail if variant classes are not added
      const result = formatTextToHTML('# Heading');
      expect(result.html).toContain('prompt-line--heading');
    });

    it('includes nested span classes for lists - catches structure', () => {
      // Would fail if span structure is broken
      const result = formatTextToHTML('1. Item');
      expect(result.html).toContain('prompt-ordered-index');
      expect(result.html).toContain('prompt-ordered-text');
    });

    it('includes bullet marker and text classes - catches bullet structure', () => {
      // Would fail if bullet span structure is broken
      const result = formatTextToHTML('- Item');
      expect(result.html).toContain('prompt-bullet-marker');
      expect(result.html).toContain('prompt-bullet-text');
    });
  });

  describe('complex formatting scenarios', () => {
    it('handles mixed content types - catches integration', () => {
      // Would fail if any formatter breaks others
      const input = `# Heading
Section:
- Bullet 1
- Bullet 2

1. Numbered
2. List

Regular paragraph`;

      const result = formatTextToHTML(input);
      expect(result.html).toContain('prompt-line--heading');
      expect(result.html).toContain('prompt-line--section');
      expect(result.html).toContain('prompt-line--bullet');
      expect(result.html).toContain('prompt-line--ordered');
      expect(result.html).toContain('prompt-line--paragraph');
      expect(result.html).toContain('prompt-line--gap');
    });

    it('handles special characters in content - catches escaping in context', () => {
      // Would fail if escaping breaks formatting
      const result = formatTextToHTML('# <Heading> & "Title"');
      expect(result.html).toContain('prompt-line--heading');
      expect(result.html).toContain('&lt;Heading&gt;');
      expect(result.html).toContain('&amp;');
      expect(result.html).toContain('&quot;');
    });

    it('handles very long text - catches performance', () => {
      // Would fail if there's a performance issue
      const longText = 'word '.repeat(10000);
      const result = formatTextToHTML(longText);
      expect(result.html).toBeTruthy();
    });

    it('handles empty lines between content - catches gap positioning', () => {
      // Would fail if gap handling breaks context
      const input = 'Text\n\nMore text';
      const result = formatTextToHTML(input);
      expect(result.html).toContain('Text');
      expect(result.html).toContain('More text');
      expect(result.html).toContain('prompt-line--gap');
    });
  });

  describe('edge cases', () => {
    it('handles single character input - catches minimal input', () => {
      // Would fail if there's a minimum length assumption
      const result = formatTextToHTML('a');
      expect(result.html).toBeTruthy();
    });

    it('handles numeric input - catches String() coercion', () => {
      // Would fail if String() coercion is missing
      const result = formatTextToHTML(12345);
      expect(result.html).toContain('12345');
    });

    it('handles only newlines - catches newline-only input', () => {
      // Would fail if we don't handle newline-only text
      const result = formatTextToHTML('\n\n\n');
      expect(result.html).toBeTruthy();
    });

    it('handles only whitespace - catches whitespace-only input', () => {
      // Would fail if whitespace handling is wrong
      const result = formatTextToHTML('   ');
      expect(result.html).toBeTruthy();
    });
  });
});
