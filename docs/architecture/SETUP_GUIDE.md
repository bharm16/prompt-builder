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
cp /path/to/CLAUDE_CODE_RULES.md docs/architecture/

# Commit them
git add docs/architecture/
git commit -m "Add Claude Code architecture templates"
```

---

## Step 2: Add to Project Knowledge (1 minute)

1. Open your project in Claude UI
2. Go to Project Settings
3. Add these files to Project Knowledge:
   - `docs/architecture/CLAUDE_CODE_RULES.md`
   - `docs/architecture/CLAUDE_CODE_TEMPLATES.md`
   - `client/src/components/VideoConceptBuilder/REFACTORING_SUMMARY.md`
   
4. Wait for indexing to complete

---

## Step 3: Create Review Aliases (2 minutes)

Add to your `~/.bashrc` (Linux) or `~/.zshrc` (Mac):

```bash
# List largest files for manual review
alias cc-review="find client/src server/src -type f \( -name '*.js' -o -name '*.jsx' \) -exec wc -l {} + | sort -rn | head -20"

# These flag files for COHESION REVIEW, not automatic splitting
# Ask: "Does this have multiple responsibilities?"
alias cc-review-fe="echo 'Review these for multiple responsibilities:' && find client/src -name '*.jsx' -exec wc -l {} + | sort -rn | head -10"
alias cc-review-be="echo 'Review these for multiple responsibilities:' && find server/src/services -name '*.js' -exec wc -l {} + | sort -rn | head -10"
```

Then reload: `source ~/.bashrc` or `source ~/.zshrc`

**IMPORTANT:** These commands help you find files to *review*, not files to automatically split. A long file with one responsibility is fine.

---

## Step 4: Create Text Snippets (Optional - 5 minutes)

### VS Code Snippets

Create `.vscode/claude-code.code-snippets`:

```json
{
  "Claude Code Frontend Feature": {
    "prefix": "cc-frontend",
    "body": [
      "Add ${1:FEATURE_NAME}",
      "",
      "ARCHITECTURE: VideoConceptBuilder pattern",
      "- ${2:ComponentName}.jsx (orchestration only, no business logic)",
      "- hooks/ (state + handlers, testable with ≤2 mocks)",
      "- api/ (fetch + parsing)",
      "- components/ (display only, props in JSX out)",
      "",
      "RESPONSIBILITY CHECK: Each file = one sentence, no 'and'",
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
      "- MainService.js (coordination only, delegates everything)",
      "- services/ (one responsibility per service, testable with ≤2 mocks)",
      "- templates/ (.md files for prompts)",
      "",
      "RESPONSIBILITY CHECK: Each service = one reason to change",
      "REFERENCE: server/src/services/PromptOptimizationService.js",
      "SHOW STRUCTURE FIRST"
    ],
    "description": "Template for new backend service"
  },
  "Claude Code Modify": {
    "prefix": "cc-modify",
    "body": [
      "Modify ${1:FILE_PATH} to ${2:DESCRIPTION}",
      "",
      "BEFORE CHANGING:",
      "- Does this add a new responsibility? → Extract first",
      "- Can I still describe this file in one sentence? → If not, split by responsibility",
      "",
      "SHOW WHAT CHANGES BEFORE implementing"
    ],
    "description": "Template for modifying existing code"
  },
  "Claude Code Refactor": {
    "prefix": "cc-refactor",
    "body": [
      "Refactor ${1:FILE_PATH}",
      "",
      "PROBLEM: ${2:describe actual issue—multiple responsibilities, hard to test, etc.}",
      "NOT: 'it's too long'",
      "",
      "RESPONSIBILITIES IDENTIFIED:",
      "1. ${3:first responsibility} → will become ${4:location}",
      "2. ${5:second responsibility} → will become ${6:location}",
      "",
      "VALIDATION:",
      "- Each file describable in ≤10 words",
      "- Each file testable with ≤2 mocks",
      "",
      "REFERENCE: VideoConceptBuilder/REFACTORING_SUMMARY.md",
      "SHOW PLAN FIRST"
    ],
    "description": "Template for refactoring"
  }
}
```

**Usage:** Type `cc-frontend` and press Tab in VS Code.

---

## Step 5: Keep Cheatsheet Visible

**Option A: Browser Tab**
```bash
open docs/architecture/CLAUDE_CODE_CHEATSHEET.md
```

**Option B: Second Monitor**
Open the cheatsheet on your second monitor.

**Option C: Print It**
Seriously. Print `EMERGENCY_REFERENCE.md` and stick it next to your monitor.

---

## Step 6: Test Your Setup (3 minutes)

### Test 1: Project Knowledge Works
In Claude UI:
```
What's the principle behind splitting files in this project?
```
Should reference "one reason to change" and responsibility, NOT line counts.

### Test 2: Full Claude Code Request
```bash
claude-code "Add a simple ToastMessage component

ARCHITECTURE: VideoConceptBuilder pattern
- ToastMessage.jsx (display only)
- hooks/useToast.js (state + show/hide handlers)

RESPONSIBILITY CHECK: Each file does one thing
REFERENCE: client/src/components/VideoConceptBuilder/
SHOW STRUCTURE FIRST"
```

Claude Code should:
1. Show you the proposed structure
2. Confirm each file has one responsibility
3. Follow the pattern

---

## Daily Workflow

### When Making a Feature Request

1. **Copy appropriate template** from cheatsheet
2. **Fill in specifics**
3. **State the responsibility** of each proposed file
4. **Add "SHOW STRUCTURE FIRST"**

### After Claude Code Runs

Ask yourself:
1. Can I describe each new file in ≤10 words?
2. Can I test each piece with ≤2 mocks?
3. Do files that change together live together?

If any answer is "no," refactor by responsibility.

### Before Committing

```bash
# Run tests
npm test

# Quick review of largest files
cc-review

# For each large file, ask: "Does this have ONE responsibility?"
# If yes → fine
# If no → refactor by responsibility
```

---

## Example: Real Usage Session

```bash
# 1. Need to add export feature
# Copy "New Frontend Feature" template from cheatsheet

# 2. Run claude-code with responsibility-focused template
claude-code "Add export to PDF functionality

ARCHITECTURE: VideoConceptBuilder pattern
- ExportButton.jsx (display: renders button, receives onClick)
- hooks/usePdfExport.js (logic: handles generation, loading state)
- api/exportApi.js (network: PDF endpoint calls)

RESPONSIBILITY CHECK:
- ExportButton: 'Renders the export button' (one thing)
- usePdfExport: 'Manages PDF generation state' (one thing)
- exportApi: 'Calls PDF endpoint' (one thing)

REFERENCE: client/src/components/VideoConceptBuilder/
SHOW STRUCTURE FIRST"

# 3. Claude Code shows structure, confirm each file has one job

# 4. After implementation, verify
# Can I describe each file in ≤10 words? Yes
# Can I test each with ≤2 mocks? Yes

# 5. Run tests
npm test

# 6. Commit
git commit -m "Add PDF export following VideoConceptBuilder pattern"
```

---

## Troubleshooting

### "Claude Code isn't following the patterns"

Be more explicit about responsibilities:
```bash
claude-code "Add feature

ARCHITECTURE: VideoConceptBuilder pattern

RESPONSIBILITY ASSIGNMENT:
- MainComponent.jsx → orchestration only (wires pieces, no logic)
- hooks/useFeatureState.js → state logic (testable without rendering)
- api/featureApi.js → network (one place for endpoint changes)

Each file must be describable in one sentence without 'and'.
SHOW STRUCTURE FIRST"
```

### "Should I split this file?"

Ask these questions:
1. **Does it have multiple responsibilities?** (multiple reasons to change)
2. **Can I describe it in one sentence without 'and'?**
3. **Can I test it with ≤2 mocks?**

If answers are: No, Yes, Yes → Don't split. It's fine.
If any answer differs → Split by responsibility.

### "I keep creating files that change together"

That's a sign you split wrong. The rule is:
- Files that change together should live together
- Split by responsibility, not by arbitrary boundaries

If `ComponentA.jsx` and `useComponentA.js` always change together for the same reason, maybe they should be one file.

---

## Summary

**The principle:**
> Split by responsibility, not by size.

**The test:**
> "Can I describe this in one sentence without 'and'?"

**The workflow:**
1. Copy template
2. State each file's single responsibility
3. Ask for structure first
4. Verify each file does one thing

---

## Next Steps

1. ✅ Run Steps 1-3 now (5 minutes)
2. ✅ Test with a small feature
3. ✅ Use templates for all future requests
4. ✅ Ask "what's the responsibility?" not "how long is it?"
