import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock environment variables before importing server
process.env.VITE_ANTHROPIC_API_KEY = 'sk-test-key-12345';
process.env.VITE_FIREBASE_API_KEY = 'test-firebase-key';
process.env.VITE_FIREBASE_PROJECT_ID = 'test-project';
process.env.VITE_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
process.env.VITE_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
process.env.VITE_FIREBASE_MESSAGING_SENDER_ID = '123456789';
process.env.VITE_FIREBASE_APP_ID = 'test-app-id';
process.env.NODE_ENV = 'test';
process.env.ALLOWED_API_KEYS = 'dev-key-12345,test-key-67890';
process.env.METRICS_TOKEN = 'dev-metrics-token-12345';

// Mock fetch globally
global.fetch = vi.fn();

describe('API Server Tests', () => {
  let app;
  let cacheService;
  let metricsService;

  const createLLMResponse = (payload) => ({
    ok: true,
    status: 200,
    json: async () => ({
      choices: [
        {
          message: {
            content: typeof payload === 'string' ? payload : JSON.stringify(payload),
          },
        },
      ],
      // Include Claude-style content for legacy tests that read directly
      content: [
        {
          text: typeof payload === 'string' ? payload : JSON.stringify(payload),
        },
      ],
    }),
  });

  beforeAll(async () => {
    // Dynamically import the server after env vars are set
    const serverModule = await import('../server.js');
    app = serverModule.default;

    const cacheModule = await import('../src/services/CacheService.js');
    cacheService = cacheModule.cacheService;

    const metricsModule = await import('../src/infrastructure/MetricsService.js');
    metricsService = metricsModule.metricsService;

    // Clear any existing mocks
    vi.clearAllMocks();
  });

  beforeEach(async () => {
    // Reset fetch mock before each test
    global.fetch.mockReset();

    // Clear cache between tests to avoid interference
    await cacheService.flush();
  });

  describe('POST /api/optimize', () => {

    it('should return 400 for missing prompt', async () => {
      const response = await request(app)
        .post('/api/optimize')
        .set('X-API-Key', 'dev-key-12345')
        .send({ mode: 'code' })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContain('Prompt is required');
    });

    it('should return 400 for empty prompt', async () => {
      const response = await request(app)
        .post('/api/optimize')
        .set('X-API-Key', 'dev-key-12345')
        .send({ prompt: '', mode: 'code' })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBe('Prompt is required');
    });

    it('should return 400 for missing mode', async () => {
      const response = await request(app)
        .post('/api/optimize')
        .set('X-API-Key', 'dev-key-12345')
        .send({ prompt: 'Test prompt' })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toBe('Mode is required');
    });

    it('should return 400 for invalid mode', async () => {
      const response = await request(app)
        .post('/api/optimize')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          prompt: 'Test prompt',
          mode: 'invalid-mode',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContain('Mode must be one of');
    });

    it('should return 400 for prompt exceeding max length', async () => {
      const response = await request(app)
        .post('/api/optimize')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          prompt: 'a'.repeat(10001),
          mode: 'code',
        })
        .expect(400);

      expect(response.body.details).toContain('10,000 characters');
    });

    it('should accept valid request with code mode', async () => {
      // Mock successful Claude API response
      global.fetch.mockResolvedValueOnce(
        createLLMResponse('Optimized code prompt response')
      );

      const response = await request(app)
        .post('/api/optimize')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          prompt: 'Test code prompt',
          mode: 'code',
        })
        .expect(200);

      expect(response.body).toHaveProperty('optimizedPrompt');
      expect(response.body.optimizedPrompt).toBe('Optimized code prompt response');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should accept all valid modes', async () => {
      const modes = ['code', 'text', 'learning', 'video', 'reasoning', 'research', 'socratic', 'optimize'];

      for (const mode of modes) {
        global.fetch.mockResolvedValueOnce(
          createLLMResponse(`Optimized ${mode} response`)
        );

        const response = await request(app)
          .post('/api/optimize')
          .set('X-API-Key', 'dev-key-12345')
          .send({
            prompt: `Test prompt for ${mode}`,
            mode,
          })
          .expect(200);

        expect(response.body).toHaveProperty('optimizedPrompt');
      }

      expect(global.fetch).toHaveBeenCalledTimes(modes.length);
    });

    it('should accept valid request with context', async () => {
      global.fetch.mockResolvedValueOnce(
        createLLMResponse('Optimized prompt with context')
      );

      const response = await request(app)
        .post('/api/optimize')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          prompt: 'Test prompt',
          mode: 'code',
          context: {
            specificAspects: 'Focus on performance',
            backgroundLevel: 'Advanced',
            intendedUse: 'Production system',
          },
        })
        .expect(200);

      expect(response.body.optimizedPrompt).toBe('Optimized prompt with context');
    });

    it('should handle Claude API errors gracefully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Claude API Error',
      });

      const response = await request(app)
        .post('/api/optimize')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          prompt: 'Test prompt',
          mode: 'code',
        })
        .expect(500);

      expect(response.body.error).toContain('Claude API error');
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const response = await request(app)
        .post('/api/optimize')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          prompt: 'Test prompt',
          mode: 'code',
        })
        .expect(500);

      expect(response.body.error).toContain('Network error');
    });
  });

  describe('POST /api/generate-questions', () => {
    it('should return 400 for missing prompt', async () => {
      const response = await request(app)
        .post('/api/generate-questions')
        .set('X-API-Key', 'dev-key-12345')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContain('Prompt is required');
    });

    it('should return 400 for empty prompt', async () => {
      const response = await request(app)
        .post('/api/generate-questions')
        .set('X-API-Key', 'dev-key-12345')
        .send({ prompt: '' })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContain('Prompt is required');
    });

    it('should generate questions for valid prompt', async () => {
      const mockQuestions = {
        questions: [
          {
            id: 1,
            title: 'What specific aspects?',
            description: 'Helps clarify focus',
            field: 'specificAspects',
            examples: ['Example 1', 'Example 2', 'Example 3'],
          },
          {
            id: 2,
            title: 'Background level?',
            description: 'Determines expertise level',
            field: 'backgroundLevel',
            examples: ['Beginner', 'Intermediate', 'Advanced'],
          },
          {
            id: 3,
            title: 'Intended use?',
            description: 'Helps tailor response',
            field: 'intendedUse',
            examples: ['Learning', 'Production', 'Testing'],
          },
        ],
      };

      global.fetch.mockResolvedValueOnce(createLLMResponse(mockQuestions));

      const response = await request(app)
        .post('/api/generate-questions')
        .set('X-API-Key', 'dev-key-12345')
        .send({ prompt: 'Help me with React' })
        .expect(200);

      expect(response.body.questions).toHaveLength(3);
      expect(response.body.questions[0]).toHaveProperty('id');
      expect(response.body.questions[0]).toHaveProperty('title');
      expect(response.body.questions[0]).toHaveProperty('field');
      expect(response.body.questions[0]).toHaveProperty('examples');
    });

    it('should handle JSON parsing with markdown code blocks', async () => {
      const mockQuestions = {
        questions: [
          {
            id: 1,
            title: 'Test question?',
            description: 'Test description',
            field: 'specificAspects',
            examples: ['Example 1'],
          },
        ],
      };

      // Simulate response with markdown code blocks
      const responseText = '```json\n' + JSON.stringify(mockQuestions) + '\n```';

      global.fetch.mockResolvedValueOnce(createLLMResponse(responseText));

      const response = await request(app)
        .post('/api/generate-questions')
        .set('X-API-Key', 'dev-key-12345')
        .send({ prompt: 'Test prompt' })
        .expect(200);

      expect(response.body.questions).toHaveLength(1);
    });

    it('should handle API errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      const response = await request(app)
        .post('/api/generate-questions')
        .set('X-API-Key', 'dev-key-12345')
        .send({ prompt: 'Test prompt' })
        .expect(429);

      expect(response.body.error).toContain('Claude API error');
    });
  });

  describe('POST /api/get-enhancement-suggestions', () => {
    it('should return 400 for missing highlighted text', async () => {
      const response = await request(app)
        .post('/api/get-enhancement-suggestions')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          fullPrompt: 'Full prompt text',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContain('Highlighted text is required');
    });

    it('should return 400 for missing full prompt', async () => {
      const response = await request(app)
        .post('/api/get-enhancement-suggestions')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          highlightedText: 'Selected text',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContain('Full prompt is required');
    });

    it('should detect placeholders and return value suggestions', async () => {
      const mockSuggestions = [
        { text: 'New York City', explanation: 'Major urban center', category: 'US Cities' },
        { text: 'Tokyo', explanation: 'Asian metropolitan', category: 'Asian Cities' },
        { text: 'Paris', explanation: 'European capital', category: 'European Cities' },
      ];

      global.fetch.mockResolvedValueOnce(createLLMResponse(mockSuggestions));

      const response = await request(app)
        .post('/api/get-enhancement-suggestions')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          highlightedText: 'location',
          contextBefore: 'Set the ',
          contextAfter: ' to something specific',
          fullPrompt: 'Set the location to something specific',
          originalUserPrompt: 'Create a travel video',
        })
        .expect(200);

      expect(response.body.isPlaceholder).toBe(true);
      expect(response.body.suggestions).toBeDefined();

      // Check if suggestions are grouped by category
      if (response.body.hasCategories) {
        expect(response.body.suggestions[0]).toHaveProperty('category');
        expect(response.body.suggestions[0]).toHaveProperty('suggestions');
        expect(response.body.suggestions[0].suggestions[0]).toHaveProperty('text');
      } else {
        expect(response.body.suggestions).toHaveLength(3);
        expect(response.body.suggestions[0]).toHaveProperty('text');
        expect(response.body.suggestions[0]).toHaveProperty('explanation');
      }
    });

    it('should generate rewrite suggestions for non-placeholders', async () => {
      const mockSuggestions = [
        { text: 'First rewrite option', explanation: 'More specific and actionable' },
        { text: 'Second rewrite option', explanation: 'Better structure and clarity' },
        { text: 'Third rewrite option', explanation: 'Enhanced detail and precision' },
      ];

      global.fetch.mockResolvedValueOnce(createLLMResponse(mockSuggestions));

      const response = await request(app)
        .post('/api/get-enhancement-suggestions')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          highlightedText: 'This is a complete sentence that needs improvement',
          contextBefore: 'Start of prompt. ',
          contextAfter: ' Rest of prompt.',
          fullPrompt: 'Start of prompt. This is a complete sentence that needs improvement Rest of prompt.',
          originalUserPrompt: 'Improve my prompt',
        })
        .expect(200);

      expect(response.body.suggestions).toHaveLength(3);
      expect(response.body.isPlaceholder).toBe(false);
    });

    it('should handle video prompts differently', async () => {
      const mockSuggestions = [
        { text: 'Cinematic rewrite with camera details', explanation: 'Adds specific camera movements and framing' },
      ];

      global.fetch.mockResolvedValueOnce(createLLMResponse(mockSuggestions));

      const response = await request(app)
        .post('/api/get-enhancement-suggestions')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          highlightedText: 'pan across the scene',
          contextBefore: 'Camera Movement: ',
          contextAfter: '',
          fullPrompt: '**Main Prompt:** Test video. **Technical Parameters:** Camera Movement: pan across the scene',
          originalUserPrompt: 'Create a cinematic video',
        })
        .expect(200);

      expect(response.body.suggestions).toBeDefined();
    });
  });

  describe('POST /api/get-custom-suggestions', () => {
    it('should return 400 for missing highlighted text', async () => {
      const response = await request(app)
        .post('/api/get-custom-suggestions')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          customRequest: 'Make it shorter',
          fullPrompt: 'Full prompt',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for missing custom request', async () => {
      const response = await request(app)
        .post('/api/get-custom-suggestions')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          highlightedText: 'Selected text',
          fullPrompt: 'Full prompt',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should generate custom suggestions', async () => {
      const mockSuggestions = [
        { text: 'Custom suggestion 1' },
        { text: 'Custom suggestion 2' },
        { text: 'Custom suggestion 3' },
      ];

      global.fetch.mockResolvedValueOnce(createLLMResponse(mockSuggestions));

      const response = await request(app)
        .post('/api/get-custom-suggestions')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          highlightedText: 'This text needs to be shorter',
          customRequest: 'Make it more concise',
          fullPrompt: 'Full prompt with: This text needs to be shorter',
        })
        .expect(200);

      expect(response.body.suggestions).toHaveLength(3);
      expect(response.body.suggestions[0]).toHaveProperty('text');
    });
  });

  describe('POST /api/detect-scene-change', () => {
    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/detect-scene-change')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          changedField: 'location',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should detect scene changes', async () => {
      const mockResult = {
        isSceneChange: true,
        confidence: 'high',
        reasoning: 'Complete environment change from indoor to outdoor',
        suggestedUpdates: {
          'atmospheric-conditions': 'Clear blue sky with scattered clouds',
          'background-elements': 'Mountain ranges in distance',
        },
      };

      global.fetch.mockResolvedValueOnce(createLLMResponse(mockResult));

      const response = await request(app)
        .post('/api/detect-scene-change')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          changedField: 'location',
          newValue: 'Mountain peak at sunrise',
          oldValue: 'Coffee shop interior',
          fullPrompt: 'Video prompt with location change',
          affectedFields: {
            'atmospheric-conditions': 'Warm indoor lighting',
            'background-elements': 'Cafe furniture and patrons',
          },
        })
        .expect(200);

      expect(response.body.isSceneChange).toBe(true);
      expect(response.body.confidence).toBe('high');
      expect(response.body.suggestedUpdates).toBeDefined();
    });

    it('should handle non-scene changes', async () => {
      const mockResult = {
        isSceneChange: false,
        confidence: 'high',
        reasoning: 'Minor refinement, same environment',
        suggestedUpdates: {},
      };

      global.fetch.mockResolvedValueOnce(createLLMResponse(mockResult));

      const response = await request(app)
        .post('/api/detect-scene-change')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          changedField: 'location',
          newValue: 'Modern coffee shop with minimalist decor',
          oldValue: 'Vintage coffee shop',
          fullPrompt: 'Video prompt with minor location refinement',
          affectedFields: {},
        })
        .expect(200);

      expect(response.body.isSceneChange).toBe(false);
      expect(response.body.suggestedUpdates).toEqual({});
    });
  });

  describe('POST /api/get-creative-suggestions', () => {
    it('should return 400 for missing element type', async () => {
      const response = await request(app)
        .post('/api/get-creative-suggestions')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          currentValue: 'Test value',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should return 400 for invalid element type', async () => {
      const response = await request(app)
        .post('/api/get-creative-suggestions')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          elementType: 'invalid-type',
        })
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });

    it('should generate creative suggestions for all valid element types', async () => {
      const elementTypes = ['subject', 'action', 'location', 'time', 'mood', 'style', 'event'];

      for (const elementType of elementTypes) {
        const mockSuggestions = [
          { text: 'Suggestion 1', explanation: 'Why it works' },
          { text: 'Suggestion 2', explanation: 'Why it works' },
        ];

        global.fetch.mockResolvedValueOnce(createLLMResponse(mockSuggestions));

        const response = await request(app)
          .post('/api/get-creative-suggestions')
          .set('X-API-Key', 'dev-key-12345')
          .send({
            elementType,
            currentValue: 'Current value',
            context: 'Full context',
            concept: 'Overall concept',
          })
          .expect(200);

        expect(response.body.suggestions).toBeDefined();
        expect(response.body.suggestions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Security Headers', () => {
    it('should include Helmet security headers', async () => {
      const response = await request(app).get('/nonexistent-route');

      // Helmet adds these headers
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });
  });

  describe('CORS Configuration', () => {
    it('should allow requests from localhost:5173', async () => {
      global.fetch.mockResolvedValueOnce(createLLMResponse('Response'));

      const response = await request(app)
        .post('/api/optimize')
        .set('Origin', 'http://localhost:5173')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          prompt: 'Test',
          mode: 'code',
        });

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });
  });

  describe('Placeholder Detection', () => {
    it('should detect single-word placeholders', async () => {
      global.fetch.mockResolvedValueOnce(
        createLLMResponse(
          '[{"text": "Paris", "explanation": "Capital of France", "category": "European Cities"}, {"text": "New York", "explanation": "Major US city", "category": "US Cities"}]'
        )
      );

      const response = await request(app)
        .post('/api/get-enhancement-suggestions')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          highlightedText: 'location',
          contextBefore: 'Set ',
          contextAfter: ' to',
          fullPrompt: 'Set location to something',
          originalUserPrompt: 'Test',
        })
        .expect(200);

      expect(response.body.isPlaceholder).toBe(true);
    });

    it('should detect placeholders in parentheses', async () => {
      global.fetch.mockResolvedValueOnce(
        createLLMResponse(
          '[{"text": "downtown office", "explanation": "Central business district", "category": "Indoor Locations"}, {"text": "beach resort", "explanation": "Coastal vacation spot", "category": "Outdoor Locations"}]'
        )
      );

      const response = await request(app)
        .post('/api/get-enhancement-suggestions')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          highlightedText: 'your location',
          contextBefore: 'Specify (',
          contextAfter: ') here',
          fullPrompt: 'Specify (your location) here',
          originalUserPrompt: 'Test',
        })
        .expect(200);

      expect(response.body.isPlaceholder).toBe(true);
    });

    it('should detect placeholders with preceding phrases', async () => {
      global.fetch.mockResolvedValueOnce(
        createLLMResponse(
          '[{"text": "New York", "explanation": "Major US city", "category": "US Cities"}, {"text": "Tokyo", "explanation": "Major Asian city", "category": "Asian Cities"}]'
        )
      );

      const response = await request(app)
        .post('/api/get-enhancement-suggestions')
        .set('X-API-Key', 'dev-key-12345')
        .send({
          highlightedText: 'Paris',
          contextBefore: 'such as ',
          contextAfter: ' or London',
          fullPrompt: 'Cities such as Paris or London',
          originalUserPrompt: 'Test',
        })
        .expect(200);

      expect(response.body.isPlaceholder).toBe(true);
    });
  });

  describe('POST /api/check-compatibility', () => {
    const payload = {
      elementType: 'subject',
      value: 'Robot detective',
      existingElements: {
        subject: 'Time-traveling journalist',
        location: 'Rain-soaked metropolis',
        mood: 'Noir mystery',
      },
    };

    it('should analyze compatibility, cache the result, and update metrics', async () => {
      const compatibilityResult = {
        score: 0.82,
        feedback: 'Character concept fits the noir tone.',
        conflicts: [],
        suggestions: ['Lean into the investigative angle for cohesion.'],
      };

      global.fetch.mockResolvedValueOnce(createLLMResponse(compatibilityResult));

      const missSpy = vi.spyOn(metricsService, 'recordCacheMiss');
      const hitSpy = vi.spyOn(metricsService, 'recordCacheHit');
      const setSpy = vi.spyOn(cacheService, 'set');

      const firstResponse = await request(app)
        .post('/api/check-compatibility')
        .set('X-API-Key', 'dev-key-12345')
        .send(payload)
        .expect(200);

      expect(firstResponse.body).toEqual(compatibilityResult);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(missSpy).toHaveBeenCalledTimes(1);
      expect(hitSpy).not.toHaveBeenCalled();

      const normalizedElements = Object.fromEntries(
        Object.entries(payload.existingElements)
          .filter(([key, value]) => value && key !== payload.elementType)
          .sort(([a], [b]) => a.localeCompare(b))
      );
      const expectedCacheKey = cacheService.generateKey('compatibility', {
        elementType: payload.elementType,
        value: payload.value.trim().toLowerCase(),
        existingElements: normalizedElements,
      });

      expect(setSpy).toHaveBeenCalledWith(expectedCacheKey, compatibilityResult, {
        ttl: 30,
      });

      const ttlTimestamp = cacheService.cache.getTtl(expectedCacheKey);
      expect(ttlTimestamp).toBeGreaterThan(Date.now());
      const ttlMs = ttlTimestamp - Date.now();
      expect(ttlMs).toBeGreaterThan(25000);
      expect(ttlMs).toBeLessThanOrEqual(30000);

      setSpy.mockClear();
      missSpy.mockClear();
      hitSpy.mockClear();
      global.fetch.mockClear();

      const secondResponse = await request(app)
        .post('/api/check-compatibility')
        .set('X-API-Key', 'dev-key-12345')
        .send(payload)
        .expect(200);

      expect(secondResponse.body).toEqual(compatibilityResult);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(hitSpy).toHaveBeenCalledTimes(1);
      expect(missSpy).not.toHaveBeenCalled();
      expect(setSpy).not.toHaveBeenCalled();

      setSpy.mockRestore();
      hitSpy.mockRestore();
      missSpy.mockRestore();
    });

    it('should return a fallback when structured output enforcement fails', async () => {
      global.fetch.mockImplementation(() =>
        Promise.resolve(createLLMResponse('not valid json output'))
      );

      const response = await request(app)
        .post('/api/check-compatibility')
        .set('X-API-Key', 'dev-key-12345')
        .send(payload)
        .expect(200);

      expect(response.body.score).toBe(0.5);
      expect(response.body.feedback).toContain('Unable to determine');
      expect(global.fetch.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe('POST /api/complete-scene', () => {
    it('should merge suggestions for missing elements', async () => {
      const payload = {
        existingElements: {
          subject: 'Robot detective',
          location: '',
          mood: 'Noir mystery',
        },
        concept: 'Futuristic noir investigation',
      };

      const llmResponse = {
        location: 'A neon-drenched alleyway under constant rain',
      };

      global.fetch.mockResolvedValueOnce(createLLMResponse(llmResponse));

      const response = await request(app)
        .post('/api/complete-scene')
        .set('X-API-Key', 'dev-key-12345')
        .send(payload)
        .expect(200);

      expect(response.body.suggestions.location).toBe(llmResponse.location);
      expect(response.body.suggestions.subject).toBe(payload.existingElements.subject);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/generate-variations', () => {
    it('should return structured variations', async () => {
      const payload = {
        elements: {
          subject: 'Robot detective',
          location: 'Neon city',
          mood: 'Noir mystery',
        },
        concept: 'Futuristic noir investigation',
      };

      const variations = [
        {
          name: 'Undercover Noir',
          description: 'Focuses on stealth and espionage.',
          elements: { subject: 'Robot detective', location: 'Neon city' },
          changes: ['Introduce undercover assignment'],
        },
        {
          name: 'High-Speed Pursuit',
          description: 'Centers on a chase across the skyline.',
          elements: { subject: 'Robot detective', location: 'Skyway' },
          changes: ['Add aerial vehicles'],
        },
        {
          name: 'Cybercrime Lab',
          description: 'Spotlights forensic analysis.',
          elements: { subject: 'Robot detective', location: 'Forensic lab' },
          changes: ['Highlight tech-savvy tools'],
        },
      ];

      global.fetch.mockResolvedValueOnce(createLLMResponse(variations));

      const response = await request(app)
        .post('/api/generate-variations')
        .set('X-API-Key', 'dev-key-12345')
        .send(payload)
        .expect(200);

      expect(response.body.variations).toHaveLength(3);
      expect(response.body.variations[0]).toHaveProperty('name');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/parse-concept', () => {
    it('should clean markdown output when parsing concept', async () => {
      const payload = { concept: 'A robot detective solving mysteries in a neon city.' };
      const conceptBreakdown = {
        subject: 'Robot detective',
        action: 'Investigates crime scenes',
        location: 'Neon city',
        time: 'Rainy night',
        mood: 'Noir suspense',
        style: 'Cyberpunk thriller',
        event: 'High-profile heist',
      };

      const markdownResponse = `\n\n\`\`\`json\n${JSON.stringify(conceptBreakdown)}\n\`\`\``;
      global.fetch.mockResolvedValueOnce(createLLMResponse(markdownResponse));

      const response = await request(app)
        .post('/api/parse-concept')
        .set('X-API-Key', 'dev-key-12345')
        .send(payload)
        .expect(200);

      expect(response.body.elements).toEqual(conceptBreakdown);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/get-refinements', () => {
    it('should return refinement suggestions for filled elements', async () => {
      const payload = {
        elements: {
          subject: 'Robot detective',
          location: 'Neon city',
        },
      };

      const refinements = {
        subject: ['Cybernetic sleuth', 'Investigative android'],
        location: ['Rain-drenched skyline'],
      };

      global.fetch.mockResolvedValueOnce(createLLMResponse(refinements));

      const response = await request(app)
        .post('/api/get-refinements')
        .set('X-API-Key', 'dev-key-12345')
        .send(payload)
        .expect(200);

      expect(response.body.refinements.subject).toContain('Cybernetic sleuth');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/detect-conflicts', () => {
    it('should surface detected conflicts', async () => {
      const payload = {
        elements: {
          subject: 'Robot detective',
          location: 'Deep ocean base',
        },
      };

      const conflicts = [
        {
          elements: ['subject', 'location'],
          severity: 'medium',
          message: 'Robots may corrode underwater without preparation.',
          resolution: 'Add waterproofing or change location.',
        },
      ];

      global.fetch.mockResolvedValueOnce(createLLMResponse(conflicts));

      const response = await request(app)
        .post('/api/detect-conflicts')
        .set('X-API-Key', 'dev-key-12345')
        .send(payload)
        .expect(200);

      expect(response.body.conflicts).toHaveLength(1);
      expect(response.body.conflicts[0].severity).toBe('medium');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/generate-technical-params', () => {
    it('should return structured technical guidance', async () => {
      const payload = {
        elements: {
          subject: 'Robot detective',
          location: 'Neon city',
          mood: 'Noir mystery',
        },
      };

      const technicalParams = {
        camera: { angle: 'Low angle', movement: 'Slow dolly', lens: '35mm' },
        lighting: { type: 'Practical neon', direction: 'Side', quality: 'Moody' },
        color: { grading: 'Teal and orange', palette: 'High contrast' },
        format: { frameRate: '24fps', aspectRatio: '2.39:1', resolution: '4K' },
        audio: { style: 'Synthwave score', mood: 'Brooding' },
        postProduction: { effects: ['Light rain composite'], transitions: 'Hard cuts' },
      };

      global.fetch.mockResolvedValueOnce(createLLMResponse(technicalParams));

      const response = await request(app)
        .post('/api/generate-technical-params')
        .set('X-API-Key', 'dev-key-12345')
        .send(payload)
        .expect(200);

      expect(response.body.technicalParams.camera.angle).toBe('Low angle');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/validate-prompt', () => {
    it('should return validation scoring', async () => {
      const payload = {
        elements: {
          subject: 'Robot detective',
          location: 'Neon city',
        },
        concept: 'Futuristic noir investigation',
      };

      const validation = {
        score: 78,
        breakdown: {
          completeness: 20,
          specificity: 18,
          coherence: 22,
          visualPotential: 18,
        },
        feedback: ['Clarify the antagonist role.'],
        strengths: ['Strong atmosphere'],
        weaknesses: ['Need clearer stakes'],
      };

      global.fetch.mockResolvedValueOnce(createLLMResponse(validation));

      const response = await request(app)
        .post('/api/validate-prompt')
        .set('X-API-Key', 'dev-key-12345')
        .send(payload)
        .expect(200);

      expect(response.body.score).toBe(78);
      expect(response.body.breakdown.coherence).toBe(22);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/get-smart-defaults', () => {
    it('should provide default suggestions for dependent element', async () => {
      const payload = {
        elementType: 'lighting',
        existingElements: {
          subject: 'Robot detective',
          location: 'Neon city',
          mood: 'Noir mystery',
        },
      };

      const defaults = [
        'High-contrast neon signage',
        'Backlit rain-soaked streets',
        'Moody alley uplighting',
      ];

      global.fetch.mockResolvedValueOnce(createLLMResponse(defaults));

      const response = await request(app)
        .post('/api/get-smart-defaults')
        .set('X-API-Key', 'dev-key-12345')
        .send(payload)
        .expect(200);

      expect(response.body.defaults).toEqual(defaults);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /api/save-template', () => {
    it('should persist template metadata for reuse', async () => {
      const payload = {
        name: 'Noir Investigation',
        elements: { subject: 'Robot detective' },
        concept: 'Futuristic noir investigation',
        userId: 'user-123',
      };

      const response = await request(app)
        .post('/api/save-template')
        .set('X-API-Key', 'dev-key-12345')
        .send(payload)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.template).toMatchObject({ name: 'Noir Investigation' });
    });
  });

  describe('POST /api/get-template-recommendations', () => {
    it('should return an array of recommendations even without prior usage', async () => {
      const response = await request(app)
        .post('/api/get-template-recommendations')
        .set('X-API-Key', 'dev-key-12345')
        .send({ userId: 'user-123', currentElements: {} })
        .expect(200);

      expect(Array.isArray(response.body.recommendations)).toBe(true);
    });
  });

  describe('POST /api/record-user-choice', () => {
    it('should record the selected option successfully', async () => {
      const payload = {
        elementType: 'subject',
        chosen: 'Robot detective',
        rejected: ['Alien journalist'],
        userId: 'user-123',
      };

      const response = await request(app)
        .post('/api/record-user-choice')
        .set('X-API-Key', 'dev-key-12345')
        .send(payload)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/get-alternative-phrasings', () => {
    it('should return alternative phrasings with tone metadata', async () => {
      const payload = { elementType: 'subject', value: 'Robot detective' };
      const alternatives = [
        { text: 'Cybernetic investigator', tone: 'technical' },
        { text: 'Futuristic sleuth', tone: 'dramatic' },
      ];

      global.fetch.mockResolvedValueOnce(createLLMResponse(alternatives));

      const response = await request(app)
        .post('/api/get-alternative-phrasings')
        .set('X-API-Key', 'dev-key-12345')
        .send(payload)
        .expect(200);

      expect(response.body.alternatives).toHaveLength(2);
      expect(response.body.alternatives[0]).toHaveProperty('tone');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
