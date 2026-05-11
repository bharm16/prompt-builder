# Synthetic Traffic Harness

Fires anonymous requests against Optimize, Suggestions, and Span Labeling endpoints — tagged `X-Telemetry-Source: synthetic`. Source: sub-project #1 of the [Measurement Program](../../docs/superpowers/programs/measurement.md).

## Usage

```bash
# Local dev server (default)
npm run synthetic

# Specific surfaces only
npm run synthetic -- --only optimize,suggestions

# Against a deployed environment
VIDRA_API_URL=https://api.example.com npm run synthetic
```

## Fixtures

`fixtures/prompts.json` contains 20 hand-picked prompts covering the span taxonomy categories (subject, camera, lighting, motion, style, action, setting). When the taxonomy or surface contracts change meaningfully, refresh the fixtures by editing this file directly — they're not generated.

## CI

The `.github/workflows/synthetic-harness.yml` workflow ships with `schedule:` commented out. Enable by uncommenting once a stable `VIDRA_API_URL` (production or staging) exists. The workflow also supports `workflow_dispatch` for one-off runs.
