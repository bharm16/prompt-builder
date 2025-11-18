# Setup Guide: Using Claude Code Templates

This guide shows you how to integrate the templates into your daily workflow.

---

## Step 1: Add Files to Your Repo (2 minutes)

```bash
# In your project root
mkdir -p docs/architecture

# Copy the template files
cp /path/to/CLAUDE_CODE_TEMPLATES.md docs/architecture/
cp /path/to/CLAUDE_CODE_CHEATSHEET.md docs/architecture/

# Commit them
git add docs/architecture/
git commit -m "Add Claude Code architecture templates"
```

---

## Step 2: Add to Project Knowledge (1 minute)

1. Open your project in Claude UI
2. Go to Project Settings
3. Add these files to Project Knowledge:
   - `docs/architecture/CLAUDE_CODE_TEMPLATES.md`
   - `docs/architecture/CLAUDE_CODE_CHEATSHEET.md`
   - `client/src/components/VideoConceptBuilder/REFACTORING_SUMMARY.md` (if not already added)
   
4. Wait for indexing to complete

**Why:** Claude Code can search project knowledge when referenced, making it easier to find patterns.

---

## Step 3: Create Aliases for Validation (2 minutes)

Add to your `~/.bashrc` (Linux) or `~/.zshrc` (Mac):

```bash
# Quick validation commands
alias cc-check="find client/src server/src -type f \( -name '*.js' -o -name '*.jsx' \) -exec wc -l {} + | sort -rn | head -20"

# Check regular components (should be < 200 lines)
alias cc-fe="find client/src -name '*.jsx' -path '*/components/*' -exec wc -l {} + | awk '\$1 > 200 {print \"❌ Component over 200: \" \$0}'"

# Check orchestrator components (should be < 500 lines)
alias cc-fe-main="find client/src -name '*.jsx' ! -path '*/components/*' -exec wc -l {} + | awk '\$1 > 500 {print \"❌ Orchestrator over 500: \" \$0}'"

# Check orchestrator services (should be < 500 lines)
alias cc-be-main="find server/src/services -maxdepth 1 -name '*.js' -exec wc -l {} + | awk '\$1 > 500 {print \"❌ Service orchestrator over 500: \" \$0}'"

# Check specialized services (should be < 300 lines)
alias cc-be-spec="find server/src/services -mindepth 2 -name '*.js' -exec wc -l {} + | awk '\$1 > 300 {print \"❌ Specialized service over 300: \" \$0}'"

alias cc-all="find client/src server/src -name '*.js' -o -name '*.jsx' | xargs wc -l | sort -rn"
```

Then reload: `source ~/.bashrc` or `source ~/.zshrc`

Now you can run:
```bash
cc-check      # Check top 20 largest files
cc-fe         # Check regular UI components (< 200 lines)
cc-fe-main    # Check orchestrator components (< 500 lines)
cc-be-main    # Check orchestrator services (< 500 lines)
cc-be-spec    # Check specialized services (< 300 lines)
```

---

## Step 4: Create Text Snippets (5 minutes - OPTIONAL but saves tons of time)

### Option A: VS Code Snippets

Create `.vscode/claude-code.code-snippets`:

```json
{
  "Claude Code Frontend Feature": {
    "prefix": "cc-frontend",
    "body": [
      "Add ${1:FEATURE_NAME}",
      "",
      "ARCHITECTURE: VideoConceptBuilder pattern",
      "- ${2:ComponentName}.jsx (orchestrator, max 500 lines)",
      "- hooks/use${2:ComponentName}State.js (useReducer)",
      "- api/${3:apiName}Api.js (fetch calls)",
      "- components/ (UI < 200 lines each)",
      "",
      "REFERENCE: client/src/components/VideoConceptBuilder/",
      "SHOW STRUCTURE FIRST"
    ],
    "description": "Template for new frontend feature"
  },
  "Claude Code Backend Service": {
    "prefix": "cc-backend",
    "body": [
      "Add ${1:SERVICE_NAME}",
      "",
      "ARCHITECTURE: PromptOptimizationService pattern",
      "- ${2:MainService}.js (orchestrator, max 500 lines)",
      "- services/${3:service-name}/ (specialized services < 300 lines)",
      "- templates/ (.md files for prompts)",
      "",
      "REFERENCE: server/src/services/prompt-optimization/PromptOptimizationService.js",
      "SHOW STRUCTURE FIRST"
    ],
    "description": "Template for new backend service"
  },
  "Claude Code Modify": {
    "prefix": "cc-modify",
    "body": [
      "Modify ${1:FILE_PATH} to ${2:DESCRIPTION}",
      "",
      "CURRENT: ${1:FILE_PATH} ($(wc -l ${1:FILE_PATH}))",
      "CONSTRAINTS:",
      "- Maintain existing pattern",
      "- No file over ${3:[500 orchestrator | 200 component | 300 service]} lines",
      "- If exceeds, refactor first",
      "",
      "SHOW WHAT CHANGES BEFORE implementing"
    ],
    "description": "Template for modifying existing code"
  }
}
```

**Usage:** Type `cc-frontend` and press Tab in VS Code.

### Option B: Text Expansion Tool (Mac: Text Expander, Windows: AutoHotkey)

Create shortcuts:
- `;ccfe` → Expands to frontend template
- `;ccbe` → Expands to backend template
- `;ccmod` → Expands to modify template

---

## Step 5: Keep Cheatsheet Visible (CRITICAL)

**Option A: Browser Tab**
```bash
# Open in browser (Mac)
open docs/architecture/CLAUDE_CODE_CHEATSHEET.md

# Or serve it locally
npx serve docs/architecture/
# Then open http://localhost:3000/CLAUDE_CODE_CHEATSHEET.md
```

**Option B: Terminal Split**
```bash
# In a terminal split/pane, keep this running:
watch -n 1 cat docs/architecture/CLAUDE_CODE_CHEATSHEET.md
```

**Option C: Printed Copy** (seriously)
Print `CLAUDE_CODE_CHEATSHEET.md` and keep it next to your monitor during development.

**Option D: Second Monitor**
Just open the cheatsheet on your second monitor.

---

## Step 6: Test Your Setup (3 minutes)

### Test 1: Validate Commands Work
```bash
cd /path/to/your/project
cc-check
# Should show top 20 largest files
```

### Test 2: Project Knowledge Works
In Claude UI:
```
What's the architecture pattern for frontend components?
```
Should reference `VideoConceptBuilder` from your docs.

### Test 3: Full Claude Code Request
```bash
claude-code "Add a simple ToastMessage component

ARCHITECTURE: VideoConceptBuilder pattern
- ToastMessage.jsx (UI component, max 200 lines)
- hooks/useToast.js (max 150 lines)

REFERENCE: client/src/components/VideoConceptBuilder/components/
SHOW STRUCTURE FIRST"
```

Claude Code should:
1. Show you the proposed structure
2. Ask for confirmation
3. Follow the pattern

---

## Daily Workflow

### Morning Setup (30 seconds)
```bash
# Open project
cd ~/projects/prompt-builder

# Open cheatsheet in browser tab
open docs/architecture/CLAUDE_CODE_CHEATSHEET.md

# Or print to terminal
cat docs/architecture/CLAUDE_CODE_CHEATSHEET.md
```

### When Making a Feature Request (2 minutes)

1. **Open cheatsheet** (you already have it open)
2. **Copy appropriate template**
   - New frontend? Copy "New Frontend Feature" template
   - New backend? Copy "New Backend Service" template
   - Modifying? Copy "Modify Existing Code" template
3. **Fill in the blanks** (component names, feature description)
4. **Add reference** to similar existing code
5. **Paste into claude-code request**

### After Claude Code Runs (30 seconds)

```bash
# Check file sizes
cc-check

# Any violations?
cc-fe
cc-be

# If violations found, fix before continuing
```

### Before Committing (1 minute)

```bash
# Final check
cc-check

# Run tests
npm test

# If all good, commit
git add .
git commit -m "Add [feature] following architecture patterns"
```

---

## Example: Real Usage Session

```bash
# 1. Morning: Open cheatsheet
open docs/architecture/CLAUDE_CODE_CHEATSHEET.md

# 2. Need to add export feature
# Copy "New Frontend Feature" template from cheatsheet
# Fill in blanks:
#   - FEATURE: export to PDF functionality
#   - ComponentName: ExportButton
#   - Reference: similar buttons in VideoConceptBuilder

# 3. Run claude-code with completed template
claude-code "Add export to PDF functionality

ARCHITECTURE: VideoConceptBuilder pattern
- ExportButton.jsx (UI component, max 200 lines)
- hooks/usePdfExport.js (max 150 lines)
- api/promptOptimizerApi.js (add exportToPdf method)

REFERENCE: client/src/components/VideoConceptBuilder/components/
SHOW STRUCTURE FIRST"

# 4. Claude Code shows structure, looks good, implement

# 5. After implementation, validate
cc-check
# Shows ExportButton.jsx: 145 lines ✅
# Shows usePdfExport.js: 89 lines ✅

# 6. Run tests
npm test

# 7. Commit
git add .
git commit -m "Add PDF export following VideoConceptBuilder pattern"
```

**Time spent:** ~5 minutes including validation
**Quality:** Follows architecture patterns automatically
**Technical debt:** Zero

---

## Troubleshooting

### "Claude Code isn't following the patterns"

**Solution:** Be more explicit. Instead of:
```bash
claude-code "add export feature"
```

Do:
```bash
claude-code "Add export feature

ARCHITECTURE: VideoConceptBuilder pattern (see client/src/components/VideoConceptBuilder/)
CONSTRAINTS:
- Orchestrator max 500 lines
- UI components max 200 lines
- Hooks max 150 lines
- API calls in api/ layer

SHOW STRUCTURE BEFORE implementing"
```

### "File exceeded size limits"

**Solution:** Refactor before adding more:
```bash
claude-code "Refactor [file] - currently [X] lines, exceeds [limit]

Follow VideoConceptBuilder/REFACTORING_SUMMARY.md pattern:
- Extract to hooks/
- Extract to components/
- Extract to utils/

Target: Main component under [limit] lines
SHOW REFACTORING PLAN FIRST"
```

### "I keep forgetting to check sizes"

**Solution:** Add to git pre-commit hook:

Create `.git/hooks/pre-commit`:
```bash
#!/bin/bash

echo "Checking file sizes..."

# Check UI components (should be < 200 lines)
violations=$(find client/src -name "*.jsx" -path "*/components/*" -exec wc -l {} + | awk '$1 > 200 {print $0}')
if [ ! -z "$violations" ]; then
  echo "❌ UI components exceed 200 lines:"
  echo "$violations"
  echo ""
  echo "Refactor before committing."
  exit 1
fi

# Check orchestrator components (should be < 500 lines)
violations=$(find client/src -name "*.jsx" ! -path "*/components/*" -exec wc -l {} + | awk '$1 > 500 {print $0}')
if [ ! -z "$violations" ]; then
  echo "❌ Orchestrator components exceed 500 lines:"
  echo "$violations"
  echo ""
  echo "Refactor before committing."
  exit 1
fi

# Check specialized services (should be < 300 lines)
violations=$(find server/src/services -mindepth 2 -name "*.js" -exec wc -l {} + | awk '$1 > 300 {print $0}')
if [ ! -z "$violations" ]; then
  echo "❌ Specialized services exceed 300 lines:"
  echo "$violations"
  echo ""
  echo "Refactor before committing."
  exit 1
fi

# Check orchestrator services (should be < 500 lines)
violations=$(find server/src/services -maxdepth 1 -name "*.js" -exec wc -l {} + | awk '$1 > 500 {print $0}')
if [ ! -z "$violations" ]; then
  echo "❌ Orchestrator services exceed 500 lines:"
  echo "$violations"
  echo ""
  echo "Refactor before committing."
  exit 1
fi

echo "✅ All files within size limits"
exit 0
```

Make executable: `chmod +x .git/hooks/pre-commit`

---

## Advanced: Create a Helper Script

Create `scripts/claude-code-helper.sh`:

```bash
#!/bin/bash

# Claude Code Helper Script
# Usage: ./scripts/claude-code-helper.sh [new-frontend|new-backend|modify|check]

case "$1" in
  new-frontend)
    echo "Enter feature name:"
    read feature
    echo "Enter component name:"
    read component
    cat << EOF

Add $feature

ARCHITECTURE: VideoConceptBuilder pattern
- $component.jsx (orchestrator, max 500 lines)
- hooks/use${component}State.js (useReducer)
- api/${component,,}Api.js (fetch calls)
- components/ (UI < 200 lines each)

REFERENCE: client/src/components/VideoConceptBuilder/
SHOW STRUCTURE FIRST
EOF
    ;;
    
  new-backend)
    echo "Enter service name:"
    read service
    cat << EOF

Add $service

ARCHITECTURE: PromptOptimizationService pattern
- ${service}.js (orchestrator, max 500 lines)
- services/${service,,}/ (specialized services < 300 lines)
- templates/ (.md files for prompts)

REFERENCE: server/src/services/prompt-optimization/PromptOptimizationService.js
SHOW STRUCTURE FIRST
EOF
    ;;
    
  modify)
    echo "Enter file path:"
    read filepath
    lines=$(wc -l "$filepath" 2>/dev/null | awk '{print $1}')
    echo "Describe what to modify:"
    read description
    cat << EOF

Modify $filepath to $description

CURRENT: $filepath ($lines lines)
CONSTRAINTS:
- Maintain existing pattern
- No file over [500 orchestrator | 200 UI component | 300 service]
- If exceeds, refactor first

SHOW WHAT CHANGES BEFORE implementing
EOF
    ;;
    
  check)
    echo "Checking file sizes..."
    find client/src server/src -type f \( -name "*.js" -o -name "*.jsx" \) -exec wc -l {} + | sort -rn | head -20
    ;;
    
  *)
    echo "Usage: $0 {new-frontend|new-backend|modify|check}"
    exit 1
    ;;
esac
```

Make executable: `chmod +x scripts/claude-code-helper.sh`

**Usage:**
```bash
# Generate frontend template
./scripts/claude-code-helper.sh new-frontend
# Follow prompts, copy output to claude-code

# Check sizes
./scripts/claude-code-helper.sh check
```

---

## Summary: Your New Process

**Before using Claude Code:**
1. ✅ Cheatsheet is visible
2. ✅ Validation aliases are set up
3. ✅ Templates are accessible

**When using Claude Code:**
1. Copy template from cheatsheet
2. Fill in specifics
3. Reference existing code
4. Say "SHOW STRUCTURE FIRST"
5. Validate with `cc-check`

**Result:**
- Consistent architecture
- No god objects
- No technical debt
- Fast development

---

## Next Steps

1. ✅ Run Step 1-3 now (5 minutes)
2. ✅ Test with a small feature (10 minutes)
3. ✅ Use templates for all future requests
4. ✅ Check sizes after every claude-code run

**That's it. You're set up.**

Keep the cheatsheet visible and reference it every time you use Claude Code. After ~10 requests, it'll become muscle memory.
