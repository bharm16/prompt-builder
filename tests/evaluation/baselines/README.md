# Evaluation Baselines

Baselines store last-known-good suite metrics for regression checks.

Files:
- `span-labeling-baseline.json`
- `suggestions-baseline.json`
- `optimization-baseline.json`

To generate/update baselines locally (makes real LLM calls):

```bash
npm run eval:regression -- --update-baseline
```

CI uses these files to detect regressions. Commit updated baselines only after verifying results.

