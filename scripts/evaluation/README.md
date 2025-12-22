# Span Labeling Evaluation

Scripts for evaluating span labeling quality using LLM-as-Judge approach with real production data.

## Quick Start

```bash
# Step 1: Generate fresh evaluation prompts from real user inputs
npx tsx scripts/evaluation/generate-evaluation-prompts.ts

# Step 2: Run evaluation (span labeling + LLM judge)
npx tsx scripts/evaluation/span-labeling-evaluation.ts

# Step 3: Lock results as baseline
npx tsx scripts/evaluation/span-labeling-evaluation.ts --baseline

# After making changes, re-run and compare
npx tsx scripts/evaluation/span-labeling-evaluation.ts
npx tsx scripts/evaluation/compare-snapshots.ts
```

## Workflow

### Phase 1: Generate Clean Evaluation Data

The raw prompts file (`raw-prompts-*.json`) contains outputs from different optimizer versions over time. For a clean baseline, regenerate outputs with the current optimizer:

```bash
# Generate all unique prompts (may take a while)
npx tsx scripts/evaluation/generate-evaluation-prompts.ts

# Or sample 30 for quick testing
npx tsx scripts/evaluation/generate-evaluation-prompts.ts --sample 30
```

**Output:** `scripts/evaluation/data/evaluation-prompts-latest.json`

This gives you:
- Real user inputs (authentic test cases)
- Consistent output format (current optimizer)
- Clean baseline for comparison

### Phase 2: Run Evaluation

```bash
# Uses data/evaluation-prompts-latest.json by default
npx tsx scripts/evaluation/span-labeling-evaluation.ts

# Or specify a file
npx tsx scripts/evaluation/span-labeling-evaluation.ts --prompts-file path/to/file.json

# Sample for quick iteration
npx tsx scripts/evaluation/span-labeling-evaluation.ts --sample 20
```

### Phase 3: Establish Baseline

Once you're happy with the results:

```bash
npx tsx scripts/evaluation/span-labeling-evaluation.ts --baseline
```

This locks `snapshots/latest.json` as `snapshots/baseline.json`.

### Phase 4: Detect Regressions

After making changes to span labeling:

```bash
# Run new evaluation
npx tsx scripts/evaluation/span-labeling-evaluation.ts

# Compare to baseline
npx tsx scripts/evaluation/compare-snapshots.ts
```

## How It Works

### No Ground Truth Required

Instead of manually annotating "correct" spans, we use **LLM-as-Judge** with GPT-4o:
- GPT-4o evaluates each span labeling result
- Scores on 5 dimensions (25 points max)
- Identifies specific issues (missed elements, incorrect extractions)

GPT-4o was chosen as judge because:
- 0.86 correlation with human annotators (per GeoBenchX benchmarks)
- Different model family than span labeling (Groq/Llama) - avoids self-preference bias
- Strong structured output adherence for consistent JSON responses

### LLM Judge Rubric

| Dimension | What It Measures | Max |
|-----------|------------------|-----|
| **Coverage** | Did it extract ALL visual control points? | 5 |
| **Precision** | Did it correctly SKIP abstract concepts? | 5 |
| **Granularity** | Are span boundaries correct? | 5 |
| **Taxonomy** | Are roles assigned correctly? | 5 |
| **Technical Specs** | Did it extract fps, duration, aspect ratio? | 5 |

### Regression Detection

Compares snapshots to detect:
- **Score regressions**: Prompts that got worse by 3+ points
- **New errors**: Prompts that now fail to process
- **Category changes**: Coverage improved but precision dropped

## Scripts

### `generate-evaluation-prompts.ts`

Regenerates outputs using current optimizer.

```bash
npx tsx scripts/evaluation/generate-evaluation-prompts.ts [options]

Options:
  --input <path>   Source file with raw prompts
  --sample <N>     Only process N random prompts
```

**Output:** `data/evaluation-prompts-{timestamp}.json` and `data/evaluation-prompts-latest.json`

### `span-labeling-evaluation.ts`

Runs span labeling + LLM judge on prompts.

```bash
npx tsx scripts/evaluation/span-labeling-evaluation.ts [options]

Options:
  --prompts-file <path>  Path to evaluation prompts JSON
  --sample <N>           Only evaluate N random prompts
  --baseline             Lock results as baseline
```

**Output:** `snapshots/latest.json` (and `snapshots/baseline.json` with `--baseline`)

### `compare-snapshots.ts`

Compares current run to baseline.

```bash
npx tsx scripts/evaluation/compare-snapshots.ts [options]

Options:
  --baseline <path>  Baseline snapshot path
  --current <path>   Current snapshot path
```

## Interpreting Results

### Score Distribution

| Range | Meaning |
|-------|---------|
| Excellent (23-25) | Ready for production |
| Good (18-22) | Minor issues |
| Acceptable (13-17) | Needs attention |
| Poor (8-12) | Significant problems |
| Failing (0-7) | Broken |

### Regression Thresholds

- Individual prompt: ≥3 point drop = regression
- Average score: ≥0.5 point drop = warning
- New errors: Any = warning

### Example Output

**Evaluation Report:**
```
📊 SUMMARY (50 prompts evaluated):
  Average Score:      21.3/25
  Average Span Count: 16.2

📈 SCORE DISTRIBUTION:
  excellent (23-25)    ████████████ 24
  good (18-22)         ██████████████████ 18
  acceptable (13-17)   ████ 6
  poor (8-12)          █ 2
  failing (0-7)         0

❌ COMMONLY MISSED ELEMENTS:
  - soft shadows (8x)
  - color temperature (5x)
```

**Regression Report:**
```
📊 OVERALL CHANGE:
  Average Score: 21.3 → 20.1 (-1.2)

❌ REGRESSIONS (3 prompts got worse by 3+ points):
  [22→17] "man driving a car..."

⚠️  REVIEW BEFORE DEPLOY
```

## Directory Structure

```
scripts/evaluation/
├── generate-evaluation-prompts.ts  # Step 1: Regenerate outputs
├── span-labeling-evaluation.ts     # Step 2: Run evaluation
├── compare-snapshots.ts            # Step 3: Detect regressions
├── run-golden-set-evaluation.ts    # Legacy (uses placeholder annotations)
├── README.md
├── data/
│   ├── evaluation-prompts-latest.json
│   └── evaluation-prompts-{timestamp}.json
└── snapshots/
    ├── baseline.json
    └── latest.json
```

## Tips

### Quick Iteration

```bash
# Generate small sample
npx tsx scripts/evaluation/generate-evaluation-prompts.ts --sample 10

# Evaluate that sample
npx tsx scripts/evaluation/span-labeling-evaluation.ts --sample 10
```

### Full Evaluation

```bash
# Generate all prompts (takes ~3-5 min for 100+ prompts)
npx tsx scripts/evaluation/generate-evaluation-prompts.ts

# Full evaluation (takes ~5-10 min)
npx tsx scripts/evaluation/span-labeling-evaluation.ts --baseline
```

### Environment Variables

Required:
- `OPENAI_API_KEY` - **Required** for LLM-as-Judge (uses GPT-4o)
- `GROQ_API_KEY` - For span labeling (or OpenAI as fallback)

The judge always uses GPT-4o. Span labeling uses Groq if available, otherwise falls back to OpenAI.
