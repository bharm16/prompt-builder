# Span Highlighting - Cleanup Guide

## Overview

This guide documents files that should be removed after the consolidation is validated and stable for at least 1 sprint.

## Current Status

- ✅ **New structure created**: All files copied to `features/span-highlighting/`
- ✅ **Backward compatibility shims**: Re-export shims created in old locations
- ✅ **Tests passing**: 86/89 tests passing (3 pre-existing test failures)
- ⏳ **Validation period**: Keep old files for 1 sprint

## Files to Remove (After Validation Period)

### Phase 1: Remove Original Files (Keep Backup Copies)

The following original files have been backed up with `.original` extension and should be removed after validation:

```bash
# Original files backed up
client/src/utils/anchorRanges.js.original
client/src/utils/categoryValidators.js.original
client/src/features/prompt-optimizer/hooks/useSpanLabeling.js.original
client/src/features/prompt-optimizer/hooks/useHighlightRendering.js.original
```

**Action**: After 1 sprint, remove these `.original` backup files:

```bash
rm client/src/utils/anchorRanges.js.original
rm client/src/utils/categoryValidators.js.original
rm client/src/features/prompt-optimizer/hooks/useSpanLabeling.js.original
rm client/src/features/prompt-optimizer/hooks/useHighlightRendering.js.original
```

### Phase 2: Remove Old Directory Structures

These directories contain the original nested structure and should be removed after validation:

```bash
# Old nested directories (now consolidated)
client/src/features/prompt-optimizer/hooks/useSpanLabeling/
client/src/features/prompt-optimizer/hooks/useHighlightRendering/
```

**Action**: After 1 sprint, remove these directories:

```bash
rm -rf client/src/features/prompt-optimizer/hooks/useSpanLabeling/
rm -rf client/src/features/prompt-optimizer/hooks/useHighlightRendering/
```

### Phase 3: Remove Old Utility Files

These utilities have been moved to the new structure:

```bash
# Old utility files (now in span-highlighting/utils/)
client/src/features/prompt-optimizer/utils/spanUtils.js
client/src/features/prompt-optimizer/utils/spanValidation.js
client/src/features/prompt-optimizer/utils/tokenBoundaries.js
client/src/features/prompt-optimizer/utils/highlightConversion.js
```

**Action**: After 1 sprint, remove these files:

```bash
rm client/src/features/prompt-optimizer/utils/spanUtils.js
rm client/src/features/prompt-optimizer/utils/spanValidation.js
rm client/src/features/prompt-optimizer/utils/tokenBoundaries.js
rm client/src/features/prompt-optimizer/utils/highlightConversion.js
```

### Phase 4: Remove Other Moved Hooks

```bash
# Other hooks moved to new location
client/src/features/prompt-optimizer/hooks/useHighlightSourceSelection.js
client/src/features/prompt-optimizer/hooks/useProgressiveSpanRendering.js
```

**Action**: After 1 sprint, remove these files:

```bash
rm client/src/features/prompt-optimizer/hooks/useHighlightSourceSelection.js
rm client/src/features/prompt-optimizer/hooks/useProgressiveSpanRendering.js
```

### Phase 5: Remove Old Test Files

These test files have been copied to the new location:

```bash
# Old test files (now in span-highlighting/__tests__/)
client/src/utils/__tests__/anchorRanges.test.js
client/src/utils/__tests__/categoryValidators.test.js
client/src/features/prompt-optimizer/hooks/__tests__/useSpanLabeling.cache.test.jsx
client/src/features/prompt-optimizer/utils/__tests__/tokenBoundaries.test.js
```

**Action**: After 1 sprint, remove these test files:

```bash
rm client/src/utils/__tests__/anchorRanges.test.js
rm client/src/utils/__tests__/categoryValidators.test.js
rm client/src/features/prompt-optimizer/hooks/__tests__/useSpanLabeling.cache.test.jsx
rm client/src/features/prompt-optimizer/utils/__tests__/tokenBoundaries.test.js
```

### Phase 6: Remove Backward Compatibility Shims

**IMPORTANT**: This should be the LAST step, only after confirming ALL consumers have been updated.

```bash
# Shim files (provide backward compatibility)
client/src/utils/anchorRanges.js
client/src/utils/categoryValidators.js
client/src/features/prompt-optimizer/hooks/useSpanLabeling.js
client/src/features/prompt-optimizer/hooks/useHighlightRendering.js
```

**Action**: After confirming no imports from old paths remain, remove shims:

```bash
rm client/src/utils/anchorRanges.js
rm client/src/utils/categoryValidators.js
rm client/src/features/prompt-optimizer/hooks/useSpanLabeling.js
rm client/src/features/prompt-optimizer/hooks/useHighlightRendering.js
```

## Validation Checklist

Before removing any files, verify:

- [ ] All tests passing (currently 86/89, fix 3 pre-existing failures)
- [ ] No console errors in development
- [ ] Highlighting works correctly in all modes
- [ ] Span labeling API calls successful
- [ ] Cache persistence working
- [ ] No performance regressions
- [ ] Deployed to staging for at least 1 sprint
- [ ] No user-reported issues related to highlighting/spans

## Search for Remaining Old Imports

Before removing shims, search for any remaining imports from old paths:

```bash
# Search for old import patterns
grep -r "from.*utils/anchorRanges" client/src/
grep -r "from.*utils/categoryValidators" client/src/
grep -r "from.*prompt-optimizer/hooks/useSpanLabeling" client/src/
grep -r "from.*prompt-optimizer/hooks/useHighlightRendering" client/src/
```

If any are found, update them to:

```javascript
// Update to new import
import { ... } from '@/features/span-highlighting';
```

## Rollback Plan

If issues are discovered after cleanup:

1. **Restore from backup**: The `.original` files can be restored
2. **Restore from git**: Use `git checkout HEAD~1 -- <file>` to restore
3. **Re-add shims**: Re-create the shim files if needed
4. **Monitor logs**: Check for import errors or runtime issues

## Complete Cleanup Script

**ONLY RUN AFTER VALIDATION PERIOD (1+ sprint):**

```bash
#!/bin/bash
# cleanup-span-highlighting.sh
# Run this script ONLY after validation period

echo "🗑️  Cleaning up old span highlighting files..."

# Phase 1: Remove .original backups
echo "Phase 1: Removing .original backups..."
rm -f client/src/utils/anchorRanges.js.original
rm -f client/src/utils/categoryValidators.js.original
rm -f client/src/features/prompt-optimizer/hooks/useSpanLabeling.js.original
rm -f client/src/features/prompt-optimizer/hooks/useHighlightRendering.js.original

# Phase 2: Remove old nested directories
echo "Phase 2: Removing old nested directories..."
rm -rf client/src/features/prompt-optimizer/hooks/useSpanLabeling/
rm -rf client/src/features/prompt-optimizer/hooks/useHighlightRendering/

# Phase 3: Remove old utility files
echo "Phase 3: Removing old utility files..."
rm -f client/src/features/prompt-optimizer/utils/spanUtils.js
rm -f client/src/features/prompt-optimizer/utils/spanValidation.js
rm -f client/src/features/prompt-optimizer/utils/tokenBoundaries.js
rm -f client/src/features/prompt-optimizer/utils/highlightConversion.js

# Phase 4: Remove other moved hooks
echo "Phase 4: Removing other moved hooks..."
rm -f client/src/features/prompt-optimizer/hooks/useHighlightSourceSelection.js
rm -f client/src/features/prompt-optimizer/hooks/useProgressiveSpanRendering.js

# Phase 5: Remove old test files
echo "Phase 5: Removing old test files..."
rm -f client/src/utils/__tests__/anchorRanges.test.js
rm -f client/src/utils/__tests__/categoryValidators.test.js
rm -f client/src/features/prompt-optimizer/hooks/__tests__/useSpanLabeling.cache.test.jsx
rm -f client/src/features/prompt-optimizer/utils/__tests__/tokenBoundaries.test.js

# Phase 6: Remove shims (ONLY if no old imports remain)
echo "Phase 6: Checking for old imports..."
if grep -rq "from.*utils/anchorRanges\|from.*utils/categoryValidators\|from.*prompt-optimizer/hooks/useSpanLabeling\|from.*prompt-optimizer/hooks/useHighlightRendering" client/src/; then
  echo "⚠️  WARNING: Old imports still found! NOT removing shims."
  echo "Please update all imports to use @/features/span-highlighting"
  exit 1
else
  echo "✅ No old imports found. Removing shims..."
  rm -f client/src/utils/anchorRanges.js
  rm -f client/src/utils/categoryValidators.js
  rm -f client/src/features/prompt-optimizer/hooks/useSpanLabeling.js
  rm -f client/src/features/prompt-optimizer/hooks/useHighlightRendering.js
fi

echo "✅ Cleanup complete!"
echo "Remember to:"
echo "  1. Run tests: npm test -- span-highlighting"
echo "  2. Check for console errors"
echo "  3. Commit changes"
```

## Timeline

- **Week 1-2**: Validation period (current)
- **Week 3**: Review metrics, user feedback
- **Week 4**: Execute cleanup if stable
- **Week 5+**: Monitor for any issues

## Success Criteria

Cleanup can proceed when:

1. ✅ No critical bugs reported
2. ✅ All tests passing
3. ✅ Performance metrics stable
4. ✅ Team consensus on stability
5. ✅ Code review approved

---

**Last Updated**: Initial consolidation  
**Status**: Validation period - DO NOT CLEANUP YET  
**Next Review**: After 1 sprint (2-4 weeks)

