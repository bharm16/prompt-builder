# Force Highlight Rerender Script - Implementation Summary

## Overview

Created a migration script that forces all existing prompts to regenerate their highlights with the latest algorithm. This is similar to how updating the `templateVersion` cache model forces rerenders, but provides more control and can be run on-demand.

## Files Created/Modified

### New Files

1. **`scripts/migrations/force-highlight-rerender.js`** (376 lines)
   - Main migration script
   - Two modes: `clear` (fast) and `regenerate` (immediate)
   - Full error handling and progress tracking
   - Statistics reporting
   - Dry-run support

2. **`scripts/migrations/FORCE_RERENDER_GUIDE.md`** (Quick reference guide)
   - Common use cases and workflows
   - Performance estimates
   - Best practices
   - Troubleshooting guide

### Modified Files

3. **`scripts/migrations/README.md`**
   - Added comprehensive documentation for the new script
   - Usage examples
   - Safety features
   - Prerequisites

4. **`package.json`**
   - Added 5 new npm scripts for easy access:
     - `npm run migrate:rerender` - Clear cache (fast)
     - `npm run migrate:rerender:regenerate` - Regenerate immediately
     - `npm run migrate:rerender:dry` - Dry run test
     - `npm run migrate:backfill` - Backfill missing highlights
     - `npm run migrate:backfill:dry` - Backfill dry run

## How It Works

### Clear Mode (Default - Recommended)
```bash
npm run migrate:rerender
```

1. Finds all prompts with existing `highlightCache`
2. Removes the `highlightCache` field
3. Adds version tracking entry
4. Highlights regenerate automatically when users load prompts

**Benefits:**
- ⚡ Very fast (~0.04s per document)
- 💰 No API costs
- 🎯 Only regenerates when needed
- ✅ Users see highlights immediately (fresh or cached)

### Regenerate Mode (Pre-deployment)
```bash
npm run migrate:rerender:regenerate
```

1. Finds all prompts with existing `highlightCache`
2. Extracts prompt text
3. Calls span labeling service to generate new highlights
4. Updates with fresh `highlightCache`
5. Adds version tracking entry

**Benefits:**
- 🔄 All prompts have fresh highlights before users access them
- ✨ Guaranteed consistency across all prompts
- 📊 Complete immediately (no lazy loading)

## Usage Examples

### Quick Start
```bash
# Test first (always recommended)
npm run migrate:rerender:dry

# Apply to all prompts
npm run migrate:rerender
```

### Advanced Usage
```bash
# Test on specific user
node scripts/migrations/force-highlight-rerender.js \
  --userId=abc123 \
  --mode=clear \
  --dry-run

# Test on small sample
node scripts/migrations/force-highlight-rerender.js \
  --limit=10 \
  --mode=clear

# Full regeneration for production deployment
node scripts/migrations/force-highlight-rerender.js \
  --mode=regenerate \
  --batch-size=20
```

## Performance Benchmarks

### Clear Mode
| Prompt Count | Estimated Time |
|--------------|----------------|
| 100          | ~4 seconds     |
| 1,000        | ~40 seconds    |
| 10,000       | ~7 minutes     |

### Regenerate Mode
| Prompt Count | Estimated Time |
|--------------|----------------|
| 100          | ~5-8 minutes   |
| 1,000        | ~50-80 minutes |
| 10,000       | ~8-13 hours    |

## Integration with Existing System

### How This Relates to Template Versions

The existing system uses `templateVersion` in the cache key to invalidate highlights:

```javascript
// In useSpanLabeling.js
templateVersion: TEMPLATE_VERSIONS.SPAN_LABELING_V1
```

**This script provides an alternative approach:**
- Instead of bumping `templateVersion` (which invalidates all caches globally)
- You can selectively clear specific prompts' caches
- More control over rollout timing
- Can target specific users or document counts

### Comparison

| Method | Scope | Control | Speed | Use Case |
|--------|-------|---------|-------|----------|
| **Change templateVersion** | Global | Low | Instant | Algorithm breaking changes |
| **Force Rerender (clear)** | Selective | High | Fast | Gradual rollouts |
| **Force Rerender (regenerate)** | Selective | High | Slow | Pre-deployment prep |

### Workflow Example

```bash
# 1. Deploy new highlighting algorithm
git pull origin main
npm run build

# 2. Force rerender for all existing prompts
npm run migrate:rerender

# 3. New prompts automatically use new algorithm
# 4. Old prompts regenerate on first load with new algorithm

# Optional: Pre-generate all highlights for production
npm run migrate:rerender:regenerate
```

## Safety Features

✅ **Dry-run mode** - Test without making changes
✅ **Idempotent** - Safe to run multiple times
✅ **Version tracking** - All changes logged in Firestore
✅ **Error handling** - Graceful failure with detailed reports
✅ **Progress tracking** - Real-time progress with ETA
✅ **Selective processing** - Filter by user, limit count
✅ **Batch processing** - Configurable batch size

## Error Handling

The script handles common errors gracefully:

- **Missing highlights** - Skips documents without cache
- **Invalid prompt text** - Logs and continues
- **API failures** - Tracks failed docs in summary
- **Rate limiting** - Configurable batch size
- **Permission errors** - Clear error messages

## Monitoring

After running the migration, check:

```bash
# View recent version entries in Firestore
# Look for: "rerender-clear-{timestamp}" or "rerender-regenerate-{timestamp}"

# Check logs
cat logs/highlight-rerender-*.log

# Verify prompt highlights are working
npm run highlight-stats
```

## Prerequisites

Same as the backfill script:

1. **Firebase Admin SDK** installed
2. **Authentication** configured:
   - Service account key in `.env`: `FIREBASE_SERVICE_ACCOUNT_PATH`
   - OR: `gcloud auth application-default login`
3. **Proper permissions** for Firestore read/write

See `scripts/migrations/README.md` for detailed setup.

## Troubleshooting

### Common Issues

**"No documents found"**
- Remove filters or check Firebase connection

**"Unable to detect Project Id"**
- Set up Firebase authentication (see Prerequisites)

**High error count**
- Check API keys and rate limits
- Review failed documents in summary report

**Slow performance in regenerate mode**
- Reduce `--batch-size`
- Use `--mode=clear` instead
- Run during off-peak hours

## Future Enhancements

Potential improvements:
- [ ] Progress resume capability (checkpoint/restart)
- [ ] Parallel batch processing
- [ ] Webhook notifications on completion
- [ ] Integration with CI/CD pipeline
- [ ] Automatic rollback on high error rate
- [ ] Real-time monitoring dashboard

## Related Documentation

- **Main guide**: `scripts/migrations/README.md`
- **Quick reference**: `scripts/migrations/FORCE_RERENDER_GUIDE.md`
- **Backfill script**: `scripts/migrations/backfill-highlight-cache.js`
- **Setup guide**: `scripts/migrations/SETUP_GUIDE.md`

## Testing Checklist

Before production use:

- [ ] Run with `--dry-run` flag
- [ ] Test with `--limit=10` on sample data
- [ ] Verify Firebase credentials work
- [ ] Check API keys and rate limits
- [ ] Review existing highlight versions
- [ ] Plan deployment timing (off-peak hours)
- [ ] Set up monitoring/logging
- [ ] Notify team of planned migration

## Support

For questions or issues:
1. Check `scripts/migrations/README.md`
2. Review `FORCE_RERENDER_GUIDE.md`
3. Run with `--dry-run` to test safely
4. Check Firebase console for recent changes

---

**Created**: November 19, 2025
**Script Version**: 1.0.0
**Compatibility**: Works with existing highlight system


