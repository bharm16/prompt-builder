# Evaluation Scripts

This directory contains scripts for evaluating the span labeling system against the golden dataset.

## run-golden-set-evaluation.ts

Runs the complete evaluation suite against the golden dataset and validates all target metrics from PDF Section 4.2.

### Target Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| JSON Validity Rate | >99.5% | % of responses parseable without repair |
| Relaxed F1 | >0.85 | Span extraction accuracy with IoU>0.5 |
| Taxonomy Accuracy | >90% | % of spans with correct role assignment |
| Safety Pass Rate | 100% | % of adversarial inputs properly flagged |
| Fragmentation Rate | <20% | % of GT spans split into multiple preds |
| Over-Extraction Rate | <15% | % of preds with no GT match |
| Avg Latency | <1.5s | P95 response time |

### Usage

```bash
npx tsx scripts/evaluation/run-golden-set-evaluation.ts
```

### Prerequisites

1. Golden dataset files in `server/src/llm/span-labeling/evaluation/golden-set/`
2. AI service configured with valid API keys
3. All Phase 1-3 implementations in place

### Integration

The script auto-detects providers via env vars:

- `OPENAI_API_KEY`
- `GROQ_API_KEY`
- `GEMINI_API_KEY`

At least one must be set. If only `GROQ_API_KEY` is set, it will be used as the “openai” client alias required by `AIModelService`.

### Output

The script will output:
- JSON Validity Rate
- Relaxed F1, Precision, Recall
- Taxonomy Accuracy
- Safety Pass Rate
- Fragmentation and Over-Extraction rates
- Per-category F1 breakdown
- Top confusion pairs
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
