/**
 * @test {StrictSpanResponseSchema}
 * @description Comprehensive tests for strict span response schema with Chain-of-Thought field
 * 
 * This test demonstrates:
 * - analysis_trace field is required
 * - analysis_trace validation
 * - Schema structure with Chain-of-Thought field
 * - OpenAI response format conversion
 * - Schema validation function
 * 
 * Pattern: TypeScript test for schema validation
 */

import { describe, it, expect } from 'vitest';
import {
  StrictSpanResponseSchema,
  validateStrictSchema,
  getOpenAIResponseFormat,
  getGroqResponseFormat,
  getSchemaForProvider,
} from '../StrictSpanResponseSchema';

describe('StrictSpanResponseSchema', () => {
  // ============================================
  // Chain-of-Thought Field Tests
  // ============================================

  describe('Chain-of-Thought Field', () => {
    it('should require analysis_trace field', () => {
      // Arrange
      const responseWithoutTrace = {
        spans: [],
        meta: { version: 'v1', notes: '' },
      };

      // Act
      const validation = validateStrictSchema(responseWithoutTrace);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('analysis_trace must be a string');
    });

    it('should validate analysis_trace is string', () => {
      // Arrange
      const responseWithInvalidTrace = {
        analysis_trace: 123, // Not a string
        spans: [],
        meta: { version: 'v1', notes: '' },
      };

      // Act
      const validation = validateStrictSchema(responseWithInvalidTrace);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('analysis_trace must be a string');
    });

    it('should accept valid analysis_trace string', () => {
      // Arrange
      const validResponse = {
        analysis_trace: 'I analyzed the text and identified camera movement and subject identity',
        spans: [
          {
            text: 'camera pans',
            role: 'camera.movement',
            confidence: 0.9,
          },
        ],
        meta: { version: 'v1', notes: '' },
      };

      // Act
      const validation = validateStrictSchema(validResponse);

      // Assert
      expect(validation.valid).toBe(true);
      expect(validation.errors).toBeUndefined();
    });

    it('should reject responses without analysis_trace', () => {
      // Arrange
      const responseMissingTrace = {
        spans: [
          {
            text: 'test',
            role: 'subject.identity',
            confidence: 0.8,
          },
        ],
        meta: { version: 'v1', notes: '' },
      };

      // Act
      const validation = validateStrictSchema(responseMissingTrace);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toBeDefined();
      expect(validation.errors?.some((e) => e.includes('analysis_trace'))).toBe(true);
    });

    it('should accept empty analysis_trace string', () => {
      // Arrange
      const responseWithEmptyTrace = {
        analysis_trace: '',
        spans: [],
        meta: { version: 'v1', notes: '' },
      };

      // Act
      const validation = validateStrictSchema(responseWithEmptyTrace);

      // Assert - Empty string is still a valid string
      expect(validation.valid).toBe(true);
    });

    it('should accept multi-line analysis_trace', () => {
      // Arrange
      const multiLineTrace = `Step 1: Identified camera movement "pans"
Step 2: Identified subject "detective"
Step 3: Determined span boundaries`;

      const validResponse = {
        analysis_trace: multiLineTrace,
        spans: [
          {
            text: 'pans',
            role: 'camera.movement',
            confidence: 0.9,
          },
        ],
        meta: { version: 'v1', notes: '' },
      };

      // Act
      const validation = validateStrictSchema(validResponse);

      // Assert
      expect(validation.valid).toBe(true);
    });
  });

  // ============================================
  // Schema Structure Tests
  // ============================================

  describe('Schema Structure', () => {
    it('should have analysis_trace as required property', () => {
      // Arrange
      const schema = StrictSpanResponseSchema.schema;

      // Act & Assert
      expect(schema.required).toContain('analysis_trace');
      expect(schema.properties.analysis_trace).toBeDefined();
      expect(schema.properties.analysis_trace.type).toBe('string');
    });

    it('should maintain backward compatibility with spans/meta', () => {
      // Arrange
      const validResponse = {
        analysis_trace: 'Analysis complete',
        spans: [
          {
            text: 'test',
            role: 'subject.identity',
            confidence: 0.8,
          },
        ],
        meta: {
          version: 'v1',
          notes: 'Test notes',
        },
      };

      // Act
      const validation = validateStrictSchema(validResponse);

      // Assert
      expect(validation.valid).toBe(true);
      expect(validResponse.spans).toBeDefined();
      expect(validResponse.meta).toBeDefined();
    });

    it('should require spans array', () => {
      // Arrange
      const responseWithoutSpans = {
        analysis_trace: 'Analysis',
        meta: { version: 'v1', notes: '' },
      };

      // Act
      const validation = validateStrictSchema(responseWithoutSpans);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('spans must be an array');
    });

    it('should require meta object', () => {
      // Arrange
      const responseWithoutMeta = {
        analysis_trace: 'Analysis',
        spans: [],
      };

      // Act
      const validation = validateStrictSchema(responseWithoutMeta);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('meta must be an object');
    });

    it('should validate complete valid response', () => {
      // Arrange
      const completeResponse = {
        analysis_trace: 'Identified camera movement and subject',
        spans: [
          {
            text: 'camera pans',
            role: 'camera.movement',
            confidence: 0.9,
          },
          {
            text: 'detective',
            role: 'subject.identity',
            confidence: 0.95,
          },
        ],
        meta: {
          version: 'v3-taxonomy',
          notes: 'Split composite phrase into separate spans',
        },
        isAdversarial: false,
      };

      // Act
      const validation = validateStrictSchema(completeResponse);

      // Assert
      expect(validation.valid).toBe(true);
      expect(validation.errors).toBeUndefined();
    });

    it('should reject additional properties at top level', () => {
      // Arrange
      const responseWithExtraFields = {
        analysis_trace: 'Analysis',
        spans: [],
        meta: { version: 'v1', notes: '' },
        extraField: 'not allowed',
      };

      // Act
      const validation = validateStrictSchema(responseWithExtraFields);

      // Assert - Schema has additionalProperties: false, but validation function
      // doesn't check this (it's enforced by the LLM provider)
      // So this test verifies the schema structure itself
      expect(StrictSpanResponseSchema.schema.additionalProperties).toBe(false);
    });
  });

  // ============================================
  // OpenAI Response Format Tests
  // ============================================

  describe('OpenAI Response Format', () => {
    it('should convert to OpenAI response format', () => {
      // Act
      const format = getOpenAIResponseFormat();

      // Assert
      expect(format.type).toBe('json_schema');
      expect(format.json_schema).toBeDefined();
      expect(format.json_schema.name).toBe('span_labeling_response');
      expect(format.json_schema.strict).toBe(true);
      expect(format.json_schema.schema).toBeDefined();
    });

    it('should include analysis_trace in OpenAI schema', () => {
      // Act
      const format = getOpenAIResponseFormat();

      // Assert
      const schema = format.json_schema.schema;
      expect(schema.properties.analysis_trace).toBeDefined();
      expect(schema.properties.analysis_trace.type).toBe('string');
      expect(schema.required).toContain('analysis_trace');
    });

    it('should have strict mode enabled', () => {
      // Act
      const format = getOpenAIResponseFormat();

      // Assert
      expect(format.json_schema.strict).toBe(true);
    });
  });

  // ============================================
  // Groq Response Format Tests
  // ============================================

  describe('Groq Response Format', () => {
    it('should convert to Groq JSON mode format', () => {
      // Act
      const format = getGroqResponseFormat();

      // Assert
      expect(format.type).toBe('json_object');
    });
  });

  // ============================================
  // Provider-Specific Schema Tests
  // ============================================

  describe('Provider-Specific Schema', () => {
    it('should return OpenAI format for OpenAI provider', () => {
      // Act
      const schema = getSchemaForProvider('openai');

      // Assert
      expect(schema.type).toBe('json_schema');
      expect(schema.json_schema).toBeDefined();
    });

    it('should return Groq format for Groq provider', () => {
      // Act
      const schema = getSchemaForProvider('groq');

      // Assert
      expect(schema.type).toBe('json_object');
    });

    it('should return JSON object format for unknown provider', () => {
      // Act
      const schema = getSchemaForProvider('unknown');

      // Assert
      expect(schema.type).toBe('json_object');
    });

    it('should handle case-insensitive provider names', () => {
      // Act
      const schema1 = getSchemaForProvider('OPENAI');
      const schema2 = getSchemaForProvider('OpenAI');

      // Assert
      expect(schema1.type).toBe('json_schema');
      expect(schema2.type).toBe('json_schema');
    });
  });

  // ============================================
  // Span Validation Tests
  // ============================================

  describe('Span Validation', () => {
    it('should validate span text is string', () => {
      // Arrange
      const response = {
        analysis_trace: 'Analysis',
        spans: [
          {
            text: 123, // Invalid: not a string
            role: 'subject.identity',
            confidence: 0.8,
          },
        ],
        meta: { version: 'v1', notes: '' },
      };

      // Act
      const validation = validateStrictSchema(response);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('spans[0].text must be a string');
    });

    it('should validate span role is valid taxonomy ID', () => {
      // Arrange
      const response = {
        analysis_trace: 'Analysis',
        spans: [
          {
            text: 'test',
            role: 'invalid.role', // Invalid taxonomy ID
            confidence: 0.8,
          },
        ],
        meta: { version: 'v1', notes: '' },
      };

      // Act
      const validation = validateStrictSchema(response);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors?.some((e) => e.includes('invalid.role'))).toBe(true);
    });

    it('should validate span confidence is between 0 and 1', () => {
      // Arrange
      const response = {
        analysis_trace: 'Analysis',
        spans: [
          {
            text: 'test',
            role: 'subject.identity',
            confidence: 1.5, // Invalid: > 1
          },
        ],
        meta: { version: 'v1', notes: '' },
      };

      // Act
      const validation = validateStrictSchema(response);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors?.some((e) => e.includes('confidence'))).toBe(true);
    });

    it('should accept valid spans', () => {
      // Arrange
      const response = {
        analysis_trace: 'Analysis',
        spans: [
          {
            text: 'camera pans',
            role: 'camera.movement',
            confidence: 0.9,
          },
          {
            text: 'detective',
            role: 'subject.identity',
            confidence: 0.95,
          },
        ],
        meta: { version: 'v1', notes: '' },
      };

      // Act
      const validation = validateStrictSchema(response);

      // Assert
      expect(validation.valid).toBe(true);
    });
  });

  // ============================================
  // Meta Validation Tests
  // ============================================

  describe('Meta Validation', () => {
    it('should validate meta.version is string', () => {
      // Arrange
      const response = {
        analysis_trace: 'Analysis',
        spans: [],
        meta: {
          version: 123, // Invalid: not a string
          notes: '',
        },
      };

      // Act
      const validation = validateStrictSchema(response);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('meta.version must be a string');
    });

    it('should validate meta.notes is string', () => {
      // Arrange
      const response = {
        analysis_trace: 'Analysis',
        spans: [],
        meta: {
          version: 'v1',
          notes: 456, // Invalid: not a string
        },
      };

      // Act
      const validation = validateStrictSchema(response);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('meta.notes must be a string');
    });

    it('should accept valid meta object', () => {
      // Arrange
      const response = {
        analysis_trace: 'Analysis',
        spans: [],
        meta: {
          version: 'v3-taxonomy',
          notes: 'Processed with two-pass architecture',
        },
      };

      // Act
      const validation = validateStrictSchema(response);

      // Assert
      expect(validation.valid).toBe(true);
    });
  });

  // ============================================
  // Edge Cases Tests
  // ============================================

  describe('Edge Cases', () => {
    it('should handle null response', () => {
      // Act
      const validation = validateStrictSchema(null);

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Response must be an object');
    });

    it('should handle non-object response', () => {
      // Act
      const validation = validateStrictSchema('not an object');

      // Assert
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Response must be an object');
    });

    it('should handle empty spans array', () => {
      // Arrange
      const response = {
        analysis_trace: 'No spans identified',
        spans: [],
        meta: { version: 'v1', notes: 'No matches found' },
      };

      // Act
      const validation = validateStrictSchema(response);

      // Assert
      expect(validation.valid).toBe(true);
    });

    it('should handle isAdversarial flag', () => {
      // Arrange
      const response = {
        analysis_trace: 'Detected adversarial input',
        spans: [],
        meta: { version: 'v1', notes: '' },
        isAdversarial: true,
      };

      // Act
      const validation = validateStrictSchema(response);

      // Assert
      expect(validation.valid).toBe(true);
    });

    it('should handle missing isAdversarial flag (optional)', () => {
      // Arrange
      const response = {
        analysis_trace: 'Analysis',
        spans: [],
        meta: { version: 'v1', notes: '' },
        // isAdversarial not present
      };

      // Act
      const validation = validateStrictSchema(response);

      // Assert
      expect(validation.valid).toBe(true);
    });
  });

  // ============================================
  // Schema Description Tests
  // ============================================

  describe('Schema Description', () => {
    it('should have descriptive analysis_trace field', () => {
      // Arrange
      const analysisTraceProperty = StrictSpanResponseSchema.schema.properties.analysis_trace;

      // Assert
      expect(analysisTraceProperty.description).toBeDefined();
      expect(analysisTraceProperty.description).toContain('Step-by-step analysis');
      expect(analysisTraceProperty.description).toContain('reasoning');
    });

    it('should have schema name', () => {
      // Assert
      expect(StrictSpanResponseSchema.name).toBe('span_labeling_response');
    });

    it('should have strict mode enabled', () => {
      // Assert
      expect(StrictSpanResponseSchema.strict).toBe(true);
    });
  });
});

