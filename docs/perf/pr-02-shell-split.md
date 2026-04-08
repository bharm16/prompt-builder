# PR 2: Public Shell Split and Route-Level Lazy Loading

## Baseline (before — after PR 1 fix)

- `index` (main entry): 1,558.29 kB min / 410.31 kB gzip
- `vendor-three`: not separated (included in index)
- `GenerationControlsPanel`: not separated (included in index)
- Three.js loads on every page including marketing

## After

- `index` (main entry): 935.53 kB min / 266.22 kB gzip
- `vendor-three`: 485.49 kB min / 122.48 kB gzip (separate lazy chunk)
- `GenerationControlsPanel`: 87.18 kB min / 14.15 kB gzip (separate lazy chunk)
- `MainWorkspace`: 463.04 kB min / 101.30 kB gzip (unchanged)

## Delta

- `index`: -39.9% (-622.76 kB min / -144.09 kB gzip)
- Total initial load savings for marketing pages: ~767 kB min / ~281 kB gzip
- Three.js now loads only when CameraMotionModal opens
- Generation controls now load only when Studio tab is active

## Method

- `npm run build` with Vite production mode
- Compared rollup output sizes from build log
- Verified by checking that vendor-three and GenerationControlsPanel appear as separate chunks

## Rollback Gate

- Revert if workspace functionality breaks (generation controls, camera motion, face swap)
- Revert if marketing pages show workspace loading artifacts
- Revert if bundle sizes increase for the main entry
