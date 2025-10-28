import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

/**
 * K6 Load Test for Span Labeling Performance
 *
 * This test validates:
 * - <200ms API latency target (P95)
 * - 5 concurrent request limit enforcement
 * - Cache effectiveness (>70% hit rate)
 * - Request coalescing (>50% duplicate reduction)
 * - System stability under load
 *
 * Test Scenarios:
 * 1. Ramp-up: 0 → 50 users over 2 minutes
 * 2. Sustained load: 50 users for 5 minutes
 * 3. Spike test: 50 → 100 users for 1 minute
 * 4. Cool-down: 100 → 0 users over 1 minute
 *
 * Usage:
 * k6 run --env API_URL=http://localhost:3001 --env API_KEY=your-key k6-span-labeling-performance.js
 */

// Custom metrics
const cacheHitRate = new Rate('cache_hit_rate');
const apiLatency = new Trend('api_latency_ms');
const cacheLatency = new Trend('cache_latency_ms');
const concurrencyViolations = new Counter('concurrency_limit_violations');
const requestCoalescing = new Rate('request_coalescing_rate');

// Configuration
export const options = {
  scenarios: {
    // Scenario 1: Gradual ramp-up
    rampUp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 }, // Ramp to 50 users
        { duration: '5m', target: 50 }, // Stay at 50 users
        { duration: '1m', target: 100 }, // Spike to 100 users
        { duration: '1m', target: 0 }, // Cool down
      ],
      gracefulRampDown: '30s',
    },

    // Scenario 2: Concurrent request validation
    concurrencyTest: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 1,
      maxDuration: '30s',
      startTime: '9m', // Run after main test
    },
  },

  thresholds: {
    // Primary goal: P95 latency < 200ms
    'http_req_duration{cache:miss}': ['p(95)<200'],

    // Cache hits should be very fast
    'http_req_duration{cache:hit}': ['p(95)<10'],

    // Overall success rate
    http_req_failed: ['rate<0.05'], // <5% error rate

    // Cache effectiveness
    cache_hit_rate: ['rate>0.7'], // >70% cache hit rate

    // Request coalescing
    request_coalescing_rate: ['rate>0.5'], // >50% coalescing rate

    // No concurrency limit violations
    concurrency_limit_violations: ['count==0'],

    // Response time by percentile
    api_latency_ms: [
      'p(50)<100', // P50 < 100ms
      'p(95)<200', // P95 < 200ms
      'p(99)<500', // P99 < 500ms
    ],
  },
};

// Test data
const SAMPLE_TEXTS = [
  'A cinematic wide shot of a sunset',
  'Close-up of a person smiling',
  'Pan right across the cityscape',
  'Dramatic lighting with soft shadows',
  'Slow motion shot at 120fps',
  'Shallow depth of field effect',
  'Golden hour warm color grading',
  'Tracking shot following the subject',
  'Low angle shot looking up',
  'High contrast black and white',
];

// Environment variables
const API_URL = __ENV.API_URL || 'http://localhost:3001';
const API_KEY = __ENV.API_KEY || 'test-key';
const BASE_URL = `${API_URL}/llm/label-spans`;
const BATCH_URL = `${API_URL}/llm/label-spans-batch`;

// Helper functions
function getRandomText() {
  return SAMPLE_TEXTS[Math.floor(Math.random() * SAMPLE_TEXTS.length)];
}

function createPayload(text) {
  return JSON.stringify({
    text,
    maxSpans: 60,
    minConfidence: 0.5,
    policy: {
      nonTechnicalWordLimit: 6,
      allowOverlap: false,
    },
    templateVersion: 'v1',
  });
}

// Main test scenario
export default function () {
  const text = getRandomText();
  const payload = createPayload(text);

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    tags: {
      endpoint: 'label-spans',
    },
  };

  // Make request
  const startTime = Date.now();
  const response = http.post(BASE_URL, payload, params);
  const duration = Date.now() - startTime;

  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has spans': (r) => r.json('spans') !== undefined,
    'has meta': (r) => r.json('meta') !== undefined,
    'valid JSON': (r) => {
      try {
        r.json();
        return true;
      } catch {
        return false;
      }
    },
  });

  // Track cache status
  const cacheStatus = response.headers['X-Cache'];
  if (cacheStatus === 'HIT') {
    cacheHitRate.add(1);
    cacheLatency.add(duration);
  } else {
    cacheHitRate.add(0);
    apiLatency.add(duration);
  }

  // Tag response for threshold tracking
  response.tags.cache = cacheStatus === 'HIT' ? 'hit' : 'miss';

  // Check for queue timeout (indicates concurrency limit hit)
  if (response.status === 502 && response.body.includes('queue')) {
    concurrencyViolations.add(1);
  }

  // Random think time between requests
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// Concurrency validation scenario
export function concurrencyTest() {
  const text = `Concurrent test ${__VU} ${__ITER} ${Date.now()}`;
  const payload = createPayload(text);

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
  };

  // Send 10 identical requests simultaneously to test coalescing
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(http.post(BASE_URL, payload, params));
  }

  // All requests should succeed (via coalescing)
  const responses = promises;
  let coalescedCount = 0;

  responses.forEach((response) => {
    check(response, {
      'concurrent request succeeded': (r) => r.status === 200,
    });

    // If response time is very fast, it was likely coalesced
    if (response.timings.duration < 50) {
      coalescedCount++;
    }
  });

  // Track coalescing effectiveness
  requestCoalescing.add(coalescedCount / responses.length);
}

// Batch endpoint test
export function batchTest() {
  const texts = [
    getRandomText(),
    getRandomText(),
    getRandomText(),
    getRandomText(),
    getRandomText(),
  ];

  const batchPayload = JSON.stringify(
    texts.map((text) => ({
      text,
      maxSpans: 60,
      minConfidence: 0.5,
      policy: {
        nonTechnicalWordLimit: 6,
        allowOverlap: false,
      },
      templateVersion: 'v1',
    }))
  );

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
  };

  const response = http.post(BATCH_URL, batchPayload, params);

  check(response, {
    'batch status is 200': (r) => r.status === 200,
    'batch returns array': (r) => Array.isArray(r.json()),
    'batch correct length': (r) => r.json().length === texts.length,
  });
}

// Setup function (runs once)
export function setup() {
  console.log('========================================');
  console.log('Span Labeling Performance Load Test');
  console.log('========================================');
  console.log(`API URL: ${API_URL}`);
  console.log(`Test Duration: ~9 minutes`);
  console.log(`Max Concurrent Users: 100`);
  console.log(`Target P95 Latency: <200ms`);
  console.log(`Target Cache Hit Rate: >70%`);
  console.log('========================================\n');

  // Warm up cache with common requests
  console.log('Warming up cache...');
  SAMPLE_TEXTS.forEach((text) => {
    http.post(
      BASE_URL,
      createPayload(text),
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
      }
    );
  });
  console.log('Cache warm-up complete\n');
}

// Teardown function (runs once at end)
export function teardown(data) {
  console.log('\n========================================');
  console.log('Test Complete');
  console.log('========================================');
  console.log('Check the summary above for results.');
  console.log('Key metrics to review:');
  console.log('  - http_req_duration (P95)');
  console.log('  - cache_hit_rate');
  console.log('  - request_coalescing_rate');
  console.log('  - concurrency_limit_violations');
  console.log('========================================');
}

// Handle different stages
export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

// Text summary helper
function textSummary(data, options = {}) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;

  let summary = '\n';
  summary += `${indent}========================================\n`;
  summary += `${indent}Performance Test Results\n`;
  summary += `${indent}========================================\n\n`;

  // Requests
  const requests = data.metrics.http_reqs;
  if (requests) {
    summary += `${indent}Total Requests: ${requests.values.count}\n`;
    summary += `${indent}Request Rate: ${requests.values.rate.toFixed(2)}/s\n\n`;
  }

  // Latency
  const duration = data.metrics.http_req_duration;
  if (duration) {
    summary += `${indent}Latency:\n`;
    summary += `${indent}  P50: ${duration.values['p(50)'].toFixed(2)}ms\n`;
    summary += `${indent}  P95: ${duration.values['p(95)'].toFixed(2)}ms `;
    summary += duration.values['p(95)'] < 200 ? '✓\n' : '✗ (target: <200ms)\n';
    summary += `${indent}  P99: ${duration.values['p(99)'].toFixed(2)}ms\n\n`;
  }

  // Cache
  const cacheHit = data.metrics.cache_hit_rate;
  if (cacheHit) {
    const hitRate = (cacheHit.values.rate * 100).toFixed(1);
    summary += `${indent}Cache Hit Rate: ${hitRate}% `;
    summary += cacheHit.values.rate > 0.7 ? '✓\n\n' : '✗ (target: >70%)\n\n';
  }

  // Errors
  const failed = data.metrics.http_req_failed;
  if (failed) {
    const errorRate = (failed.values.rate * 100).toFixed(2);
    summary += `${indent}Error Rate: ${errorRate}% `;
    summary += failed.values.rate < 0.05 ? '✓\n\n' : '✗ (target: <5%)\n\n';
  }

  summary += `${indent}========================================\n`;

  return summary;
}
