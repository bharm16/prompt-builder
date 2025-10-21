/**
 * E2E Test Fixtures and Mock Data
 */

export const testPrompts = {
  simple: {
    prompt: 'Write a function to sort an array',
    mode: 'code',
  },
  complex: {
    prompt: 'Create a comprehensive testing strategy for a microservices architecture',
    mode: 'code',
    context: {
      specificAspects: 'Focus on integration testing and contract testing',
      backgroundLevel: 'Advanced',
      intendedUse: 'Production deployment',
    },
  },
  learning: {
    prompt: 'Explain how neural networks work',
    mode: 'learning',
    context: {
      backgroundLevel: 'Beginner',
      intendedUse: 'Educational',
    },
  },
  video: {
    prompt: 'A sunset over mountains with birds flying',
    mode: 'video',
    context: {
      specificAspects: 'Cinematic, golden hour lighting',
    },
  },
  reasoning: {
    prompt: 'Analyze the implications of quantum computing on cryptography',
    mode: 'reasoning',
  },
};

export const mockAIResponses = {
  simple: {
    content: 'Here is a function to sort an array:\n\n```javascript\nfunction sortArray(arr) {\n  return arr.sort((a, b) => a - b);\n}\n```',
    usage: {
      input_tokens: 50,
      output_tokens: 100,
    },
  },
  complex: {
    content: 'Here is a comprehensive testing strategy:\n\n1. Unit Testing\n2. Integration Testing\n3. Contract Testing\n4. E2E Testing',
    usage: {
      input_tokens: 150,
      output_tokens: 300,
    },
  },
};

export const mockTemplates = [
  {
    id: 'template-1',
    name: 'Code Review Template',
    mode: 'code',
    content: 'Review the following code for best practices',
  },
  {
    id: 'template-2',
    name: 'Learning Template',
    mode: 'learning',
    content: 'Explain the concept in simple terms',
  },
];

export const mockSuggestions = [
  {
    type: 'enhancement',
    text: 'Consider adding error handling',
    position: 50,
  },
  {
    type: 'improvement',
    text: 'Add more specific context',
    position: 100,
  },
];

export const testUsers = {
  valid: {
    apiKey: 'test-api-key-valid',
    email: 'test@example.com',
  },
  invalid: {
    apiKey: 'invalid-key',
    email: 'invalid@example.com',
  },
};

export const errorMessages = {
  emptyPrompt: 'Prompt is required',
  invalidMode: 'Mode must be one of',
  networkError: 'Network error',
  authError: 'Authentication failed',
  rateLimitError: 'Rate limit exceeded',
};

export const selectors = {
  // Prompt Builder
  promptInput: '[data-testid="prompt-input"], textarea[name="prompt"]',
  modeSelector: '[data-testid="mode-selector"], select[name="mode"]',
  submitButton: '[data-testid="submit-button"], button[type="submit"]',
  clearButton: '[data-testid="clear-button"]',

  // Results
  resultContainer: '[data-testid="result-container"]',
  enhancedPrompt: '[data-testid="enhanced-prompt"]',
  aiResponse: '[data-testid="ai-response"]',

  // Templates
  templateSelector: '[data-testid="template-selector"]',
  templateOption: '[data-testid="template-option"]',

  // Settings
  settingsButton: '[data-testid="settings-button"]',
  settingsModal: '[data-testid="settings-modal"]',
  apiKeyInput: '[data-testid="api-key-input"]',

  // History
  historyButton: '[data-testid="history-button"]',
  historySidebar: '[data-testid="history-sidebar"]',
  historyItem: '[data-testid="history-item"]',

  // Notifications
  toast: '[role="alert"], .toast, [data-testid="toast"]',
  errorMessage: '[data-testid="error-message"]',

  // Loading states
  loadingSpinner: '[data-testid="loading-spinner"]',
  loadingOverlay: '[data-testid="loading-overlay"]',
};

export const apiEndpoints = {
  enhance: '/api/enhance-prompt',
  suggestions: '/api/suggestions',
  templates: '/api/templates',
  health: '/api/health',
  metrics: '/metrics',
};

export const testTimeouts = {
  short: 1000,
  medium: 5000,
  long: 10000,
  apiCall: 15000,
};
