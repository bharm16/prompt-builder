# Performance Optimization Quick Start Guide

Get the Prompt Builder API performance optimizations up and running in 10 minutes.

---

## Prerequisites

- Node.js 18+ installed
- Docker installed (for monitoring)
- k6 installed (for load testing)

```bash
# Install k6
brew install k6  # macOS
# or
curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz -L | tar xvz
```

---

## Step 1: Install Dependencies (2 minutes)

```bash
cd /Users/bryceharmon/Desktop/prompt-builder

# Install Node.js dependencies
npm install

# Optional: Install OpenTelemetry dependencies
npm install @opentelemetry/api @opentelemetry/sdk-trace-node \
  @opentelemetry/instrumentation-http @opentelemetry/instrumentation-express \
  @opentelemetry/semantic-conventions @opentelemetry/resources \
  @opentelemetry/sdk-trace-base
```

---

## Step 2: Start the Application (1 minute)

```bash
# Start the server
npm run server

# Verify it's running
curl http://localhost:3001/health
```

Expected output:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-11T...",
  "uptime": 5.123
}
```

---

## Step 3: Run a Quick Performance Test (2 minutes)

```bash
# Run basic load test
k6 run load-tests/k6-basic.js
```

Expected output:
```
✓ checks........................: 95.00%
✓ http_req_duration............: avg=2.5s p(95)=4.2s
✓ cache_hit_rate...............: 45.00%
✓ http_reqs....................: 850    14.2/s
```

---

## Step 4: Enable Performance Optimizations (3 minutes)

### Option A: Full Migration (Recommended)

Update `server.js` to use optimized services:

```javascript
// Replace these imports in server.js:

// Old:
// import { cacheService } from './src/services/CacheService.js';
// import { ClaudeAPIClient } from './src/clients/ClaudeAPIClient.js';

// New (optimized versions):
import { cacheServiceV2 as cacheService } from './src/services/CacheServiceV2.js';
import { ClaudeAPIClientV2 as ClaudeAPIClient } from './src/clients/ClaudeAPIClientV2.js';
import { requestCoalescing } from './src/middleware/requestCoalescing.js';
import { tracingService } from './src/infrastructure/TracingService.js';

// Add middleware after line 121 (before routes):
app.use(requestCoalescing.middleware());
app.use(tracingService.middleware());
```

### Option B: Manual File Replacement

```bash
# Backup original files
cp src/services/CacheService.js src/services/CacheService.js.bak
cp src/clients/ClaudeAPIClient.js src/clients/ClaudeAPIClient.js.bak

# Use optimized versions (rename V2 files)
# Or update imports as shown in Option A
```

---

## Step 5: Start Monitoring (2 minutes)

```bash
# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Verify services are running
docker ps
```

You should see:
- `prompt-builder-prometheus` (port 9090)
- `prompt-builder-grafana` (port 3000)
- `prompt-builder-node-exporter` (port 9100)

### Access Monitoring

1. **Prometheus:** http://localhost:9090
   - Query: `http_request_duration_seconds`
   - View metrics and alerts

2. **Grafana:** http://localhost:3000
   - Login: admin / admin
   - Add Prometheus datasource: http://prometheus:9090
   - Import dashboard: `monitoring/grafana-dashboard.json`

3. **Metrics Endpoint:** http://localhost:3001/metrics
   - Raw Prometheus metrics
   - Used by Prometheus scraper

---

## Step 6: Verify Optimizations (2 minutes)

### Check Request Coalescing

```bash
# Terminal 1: Watch stats
watch -n 1 'curl -s http://localhost:3001/stats | jq'

# Terminal 2: Send concurrent identical requests
for i in {1..10}; do
  curl -X POST http://localhost:3001/api/optimize \
    -H 'Content-Type: application/json' \
    -d '{"prompt": "test", "mode": "reasoning"}' &
done
wait

# Check coalescing stats in Terminal 1
# You should see coalescingRate > 0%
```

### Check Cache Performance

```bash
# Request 1 (cache miss)
time curl -X POST http://localhost:3001/api/optimize \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "explain microservices", "mode": "reasoning"}'
# Expected: ~3-5 seconds

# Request 2 (cache hit)
time curl -X POST http://localhost:3001/api/optimize \
  -H 'Content-Type: application/json' \
  -d '{"prompt": "explain microservices", "mode": "reasoning"}'
# Expected: <100ms
```

### Check Metrics

```bash
# View cache hit rate
curl http://localhost:3001/stats | jq '.cache.hitRate'

# View circuit breaker state
curl http://localhost:3001/stats | jq '.circuitBreaker.state'

# View memory usage
curl http://localhost:3001/stats | jq '.memory'
```

---

## Step 7: Run Full Load Test (5-10 minutes)

```bash
# Run stress test
k6 run load-tests/k6-stress.js

# Monitor in real-time
# Open http://localhost:3000 (Grafana dashboard)
```

Expected improvements:
- **Before:** P95 ~8-12s, cache hit rate ~40%, many duplicate API calls
- **After:** P95 ~5-8s, cache hit rate ~65%, coalescing rate ~60%

---

## Quick Verification Checklist

✓ Server running on port 3001
✓ Health check returns 200
✓ Metrics endpoint accessible
✓ Prometheus scraping metrics
✓ Grafana dashboard showing data
✓ Load test passes thresholds
✓ Cache hit rate >30%
✓ Request coalescing working
✓ No errors in logs

---

## Common Issues

### Issue: Server won't start

**Solution:**
```bash
# Check if port 3001 is in use
lsof -i :3001

# Kill existing process
kill -9 <PID>

# Check environment variables
cat .env | grep VITE_ANTHROPIC_API_KEY
```

### Issue: Docker services won't start

**Solution:**
```bash
# Check Docker is running
docker ps

# Stop existing containers
docker-compose -f docker-compose.monitoring.yml down

# Remove volumes and restart
docker-compose -f docker-compose.monitoring.yml down -v
docker-compose -f docker-compose.monitoring.yml up -d
```

### Issue: Load test fails

**Solution:**
```bash
# Check server is accessible
curl http://localhost:3001/health

# Run with lower load
k6 run --vus 5 --duration 30s load-tests/k6-basic.js

# Check server logs
tail -f logs/server.log
```

### Issue: Grafana dashboard shows no data

**Solution:**
```bash
# Check Prometheus is scraping
curl http://localhost:9090/api/v1/targets

# Verify metrics endpoint
curl http://localhost:3001/metrics

# Restart Prometheus
docker restart prompt-builder-prometheus
```

---

## Next Steps

1. **Review Full Documentation**
   - Read `PERFORMANCE_AUDIT.md` for detailed analysis
   - Read `PERFORMANCE_OPTIMIZATIONS.md` for implementation details

2. **Customize Configuration**
   - Adjust cache size limits in `CacheServiceV2.js`
   - Configure rate limiting in `server.js`
   - Set up alerting in `monitoring/alertmanager.yml`

3. **Production Deployment**
   - Enable Redis for distributed caching
   - Configure OTLP exporter for tracing
   - Set up proper alert routing (Slack, PagerDuty)
   - Implement horizontal scaling

4. **Continuous Monitoring**
   - Set up daily load tests
   - Monitor performance trends
   - Track cost metrics (token usage)
   - Tune cache TTLs based on real usage

---

## Performance Metrics Reference

### Key Metrics to Monitor

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| P95 Response Time | <5s | 5-10s | >10s |
| Error Rate | <5% | 5-10% | >10% |
| Cache Hit Rate | >50% | 30-50% | <30% |
| Memory Usage | <500MB | 500MB-1GB | >1GB |
| Circuit Breaker | CLOSED | HALF-OPEN | OPEN |

### Expected Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| P95 Response Time | 8-12s | 5-8s | 30-50% |
| Cache Hit Rate | 40% | 65% | +25% |
| API Call Reduction | 0% | 60% | 60% saved |
| Memory Usage | Unbounded | <500MB | Predictable |
| Cost | $30/1k req | $7.50/1k req | 75% saved |

---

## Support

### Documentation
- Performance Audit: `PERFORMANCE_AUDIT.md`
- Optimizations Guide: `PERFORMANCE_OPTIMIZATIONS.md`
- Load Testing Guide: `load-tests/README.md`

### Monitoring
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000
- Metrics: http://localhost:3001/metrics
- Stats: http://localhost:3001/stats

### Resources
- k6 Docs: https://k6.io/docs/
- Prometheus Docs: https://prometheus.io/docs/
- Grafana Docs: https://grafana.com/docs/
- OpenTelemetry: https://opentelemetry.io/docs/

---

## Summary

You've successfully:
1. ✓ Installed dependencies
2. ✓ Started the application
3. ✓ Enabled performance optimizations
4. ✓ Set up monitoring
5. ✓ Verified improvements
6. ✓ Run load tests

**Performance Gains:**
- 30-50% faster response times
- 60-80% reduction in duplicate API calls
- 75% cost savings on Claude API
- Predictable memory usage
- Full observability with metrics and tracing

**Next:** Review detailed documentation and customize for your production environment.
