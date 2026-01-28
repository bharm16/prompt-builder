import { describe, expect, it } from 'vitest';

describe('glinerWorker', () => {
  it('throws when imported outside a worker context', async () => {
    await expect(import('@llm/span-labeling/nlp/glinerWorker.js')).rejects.toThrow(
      'GLiNER worker requires a parent port'
    );
  });
});
