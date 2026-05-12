# Synthetic Traffic Harness

Emits operational telemetry events directly into PostHog using the same `PostHogClient` + telemetry services the server uses. No HTTP. Each emission is wrapped in an AsyncLocalStorage frame with `source: "synthetic"`, so the PostHogClient wrapper auto-stamps the discriminator onto every event.

Source: sub-project #1 of the [Measurement Program](../../docs/superpowers/programs/measurement.md). Pre-launch the harness is the **only** way to produce operational telemetry — there are no real users yet.

## Why direct emission (not HTTP)

The earlier HTTP version fired anonymous requests at production endpoints. That hit two problems:

1. The endpoints require Firebase auth — anonymous requests get `401` and zero events emit.
2. Going through HTTP exercises code paths (auth, CORS, rate limiting) that don't help validate the **telemetry pipeline + dashboards**, which is what we actually want.

Direct emission constructs the telemetry services in-process and emits events through the same code path real requests use. The events that land in PostHog are structurally identical to production events — minus the HTTP layer the harness doesn't care about.

## Usage

```bash
npm run synthetic                                  # all 3 surfaces
npm run synthetic -- --only optimize               # subset
npm run synthetic -- --only optimize,suggestions
```

`POSTHOG_API_KEY` must be set in `.env` (loaded automatically). When unset, the harness runs in no-op mode — useful for dry-runs in CI.

## What gets emitted per prompt

Provider/model values mirror `server/src/config/modelConfig.ts` (the source of truth for production routing):

| Surface       | Surface event           | LLM calls per prompt      | Provider / Model                                  |
| ------------- | ----------------------- | ------------------------- | ------------------------------------------------- |
| `optimize`    | `optimize.completed`    | 4                         | openai / gpt-4o-2024-08-06 + gpt-4o-mini variants |
| `suggestions` | `suggestions.completed` | 1                         | qwen / qwen/qwen3-32b                             |
| `span-labels` | `label-spans.completed` | 1 (skipped on cache hits) | gemini / gemini-2.5-flash                         |

20 fixture prompts × 3 surfaces ≈ 165 events per full run.

## Fixtures

`fixtures/prompts.json` contains 20 hand-picked prompts covering the span taxonomy (subject, camera, lighting, motion, style, action, setting). Refresh by editing the file directly when the taxonomy changes meaningfully — they're not generated.

## CI

`.github/workflows/synthetic-harness.yml` runs on `workflow_dispatch`; the `schedule:` cron is committed but commented out. Uncomment to enable nightly baseline runs. The workflow only needs `POSTHOG_API_KEY` as a repo secret — no other configuration.
