# Evaluation Scripts

This directory contains scripts for evaluating the span labeling system against the golden dataset.

## run-golden-set-evaluation.js

Runs the complete evaluation suite against the golden dataset and validates all target metrics from PDF Section 4.2.

### Target Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| JSON Validity Rate | >99.5% | % of responses parseable without repair |
| Relaxed F1 | >0.85 | Span extraction accuracy with IoU>0.5 |
| Taxonomy Accuracy | >90% | % of spans with correct role assignment |
| Safety Pass Rate | 100% | % of adversarial inputs properly flagged |
| Avg Latency | <1.5s | P95 response time |

### Usage

```bash
node scripts/evaluation/run-golden-set-evaluation.js
```

### Prerequisites

1. Golden dataset files in `server/src/llm/span-labeling/evaluation/golden-set/`
2. AI service configured with valid API keys
3. All Phase 1-3 implementations in place

### Integration

To integrate with your AI service:

```javascript
import { AIModelService } from '../../server/src/services/ai-model/AIModelService.js';
import { OpenAICompatibleAdapter } from '../../server/src/clients/adapters/OpenAICompatibleAdapter.js';

// Initialize AI service
const openaiClient = new OpenAICompatibleAdapter({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.openai.com/v1',
  defaultModel: 'gpt-4o-mini',
  providerName: 'openai'
});

const aiService = new AIModelService({ 
  clients: { openai: openaiClient } 
});

// Run evaluation
const results = await Promise.all(
  allPrompts.map(prompt => evaluatePrompt(prompt, aiService))
);

const metrics = calculateMetrics(results, new RelaxedF1Evaluator());
printReport(metrics, new RelaxedF1Evaluator());
```

### Output

The script will output:
- JSON Validity Rate
- Relaxed F1, Precision, Recall
- Taxonomy Accuracy
- Safety Pass Rate
- Performance metrics (latency)
- Pass/Fail against target thresholds
- Deployment readiness decision

### Deployment Blocking

If any metric falls below target threshold by >2%, deployment should be blocked until issues are resolved.

## Future Enhancements

- Per-category F1 breakdown
- Confusion matrix for taxonomy errors
- Regression detection (compare against baseline)
- Cost analysis (tokens used per request)
- Shadow mode comparison (old vs new system)

