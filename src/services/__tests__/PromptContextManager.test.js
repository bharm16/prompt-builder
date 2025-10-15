import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PromptContextManager } from '../PromptContextManager.js';

// Mock logger
vi.mock('../../infrastructure/Logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('PromptContextManager', () => {
  let mgr;

  beforeEach(() => {
    vi.clearAllMocks();
    mgr = new PromptContextManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records interactions and limits history', () => {
    const user = 'u1';
    for (let i = 0; i < 105; i++) {
      mgr.recordInteraction(user, { id: i, type: 'prompt', prompt: `test ${i}` });
    }
    const history = mgr.getUserAnalytics(user);
    expect(history.totalInteractions).toBe(100); // limited to 100
  });

  it('enriches context with history, session, insights, and patterns', async () => {
    const user = 'u2';
    mgr.recordInteraction(user, { id: 1, type: 'prompt', service: 'svc', prompt: 'Explain API function' });
    mgr.recordInteraction(user, { id: 2, type: 'prompt', service: 'svc', prompt: 'Analyze data trends' });
    mgr.recordInteraction(user, { id: 3, type: 'prompt', service: 'svc', prompt: 'Debug code issue' });

    const enriched = await mgr.enrichWithContext('Create function', user, 'test');
    expect(enriched).toHaveProperty('context');
    expect(enriched.context.history.promptCount).toBeGreaterThan(0);
    expect(Array.isArray(enriched.context.patterns.commonRequests)).toBe(true);
  });

  it('detects domain and expertise from history patterns', () => {
    const user = 'u3';
    // Populate enough history to infer expertise
    for (let i = 0; i < 10; i++) {
      mgr.recordInteraction(user, { id: i, type: 'prompt', prompt: 'Analyze API function (DEBUG)' });
    }
    const analytics = mgr.getUserAnalytics(user);
    expect(['beginner', 'intermediate', 'expert']).toContain(analytics.expertiseLevel);
  });

  it('clears user session data', () => {
    const user = 'u4';
    mgr.recordInteraction(user, { id: 1, type: 'prompt', service: 'svc', prompt: 'Test' });
    mgr.clearSession(user);
    const analytics = mgr.getUserAnalytics(user);
    expect(analytics.sessionDuration).toBe(0);
  });
});
