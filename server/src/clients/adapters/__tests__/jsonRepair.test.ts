import { describe, it, expect } from 'vitest';
import { attemptJsonRepair } from '../jsonRepair';

describe('attemptJsonRepair', () => {
  describe('error handling', () => {
    it('removes trailing commas so JSON can parse', () => {
      const input = '{"a": 1, "b": 2,}';

      const { repaired, changes } = attemptJsonRepair(input);

      expect(changes).toContain('Removed trailing commas');
      expect(() => JSON.parse(repaired)).not.toThrow();
      const parsed = JSON.parse(repaired) as { a: number; b: number };
      expect(parsed.b).toBe(2);
    });

    it('adds missing commas between adjacent objects', () => {
      const input = '[{"a": 1} {"b": 2}]';

      const { repaired, changes } = attemptJsonRepair(input);

      expect(changes).toContain('Added missing commas between objects');
      const parsed = JSON.parse(repaired) as Array<{ a?: number; b?: number }>;
      expect(parsed).toHaveLength(2);
      expect(parsed[1]).toBeDefined();
      expect(parsed[1]?.b).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('returns unchanged text and no changes for valid JSON', () => {
      const input = '{"ok": true}';

      const { repaired, changes } = attemptJsonRepair(input);

      expect(repaired).toBe(input);
      expect(changes).toHaveLength(0);
    });
  });

  describe('core behavior', () => {
    it('quotes keys and converts single-quoted keys', () => {
      const input = "{'a': 1, b: 2}";

      const { repaired, changes } = attemptJsonRepair(input);

      expect(changes).toContain('Converted single quotes to double quotes');
      expect(changes).toContain('Added quotes to unquoted keys');
      const parsed = JSON.parse(repaired) as { a: number; b: number };
      expect(parsed).toEqual({ a: 1, b: 2 });
    });
  });
});
