import { describe, expect, it, vi } from 'vitest';

const { shouldUseDeveloperMessageMock } = vi.hoisted(() => ({
  shouldUseDeveloperMessageMock: vi.fn(),
}));

vi.mock('@config/modelConfig', () => ({
  shouldUseDeveloperMessage: shouldUseDeveloperMessageMock,
}));

import { buildDefaultDeveloperMessage, resolveDeveloperMessage } from '../DeveloperMessagePolicy';

describe('DeveloperMessagePolicy', () => {
  it('returns explicit developerMessage when provided', () => {
    shouldUseDeveloperMessageMock.mockReturnValue(false);

    const result = resolveDeveloperMessage({
      operation: 'op',
      params: {
        systemPrompt: 'prompt',
        developerMessage: 'explicit-dev-message',
      },
      hasStructuredOutput: true,
      hasStrictSchema: false,
    });

    expect(result).toBe('explicit-dev-message');
  });

  it('builds default developer message when operation requires it', () => {
    shouldUseDeveloperMessageMock.mockReturnValue(true);

    const result = resolveDeveloperMessage({
      operation: 'op',
      params: {
        systemPrompt: 'prompt',
      },
      hasStructuredOutput: true,
      hasStrictSchema: false,
    });

    expect(result).toContain('OUTPUT FORMAT:');
    expect(result).toContain('Respond with ONLY valid JSON');
    expect(result).toContain('SECURITY:');
  });

  it('omits output-format section when strict schema is enabled', () => {
    const result = buildDefaultDeveloperMessage(true, true);

    expect(result).not.toContain('OUTPUT FORMAT:');
    expect(result).toContain('DATA HANDLING:');
  });

  it('returns undefined when operation does not require developer message', () => {
    shouldUseDeveloperMessageMock.mockReturnValue(false);

    const result = resolveDeveloperMessage({
      operation: 'op',
      params: {
        systemPrompt: 'prompt',
      },
      hasStructuredOutput: false,
      hasStrictSchema: false,
    });

    expect(result).toBeUndefined();
  });
});
