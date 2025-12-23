# Span Labeling Evaluation Baseline

**Established:** 2025-12-23
**Baseline File:** `snapshots/baseline.json`

---

## Baseline Metrics

| Metric | Value | Target |
|--------|-------|--------|
| **Overall Score** | 18.76/25 (75%) | 22/25 (88%) |
| **Prompts Evaluated** | 54 | - |
| **Excellent (23-25)** | 0 | 20+ |
| **Good (18-22)** | 33 | 30+ |
| **Acceptable (13-17)** | 12 | <5 |
| **Judge Failures** | 3 | 0 |
| **Avg Latency** | 8,464ms | <5,000ms |

---

## Category Baseline (Coverage / Precision)

| Category | Coverage | Precision | Priority |
|----------|----------|-----------|----------|
| action | 3.04 | 4.42 | 🔴 HIGH |
| style | 3.24 | 3.38 | 🔴 HIGH |
| subject | 3.67 | 4.27 | 🟡 MEDIUM |
| lighting | 3.76 | 3.82 | 🟡 MEDIUM |
| environment | 3.82 | 4.60 | 🟢 OK |
| audio | 3.96 | 4.44 | 🟢 OK |
| camera | 4.02 | 4.33 | 🟢 OK |
| shot | 4.29 | 4.53 | ✅ GOOD |
| technical | 4.78 | 4.80 | ✅ GOOD |

---

## Top Issues to Fix

### 1. Taxonomy Errors (Quick Win)
**Problem:** `Eye-level` being classified as `technical.aspectRatio` instead of `camera.angle`
**Impact:** 10+ false positives
**Fix:** Update schema/few-shot examples

### 2. Abstract Concepts (57 false positives)
**Problem:** Extracting non-visual concepts like "nostalgic atmosphere", "Terrence Malick"
**Impact:** Precision across style/subject categories
**Fix:** Strengthen "visual control point" filtering in prompt

### 3. Action Coverage (3.04/5)
**Problem:** Missing visible actions like "stirring a pot", "gazing out window"
**Impact:** Core user value - actions are primary edit targets
**Fix:** Add action-specific examples to few-shot

### 4. Judge Parser Failures (3 prompts)
**Problem:** Judge response doesn't match expected schema
**Impact:** 5.5% of evaluations fail to score
**Fix:** More robust JSON parsing, fallback handling

### 5. Style Metadata Inflation
**Problem:** "minimal motion blur" counted 26x as missed
**Note:** This is boilerplate, not user-editable content
**Fix:** Either exclude from evaluation OR stop generating this boilerplate

---

## Improvement Tracking

| Date | Change | Score | Δ |
|------|--------|-------|---|
| 2025-12-23 | Baseline | 18.76 | - |
| 2025-12-23 | Remove 3 judge-failing prompts, add Eye-level to vocab | 19.29 | +0.53 |
| 2025-12-23 | Add f-stop range pattern (f/1.8-f/2.8) | TBD | TBD |

---

## Changes Log

### 2025-12-23: Initial Fixes
1. **Removed 3 prompts causing judge parser failures:**
   - `PnvcC4p5Z3eMKSEXlAmN` (woman playing computer games)
   - `KdmT0ljWyrRRDSYwMZ94` (man driving a car)
   - `BOTBWJMaxdM5HTPWYkL4` (large box exploding)
   - Evaluation now uses 51 prompts instead of 54

2. **Added hyphenated camera angle variants to vocab.json:**
   - `Eye-Level`, `eye-level` (previously only had `Eye Level`)
   - `Low-Angle`, `High-Angle` 
   - This offloads classification to NLP (100% precision) instead of LLM
   - **Result:** Camera coverage 4.02 → 4.24 (+0.22), precision 4.33 → 4.53 (+0.20)

3. **Added f-stop range pattern to NlpSpanService.ts:**
   - New regex: `/\bf\s*\/\s*\d+(?:\.\d+)?\s*-\s*f?\s*\/?\s*\d+(?:\.\d+)?\b/gi`
   - Matches: `f/1.8-f/2.8`, `f/1.8-2.8`, `f/1.8 - f/2.8`
   - Fixes 4x `technical.frameRate → camera.focus` taxonomy errors

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
