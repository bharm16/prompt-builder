# Load Testing Guide

This directory contains load testing scripts for the Prompt Builder API.

## Prerequisites

### Install k6

#### macOS
```bash
brew install k6
```

#### Linux
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

#### Windows
```bash
choco install k6
```

#### Docker
```bash
docker pull grafana/k6
```

## Available Tests

### 1. Basic Load Test (`k6-basic.js`)

**Purpose:** Tests all API endpoints under normal load conditions.

**Characteristics:**
- 10-20 concurrent users
- All endpoints tested
- Realistic user behavior (think time)
- Cache hit rate validation

**Run:**
```bash
k6 run load-tests/k6-basic.js
```

**Expected Results:**
- Request rate: 5-10 req/s
- P95 response time: <5s
- Error rate: <10%
- Cache hit rate: >30%

**Duration:** ~4 minutes

---

### 2. Stress Test (`k6-stress.js`)

**Purpose:** Tests system under high load to identify breaking points.

**Characteristics:**
- 50-150 concurrent users
- Spike testing
- Request coalescing validation
- Rate limiting validation

**Run:**
```bash
k6 run load-tests/k6-stress.js
```

**Expected Results:**
- Request rate: 50-100 req/s
- P95 response time: <10s
- Error rate: <20%
- Cache hit rate: >50%
- Coalescing rate: >20%

**Duration:** ~11 minutes

---

## Running Tests

### Basic Usage

```bash
# Run basic test
k6 run load-tests/k6-basic.js

# Run stress test
k6 run load-tests/k6-stress.js

# With custom base URL
k6 run --env BASE_URL=http://staging:3001 load-tests/k6-basic.js

# With custom VUs and duration
k6 run --vus 10 --duration 30s load-tests/k6-basic.js
```

### Docker Usage

```bash
# Run with Docker
docker run --rm -v $(pwd)/load-tests:/scripts grafana/k6 run /scripts/k6-basic.js

# With custom parameters
docker run --rm -v $(pwd)/load-tests:/scripts grafana/k6 run \
  --vus 20 --duration 1m \
  --env BASE_URL=http://host.docker.internal:3001 \
  /scripts/k6-basic.js
```

### Cloud Testing (k6 Cloud)

```bash
# Login to k6 Cloud
k6 login cloud

# Run test in cloud
k6 cloud load-tests/k6-basic.js

# View results
# Visit: https://app.k6.io
```

---

## Understanding Results

### Metrics

#### Request Metrics
- `http_reqs`: Total number of requests
- `http_req_duration`: Response time distribution
- `http_req_failed`: Failed request rate
- `http_req_waiting`: Time to first byte

#### Custom Metrics
- `cache_hit_rate`: Percentage of requests served from cache
- `api_errors`: Number of API errors (not rate limited)
- `request_duration_ms`: Custom request duration tracking
- `coalescing_benefit`: Fast response rate (cache + coalescing)

### Response Time Percentiles

- **P50 (Median):** 50% of requests faster than this
- **P95:** 95% of requests faster than this (key SLO metric)
- **P99:** 99% of requests faster than this
- **Max:** Slowest request

### Success Criteria

#### Basic Test
```
✓ http_req_duration (p95) < 5000ms
✓ http_req_failed < 10%
✓ cache_hit_rate > 30%
✓ checks passed > 90%
```

#### Stress Test
```
✓ http_req_duration (p95) < 10000ms
✓ http_req_failed < 20%
✓ cache_hit_rate > 50%
✓ coalescing_benefit > 20%
```

---

## Interpreting Results

### Good Performance
```
✓ checks.........................: 95.00%  (950/1000)
✓ http_req_duration.............: avg=2.5s p(95)=4.2s max=8.5s
✓ http_req_failed...............: 2.00%   (20/1000)
✓ cache_hit_rate................: 55.00%
✓ http_reqs.....................: 1000    16.6/s
```

**Indicators:**
- High check pass rate (>90%)
- P95 under threshold
- Low error rate
- Good cache hit rate

### Performance Issues
```
✗ checks.........................: 75.00%  (750/1000)
✗ http_req_duration.............: avg=8.5s p(95)=15.2s max=30s
✗ http_req_failed...............: 15.00%  (150/1000)
✗ cache_hit_rate................: 20.00%
✗ http_reqs.....................: 1000    8.3/s
```

**Problems:**
- Low check pass rate - validation failures
- High P95 - slow responses
- High error rate - system overloaded
- Low cache hit rate - caching not effective

### Rate Limited
```
⚠ checks.........................: 60.00%  (600/1000)
⚠ http_req_duration.............: avg=1.2s p(95)=2.5s max=5s
✓ http_req_failed (rate limited): 40.00%  (400/1000 with 429)
✗ http_reqs.....................: 1000    50/s
```

**Indicators:**
- Many 429 (Too Many Requests) responses
- Actual response times good for non-limited requests
- Rate limiter working as expected

---

## Troubleshooting

### Issue: All requests failing

**Symptoms:**
```
✗ http_req_failed...............: 100.00%
```

**Possible Causes:**
1. Server not running
2. Wrong base URL
3. Network issues

**Solutions:**
```bash
# Check server is running
curl http://localhost:3001/health

# Verify base URL
k6 run --env BASE_URL=http://localhost:3001 load-tests/k6-basic.js

# Check server logs
tail -f logs/server.log
```

---

### Issue: Low cache hit rate

**Symptoms:**
```
✗ cache_hit_rate................: 10.00%
```

**Possible Causes:**
1. Cache disabled or cleared
2. High variation in requests
3. Cache TTL too short

**Solutions:**
```bash
# Check cache stats
curl http://localhost:3001/stats | jq '.cache'

# Increase cache TTL in config
# Verify cache is working
curl -X POST http://localhost:3001/api/optimize \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "test", "mode": "reasoning"}'

# Request again (should be faster)
```

---

### Issue: High error rate

**Symptoms:**
```
✗ http_req_failed...............: 25.00%
✗ Circuit breaker OPEN
```

**Possible Causes:**
1. Claude API issues
2. Rate limiting
3. System overload

**Solutions:**
```bash
# Check circuit breaker status
curl http://localhost:3001/stats | jq '.circuitBreaker'

# Check Claude API health
curl http://localhost:3001/health/ready

# Reduce load
k6 run --vus 5 --duration 30s load-tests/k6-basic.js

# Check logs
tail -f logs/server.log | grep ERROR
```

---

## Custom Test Development

### Basic Template

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  const res = http.get('http://localhost:3001/health');

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
```

### Advanced Template with Custom Metrics

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// Custom metrics
const myCounter = new Counter('my_custom_counter');
const myTrend = new Trend('my_custom_trend');
const myRate = new Rate('my_custom_rate');

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 20 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'my_custom_trend': ['p(95)<5000'],
    'my_custom_rate': ['rate>0.9'],
  },
};

export default function () {
  const startTime = Date.now();

  const res = http.post('http://localhost:3001/api/optimize',
    JSON.stringify({
      prompt: 'test prompt',
      mode: 'reasoning',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const duration = Date.now() - startTime;

  // Record custom metrics
  myCounter.add(1);
  myTrend.add(duration);
  myRate.add(res.status === 200);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
```

---

## Best Practices

### 1. Gradual Load Increase
```javascript
stages: [
  { duration: '30s', target: 10 },  // Warm-up
  { duration: '1m', target: 10 },   // Steady
  { duration: '30s', target: 20 },  // Ramp up
  { duration: '1m', target: 20 },   // Hold
  { duration: '30s', target: 0 },   // Cool down
]
```

### 2. Realistic User Behavior
```javascript
// Random think time
sleep(Math.random() * 2 + 1); // 1-3 seconds

// Random endpoint selection
const endpoints = ['/api/optimize', '/api/generate-questions'];
const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
```

### 3. Validate Responses
```javascript
check(res, {
  'status is 200': (r) => r.status === 200,
  'response time < 5s': (r) => r.timings.duration < 5000,
  'has valid body': (r) => {
    try {
      const body = JSON.parse(r.body);
      return body.optimizedPrompt !== undefined;
    } catch (e) {
      return false;
    }
  },
});
```

### 4. Monitor System Resources
```bash
# In another terminal during test
watch -n 1 'curl -s http://localhost:3001/stats | jq'

# Or use monitoring dashboard
# Open Grafana: http://localhost:3000
```

---

## Continuous Integration

### GitHub Actions Example

```yaml
name: Load Tests

on:
  schedule:
    - cron: '0 0 * * *' # Daily
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Start server
        run: |
          npm install
          npm start &
          sleep 10

      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run load tests
        run: k6 run load-tests/k6-basic.js

      - name: Upload results
        uses: actions/upload-artifact@v2
        with:
          name: load-test-results
          path: load-test-results.json
```

---

## Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Examples](https://github.com/grafana/k6-examples)
- [k6 Cloud](https://app.k6.io)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/performance-testing/)
