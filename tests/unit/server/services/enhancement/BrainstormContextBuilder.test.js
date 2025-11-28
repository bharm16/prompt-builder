import { describe, it, expect, beforeEach } from 'vitest';
import { BrainstormContextBuilder } from '../../../../../server/src/services/enhancement/services/BrainstormContextBuilder.js';

describe('BrainstormContextBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new BrainstormContextBuilder();
  });

  describe('buildBrainstormSignature', () => {
    it('should return null for null input', () => {
      expect(builder.buildBrainstormSignature(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(builder.buildBrainstormSignature(undefined)).toBeNull();
    });

    it('should return null for non-object input', () => {
      expect(builder.buildBrainstormSignature('string')).toBeNull();
      expect(builder.buildBrainstormSignature(123)).toBeNull();
      expect(builder.buildBrainstormSignature(true)).toBeNull();
    });

    it('should return null for empty object', () => {
      expect(builder.buildBrainstormSignature({})).toBeNull();
    });

    it('should build signature with normalized elements', () => {
      const input = {
        elements: {
          subject: '  a lone astronaut  ',
          setting: 'Mars surface',
          mood: '',
          style: '   ',
        },
      };

      const result = builder.buildBrainstormSignature(input);

      expect(result).toEqual({
        elements: {
          subject: 'a lone astronaut',
          setting: 'Mars surface',
        },
      });
    });

    it('should filter out empty and whitespace-only elements', () => {
      const input = {
        elements: {
          validKey: 'valid value',
          emptyKey: '',
          whitespaceKey: '   ',
          nullKey: null,
        },
      };

      const result = builder.buildBrainstormSignature(input);

      expect(result).toEqual({
        elements: {
          validKey: 'valid value',
        },
      });
    });

    it('should normalize metadata format field', () => {
      const input = {
        elements: {},
        metadata: {
          format: '  cinematic  ',
        },
      };

      const result = builder.buildBrainstormSignature(input);

      expect(result).toEqual({
        metadata: {
          format: 'cinematic',
        },
      });
    });

    it('should include validation score when it is a finite number', () => {
      const input = {
        elements: {},
        metadata: {
          validationScore: 0.85,
        },
      };

      const result = builder.buildBrainstormSignature(input);

      expect(result).toEqual({
        metadata: {
          validationScore: 0.85,
        },
      });
    });

    it('should filter out invalid validation scores', () => {
      const inputs = [
        { metadata: { validationScore: Infinity } },
        { metadata: { validationScore: -Infinity } },
        { metadata: { validationScore: NaN } },
        { metadata: { validationScore: 'not a number' } },
      ];

      inputs.forEach((input) => {
        const result = builder.buildBrainstormSignature(input);
        expect(result).toBeNull();
      });
    });

    it('should normalize technical params strings', () => {
      const input = {
        elements: {},
        metadata: {
          technicalParams: {
            fps: '  24  ',
            resolution: '4k',
            emptyParam: '',
            whitespaceParam: '   ',
          },
        },
      };

      const result = builder.buildBrainstormSignature(input);

      expect(result).toEqual({
        metadata: {
          technicalParams: {
            fps: '24',
            resolution: '4k',
          },
        },
      });
    });

    it('should include non-empty arrays in technical params', () => {
      const input = {
        elements: {},
        metadata: {
          technicalParams: {
            tags: ['cinematic', 'dramatic'],
            emptyArray: [],
          },
        },
      };

      const result = builder.buildBrainstormSignature(input);

      expect(result).toEqual({
        metadata: {
          technicalParams: {
            tags: ['cinematic', 'dramatic'],
          },
        },
      });
    });

    it('should include non-empty objects in technical params', () => {
      const input = {
        elements: {},
        metadata: {
          technicalParams: {
            settings: { brightness: 0.5, contrast: 0.7 },
            emptyObject: {},
          },
        },
      };

      const result = builder.buildBrainstormSignature(input);

      expect(result).toEqual({
        metadata: {
          technicalParams: {
            settings: { brightness: 0.5, contrast: 0.7 },
          },
        },
      });
    });

    it('should include primitive values in technical params', () => {
      const input = {
        elements: {},
        metadata: {
          technicalParams: {
            enabled: true,
            count: 42,
            ratio: 0.0,
          },
        },
      };

      const result = builder.buildBrainstormSignature(input);

      expect(result).toEqual({
        metadata: {
          technicalParams: {
            enabled: true,
            count: 42,
            ratio: 0.0,
          },
        },
      });
    });

    it('should filter out null and undefined technical params', () => {
      const input = {
        elements: {},
        metadata: {
          technicalParams: {
            validParam: 'value',
            nullParam: null,
            undefinedParam: undefined,
          },
        },
      };

      const result = builder.buildBrainstormSignature(input);

      expect(result).toEqual({
        metadata: {
          technicalParams: {
            validParam: 'value',
          },
        },
      });
    });

    it('should build complete signature with all fields', () => {
      const input = {
        elements: {
          subject: 'astronaut',
          setting: 'Mars',
        },
        metadata: {
          format: 'cinematic',
          validationScore: 0.9,
          technicalParams: {
            fps: '24',
            resolution: '4k',
          },
        },
      };

      const result = builder.buildBrainstormSignature(input);

      expect(result).toEqual({
        elements: {
          subject: 'astronaut',
          setting: 'Mars',
        },
        metadata: {
          format: 'cinematic',
          validationScore: 0.9,
          technicalParams: {
            fps: '24',
            resolution: '4k',
          },
        },
      });
    });

    it('should handle missing elements or metadata gracefully', () => {
      const input1 = {
        elements: { subject: 'test' },
      };

      const input2 = {
        metadata: { format: 'test' },
      };

      expect(builder.buildBrainstormSignature(input1)).toEqual({
        elements: { subject: 'test' },
      });

      expect(builder.buildBrainstormSignature(input2)).toEqual({
        metadata: { format: 'test' },
      });
    });
  });

  describe('buildBrainstormContextSection', () => {
    it('should return empty string for null input', () => {
      expect(builder.buildBrainstormContextSection(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(builder.buildBrainstormContextSection(undefined)).toBe('');
    });

    it('should return empty string for non-object input', () => {
      expect(builder.buildBrainstormContextSection('string')).toBe('');
      expect(builder.buildBrainstormContextSection(123)).toBe('');
    });

    it('should return empty string when all fields are empty', () => {
      const input = {
        elements: {},
        metadata: {},
      };

      expect(builder.buildBrainstormContextSection(input)).toBe('');
    });

    it('should build section with only elements', () => {
      const input = {
        elements: {
          subject: 'a lone astronaut',
          setting: 'Mars surface',
        },
      };

      const result = builder.buildBrainstormContextSection(input);

      expect(result).toContain('**Creative Brainstorm Structured Context:**');
      expect(result).toContain('These are user-confirmed anchors');
      expect(result).toContain('- Subject: a lone astronaut');
      expect(result).toContain('- Setting: Mars surface');
      expect(result).toContain('Ensure every rewrite strengthens these anchors');
    });

    it('should format camelCase keys to human-readable format', () => {
      const input = {
        elements: {
          mainSubject: 'astronaut',
          primarySetting: 'Mars',
        },
      };

      const result = builder.buildBrainstormContextSection(input);

      expect(result).toContain('- Main Subject: astronaut');
      expect(result).toContain('- Primary Setting: Mars');
    });

    it('should include format preference in metadata section', () => {
      const input = {
        elements: { subject: 'astronaut' },
        metadata: {
          format: 'cinematic',
        },
      };

      const result = builder.buildBrainstormContextSection(input);

      expect(result).toContain('**Metadata & Technical Guidance:**');
      expect(result).toContain('- Format Preference: cinematic');
    });

    it('should include validation score in metadata section', () => {
      const input = {
        elements: { subject: 'astronaut' },
        metadata: {
          validationScore: 0.85,
        },
      };

      const result = builder.buildBrainstormContextSection(input);

      expect(result).toContain('**Metadata & Technical Guidance:**');
      expect(result).toContain('- Validation Score: 0.85');
    });

    it('should include technical parameters in metadata section', () => {
      const input = {
        elements: { subject: 'astronaut' },
        metadata: {
          technicalParams: {
            fps: '24',
            resolution: '4k',
          },
        },
      };

      const result = builder.buildBrainstormContextSection(input);

      expect(result).toContain('**Metadata & Technical Guidance:**');
      expect(result).toContain('- Fps: 24');
      expect(result).toContain('- Resolution: 4k');
    });

    it('should filter out empty string elements', () => {
      const input = {
        elements: {
          subject: 'astronaut',
          setting: '',
          mood: '   ',
        },
      };

      const result = builder.buildBrainstormContextSection(input);

      expect(result).toContain('- Subject: astronaut');
      expect(result).not.toContain('Setting');
      expect(result).not.toContain('Mood');
    });

    it('should filter out null/undefined/empty technical params', () => {
      const input = {
        elements: { subject: 'astronaut' },
        metadata: {
          technicalParams: {
            validParam: 'value',
            nullParam: null,
            undefinedParam: undefined,
            emptyString: '',
            emptyArray: [],
            emptyObject: {},
          },
        },
      };

      const result = builder.buildBrainstormContextSection(input);

      expect(result).toContain('- Valid Param: value');
      expect(result).not.toContain('Null Param');
      expect(result).not.toContain('Empty String');
    });

    it('should add category guidance when includeCategoryGuidance is true', () => {
      const input = {
        elements: { subject: 'astronaut' },
      };

      const result = builder.buildBrainstormContextSection(input, {
        includeCategoryGuidance: true,
      });

      expect(result).toContain('Use these anchors to inspire category labels');
      expect(result).not.toContain('Ensure every rewrite strengthens');
    });

    it('should add video-specific guidance when isVideoPrompt is true', () => {
      const input = {
        elements: { subject: 'astronaut' },
      };

      const result = builder.buildBrainstormContextSection(input, {
        isVideoPrompt: true,
      });

      expect(result).toContain('Translate these anchors into cinematic details');
    });

    it('should combine both category and video guidance when both flags are true', () => {
      const input = {
        elements: { subject: 'astronaut' },
      };

      const result = builder.buildBrainstormContextSection(input, {
        includeCategoryGuidance: true,
        isVideoPrompt: true,
      });

      expect(result).toContain('Use these anchors to inspire category labels');
      expect(result).toContain('Translate these anchors into cinematic details');
    });

    it('should handle array values in technical params', () => {
      const input = {
        elements: { subject: 'astronaut' },
        metadata: {
          technicalParams: {
            tags: ['sci-fi', 'dramatic', 'cinematic'],
          },
        },
      };

      const result = builder.buildBrainstormContextSection(input);

      expect(result).toContain('- Tags: sci-fi, dramatic, cinematic');
    });

    it('should handle object values in technical params', () => {
      const input = {
        elements: { subject: 'astronaut' },
        metadata: {
          technicalParams: {
            settings: { brightness: 0.5, contrast: 0.7 },
          },
        },
      };

      const result = builder.buildBrainstormContextSection(input);

      expect(result).toContain('- Settings: {"brightness":0.5,"contrast":0.7}');
    });

    it('should build complete section with all components', () => {
      const input = {
        elements: {
          subject: 'a lone astronaut',
          setting: 'Mars surface',
        },
        metadata: {
          format: 'cinematic',
          validationScore: 0.9,
          technicalParams: {
            fps: '24',
            resolution: '4k',
          },
        },
      };

      const result = builder.buildBrainstormContextSection(input, {
        includeCategoryGuidance: true,
        isVideoPrompt: true,
      });

      expect(result).toContain('**Creative Brainstorm Structured Context:**');
      expect(result).toContain('- Subject: a lone astronaut');
      expect(result).toContain('- Setting: Mars surface');
      expect(result).toContain('**Metadata & Technical Guidance:**');
      expect(result).toContain('- Format Preference: cinematic');
      expect(result).toContain('- Validation Score: 0.9');
      expect(result).toContain('- Fps: 24');
      expect(result).toContain('- Resolution: 4k');
      expect(result).toContain('Use these anchors to inspire category labels');
      expect(result).toContain('Translate these anchors into cinematic details');
    });

    it('should not include metadata section when only format is empty', () => {
      const input = {
        elements: { subject: 'astronaut' },
        metadata: {
          format: '   ',
        },
      };

      const result = builder.buildBrainstormContextSection(input);

      expect(result).not.toContain('**Metadata & Technical Guidance:**');
    });

    it('should handle validation score of zero', () => {
      const input = {
        elements: { subject: 'astronaut' },
        metadata: {
          validationScore: 0,
        },
      };

      const result = builder.buildBrainstormContextSection(input);

      expect(result).toContain('- Validation Score: 0');
    });
  });

  describe('formatBrainstormKey', () => {
    it('should return empty string for empty input', () => {
      expect(builder.formatBrainstormKey('')).toBe('');
    });

    it('should return empty string for null input', () => {
      expect(builder.formatBrainstormKey(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(builder.formatBrainstormKey(undefined)).toBe('');
    });

    it('should convert camelCase to Title Case', () => {
      expect(builder.formatBrainstormKey('mainSubject')).toBe('Main Subject');
      expect(builder.formatBrainstormKey('primarySetting')).toBe('Primary Setting');
      expect(builder.formatBrainstormKey('technicalParams')).toBe('Technical Params');
    });

    it('should convert snake_case to Title Case', () => {
      expect(builder.formatBrainstormKey('main_subject')).toBe('Main Subject');
      expect(builder.formatBrainstormKey('primary_setting')).toBe('Primary Setting');
    });

    it('should convert kebab-case to Title Case', () => {
      expect(builder.formatBrainstormKey('main-subject')).toBe('Main Subject');
      expect(builder.formatBrainstormKey('primary-setting')).toBe('Primary Setting');
    });

    it('should handle mixed separators', () => {
      expect(builder.formatBrainstormKey('main_subject-test')).toBe('Main Subject Test');
      expect(builder.formatBrainstormKey('primarySetting_value')).toBe('Primary Setting Value');
    });

    it('should capitalize first letter of each word', () => {
      expect(builder.formatBrainstormKey('subject')).toBe('Subject');
      expect(builder.formatBrainstormKey('main')).toBe('Main');
    });

    it('should handle multiple consecutive capital letters', () => {
      expect(builder.formatBrainstormKey('APIKey')).toBe('A P I Key');
      expect(builder.formatBrainstormKey('HTTPSConnection')).toBe('H T T P S Connection');
    });

    it('should normalize multiple spaces to single space', () => {
      expect(builder.formatBrainstormKey('main   subject')).toBe('Main Subject');
    });

    it('should handle numeric values by converting to string', () => {
      expect(builder.formatBrainstormKey(123)).toBe('123');
      // 0 is falsy, so returns empty string per implementation
      expect(builder.formatBrainstormKey(0)).toBe('');
    });

    it('should trim whitespace', () => {
      expect(builder.formatBrainstormKey('  mainSubject  ')).toBe('Main Subject');
    });

    it('should handle already formatted strings', () => {
      expect(builder.formatBrainstormKey('Main Subject')).toBe('Main Subject');
    });
  });

  describe('formatBrainstormValue', () => {
    it('should join arrays with commas', () => {
      expect(builder.formatBrainstormValue(['a', 'b', 'c'])).toBe('a, b, c');
      expect(builder.formatBrainstormValue([1, 2, 3])).toBe('1, 2, 3');
    });

    it('should handle empty arrays', () => {
      expect(builder.formatBrainstormValue([])).toBe('');
    });

    it('should stringify objects', () => {
      const obj = { key: 'value', nested: { inner: 'data' } };
      const result = builder.formatBrainstormValue(obj);
      expect(result).toBe('{"key":"value","nested":{"inner":"data"}}');
    });

    it('should handle null as object edge case', () => {
      expect(builder.formatBrainstormValue(null)).toBe('null');
    });

    it('should convert primitives to strings', () => {
      expect(builder.formatBrainstormValue('text')).toBe('text');
      expect(builder.formatBrainstormValue(123)).toBe('123');
      expect(builder.formatBrainstormValue(true)).toBe('true');
      expect(builder.formatBrainstormValue(false)).toBe('false');
    });

    it('should handle undefined', () => {
      expect(builder.formatBrainstormValue(undefined)).toBe('undefined');
    });

    it('should handle arrays with mixed types', () => {
      expect(builder.formatBrainstormValue([1, 'text', true, null])).toBe('1, text, true, ');
    });

    it('should handle nested arrays', () => {
      const nested = [['a', 'b'], ['c', 'd']];
      expect(builder.formatBrainstormValue(nested)).toBe('a,b, c,d');
    });
  });

  describe('edge cases and integration', () => {
    it('should handle very long element values', () => {
      const longValue = 'a'.repeat(10000);
      const input = {
        elements: {
          subject: longValue,
        },
      };

      const signature = builder.buildBrainstormSignature(input);
      expect(signature.elements.subject).toBe(longValue);

      const section = builder.buildBrainstormContextSection(input);
      expect(section).toContain(longValue);
    });

    it('should handle unicode characters in elements', () => {
      const input = {
        elements: {
          subject: '宇航員 👨‍🚀',
          setting: 'Mars 🔴',
        },
      };

      const signature = builder.buildBrainstormSignature(input);
      expect(signature.elements.subject).toBe('宇航員 👨‍🚀');

      const section = builder.buildBrainstormContextSection(input);
      expect(section).toContain('宇航員 👨‍🚀');
    });

    it('should handle special characters in keys', () => {
      const key = 'main@subject#test';
      const formatted = builder.formatBrainstormKey(key);
      expect(formatted).toBeTruthy();
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('should be consistent across multiple calls', () => {
      const input = {
        elements: { subject: 'astronaut' },
        metadata: { format: 'cinematic' },
      };

      const result1 = builder.buildBrainstormSignature(input);
      const result2 = builder.buildBrainstormSignature(input);

      expect(result1).toEqual(result2);
    });

    it('should not mutate input objects', () => {
      const input = {
        elements: { subject: '  astronaut  ' },
        metadata: { format: '  cinematic  ' },
      };

      const originalInput = JSON.parse(JSON.stringify(input));

      builder.buildBrainstormSignature(input);
      builder.buildBrainstormContextSection(input);

      expect(input).toEqual(originalInput);
    });
  });
});
