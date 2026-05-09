# Golden-Set Relaxed F1 Baselines

Per-provider baselines for the deterministic, ground-truth Relaxed F1 evaluation. Each file (`groq.json`, `openai.json`, …) is the last blessed snapshot of evaluation metrics for that provider. The harness at `scripts/evaluation/golden-set-relaxed-f1.ts` compares fresh runs against these to detect regressions.

This is **not** the LLM-as-judge eval (that's `span-labeling-evaluation.ts` with snapshots in `../snapshots/`). Two evals, two cadences, two failure modes — keep them separate.

## Workflow

```bash
# 1. Establish a baseline for the current code on a given provider
GROQ_API_KEY=… npm run eval:golden-set:bless

# 2. Subsequent runs gate against it
GROQ_API_KEY=… npm run eval:golden-set
# Exit 0 = passed | Exit 1 = regression | Exit 2 = setup error

# Run against a specific provider
npm run eval:golden-set -- --provider openai

# Run a subset of fixtures during development
npm run eval:golden-set -- --fixtures core,lighting
```

## Baseline file format

```jsonc
{
  "blessedAt": "2026-05-08T19:00:00.000Z", // ISO timestamp
  "provider": "groq", // Which provider this captures
  "commit": "abc1234", // Optional git SHA for traceability
  "summary": {
    "relaxedF1": 0.87,
    "precision": 0.86,
    "recall": 0.88,
    "taxonomyAccuracy": 0.93,
  },
  "byCategory": {
    "subject.identity": {
      "f1": 0.91,
      "precision": 0.89,
      "recall": 0.93,
      "support": 50,
    },
    // … one entry per role with support > 0 in the golden set
  },
}
```

## Gate semantics

The gate (in `../baseline-gate.ts`) flags regressions when:

- **Overall F1** drops by more than `0.02` (default tolerance)
- **Per-category F1** drops by more than `0.05` (default tolerance), but only for categories with `support >= 5` — rare-label noise is statistical, not real
- **Taxonomy accuracy** drops by more than `0.03`

Drops are regressions; gains never are. We never re-bless because the model got worse.

## When to re-bless

Re-bless after **intentional, reviewed** changes:

- Prompt template upgrade (`templateVersion: v1 → v2`)
- Model upgrade (`llama-3.1-8b-instant` → newer Groq model)
- Taxonomy expansion in `shared/taxonomy.ts` (gate will warn about new categories)
- Golden-set fixture additions or corrections

Do **not** re-bless to silence a regression you don't understand. Investigate the regressions in the gate output first — categories named in the failure are usually a tight pointer at what changed.

## Why per-provider baselines

Groq, OpenAI, and Gemini have different model architectures and JSON-mode behaviors. Forcing them to share a baseline creates pointless drift signals (e.g., Groq's 0.87 vs OpenAI's 0.92 isn't a regression, just a calibration difference). Each provider gets its own quality budget.

## Rare/missing categories

If a category in the baseline has `support < 5`, the gate skips it. If a category in the baseline is missing from a fresh run, you'll see a `missing` warning (not a hard failure) — the team should investigate whether the corresponding fixture prompts were dropped.

If a fresh run has a category not in the baseline, you'll see a `re-bless required` notice. Either bless the new shape or remove the new category from the eval.
