import { extractAndParse } from '@utils/JsonExtractor';
import type { StructuredOutputSchema } from './types';

export function parseStructuredOutput<T>(
  responseText: string,
  schema: StructuredOutputSchema | null | undefined,
  isArray: boolean
): T {
  const extractAsArray = schema?.type === 'array'
    ? true
    : (schema?.type === 'object' ? false : isArray);

  return extractAndParse<T>(responseText, extractAsArray);
}
