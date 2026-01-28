export interface StructuredOutputSchema {
  type: 'object' | 'array';
  required?: string[];
  items?: {
    required?: string[];
  };
  [key: string]: unknown;
}
