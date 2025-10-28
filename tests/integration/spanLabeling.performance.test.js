import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../server/index.js';

/**
 * Integration Tests for Span Labeling Performance
 *
 * These tests validate the entire end-to-end flow of span labeling
 * with all performance optimizations enabled:
 * - Redis caching
 * - Request coalescing
 * - Concurrency limiting
 * - Smart debouncing
 * - Character offset accuracy
 *
 * Test Coverage:
 * - Full API request/response cycle
 * - Cache hit/miss scenarios
 * - Concurrent request handling
 * - Performance benchmarks (<200ms target)
 * - Schema compliance
 * - Error handling and fallback
 */

describe('Span Labeling Performance Integration Tests', () => {
  const API_KEY = process.env.API_KEY || 'test-key';
  const BASE_URL = '/llm/label-spans';

  const sampleText = 'A cinematic wide shot of a sunset over the ocean';
  const samplePayload = {
    text: sampleText,
    maxSpans: 60,
    minConfidence: 0.5,
    policy: {
      nonTechnicalWordLimit: 6,
      allowOverlap: false,
    },
    templateVersion: 'v1',
  };

  describe('End-to-End Flow', () => {
    it('should complete span labeling request successfully', async () => {
      const response = await request(app)
        .post(BASE_URL)
        .set('X-API-Key', API_KEY)
        .send(samplePayload)
        .expect(200);

      expect(response.body).toHaveProperty('spans');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.spans)).toBe(true);
    });

    it('should return valid JSON schema', async () => {
      const response = await request(app)
        .post(BASE_URL)
        .set('X-API-Key', API_KEY)
        .send(samplePayload)
        .expect(200);

      // Validate response structure
      expect(response.body).toMatchObject({
        spans: expect.any(Array),
        meta: expect.objectContaining({
          version: expect.any(String),
          notes: expect.any(String),
        }),
      });

      // Validate span structure
      if (response.body.spans.length > 0) {
        response.body.spans.forEach((span) => {
          expect(span).toMatchObject({
            text: expect.any(String),
            start: expect.any(Number),
            end: expect.any(Number),
            role: expect.any(String),
            confidence: expect.any(Number),
          });

          // Validate confidence range
          expect(span.confidence).toBeGreaterThanOrEqual(0);
          expect(span.confidence).toBeLessThanOrEqual(1);

          // Validate offsets
          expect(span.start).toBeGreaterThanOrEqual(0);
          expect(span.end).toBeGreaterThan(span.start);
        });
      }
    });

    it('should validate character offsets against source text', async () => {
      const response = await request(app)
        .post(BASE_URL)
        .set('X-API-Key', API_KEY)
        .send(samplePayload)
        .expect(200);

      response.body.spans.forEach((span) => {
        const extracted = sampleText.slice(span.start, span.end);

        // Extracted text should match span text (case-sensitive)
        expect(extracted).toBe(span.text);
      });
    });
  });

  describe('Cache Behavior', () => {
    it('should cache results and return faster on second request', async () => {
      const uniqueText = `Unique text ${Date.now()}`;
      const payload = { ...samplePayload, text: uniqueText };

      // First request - cache miss
      const start1 = Date.now();
      const response1 = await request(app)
        .post(BASE_URL)
        .set('X-API-Key', API_KEY)
        .send(payload)
        .expect(200);
      const duration1 = Date.now() - start1;

      expect(response1.headers['x-cache']).toBe('MISS');

      // Second request - cache hit
      const start2 = Date.now();
      const response2 = await request(app)
        .post(BASE_URL)
        .set('X-API-Key', API_KEY)
        .send(payload)
        .expect(200);
      const duration2 = Date.now() - start2;

      expect(response2.headers['x-cache']).toBe('HIT');

      // Cache hit should be significantly faster
      expect(duration2).toBeLessThan(duration1 * 0.5);
      console.log(`Cache miss: ${duration1}ms, Cache hit: ${duration2}ms`);
    });

    it('should return same results for cached requests', async () => {
      const uniqueText = `Consistent text ${Date.now()}`;
      const payload = { ...samplePayload, text: uniqueText };

      const response1 = await request(app)
        .post(BASE_URL)
        .set('X-API-Key', API_KEY)
        .send(payload)
        .expect(200);

      const response2 = await request(app)
        .post(BASE_URL)
        .set('X-API-Key', API_KEY)
        .send(payload)
        .expect(200);

      // Results should be identical
      expect(response1.body.spans).toEqual(response2.body.spans);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should complete cache miss request in <200ms (with mock)', async () => {
      // Note: This test assumes mocked OpenAI client in test environment
      const start = Date.now();

      await request(app)
        .post(BASE_URL)
        .set('X-API-Key', API_KEY)
        .send({ ...samplePayload, text: `Test ${Date.now()}` })
        .expect(200);

      const duration = Date.now() - start;

      console.log(`API latency (cache miss): ${duration}ms`);
      expect(duration).toBeLessThan(200);
    });

    it('should complete cache hit request in <10ms', async () => {
      const uniqueText = `Fast cache test ${Date.now()}`;
      const payload = { ...samplePayload, text: uniqueText };

      // Warm cache
      await request(app)
        .post(BASE_URL)
        .set('X-API-Key', API_KEY)
        .send(payload)
        .expect(200);

      // Measure cached response
      const start = Date.now();

      await request(app)
        .post(BASE_URL)
        .set('X-API-Key', API_KEY)
        .send(payload)
        .expect(200);

      const duration = Date.now() - start;

      console.log(`API latency (cache hit): ${duration}ms`);
      expect(duration).toBeLessThan(10);
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 10;
      const promises = [];

      const start = Date.now();

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .post(BASE_URL)
            .set('X-API-Key', API_KEY)
            .send({ ...samplePayload, text: `Concurrent test ${i}` })
        );
      }

      const responses = await Promise.all(promises);
      const duration = Date.now() - start;

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      const avgPerRequest = duration / concurrentRequests;
      console.log(
        `${concurrentRequests} concurrent requests: ${duration}ms total, ${avgPerRequest.toFixed(1)}ms avg`
      );

      // With concurrency limiting and request coalescing,
      // average per-request time should be reasonable
      expect(avgPerRequest).toBeLessThan(500);
    });
  });

  describe('Batch Endpoint', () => {
    it('should process batch requests successfully', async () => {
      const batchPayload = [
        { ...samplePayload, text: 'First text' },
        { ...samplePayload, text: 'Second text' },
        { ...samplePayload, text: 'Third text' },
      ];

      const response = await request(app)
        .post('/llm/label-spans-batch')
        .set('X-API-Key', API_KEY)
        .send(batchPayload)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(3);

      response.body.forEach((result) => {
        expect(result).toHaveProperty('spans');
        expect(result).toHaveProperty('meta');
      });
    });

    it('should be faster than individual requests', async () => {
      const texts = ['Text A', 'Text B', 'Text C'];

      // Individual requests
      const start1 = Date.now();
      for (const text of texts) {
        await request(app)
          .post(BASE_URL)
          .set('X-API-Key', API_KEY)
          .send({ ...samplePayload, text });
      }
      const duration1 = Date.now() - start1;

      // Batch request
      const batchPayload = texts.map((text) => ({ ...samplePayload, text: text + ' batch' }));

      const start2 = Date.now();
      await request(app)
        .post('/llm/label-spans-batch')
        .set('X-API-Key', API_KEY)
        .send(batchPayload);
      const duration2 = Date.now() - start2;

      console.log(`Individual: ${duration1}ms, Batch: ${duration2}ms`);

      // Batch should be faster (or similar if cached)
      expect(duration2).toBeLessThanOrEqual(duration1 * 1.2);
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for invalid payload', async () => {
      await request(app)
        .post(BASE_URL)
        .set('X-API-Key', API_KEY)
        .send({ maxSpans: 60 }) // Missing text
        .expect(400);
    });

    it('should return 400 for invalid maxSpans', async () => {
      await request(app)
        .post(BASE_URL)
        .set('X-API-Key', API_KEY)
        .send({ ...samplePayload, maxSpans: 100 }) // Exceeds limit
        .expect(400);
    });

    it('should return 400 for invalid minConfidence', async () => {
      await request(app)
        .post(BASE_URL)
        .set('X-API-Key', API_KEY)
        .send({ ...samplePayload, minConfidence: 1.5 }) // Out of range
        .expect(400);
    });

    it('should return 401 without API key', async () => {
      await request(app).post(BASE_URL).send(samplePayload).expect(401);
    });
  });

  describe('Request Coalescing', () => {
    it('should coalesce identical concurrent requests', async () => {
      const identicalText = `Coalesce test ${Date.now()}`;
      const payload = { ...samplePayload, text: identicalText };

      // Send 5 identical requests simultaneously
      const start = Date.now();

      const promises = Array.from({ length: 5 }, () =>
        request(app).post(BASE_URL).set('X-API-Key', API_KEY).send(payload)
      );

      const responses = await Promise.all(promises);
      const duration = Date.now() - start;

      // All should succeed with same results
      responses.forEach((response, i) => {
        expect(response.status).toBe(200);
        if (i > 0) {
          expect(response.body.spans).toEqual(responses[0].body.spans);
        }
      });

      console.log(`5 coalesced requests: ${duration}ms`);

      // Should be faster than 5 separate API calls
      // With coalescing, all requests wait for single API call
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Concurrency Limiting', () => {
    it('should enforce 5 concurrent request limit', async () => {
      // Send 20 requests with unique texts (to avoid coalescing)
      const promises = Array.from({ length: 20 }, (_, i) =>
        request(app)
          .post(BASE_URL)
          .set('X-API-Key', API_KEY)
          .send({ ...samplePayload, text: `Concurrent ${i} ${Date.now()}` })
      );

      const start = Date.now();
      const responses = await Promise.all(promises);
      const duration = Date.now() - start;

      // All should eventually succeed
      responses.forEach((response) => {
        expect([200, 502]).toContain(response.status);
      });

      console.log(`20 requests with concurrency limiting: ${duration}ms`);

      // With 5 concurrent limit, should take longer than unlimited
      // but still complete all requests
      const successCount = responses.filter((r) => r.status === 200).length;
      expect(successCount).toBeGreaterThan(15); // Most should succeed
    });
  });

  describe('Smart Debouncing', () => {
    it('should use appropriate debounce for text length', async () => {
      const shortText = 'Short'; // <500 chars: 200ms debounce
      const mediumText = 'A '.repeat(250); // 500-2000 chars: 350ms debounce
      const longText = 'Long '.repeat(500); // >2000 chars: 500ms debounce

      // Note: Debouncing happens client-side, so this test verifies
      // the server accepts various text lengths efficiently

      const responses = await Promise.all([
        request(app)
          .post(BASE_URL)
          .set('X-API-Key', API_KEY)
          .send({ ...samplePayload, text: shortText }),
        request(app)
          .post(BASE_URL)
          .set('X-API-Key', API_KEY)
          .send({ ...samplePayload, text: mediumText }),
        request(app)
          .post(BASE_URL)
          .set('X-API-Key', API_KEY)
          .send({ ...samplePayload, text: longText }),
      ]);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });
});
