# Groq Llama 3.1 8B Instant Integration

## Overview

This integration adds **two-stage prompt optimization** to dramatically reduce perceived latency from **~8.5 seconds to ~300ms**.

### Architecture

**Stage 1: Fast Draft (Groq Llama 3.1 8B Instant)**
- Generates concise draft in ~200-500ms
- Users can immediately view and interact with results
- Runs on ultra-fast Groq inference infrastructure

**Stage 2: Quality Refinement (OpenAI GPT-4o-mini)**
- Refines draft in background
- Seamlessly upgrades UI when complete
- No interruption to user workflow

## Benefits

| Metric | Before | After |
|--------|--------|-------|
| Time to first content | ~8500ms | ~300ms |
| Perceived latency | 8.5s | 0.3s |
| User can interact | After 8.5s | After 0.3s |
| Cost per request | ~$0.001 | ~$0.00116 |
| Additional cost | - | +$0.00016/request |

## Setup

### 1. Get Groq API Key

Sign up at [console.groq.com](https://console.groq.com) and get your API key.

### 2. Configure Environment

Add to your `.env` file:

```bash
# Groq Configuration (Optional)
GROQ_API_KEY=gsk_your_actual_groq_api_key_here
GROQ_MODEL=llama-3.1-8b-instant
GROQ_TIMEOUT_MS=5000
```

### 3. Start the Server

```bash
npm run server
```

The server will log:
- ✅ "Groq client initialized for two-stage optimization" (if GROQ_API_KEY is set)
- ⚠️ "GROQ_API_KEY not provided, two-stage optimization disabled" (if not set)

## Usage

### Automatic Behavior

Two-stage optimization is **enabled by default** when:
1. GROQ_API_KEY is configured
2. User clicks "Optimize" button
3. Any optimization mode (video, reasoning, research, etc.)

### User Experience Flow

1. User enters prompt: "A cinematic sunset scene"
2. User clicks "Optimize"
3. **~300ms later**: Draft appears with banner "Draft ready! Refining in background..."
4. User can immediately:
   - Read the draft
   - Edit the text
   - Copy to clipboard
   - Continue working
5. **~8 seconds later**: Refined version seamlessly replaces draft
6. Toast notification: "Refined! Quality score: 85%"

### Fallback Behavior

The system automatically falls back to single-stage optimization if:
- GROQ_API_KEY not configured
- Groq API unavailable
- Two-stage optimization fails
- Network issues

## API Endpoints

### POST /api/optimize (Legacy)

Single-stage optimization (backward compatible)

**Request:**
```json
{
  "prompt": "Your prompt here",
  "mode": "video",
  "context": null,
  "brainstormContext": null
}
```

**Response:**
```json
{
  "optimizedPrompt": "Optimized prompt text..."
}
```

### POST /api/optimize-stream (New)

Two-stage streaming optimization with Server-Sent Events (SSE)

**Request:** Same as `/api/optimize`

**Response (Streaming):**
```
event: draft
data: {"draft":"Draft text...","status":"draft_ready","timestamp":1234567890}

event: refined
data: {"refined":"Refined text...","status":"complete","metadata":{...},"timestamp":1234567891}

event: done
data: {"status":"finished","usedFallback":false}
```

## Frontend Usage

### Using usePromptOptimizer Hook

```javascript
import { usePromptOptimizer } from './hooks/usePromptOptimizer';

function MyComponent() {
  const promptOptimizer = usePromptOptimizer(selectedMode, useTwoStage = true);

  const handleOptimize = async () => {
    await promptOptimizer.optimize(prompt);

    // Check states:
    console.log('Is processing?', promptOptimizer.isProcessing);
    console.log('Draft ready?', promptOptimizer.isDraftReady);
    console.log('Is refining?', promptOptimizer.isRefining);
    console.log('Draft:', promptOptimizer.draftPrompt);
    console.log('Final:', promptOptimizer.optimizedPrompt);
  };

  return (
    <>
      {promptOptimizer.isRefining && (
        <div>Refining in background...</div>
      )}
      {/* ... */}
    </>
  );
}
```

### Direct API Usage

```javascript
import { promptOptimizationApiV2 } from './services';

// With automatic fallback
const result = await promptOptimizationApiV2.optimizeWithFallback({
  prompt: "Your prompt",
  mode: "video",
  onDraft: (draft) => {
    console.log('Draft ready:', draft);
    setDisplayText(draft);
  },
  onRefined: (refined, metadata) => {
    console.log('Refinement complete:', refined);
    setDisplayText(refined);
  },
  onError: (error) => {
    console.error('Optimization failed:', error);
  }
});

console.log('Final result:', result.refined);
console.log('Used fallback?', result.usedFallback);
```

## Architecture Details

### Backend Components

1. **GroqAPIClient** (`server/src/clients/GroqAPIClient.js`)
   - Circuit breaker pattern
   - Streaming support
   - Error handling and retries
   - Metrics integration

2. **PromptOptimizationService** (`server/src/services/PromptOptimizationService.js`)
   - `optimizeTwoStage()` method
   - Draft system prompts for each mode
   - Automatic fallback logic
   - Performance logging

3. **API Routes** (`server/src/routes/api.routes.js`)
   - `/api/optimize-stream` endpoint
   - Server-Sent Events (SSE)
   - Event types: draft, refined, done, error

### Frontend Components

1. **PromptOptimizationApiV2** (`client/src/services/PromptOptimizationApiV2.js`)
   - SSE streaming client
   - Callback-based API
   - Automatic fallback
   - Error recovery

2. **usePromptOptimizer Hook** (`client/src/hooks/usePromptOptimizer.js`)
   - Two-stage state management
   - Draft/refining indicators
   - Backward compatibility
   - Quality score calculation

3. **UI Components** (`client/src/features/prompt-optimizer/components/`)
   - Refinement banner with spinner
   - Draft/refined state indicators
   - Smooth transitions

## Performance Monitoring

### Metrics Tracked

- Draft generation time (~200-500ms)
- Refinement time (~8000ms)
- Total end-to-end time
- Fallback rate
- Error rate

### Logs

```javascript
// Draft generation
logger.info('Draft generated successfully', {
  duration: 287,
  draftLength: 125,
  mode: 'video'
});

// Refinement complete
logger.info('Two-stage optimization complete', {
  draftDuration: 287,
  refinementDuration: 8432,
  totalDuration: 8719,
  mode: 'video'
});
```

## Troubleshooting

### "Two-stage optimization disabled"

**Cause:** GROQ_API_KEY not set in `.env`

**Fix:**
1. Get API key from [console.groq.com](https://console.groq.com)
2. Add to `.env`: `GROQ_API_KEY=gsk_...`
3. Restart server

### "Groq API circuit breaker is open"

**Cause:** Groq API experiencing issues

**Behavior:** Automatically falls back to single-stage optimization

**Fix:** Wait for circuit breaker to reset (30 seconds), or check Groq status

### No draft appearing

**Check:**
1. Browser console for errors
2. Server logs for Groq API errors
3. Network tab for SSE connection
4. Verify GROQ_API_KEY is valid

## Cost Analysis

### Per-Request Costs

| Model | Tokens | Cost |
|-------|--------|------|
| Groq Llama 3.1 8B | ~200 | $0.00016 |
| OpenAI GPT-4o-mini | ~2000 | $0.001 |
| **Total** | | **$0.00116** |

### Monthly Costs (1000 users, 10 optimizations/month)

- Before: 10,000 requests × $0.001 = **$10/month**
- After: 10,000 requests × $0.00116 = **$11.60/month**
- **Additional cost: $1.60/month (+16%)**

### Value Proposition

- **User satisfaction**: 28x faster perceived performance
- **Retention**: Users can interact immediately
- **Engagement**: No 8.5s wait time
- **Cost**: Only $1.60/month extra for 10,000 requests

## Configuration Options

### Disable Two-Stage Optimization

Set `useTwoStage` parameter to `false`:

```javascript
const promptOptimizer = usePromptOptimizer(selectedMode, useTwoStage = false);
```

### Customize Draft Length

Edit `getDraftSystemPrompt()` in `PromptOptimizationService.js`:

```javascript
video: `Create a concise video prompt (75-125 words).`
//                                        ^^^  ^^^
//                                     Adjust these
```

### Adjust Timeouts

In `.env`:

```bash
GROQ_TIMEOUT_MS=5000  # 5 seconds (default)
OPENAI_TIMEOUT_MS=60000  # 60 seconds (default)
```

## Testing

### Manual Testing

1. Start server: `npm run server`
2. Start client: `npm run dev`
3. Enter prompt: "A cinematic sunset"
4. Click "Optimize"
5. Observe:
   - Draft appears in ~300ms
   - Banner shows "Refining in background..."
   - Refined version appears in ~8s
   - Banner disappears

### Check Logs

```bash
# Server logs
tail -f server.log

# Look for:
# - "Draft generated successfully"
# - "Two-stage optimization complete"
# - Any errors or fallbacks
```

## Migration Guide

### From Single-Stage to Two-Stage

**No code changes required!** The integration is backward compatible.

**Optional:** Add visual indicators to your UI:

```jsx
{promptOptimizer.isRefining && (
  <div className="alert alert-info">
    <Spinner /> Refining in background...
  </div>
)}
```

### Rollback to Single-Stage

1. Remove or comment out `GROQ_API_KEY` in `.env`
2. Restart server
3. System automatically uses single-stage optimization

## Future Enhancements

### Potential Improvements

1. **Streaming Draft Generation**: Stream draft chunks as they're generated
2. **Parallel Refinement**: Start refinement before draft is fully displayed
3. **Adaptive Model Selection**: Use different models based on prompt complexity
4. **Progressive Refinement**: Show multiple refinement stages
5. **User Preferences**: Let users toggle two-stage mode
6. **A/B Testing**: Compare user satisfaction metrics

### Planned Features

- [ ] Draft caching for identical prompts
- [ ] Progressive refinement indicators
- [ ] User feedback on draft quality
- [ ] Analytics dashboard for performance metrics

## Support

### Documentation

- [Groq Documentation](https://console.groq.com/docs)
- [OpenAI Documentation](https://platform.openai.com/docs)
- [Server-Sent Events Guide](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

### Contact

For issues or questions:
- GitHub Issues: [Your Repo]
- Email: [Your Email]
- Discord: [Your Discord]

---

**Last Updated:** 2025-01-28
**Version:** 1.0.0
**Status:** Production Ready ✅
