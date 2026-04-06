# PR 1: Build Correctness and Measurement Harness

## Baseline (before)
- `vendor-react`: 66.65 kB min / 22.27 kB gzip
- `vendor-ui`: 31.87 kB min / 10.77 kB gzip
- `index` (main entry): 1,739.00 kB min / 462.50 kB gzip
- `vendor-firebase`: 487.17 kB min / 112.09 kB gzip
- `vendor-icons`: 214.48 kB min / 49.70 kB gzip
- `MainWorkspace`: 462.91 kB min / 101.23 kB gzip
- React dev bundle references in production output: YES (5 matches across stale + fresh builds)
- Build time: 6.42s

## After
- `vendor-react`: 48.12 kB min / 16.96 kB gzip
- `vendor-ui`: 26.88 kB min / 8.93 kB gzip
- `index` (main entry): 1,558.29 kB min / 410.31 kB gzip
- `vendor-firebase`: 487.17 kB min / 112.09 kB gzip (unchanged)
- `vendor-icons`: 214.48 kB min / 49.70 kB gzip (unchanged)
- `MainWorkspace`: 462.91 kB min / 101.23 kB gzip (unchanged)
- React dev bundle references in fresh production output: NONE
- Build time: 6.03s

## Delta
- `vendor-react`: -27.8% (-18.53 kB min / -5.31 kB gzip)
- `vendor-ui`: -15.7% (-4.99 kB min / -1.84 kB gzip)
- `index`: -10.4% (-180.71 kB min / -52.19 kB gzip)
- Total gzip savings: ~59.3 kB
- Build time: -6.1%

## Method
- `npm run build` with default Vite production mode
- Compared rollup output sizes from build log
- Verified with `grep -r "react.development" dist/assets/<fresh-hash>.js`
- Single run, local machine (M-series Mac)

## Rollback Gate
- Revert if production output contains any `react.development` or `react-dom.development` string
- Revert if `npm run build` fails or bundle sizes increase
