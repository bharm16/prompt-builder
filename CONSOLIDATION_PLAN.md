# File Consolidation Plan
Generated: 2025-11-02

## Analysis Summary

This analysis reveals **incomplete migrations** - both V2 and Enhanced versions coexist with their originals, with split usage patterns indicating mid-migration state.

---

## Phase 2: V2 Files Analysis

### 1. ClaudeAPIClientV2 ✅ SIMPLE CASE
**Files:**
- ✓ `server/src/clients/ClaudeAPIClientV2.js` (10K, Oct 21)
- ✓ `server/src/clients/ClaudeAPIClient.js` (6.0K, Oct 21)

**Usage:**
- V2 imports: **1**
- V1 imports: **0**

**Status:** V2 is primary, V1 is dead code

**Action Plan:**
```bash
# V1 has no imports - delete it, rename V2 to canonical name
rm server/src/clients/ClaudeAPIClient.js
git mv server/src/clients/ClaudeAPIClientV2.js server/src/clients/ClaudeAPIClient.js

# Update the 1 import from V2 to canonical name
# Find: ClaudeAPIClientV2
# Replace: ClaudeAPIClient
```

---

### 2. CacheServiceV2 ⚠️ REVERSE MIGRATION
**Files:**
- ✓ `server/src/services/CacheServiceV2.js` (9.9K, Oct 21)
- ✓ `server/src/services/CacheService.js` (5.1K, Oct 21)

**Usage:**
- V2 imports: **2**
- V1 imports: **12**

**Status:** V1 is still primary! V2 appears to be experimental/incomplete

**Action Plan:**
```bash
# INVESTIGATE FIRST - Don't delete anything yet
# Option A: V2 is experimental - delete V2
# Option B: Migration incomplete - finish migrating 12 V1 imports to V2

# Recommended: DELETE V2 (it's not widely adopted)
rm server/src/services/CacheServiceV2.js
rm tests/unit/client/services/CacheServiceV2.test.js

# Update the 2 V2 imports to use V1
# Find: CacheServiceV2
# Replace: CacheService
```

---

### 3. PromptOptimizationApiV2 ✅ NEARLY COMPLETE
**Files:**
- ✓ `client/src/services/PromptOptimizationApiV2.js` (11K, Oct 29)
- ✓ `client/src/services/PromptOptimizationApi.js` (2.0K, Oct 28)

**Usage:**
- V2 imports: **5**
- V1 imports: **1**

**Status:** V2 is mostly primary, 1 straggler V1 import remains

**Action Plan:**
```bash
# Find the 1 remaining V1 import and update it to V2
# Then delete V1 and rename V2 to canonical

# Step 1: Find and update the 1 V1 import
grep -r "PromptOptimizationApi[^V]" client/ --include="*.js" --include="*.jsx" | grep -v node_modules

# Step 2: After updating, delete V1 and rename V2
rm client/src/services/PromptOptimizationApi.js
git mv client/src/services/PromptOptimizationApiV2.js client/src/services/PromptOptimizationApi.js

# Step 3: Update the 5 V2 imports to canonical name
# Find: PromptOptimizationApiV2
# Replace: PromptOptimizationApi
```

---

## Phase 3: Enhanced Files Analysis

### 1. StepCreativeBriefEnhanced ⚠️ BASE IS PRIMARY
**Files:**
- ✓ `client/src/components/wizard/StepCreativeBriefEnhanced.jsx` (10K, Oct 28)
- ✓ `client/src/components/wizard/StepCreativeBrief.jsx` (22K, Oct 28)

**Usage:**
- Enhanced imports: **3**
- Base imports: **6**

**Status:** Base is still primary (twice as many imports)

**Action Plan:**
```bash
# BASE is canonical - DELETE Enhanced version
rm client/src/components/wizard/StepCreativeBriefEnhanced.jsx

# Update the 3 Enhanced imports to use base
# Find: StepCreativeBriefEnhanced
# Replace: StepCreativeBrief
```

---

### 2. EnhancedInput ✅ RENAME ONLY
**Files:**
- ✓ `client/src/components/wizard/EnhancedInput.jsx` (4.4K, Oct 28)
- ✗ NO BASE FILE

**Usage:**
- Enhanced imports: **7**
- Base imports: **0**

**Status:** Enhanced is the only version (bad naming)

**Action Plan:**
```bash
# No base file exists - just rename Enhanced to canonical
git mv client/src/components/wizard/EnhancedInput.jsx client/src/components/wizard/Input.jsx

# Update the 7 imports
# Find: EnhancedInput
# Replace: Input
```

---

### 3. SummaryReviewEnhanced ⚠️ BASE IS PRIMARY
**Files:**
- ✓ `client/src/components/wizard/SummaryReviewEnhanced.jsx` (12K, Oct 28)
- ✓ `client/src/components/wizard/SummaryReview.jsx` (15K, Oct 29)

**Usage:**
- Enhanced imports: **3**
- Base imports: **6**

**Status:** Base is still primary (twice as many imports)

**Action Plan:**
```bash
# BASE is canonical - DELETE Enhanced version
rm client/src/components/wizard/SummaryReviewEnhanced.jsx

# Update the 3 Enhanced imports to use base
# Find: SummaryReviewEnhanced
# Replace: SummaryReview
```

---

## Execution Order

### SAFE DELETIONS (Delete experimental/unused versions)
1. ✅ Delete `ClaudeAPIClient.js` (V1, no imports)
2. ✅ Delete `CacheServiceV2.js` + test (V2 experimental, only 2 imports)
3. ✅ Delete `StepCreativeBriefEnhanced.jsx` (Enhanced has fewer imports)
4. ✅ Delete `SummaryReviewEnhanced.jsx` (Enhanced has fewer imports)

### RENAMES (Make primary versions canonical)
5. ✅ Rename `ClaudeAPIClientV2.js` → `ClaudeAPIClient.js`
6. ✅ Rename `PromptOptimizationApiV2.js` → `PromptOptimizationApi.js` (after updating 1 V1 import)
7. ✅ Rename `EnhancedInput.jsx` → `Input.jsx`

### IMPORT UPDATES
8. Update all imports to use new canonical names
9. Test that nothing breaks
10. Commit all changes

---

## Expected Results

**Before:**
- 8 versioned files
- Mixed imports causing confusion
- Unclear which version is canonical

**After:**
- 4 canonical files (one version each)
- Clear import paths
- No version suffixes
- 4 files deleted (~40K of duplicate code removed)

---

## Risk Assessment

**Low Risk:**
- ClaudeAPIClient V1 deletion (0 imports)
- EnhancedInput rename (standalone, no conflicts)

**Medium Risk:**
- CacheServiceV2 deletion (need to update 2 imports)
- StepCreativeBriefEnhanced deletion (need to update 3 imports)
- SummaryReviewEnhanced deletion (need to update 3 imports)

**Verify After Changes:**
- Run `npm run build` to check for import errors
- Run `npm test` if tests exist
- Check that no imports are broken

---

## Next Steps

1. Review this plan
2. Execute safe deletions first
3. Execute renames with import updates
4. Test build
5. Commit changes
