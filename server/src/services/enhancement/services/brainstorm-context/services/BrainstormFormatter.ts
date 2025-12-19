import { logger } from '@infrastructure/Logger';

/**
 * Brainstorm Formatter
 *
 * Handles formatting and presentation of brainstorm context elements.
 * Single Responsibility: String formatting and output presentation.
 */
export class BrainstormFormatter {
  private readonly log = logger.child({ service: 'BrainstormFormatter' });

  constructor() {
    // No dependencies - pure logic
  }

  /**
   * Format brainstorm keys into human-readable labels
   * Converts camelCase, snake_case, and kebab-case to Title Case
   *
   * @param key - Key to format
   * @returns Formatted key in Title Case
   *
   * @example
   * formatBrainstormKey('cameraAngle') // => 'Camera Angle'
   * formatBrainstormKey('shot_type') // => 'Shot Type'
   * formatBrainstormKey('lighting-style') // => 'Lighting Style'
   */
  formatBrainstormKey(key: string): string {
    if (!key) {
      return '';
    }

    return (
      key
        .toString()
        // Insert space before capital letters
        .replace(/([A-Z])/g, ' $1')
        // Replace underscores and hyphens with spaces
        .replace(/[_-]/g, ' ')
        // Normalize multiple spaces to single space
        .replace(/\s+/g, ' ')
        .trim()
        // Capitalize first letter of each word
        .replace(/\b\w/g, (char) => char.toUpperCase())
    );
  }

  /**
   * Normalize brainstorm metadata values for prompt inclusion
   * Handles arrays, objects, and primitives
   *
   * @param value - Value to format
   * @returns Formatted string representation
   *
   * @example
   * formatBrainstormValue(['value1', 'value2']) // => 'value1, value2'
   * formatBrainstormValue({key: 'value'}) // => '{"key":"value"}'
   * formatBrainstormValue('text') // => 'text'
   */
  formatBrainstormValue(value: unknown): string {
    if (Array.isArray(value)) {
      return value.join(', ');
    }

    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }

    return String(value);
  }
}
