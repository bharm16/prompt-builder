import { vi } from 'vitest';

// Ensure all tests run with test environment semantics.
process.env.NODE_ENV = 'test';
process.env.GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'prompt-builder-test-bucket';

// Provide a safe default fetch mock so adapter tests have stable defaults.
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: async () => ({
    candidates: [{ content: { parts: [{ text: 'stub' }] } }],
  }),
  text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: 'stub' }] } }] }),
});
