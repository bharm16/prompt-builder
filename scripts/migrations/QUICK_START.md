# Migration Scripts - Quick Start

## 🚀 Common Commands

### Force Highlight Rerender

```bash
# 1. Test first (ALWAYS do this)
npm run migrate:rerender:dry

# 2. Clear cache (fast, recommended)
npm run migrate:rerender

# 3. Regenerate immediately (slower, for pre-deployment)
npm run migrate:rerender:regenerate
```

### Backfill Missing Highlights

```bash
# Test first
npm run migrate:backfill:dry

# Apply
npm run migrate:backfill
```

## 📋 When to Use Each Script

### Force Rerender (`force-highlight-rerender.js`)
**Use when:**
- ✅ You've updated the highlighting algorithm
- ✅ You want to apply new changes to existing prompts
- ✅ Similar to updating cache model/templateVersion

**Don't use when:**
- ❌ Prompts don't have highlights yet (use backfill instead)

### Backfill (`backfill-highlight-cache.js`)
**Use when:**
- ✅ Prompts are missing highlights entirely
- ✅ New users with old prompts
- ✅ After data migration

**Don't use when:**
- ❌ You just want to update existing highlights (use force rerender)

## 🎯 Quick Decision Guide

```
Do prompts have highlights already?
├─ YES → Use force-highlight-rerender.js
│   ├─ Fast rollout → --mode=clear (default)
│   └─ Pre-deployment → --mode=regenerate
│
└─ NO → Use backfill-highlight-cache.js
```

## ⚡ Performance at a Glance

| Script | Mode | Speed (per doc) | When to Use |
|--------|------|-----------------|-------------|
| Force Rerender | clear | ~0.04s | Regular updates |
| Force Rerender | regenerate | ~3-5s | Pre-deployment |
| Backfill | - | ~3-5s | Missing highlights |

## 🔧 Advanced Options

### Selective Processing

```bash
# Specific user
node scripts/migrations/force-highlight-rerender.js \
  --userId=abc123 \
  --mode=clear

# Limited count (testing)
node scripts/migrations/force-highlight-rerender.js \
  --limit=10 \
  --dry-run

# Custom batch size
node scripts/migrations/force-highlight-rerender.js \
  --batch-size=20 \
  --mode=regenerate
```

## 📊 Expected Results

### Clear Mode (1000 prompts)
```
⏱️  Time: ~40 seconds
💰 API Calls: 0
✨ Regeneration: On next load
```

### Regenerate Mode (1000 prompts)
```
⏱️  Time: ~50-80 minutes
💰 API Calls: 1000+
✨ Regeneration: Immediate
```

## ✅ Pre-flight Checklist

Before running migrations:

- [ ] Backup important data
- [ ] Run with `--dry-run` first
- [ ] Test with `--limit=10`
- [ ] Verify Firebase credentials
- [ ] Check API rate limits
- [ ] Plan for off-peak hours (if regenerate mode)

## 🆘 Quick Troubleshooting

**"Unable to detect Project Id"**
```bash
# Set up Firebase auth
export FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/service-account.json
# OR
gcloud auth application-default login
```

**"No documents found"**
```bash
# Remove filters
node scripts/migrations/force-highlight-rerender.js --mode=clear
# (without --userId or --limit)
```

**Too slow?**
```bash
# Use clear mode instead of regenerate
npm run migrate:rerender
```

## 📚 Full Documentation

- **Complete guide**: `scripts/migrations/README.md`
- **Use cases**: `scripts/migrations/FORCE_RERENDER_GUIDE.md`
- **Implementation**: `HIGHLIGHT_RERENDER_SUMMARY.md`

## 💡 Pro Tips

1. **Always test first**: Use `--dry-run` before applying changes
2. **Start small**: Test with `--limit=10` first
3. **Prefer clear mode**: Faster and more efficient
4. **Monitor progress**: Check logs and Firestore console
5. **Save output**: Redirect to log file for audit trail

```bash
npm run migrate:rerender 2>&1 | tee logs/migration-$(date +%Y%m%d).log
```

## 🔗 Quick Links

```bash
# View this guide
cat scripts/migrations/QUICK_START.md

# Full documentation
cat scripts/migrations/README.md

# Use case examples
cat scripts/migrations/FORCE_RERENDER_GUIDE.md
```

---

**Need help?** Check the full documentation or run with `--dry-run` to safely test.


