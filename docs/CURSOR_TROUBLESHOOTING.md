# Cursor Troubleshooting Guide

## Quick Fixes for Extension Update Failures

If Cursor keeps breaking and you see extension update errors (like "Claude Code for VS Code" or "Codex"), try these solutions in order:

### Option 1: Run the Diagnostic Script (Recommended)

```bash
cd /Users/bryceharmon/Desktop/prompt-builder
./scripts/fix-cursor.sh
```

This script will:
- Check Cursor installation
- Clear corrupted caches
- Reset extension state
- Fix permissions

### Option 2: Manual Quick Fixes

#### Clear Extension Cache
```bash
# Close Cursor first!
killall Cursor

# Clear cache
rm -rf ~/Library/Caches/com.todesktop.230313mzl4w4u92/*

# Restart Cursor
```

#### Reset Extension State
```bash
# Close Cursor first!
killall Cursor

# Backup and clear extension state
mkdir -p ~/Desktop/cursor-backup
cp -r ~/Library/Application\ Support/Cursor/User/globalStorage ~/Desktop/cursor-backup/
rm -rf ~/Library/Application\ Support/Cursor/User/globalStorage/*claude*
rm -rf ~/Library/Application\ Support/Cursor/User/globalStorage/*codex*

# Restart Cursor
```

#### Full Cache Clear
```bash
# Close Cursor first!
killall Cursor

# Clear all caches
rm -rf ~/Library/Caches/com.todesktop.230313mzl4w4u92/*
rm -rf ~/Library/Application\ Support/Cursor/CachedData/*

# Restart Cursor
```

### Option 3: Fix Permissions

If you see permission errors:

```bash
# Fix ownership
sudo chown -R $(whoami) ~/Library/Application\ Support/Cursor
sudo chown -R $(whoami) ~/Library/Caches/com.todesktop.230313mzl4w4u92

# Fix permissions
chmod -R 755 ~/Library/Application\ Support/Cursor
```

### Option 4: Complete Reinstall

If nothing else works:

```bash
# 1. Close Cursor
killall Cursor

# 2. Backup your settings (optional)
cp -r ~/Library/Application\ Support/Cursor/User/settings.json ~/Desktop/cursor-settings-backup.json

# 3. Remove Cursor data
rm -rf ~/Library/Application\ Support/Cursor
rm -rf ~/Library/Caches/com.todesktop.230313mzl4w4u92
rm -rf ~/Library/Logs/Cursor

# 4. Reinstall Cursor from https://cursor.sh
```

## Common Causes

1. **Corrupted Extension Cache**: Most common cause of update failures
2. **Permission Issues**: macOS security settings blocking file access
3. **Incomplete Updates**: Cursor crashed during an update
4. **Disk Space**: Insufficient disk space preventing updates
5. **Network Issues**: Interrupted downloads during extension updates

## Prevention Tips

1. **Keep Cursor Updated**: Always update to the latest version
2. **Close Before Updates**: Let Cursor finish updates completely
3. **Monitor Disk Space**: Keep at least 5GB free
4. **Check Permissions**: Ensure Cursor has necessary macOS permissions
5. **Stable Network**: Use a stable connection for updates

## Workspace-Specific Settings

This workspace has minimal Cursor-specific settings:
- `.vscode/settings.json` - Only contains terminal scrollback and MCP config
- No conflicting extension configurations

If issues persist after fixes, check:
- macOS System Preferences > Security & Privacy > Privacy > Full Disk Access
- Ensure Cursor has necessary permissions

## Getting Help

If problems persist:
1. Check Cursor logs: `~/Library/Logs/Cursor/`
2. Report issues: https://cursor.sh/support
3. Check known issues: https://github.com/getcursor/cursor/issues
