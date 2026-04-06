# PR 5: Asset Autocomplete and Write Amplification
## Baseline (before)
- Suggestion query: loads all assets (up to 100), filters in memory
- Trigger resolution: serial batch queries (one Firestore read per 10 triggers)
- Usage writes: 2 Firestore writes per matched asset (incrementUsage + full-text usage record)
- Client debounce: 150ms
## After
- Suggestion query: single Firestore prefix range query
- Trigger resolution: parallel batch queries
- Usage writes: N incrementUsage + 1 batched usage record write
- Client debounce: 300ms
## Delta
- Firestore reads per suggestion: N → 1
- Trigger resolution: serial → parallel
- Usage write payloads: full prompt text → compact hash/length metadata
## Method
- Code review of query patterns
- Measure with autocannon in staging for p95 latency
## Rollback Gate
- Revert if suggestion results are incorrect or incomplete
- Revert if asset usage tracking breaks
