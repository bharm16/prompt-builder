import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

/**
 * K6 Load Test - Stress Test Scenario
 *
 * Tests system under high load to identify breaking points
 * Focus on concurrent requests and cache effectiveness
 *
 * Run with:
 * k6 run load-tests/k6-stress.js
 */

const cacheHitRate = new Rate('cache_hit_rate');
const apiErrors = new Counter('api_errors');
const coalescingBenefit = new Rate('coalescing_benefit');

export const options = {
  stages: [
    { duration: '1m', target: 50 }, // Ramp up to 50 users
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '3m', target: 100 }, // Stay at 100 users
    { duration: '1m', target: 150 }, // Spike to 150 users
    { duration: '2m', target: 150 }, // Hold spike
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<10000'], // 95% under 10s (relaxed for stress)
    http_req_failed: ['rate<0.2'], // Less than 20% errors under stress
    cache_hit_rate: ['rate>0.5'], // At least 50% cache hits
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Limited set of prompts to test request coalescing
const testPrompts = [
  'Explain the principles of microservices architecture',
  'Write a guide to machine learning for beginners',
  'Create a content strategy for B2B SaaS companies',
];

export default function () {
  // Use same prompt frequently to test coalescing
  const prompt = testPrompts[Math.floor(Math.random() * testPrompts.length)];
  const mode = 'reasoning';

  // Send identical requests concurrently to test coalescing
  const payload = JSON.stringify({
    prompt: prompt,
    mode: mode,
    context: {
      specificAspects: 'Focus on best practices',
      backgroundLevel: 'intermediate',
    },
  });

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/api/optimize`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  const duration = Date.now() - startTime;

  const isSuccess = check(res, {
    'status is 200 or 429 (rate limited)': (r) =>
      r.status === 200 || r.status === 429,
    'has valid response': (r) => {
      if (r.status === 429) return true; // Rate limited is expected under stress
      try {
        const body = JSON.parse(r.body);
        return body.optimizedPrompt && body.optimizedPrompt.length > 0;
      } catch (e) {
        return false;
      }
    },
  });

  if (!isSuccess && res.status !== 429) {
    apiErrors.add(1);
  }

  // Cache hit detection (< 1s response)
  if (duration < 1000 && res.status === 200) {
    cacheHitRate.add(1);
    coalescingBenefit.add(1); // Fast response likely from cache or coalescing
  } else {
    cacheHitRate.add(0);
    coalescingBenefit.add(0);
  }

  // Minimal sleep to maximize concurrent load
  sleep(0.1);
}

export function handleSummary(data) {
  console.log('\n=== Stress Test Summary ===\n');
  console.log(`Total Requests: ${data.metrics.http_reqs.values.count}`);
  console.log(
    `Failed Requests: ${data.metrics.http_req_failed.values.passes || 0}`
  );
  console.log(
    `Avg Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`
  );
  console.log(
    `P95 Response Time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`
  );
  console.log(
    `Max Response Time: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms`
  );

  if (data.metrics.cache_hit_rate) {
    console.log(
      `Cache Hit Rate: ${(data.metrics.cache_hit_rate.values.rate * 100).toFixed(2)}%`
    );
  }

  if (data.metrics.coalescing_benefit) {
    console.log(
      `Fast Response Rate: ${(data.metrics.coalescing_benefit.values.rate * 100).toFixed(2)}%`
    );
  }

  return {
    'stress-test-results.json': JSON.stringify(data, null, 2),
  };
}
