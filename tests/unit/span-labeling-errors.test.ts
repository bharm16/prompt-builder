import { describe, expect, it } from 'vitest';

import { buildRequestError } from '@features/span-highlighting/api/spanLabelingErrors';

describe('spanLabelingErrors', () => {
  it('uses message from error body when present', async () => {
    const res = {
      status: 400,
      json: async () => ({ message: 'Bad request' }),
    } as Response;

    const error = await buildRequestError(res);

    expect(error.message).toBe('Bad request');
    expect(error.status).toBe(400);
  });

  it('falls back to status message on JSON errors', async () => {
    const res = {
      status: 500,
      json: async () => {
        throw new Error('Invalid JSON');
      },
    } as Response;

    const error = await buildRequestError(res);

    expect(error.message).toBe('Request failed with status 500');
    expect(error.status).toBe(500);
  });
});
