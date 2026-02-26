import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createFirestoreWriteGateMiddleware } from '@middleware/firestoreWriteGate';
import { runSupertestOrSkip } from './test-helpers/supertestSafeRequest';

describe('firestoreWriteGate middleware', () => {
  it('blocks mutating requests with 503 when circuit is open', async () => {
    const app = express();
    app.use(express.json());
    app.use(
      '/api',
      createFirestoreWriteGateMiddleware({
        isWriteAllowed: () => false,
        getRetryAfterSeconds: () => 12,
      } as never)
    );
    app.post('/api/test', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await runSupertestOrSkip(() =>
      request(app).post('/api/test').send({ hello: 'world' })
    );
    if (!response) return;

    expect(response.status).toBe(503);
    expect(response.headers['retry-after']).toBe('12');
    expect(response.body.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('allows non-mutating requests even when circuit is open', async () => {
    const app = express();
    app.use(
      '/api',
      createFirestoreWriteGateMiddleware({
        isWriteAllowed: () => false,
        getRetryAfterSeconds: () => 12,
      } as never)
    );
    app.get('/api/test', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    const response = await runSupertestOrSkip(() => request(app).get('/api/test'));
    if (!response) return;

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });
});

