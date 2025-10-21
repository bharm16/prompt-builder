import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StructuredOutputEnforcer } from '../StructuredOutputEnforcer.js';

describe('StructuredOutputEnforcer', () => {
  let client;

  beforeEach(() => {
    client = { complete: vi.fn() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts a JSON object from fenced markdown with preambles', async () => {
    client.complete.mockResolvedValueOnce({
      content: [{ text: '```json\n{"ok":true}\n``` Extra text' }],
    });

    const out = await StructuredOutputEnforcer.enforceJSON(client, 'sys', {});
    expect(out).toEqual({ ok: true });
    expect(client.complete).toHaveBeenCalledTimes(1);
  });

  it('extracts an array when isArray mode with extra text around', async () => {
    client.complete.mockResolvedValueOnce({
      content: [{ text: 'Here is array: [ {"a":1}, {"b":2} ] end' }],
    });
    const out = await StructuredOutputEnforcer.enforceJSON(client, 'sys', { isArray: true });
    expect(Array.isArray(out)).toBe(true);
    expect(out.length).toBe(2);
  });

  it('retries on parse error and succeeds within maxRetries', async () => {
    client.complete
      .mockResolvedValueOnce({ content: [{ text: 'not json' }] })
      .mockResolvedValueOnce({ content: [{ text: '{"x":1}' }] });

    const out = await StructuredOutputEnforcer.enforceJSON(client, 'sys');
    expect(out).toEqual({ x: 1 });
    expect(client.complete).toHaveBeenCalledTimes(2);
  });

  it('does not retry on APIError and throws immediately', async () => {
    const apiErr = new Error('bad request');
    apiErr.name = 'APIError';
    apiErr.statusCode = 400;
    client.complete.mockRejectedValueOnce(apiErr);

    await expect(
      StructuredOutputEnforcer.enforceJSON(client, 'sys')
    ).rejects.toThrow('bad request');
    expect(client.complete).toHaveBeenCalledTimes(1);
  });

  it('retries when schema validation fails and ultimately throws after retries', async () => {
    // Return same object missing required field, will fail schema each time
    client.complete
      .mockResolvedValueOnce({ content: [{ text: '{"a":1}' }] })
      .mockResolvedValueOnce({ content: [{ text: '{"a":1}' }] })
      .mockResolvedValueOnce({ content: [{ text: '{"a":1}' }] });
    await expect(
      StructuredOutputEnforcer.enforceJSON(client, 'sys', {
        schema: { type: 'object', required: ['b'] },
      })
    ).rejects.toThrow(/Failed to extract valid JSON/);
    expect(client.complete).toHaveBeenCalledTimes(3);
  });

  it('retries on array item schema failure and throws after retries', async () => {
    const text = '[{"a":1},{"b":2}]';
    client.complete
      .mockResolvedValueOnce({ content: [{ text }] })
      .mockResolvedValueOnce({ content: [{ text }] })
      .mockResolvedValueOnce({ content: [{ text }] });
    await expect(
      StructuredOutputEnforcer.enforceJSON(client, 'sys', {
        isArray: true,
        schema: { type: 'array', items: { required: ['a'] } },
      })
    ).rejects.toThrow(/Failed to extract valid JSON/);
    expect(client.complete).toHaveBeenCalledTimes(3);
  });
});
