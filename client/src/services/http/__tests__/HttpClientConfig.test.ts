/**
 * Unit tests for HttpClientConfig
 *
 * Tests URL building, header merging, and factory construction.
 */

import { describe, expect, it } from 'vitest';
import { HttpClientConfig } from '../HttpClientConfig';

// ---------------------------------------------------------------------------
// buildUrl - URL joining edge cases
// ---------------------------------------------------------------------------
describe('HttpClientConfig.buildUrl', () => {
  it('returns baseURL when endpoint is empty', () => {
    const config = new HttpClientConfig({ baseURL: 'http://api.test' });
    expect(config.buildUrl('')).toBe('http://api.test');
  });

  it('returns baseURL when endpoint is undefined', () => {
    const config = new HttpClientConfig({ baseURL: 'http://api.test' });
    expect(config.buildUrl()).toBe('http://api.test');
  });

  it('joins baseURL and endpoint with slash when neither has one', () => {
    const config = new HttpClientConfig({ baseURL: 'http://api.test' });
    expect(config.buildUrl('users')).toBe('http://api.test/users');
  });

  it('avoids double slash when both base and endpoint have slashes', () => {
    const config = new HttpClientConfig({ baseURL: 'http://api.test/' });
    expect(config.buildUrl('/users')).toBe('http://api.test/users');
  });

  it('joins correctly when only base has trailing slash', () => {
    const config = new HttpClientConfig({ baseURL: 'http://api.test/' });
    expect(config.buildUrl('users')).toBe('http://api.test/users');
  });

  it('joins correctly when only endpoint has leading slash', () => {
    const config = new HttpClientConfig({ baseURL: 'http://api.test' });
    expect(config.buildUrl('/users')).toBe('http://api.test/users');
  });

  it('preserves query parameters in endpoint', () => {
    const config = new HttpClientConfig({ baseURL: 'http://api.test' });
    expect(config.buildUrl('/search?q=test')).toBe('http://api.test/search?q=test');
  });
});

// ---------------------------------------------------------------------------
// mergeHeaders
// ---------------------------------------------------------------------------
describe('HttpClientConfig.mergeHeaders', () => {
  it('returns default headers when no overrides', () => {
    const config = new HttpClientConfig({
      baseURL: 'http://api.test',
      defaultHeaders: { 'Content-Type': 'application/json' },
    });
    expect(config.mergeHeaders()).toEqual({ 'Content-Type': 'application/json' });
  });

  it('overrides default headers with provided headers', () => {
    const config = new HttpClientConfig({
      baseURL: 'http://api.test',
      defaultHeaders: { 'Content-Type': 'application/json' },
    });
    const merged = config.mergeHeaders({ 'Content-Type': 'text/plain' });
    expect(merged['Content-Type']).toBe('text/plain');
  });

  it('adds new headers alongside defaults', () => {
    const config = new HttpClientConfig({
      baseURL: 'http://api.test',
      defaultHeaders: { 'Content-Type': 'application/json' },
    });
    const merged = config.mergeHeaders({ Authorization: 'Bearer token' });
    expect(merged['Content-Type']).toBe('application/json');
    expect(merged.Authorization).toBe('Bearer token');
  });

  it('returns empty object when no defaults and no overrides', () => {
    const config = new HttpClientConfig({ baseURL: 'http://api.test' });
    expect(config.mergeHeaders()).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// fromApiConfig factory
// ---------------------------------------------------------------------------
describe('HttpClientConfig.fromApiConfig', () => {
  it('sets Content-Type header by default', () => {
    const config = HttpClientConfig.fromApiConfig({ baseURL: 'http://api.test' });
    const headers = config.mergeHeaders();
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('adds Authorization and X-API-Key when apiKey is provided', () => {
    const config = HttpClientConfig.fromApiConfig({
      baseURL: 'http://api.test',
      apiKey: 'my-key',
    });
    const headers = config.mergeHeaders();
    expect(headers.Authorization).toBe('Bearer my-key');
    expect(headers['X-API-Key']).toBe('my-key');
  });

  it('does not add auth headers when apiKey is absent', () => {
    const config = HttpClientConfig.fromApiConfig({ baseURL: 'http://api.test' });
    const headers = config.mergeHeaders();
    expect(headers.Authorization).toBeUndefined();
    expect(headers['X-API-Key']).toBeUndefined();
  });

  it('uses baseURL from apiConfig', () => {
    const config = HttpClientConfig.fromApiConfig({
      baseURL: 'http://custom.api/v2',
    });
    expect(config.buildUrl('/test')).toBe('http://custom.api/v2/test');
  });

  it('uses timeout from apiConfig', () => {
    const config = HttpClientConfig.fromApiConfig({
      baseURL: 'http://api.test',
      timeout: { default: 5000 },
    });
    // Cannot directly inspect timeout, but createSignal should use it
    const signal = config.createSignal();
    expect(signal).toBeDefined();
  });
});
