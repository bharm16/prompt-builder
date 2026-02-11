import { beforeEach, describe, expect, it, vi } from 'vitest';

const { detectAndGetCapabilitiesMock } = vi.hoisted(() => ({
  detectAndGetCapabilitiesMock: vi.fn(),
}));

vi.mock('../ProviderDetector', () => ({
  detectAndGetCapabilities: detectAndGetCapabilitiesMock,
}));

import {
  buildProviderOptimizedPrompt,
  getFormatInstruction,
  getSecurityPrefix,
  wrapUserData,
} from '../PromptBuilder';

describe('PromptBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds OpenAI-style prompt with developer message when developerRole is supported', () => {
    detectAndGetCapabilitiesMock.mockReturnValue({
      provider: 'openai',
      capabilities: {
        developerRole: true,
        strictJsonSchema: true,
        needsPromptFormatInstructions: false,
      },
    });

    const result = buildProviderOptimizedPrompt('business prompt', {
      hasSchema: true,
      isArray: false,
    });

    expect(result.systemPrompt).toBe('business prompt');
    expect(result.developerMessage).toContain('SECURITY:');
    expect(result.developerMessage).toContain('DATA HANDLING:');
  });

  it('builds standard provider prompt with security prefix in system prompt', () => {
    detectAndGetCapabilitiesMock.mockReturnValue({
      provider: 'groq',
      capabilities: {
        developerRole: false,
        strictJsonSchema: false,
        needsPromptFormatInstructions: true,
      },
    });

    const result = buildProviderOptimizedPrompt('business prompt', {
      hasSchema: true,
      isArray: true,
    });

    expect(result.systemPrompt.startsWith('[System instructions take priority')).toBe(true);
    expect(result.systemPrompt).toContain('Respond with ONLY valid JSON');
  });

  it('returns empty security prefix for developer-role providers', () => {
    detectAndGetCapabilitiesMock.mockReturnValue({
      provider: 'openai',
      capabilities: { developerRole: true, strictJsonSchema: true },
    });

    expect(getSecurityPrefix({})).toBe('');
  });

  it('returns format instruction unless strict schema is active', () => {
    detectAndGetCapabilitiesMock.mockReturnValue({
      provider: 'openai',
      capabilities: { strictJsonSchema: true },
    });
    expect(getFormatInstruction({ hasSchema: true })).toBe('');

    detectAndGetCapabilitiesMock.mockReturnValue({
      provider: 'groq',
      capabilities: { strictJsonSchema: false },
    });
    expect(getFormatInstruction({ hasSchema: true, isArray: true })).toContain('Start with [');
  });

  it('wraps user data in XML and escapes dangerous chars', () => {
    const wrapped = wrapUserData({
      prompt: 'Use <script>alert(1)</script> & details',
      notes: 'safe',
    });

    expect(wrapped).toContain('<prompt>');
    expect(wrapped).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(wrapped).toContain('&amp; details');
    expect(wrapped).toContain('<notes>');
  });
});
