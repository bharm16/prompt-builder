/**
 * API Configuration
 *
 * Centralized configuration for all API-related settings
 * Makes it easy to change API endpoints, keys, timeouts, etc.
 */

const ENV = import.meta.env.MODE || 'development';

export const API_CONFIG = {
  // Base URLs
  baseURL: import.meta.env.VITE_API_URL || '/api',

  // API Keys
  apiKey: import.meta.env.VITE_API_KEY || 'dev-key-12345',

  // Timeouts (in milliseconds)
  timeout: {
    default: 30000,  // 30 seconds
    optimization: 60000,  // 60 seconds for prompt optimization
    suggestions: 3000,  // 3 seconds for suggestions (Requirement 3.5)
  },

  // Debounce configuration (in milliseconds)
  debounce: {
    suggestions: 150,  // 150ms debounce for suggestion requests (Requirement 4.3)
  },

  // Retry configuration
  retry: {
    enabled: ENV === 'production',
    maxRetries: 3,
    retryDelay: 1000,  // 1 second
    retryableStatuses: [408, 429, 500, 502, 503, 504],
  },

  // Cache configuration
  cache: {
    suggestions: {
      enabled: true,
      ttl: 300000,  // 5 minutes
    },
  },

  // Rate limiting
  rateLimit: {
    suggestions: {
      minInterval: 500,  // Minimum 500ms between calls
    },
  },
} as const;

type ServiceName = 'optimization' | 'suggestions' | 'default';

interface ServiceConfig {
  timeout?: number;
  retry?: typeof API_CONFIG.retry;
  cache?: typeof API_CONFIG.cache.suggestions;
  rateLimit?: typeof API_CONFIG.rateLimit.suggestions;
  debounce?: number;
}

/**
 * Get API configuration for a specific service
 */
export function getAPIConfig(service: ServiceName): ServiceConfig {
  const configs: Record<ServiceName, ServiceConfig> = {
    optimization: {
      timeout: API_CONFIG.timeout.optimization,
      retry: API_CONFIG.retry,
    },
    suggestions: {
      timeout: API_CONFIG.timeout.suggestions,
      cache: API_CONFIG.cache.suggestions,
      rateLimit: API_CONFIG.rateLimit.suggestions,
      debounce: API_CONFIG.debounce.suggestions,
    },
    default: {
      timeout: API_CONFIG.timeout.default,
      retry: API_CONFIG.retry,
    },
  };

  return configs[service] || configs.default;
}

