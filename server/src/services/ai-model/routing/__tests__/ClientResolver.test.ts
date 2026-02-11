import { describe, expect, it } from 'vitest';
import { ClientResolver } from '../ClientResolver';

function createClient(name: string) {
  return {
    complete: async () => ({ text: name, metadata: {} }),
  };
}

describe('ClientResolver', () => {
  it('tracks available clients and hasAnyClient state', () => {
    const resolver = new ClientResolver({
      openai: createClient('openai'),
      groq: null,
      gemini: createClient('gemini'),
    });

    expect(resolver.hasAnyClient()).toBe(true);
    expect(resolver.hasClient('openai')).toBe(true);
    expect(resolver.hasClient('groq')).toBe(false);
    expect(resolver.getAvailableClients()).toEqual(expect.arrayContaining(['openai', 'gemini']));
  });

  it('returns client by name or null when unavailable', () => {
    const openai = createClient('openai');
    const resolver = new ClientResolver({
      openai,
      groq: null,
    });

    expect(resolver.getClientByName('openai')).toBe(openai);
    expect(resolver.getClientByName('groq')).toBeNull();
  });

  it('throws with helpful message when required client is missing', () => {
    const resolver = new ClientResolver({
      openai: createClient('openai'),
      groq: null,
    });

    expect(() =>
      resolver.getClient({
        client: 'groq',
        model: 'model',
        temperature: 0,
        maxTokens: 100,
        timeout: 1000,
      })
    ).toThrow("Client 'groq' is not available");
  });
});
