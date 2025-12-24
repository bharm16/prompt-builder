# Span Labeling Evaluation Baseline

**Established:** 2025-12-24
**Baseline File:** `snapshots/baseline.json`

---

## Baseline Metrics

| Metric | Value | Target |
|--------|-------|--------|
| **Overall Score** | 19.32/25 (77%) | 22/25 (88%) |
| **Prompts Evaluated** | 52 | - |
| **Excellent (23-25)** | 0 | 20+ |
| **Good (18-22)** | 42 | 30+ |
| **Acceptable (13-17)** | 5 | <5 |
| **Errors** | 5 | 0 |
| **Avg Latency** | 4,650ms | <5,000ms ✅ |

---

## Category Baseline (Coverage / Precision)

| Category | Coverage | Precision | Priority |
|----------|----------|-----------|----------|
| action | 2.36 | 4.72 | 🔴 HIGH |
| style | 3.23 | 3.62 | 🔴 HIGH |
| subject | 3.49 | 3.98 | 🟡 MEDIUM |
| lighting | 3.91 | 4.17 | 🟡 MEDIUM |
| environment | 4.06 | 4.51 | 🟢 OK |
| audio | 4.02 | 4.60 | 🟢 OK |
| camera | 4.26 | 4.32 | 🟢 OK |
| shot | 4.43 | 4.64 | ✅ GOOD |
| technical | 4.87 | 4.87 | ✅ GOOD |

---

## Top Issues to Fix

### 1. Action Coverage (2.36/5) 🔴 CRITICAL
**Problem:** Missing critical actions like "jogging", "leaping into the air to catch a ball"
**Impact:** Core user value - actions are primary edit targets
**Status:** Coverage dropped from 3.04 → 2.36 (trade-off for better precision)
**Fix:** Improve action extraction while maintaining precision gains

### 2. Abstract Concepts (29 false positives)
**Problem:** Extracting non-visual concepts like "Naturalistic", "Terrence Malick-inspired"
**Impact:** Precision across style/subject categories
**Status:** Improved from 57 → 29 false positives
**Fix:** Continue strengthening "visual control point" filtering

### 3. Taxonomy Errors
**Problem:** 
- `shot.type → camera.movement` (9x) - e.g. "static shot", "handheld tracking"
- `shot.type → camera.focus` (7x) - e.g. "shallow focus", "deep focus"
- `camera.focus → camera.lens` (5x) - e.g. "f/1.8-f/2.8"
**Impact:** Classification accuracy
**Fix:** Update schema/few-shot examples for shot/camera distinctions

### 4. Style Metadata Inflation
**Problem:** "minimal motion blur" counted 26x as missed
**Note:** This is boilerplate, not user-editable content
**Fix:** Either exclude from evaluation OR stop generating this boilerplate

### 5. Subject Coverage/Precision (3.49/3.98)
**Problem:** Both coverage and precision dropped slightly
**Impact:** Subject identification accuracy
**Fix:** Review subject extraction patterns

---

## Improvement Tracking

| Date | Change | Score | Δ |
|------|--------|-------|---|
| 2025-12-23 | Initial Baseline | 18.76 | - |
| 2025-12-23 | Remove 3 judge-failing prompts, add Eye-level to vocab | 19.29 | +0.53 |
| 2025-12-24 | **New Baseline** - Precision improvements, latency optimization | **19.32** | **+0.56** |

---

## Changes Log

### 2025-12-24: New Baseline Established
**Key Improvements:**
- **Score:** 18.76 → 19.32 (+0.56)
- **Latency:** 8,464ms → 4,650ms (-45%, now under target)
- **False Positives:** 138 → 112 (-19%)
- **Abstract Concepts:** 57 → 29 false positives (-49%)
- **Span Count:** 31.3 → 21.42 (-35% more focused)

**Trade-offs:**
- Action coverage: 3.04 → 2.36 (-0.68) - needs attention
- Subject coverage/precision: slight decrease
- Errors: 1 → 5 (still low)

**Status:** Better overall precision and speed, but action extraction needs improvement.

### 2025-12-23: Initial Fixes
1. **Removed 3 prompts causing judge parser failures:**
   - `PnvcC4p5Z3eMKSEXlAmN` (woman playing computer games)
   - `KdmT0ljWyrRRDSYwMZ94` (man driving a car)
   - `BOTBWJMaxdM5HTPWYkL4` (large box exploding)
   - Evaluation now uses 52 prompts instead of 54

2. **Added hyphenated camera angle variants to vocab.json:**
   - `Eye-Level`, `eye-level` (previously only had `Eye Level`)
   - `Low-Angle`, `High-Angle` 
   - This offloads classification to NLP (100% precision) instead of LLM
   - **Result:** Camera coverage 4.02 → 4.26 (+0.24), precision 4.33 → 4.32 (-0.01)

3. **Added f-stop range pattern to NlpSpanService.ts:**
   - New regex: `/\bf\s*\/\s*\d+(?:\.\d+)?\s*-\s*f?\s*\/?\s*\d+(?:\.\d+)?\b/gi`
   - Matches: `f/1.8-f/2.8`, `f/1.8-2.8`, `f/1.8 - f/2.8`
   - Fixes taxonomy errors for f-stop ranges

---

## Files

- `baseline.json` - Full evaluation snapshot
- `baseline-report.txt` - Human-readable report
- `latest.json` - Most recent evaluation (symlink)
- `latest-report.txt` - Most recent report (symlink)

---

## How to Run Evaluation

```bash
cd /Users/bryceharmon/Desktop/prompt-builder
npm run eval:span-labeling
```

Compare against baseline:
```bash
# After running new evaluation
diff snapshots/baseline-report.txt snapshots/latest-report.txt
```
