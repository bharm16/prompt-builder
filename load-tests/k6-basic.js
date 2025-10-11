import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

/**
 * K6 Load Test - Basic Scenario
 *
 * Tests all API endpoints under normal load
 * Validates cache performance and response times
 *
 * Run with:
 * k6 run load-tests/k6-basic.js
 *
 * Or with different stages:
 * k6 run --vus 10 --duration 30s load-tests/k6-basic.js
 */

// Custom metrics
const cacheHitRate = new Rate('cache_hit_rate');
const apiErrors = new Counter('api_errors');
const requestDuration = new Trend('request_duration_ms');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 10 }, // Stay at 10 users
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 20 }, // Stay at 20 users
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% of requests under 5s
    http_req_failed: ['rate<0.1'], // Less than 10% errors
    cache_hit_rate: ['rate>0.3'], // At least 30% cache hits
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Sample prompts for testing
const testPrompts = [
  'Write a technical blog post about microservices architecture',
  'Explain quantum computing to a 10-year-old',
  'Create a marketing campaign for eco-friendly products',
  'Design a REST API for a todo application',
  'Analyze the impact of AI on healthcare',
];

const testModes = ['reasoning', 'research', 'socratic', 'default'];

export default function () {
  const prompt = testPrompts[Math.floor(Math.random() * testPrompts.length)];
  const mode = testModes[Math.floor(Math.random() * testModes.length)];

  // Test 1: Health check (fast path)
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
  });

  // Test 2: Prompt optimization (main endpoint)
  const optimizePayload = JSON.stringify({
    prompt: prompt,
    mode: mode,
    context: {
      specificAspects: 'Focus on practical examples',
      backgroundLevel: 'intermediate',
      intendedUse: 'professional development',
    },
  });

  const optimizeRes = http.post(`${BASE_URL}/api/optimize`, optimizePayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const isSuccess = check(optimizeRes, {
    'optimize status is 200': (r) => r.status === 200,
    'optimize has optimizedPrompt': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.optimizedPrompt && body.optimizedPrompt.length > 0;
      } catch (e) {
        return false;
      }
    },
    'optimize response time < 10s': (r) => r.timings.duration < 10000,
  });

  if (!isSuccess) {
    apiErrors.add(1);
  }

  requestDuration.add(optimizeRes.timings.duration);

  // Detect cache hit (response time < 1s indicates cache hit)
  if (optimizeRes.timings.duration < 1000 && optimizeRes.status === 200) {
    cacheHitRate.add(1);
  } else {
    cacheHitRate.add(0);
  }

  // Test 3: Generate questions (lighter endpoint)
  const questionsPayload = JSON.stringify({
    prompt: prompt,
  });

  const questionsRes = http.post(
    `${BASE_URL}/api/generate-questions`,
    questionsPayload,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(questionsRes, {
    'questions status is 200': (r) => r.status === 200,
    'questions has questions array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.questions) && body.questions.length > 0;
      } catch (e) {
        return false;
      }
    },
  });

  // Test 4: Metrics endpoint (observability check)
  if (Math.random() < 0.1) {
    // Only 10% of users check metrics
    const metricsRes = http.get(`${BASE_URL}/metrics`);
    check(metricsRes, {
      'metrics endpoint accessible': (r) => r.status === 200,
    });
  }

  // Realistic user think time between requests
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data),
  };
}

function textSummary(data) {
  const {
    metrics,
    root_group: { checks },
  } = data;

  let summary = '\n=== Load Test Summary ===\n\n';

  // Request stats
  summary += `Total Requests: ${metrics.http_reqs.values.count}\n`;
  summary += `Request Rate: ${metrics.http_reqs.values.rate.toFixed(2)} req/s\n`;
  summary += `Failed Requests: ${metrics.http_req_failed.values.passes || 0}\n\n`;

  // Response times
  summary += `Response Time (avg): ${metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += `Response Time (p95): ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `Response Time (p99): ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
  summary += `Response Time (max): ${metrics.http_req_duration.values.max.toFixed(2)}ms\n\n`;

  // Custom metrics
  if (metrics.cache_hit_rate) {
    summary += `Cache Hit Rate: ${(metrics.cache_hit_rate.values.rate * 100).toFixed(2)}%\n`;
  }

  if (metrics.api_errors) {
    summary += `API Errors: ${metrics.api_errors.values.count}\n`;
  }

  // Checks
  const checksTotal = Object.keys(checks).length;
  const checksPassed = Object.values(checks).filter((c) => c.passes > 0).length;
  summary += `\nChecks Passed: ${checksPassed}/${checksTotal}\n`;

  return summary;
}
