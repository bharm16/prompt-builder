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

  beforeAll(async () => {
    // Dynamically import the server after env vars are set
    const serverModule = await import('../server.js');
    app = serverModule.default;
    // Clear any existing mocks
    vi.clearAllMocks();
  });

  beforeEach(async () => {
    // Reset fetch mock before each test
    global.fetch.mockReset();

    // Clear cache between tests to avoid interference
    const { cacheService } = await import('../src/services/CacheService.js');
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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ text: 'Optimized code prompt response' }],
        }),
      });

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
        global.fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            content: [{ text: `Optimized ${mode} response` }],
          }),
        });

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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ text: 'Optimized prompt with context' }],
        }),
      });

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

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ text: JSON.stringify(mockQuestions) }],
        }),
      });

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

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ text: responseText }],
        }),
      });

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

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ text: JSON.stringify(mockSuggestions) }],
        }),
      });

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

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ text: JSON.stringify(mockSuggestions) }],
        }),
      });

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

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ text: JSON.stringify(mockSuggestions) }],
        }),
      });

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

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ text: JSON.stringify(mockSuggestions) }],
        }),
      });

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

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ text: JSON.stringify(mockResult) }],
        }),
      });

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

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ text: JSON.stringify(mockResult) }],
        }),
      });

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

        global.fetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            content: [{ text: JSON.stringify(mockSuggestions) }],
          }),
        });

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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ text: 'Response' }],
        }),
      });

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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ text: '[{"text": "Paris", "explanation": "Capital of France", "category": "European Cities"}, {"text": "New York", "explanation": "Major US city", "category": "US Cities"}]' }],
        }),
      });

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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ text: '[{"text": "downtown office", "explanation": "Central business district", "category": "Indoor Locations"}, {"text": "beach resort", "explanation": "Coastal vacation spot", "category": "Outdoor Locations"}]' }],
        }),
      });

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
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ text: '[{"text": "New York", "explanation": "Major US city", "category": "US Cities"}, {"text": "Tokyo", "explanation": "Major Asian city", "category": "Asian Cities"}]' }],
        }),
      });

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
});
