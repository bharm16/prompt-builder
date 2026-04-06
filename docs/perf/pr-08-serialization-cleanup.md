# PR 8: Serialization, Media Refresh, and History Persistence

## Baseline (before)
- Media refresh: JSON.stringify signature on all generations per cycle
- History persistence: full localStorage write on every edit
- Generation controls: JSON.stringify-based state persistence on every update

## After
- Media refresh: explicit string key, stale-item targeting only
- History persistence: incremental active-entry updates, deferred full snapshot
- Generation controls: throttled idle-boundary persistence with shallow compare

## Delta
- Media refresh: only stale/changed items processed per cycle
- History persistence: writes per minute reduced during active editing
- Generation controls: persistence writes reduced to idle boundaries only

## Method
- Manual testing with browser performance profiler
- Count localStorage writes during 30s editing session

## Rollback Gate
- Revert if generation media stops refreshing for completed items
- Revert if history data is lost between page reloads
- Revert if generation control settings don't persist
