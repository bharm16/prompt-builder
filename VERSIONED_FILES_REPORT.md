# Versioned Files Report
Generated: 2025-11-02

## Summary
This report identifies all versioned, duplicate, and backup files in the prompt-builder codebase that may need cleanup or consolidation.

---

## 1. V2/V3 Versioned Files

**Total Found: 5 files**

### Client Files
- `./tests/unit/client/services/CacheServiceV2.test.js`
- `./client/src/services/PromptOptimizationApiV2.js`

### Server Files
- `./server/src/clients/__tests__/ClaudeAPIClientV2.test.js`
- `./server/src/clients/ClaudeAPIClientV2.js`
- `./server/src/services/CacheServiceV2.js`

**Recommendation**: Review if V2 versions are the current implementations or if there are V1 versions that should be removed.

---

## 2. Enhanced/Improved/New Versions

**Total Found: 3 files**

### Component Files
- `./client/src/components/wizard/StepCreativeBriefEnhanced.jsx`
- `./client/src/components/wizard/EnhancedInput.jsx`
- `./client/src/components/wizard/SummaryReviewEnhanced.jsx`

**Recommendation**: Check if "Enhanced" versions have replaced original components. If so, consider renaming to remove "Enhanced" suffix and delete originals.

---

## 3. Backup Files

**Total Found: 6 files**

### Server Backups
- `./server/index.js.backup`
- `./server/src/llm/spanLabeler.js.backup`
- `./server/src/services/PromptOptimizationService.js.backup`

### Client Backups
- `./client/src/components/wizard/StepCoreConcept.jsx.backup`
- `./client/src/components/VideoConceptBuilder.jsx.backup`
- `./client/src/components/SuggestionsPanel.jsx.backup`

**Recommendation**: These are temporary backup files that should be removed if the current versions are stable. Consider committing or deleting.

---

## 4. Numbered Versions (_1, _2, -copy)

**Total Found: 0 files**

✓ No numbered version files found - this is good!

---

## Overall Recommendations

1. **Backup Files (6 files)**:
   - Can likely be safely deleted if current versions are working
   - Should NOT be committed to version control
   - Consider adding `*.backup` to `.gitignore`

2. **V2 Files (5 files)**:
   - Verify if these are current implementations
   - Look for corresponding V1 files that may be obsolete
   - Consider removing version suffix once V2 is confirmed as primary

3. **Enhanced Files (3 files)**:
   - Check if original (non-Enhanced) versions exist
   - If Enhanced is the current version, rename to remove "Enhanced" suffix
   - Delete obsolete original versions

**Total files to review: 14**
**Backup files to potentially delete: 6**
**Versioned files to potentially consolidate: 8**

---

## Next Steps

1. Review each V2 file to determine if V1 equivalents exist
2. Check if Enhanced components have replaced originals
3. Test that current versions work correctly
4. Delete backup files if current code is stable
5. Rename V2/Enhanced files to canonical names if they're the primary versions
6. Update imports/references after renaming
7. Add `*.backup`, `*.bak`, `*.old` to `.gitignore`
