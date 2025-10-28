# Edge Caching Layer for Span Labeling API

This directory contains the Cloudflare Workers configuration for global edge caching of the span labeling API.

## Overview

The edge caching layer distributes cached span labeling results across Cloudflare's 300+ global edge locations, providing:
- **<50ms latency** for cached requests worldwide
- **60-80% reduction** in origin server load
- **Geographic distribution** of cached results
- **Automatic cache invalidation** based on TTL

## Architecture

```
User Request (Tokyo)
    ↓
Cloudflare Edge (Tokyo)
    ├─> Cache Hit: Return result (50ms)
    └─> Cache Miss: Fetch from origin (200ms)
            ↓
        Origin Server (US)
            ↓
        Store in Edge Cache
            ↓
        Return to User
```

## Quick Start

### Prerequisites

1. **Cloudflare Account**
   - Sign up at https://cloudflare.com
   - Get your Account ID from the dashboard

2. **Wrangler CLI**
   ```bash
   npm install -g wrangler
   wrangler login
   ```

### Deployment

1. **Update Configuration**
   ```bash
   cd infrastructure/edge
   ```

   Edit `wrangler.toml`:
   - Set `account_id` to your Cloudflare account ID
   - Set `ORIGIN_URL` to your production server URL

2. **Deploy to Production**
   ```bash
   wrangler deploy --env production
   ```

3. **Deploy to Staging**
   ```bash
   wrangler deploy --env staging
   ```

### Testing

Test the edge cache:

```bash
# Cache miss (first request)
curl -X POST https://your-worker.workers.dev/llm/label-spans \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"text":"A cinematic shot","maxSpans":60,"minConfidence":0.5}'

# Check response headers:
# X-Edge-Cache: MISS
# X-Cache-Key: abc123
# X-Cache-TTL: 3600

# Cache hit (second request with same payload)
curl -X POST https://your-worker.workers.dev/llm/label-spans \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"text":"A cinematic shot","maxSpans":60,"minConfidence":0.5}'

# Check response headers:
# X-Edge-Cache: HIT
# X-Cache-Key: abc123
```

## Configuration

### Cache Key Generation

The cache key is generated from:
- Text content (SHA-256 hash)
- Span labeling policy
- Template version
- Max spans
- Min confidence

This ensures cache hits for identical requests across all users.

### Cache TTL Strategy

- **Small texts** (<2000 chars): 1 hour TTL
- **Large texts** (>2000 chars): 5 minutes TTL

Rationale:
- Large texts are less likely to be reused
- Short TTL reduces memory usage
- Small texts have high reuse potential

### Cache Headers

Response headers for monitoring:

| Header | Values | Description |
|--------|--------|-------------|
| `X-Edge-Cache` | HIT, MISS, BYPASS, ERROR | Cache status |
| `X-Cache-Key` | String | Cache key used |
| `X-Cache-TTL` | Number | Cache TTL in seconds |

## Performance Monitoring

### Cache Hit Rate

Monitor cache effectiveness:

```javascript
// In your analytics
const cacheHitRate = (cacheHits / totalRequests) * 100;
console.log(`Edge cache hit rate: ${cacheHitRate}%`);
```

Expected hit rates:
- **60-70%**: Good performance
- **70-80%**: Excellent performance
- **>80%**: Outstanding performance

### Latency Metrics

Expected latencies:
- **Cache hit**: 20-50ms globally
- **Cache miss**: 150-300ms (depends on origin location)
- **Error**: 50-100ms

## Advanced Configuration

### Custom Domains

To use a custom domain:

1. Add domain to Cloudflare
2. Update `wrangler.toml`:
   ```toml
   routes = [
     { pattern = "api.yourapp.com/*", zone_id = "YOUR_ZONE_ID" }
   ]
   ```
3. Deploy: `wrangler deploy`

### Cache Warming

Pre-warm cache for common prompts:

```javascript
// Add to cloudflare-worker.js
const COMMON_PROMPTS = [
  "A cinematic shot of a sunset",
  "Close-up of a person smiling",
  "Wide shot of a cityscape",
];

// Warm cache on cron trigger
addEventListener('scheduled', event => {
  event.waitUntil(warmCache());
});

async function warmCache() {
  for (const text of COMMON_PROMPTS) {
    await handleSpanLabelingRequest(
      createRequest({ text, maxSpans: 60, minConfidence: 0.5 })
    );
  }
}
```

### Analytics Integration

Track cache performance with KV:

```javascript
// Store analytics
await CACHE_ANALYTICS.put(
  `stats:${Date.now()}`,
  JSON.stringify({ cacheHits, cacheMisses, timestamp: Date.now() })
);
```

## Troubleshooting

### Cache Not Working

1. **Check Headers**: Ensure `X-Edge-Cache` header is present
2. **Verify Cache Key**: Same payload should generate same cache key
3. **Check TTL**: Cache may have expired
4. **Review Logs**: `wrangler tail` to see real-time logs

### High Cache Miss Rate

Possible causes:
- Users entering unique/varied text
- Short cache TTL
- High traffic from new users
- Cache invalidation too aggressive

Solutions:
- Increase cache TTL
- Implement cache warming
- Analyze request patterns

### Deployment Failures

```bash
# Check syntax
wrangler deploy --dry-run

# View detailed logs
wrangler tail

# Check account status
wrangler whoami
```

## Cost Estimation

Cloudflare Workers pricing (as of 2024):

**Free Tier:**
- 100,000 requests/day
- Suitable for development/testing

**Paid Plan ($5/month):**
- 10 million requests/month included
- $0.50 per additional million

**Expected costs for this use case:**
- 1M requests/month: **$5/month** (base plan)
- 10M requests/month: **$5/month** (within free quota)
- 50M requests/month: **$25/month** ($5 base + $20 overage)

## Security

### API Key Validation

Add authentication:

```javascript
function validateAPIKey(request) {
  const apiKey = request.headers.get('X-API-Key');
  if (!apiKey || apiKey !== VALID_API_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }
  return null;
}
```

### Rate Limiting

Prevent abuse:

```javascript
const RATE_LIMIT = 100; // requests per minute
const rateLimiter = new Map();

function checkRateLimit(clientId) {
  const now = Date.now();
  const requests = rateLimiter.get(clientId) || [];

  // Remove requests older than 1 minute
  const recentRequests = requests.filter(t => now - t < 60000);

  if (recentRequests.length >= RATE_LIMIT) {
    return new Response('Rate limit exceeded', { status: 429 });
  }

  recentRequests.push(now);
  rateLimiter.set(clientId, recentRequests);
  return null;
}
```

## Migration Guide

### From No Edge Caching

1. Deploy worker to staging
2. Test with production-like traffic
3. Monitor cache hit rates
4. Deploy to production gradually (10% → 50% → 100%)

### From Other CDN

1. Update DNS to point to Cloudflare
2. Deploy worker
3. Monitor for 24-48 hours
4. Compare latency metrics

## Support

- **Cloudflare Docs**: https://developers.cloudflare.com/workers/
- **Wrangler Docs**: https://developers.cloudflare.com/workers/wrangler/
- **Community**: https://community.cloudflare.com/

## License

Same as main project
