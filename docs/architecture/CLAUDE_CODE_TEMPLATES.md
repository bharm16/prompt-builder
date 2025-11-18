# Claude Code Request Templates

Copy-paste these templates when working with Claude Code to maintain architectural consistency.

---

## Template 1: New Frontend Component

```
Add [FEATURE NAME] component

ARCHITECTURE (follow VideoConceptBuilder pattern):
Structure:
- ComponentName.jsx (orchestrator, max 500 lines)
- hooks/useComponentState.js (useReducer for state)
- api/componentApi.js (all fetch calls)
- utils/componentUtils.js (pure functions)
- config/componentConfig.js (configuration data)
- components/ (UI pieces, each < 200 lines)

REFERENCE IMPLEMENTATION:
client/src/components/VideoConceptBuilder/

CONSTRAINTS:
- Orchestrator components max 500 lines (main files that compose pieces)
- Regular UI components max 200 lines
- All API calls in api/ layer
- Business logic in hooks/
- Configuration in config/
- Use useReducer, not multiple useState
- No inline styles (Tailwind only)

BEFORE IMPLEMENTING:
1. Show proposed file structure
2. List all new files with estimated line counts
3. Explain state management approach
4. Confirm no architectural violations

AFTER IMPLEMENTING:
Run validation: find client/src -name "*.jsx" -o -name "*.js" | xargs wc -l | sort -rn | head -10
```

**Example Usage:**
```bash
claude-code "Add ExportManager component for exporting prompts to multiple formats

ARCHITECTURE (follow VideoConceptBuilder pattern):
[paste template above]"
```

---

## Template 2: Modify Existing Frontend Component

```
Modify [COMPONENT NAME] to [FEATURE DESCRIPTION]

CURRENT ARCHITECTURE:
- Location: [path to component]
- Current structure: [hooks/api/utils/components]
- Current line count: [use wc -l to check]

CONSTRAINTS:
- Maintain existing architecture pattern
- If adding API calls → must go in existing api/ file
- If adding business logic → extract to hooks/
- If adding 50+ lines of UI → extract to new component in components/
- MUST NOT exceed file size limits:
  - Orchestrator components: 500 lines
  - Regular UI components: 200 lines
  - Hooks: 150 lines
  - Utils: 100 lines

REFERENCE:
client/src/components/VideoConceptBuilder/[similar component]

BEFORE IMPLEMENTING:
1. Show current file size: wc -l [file path]
2. Show what will be added/modified
3. Confirm no file will exceed limits
4. If limits exceeded, show refactoring plan first

VALIDATION:
After changes, confirm: wc -l [modified files]
```

**Example Usage:**
```bash
claude-code "Modify VideoConceptBuilder to add batch template application

CURRENT ARCHITECTURE:
- Location: client/src/components/VideoConceptBuilder/
- Current structure: hooks/api/utils/components/
- Current line count: VideoConceptBuilder.jsx = 519 lines

[paste template]"
```

---

## Template 3: New Backend Service

```
Add [SERVICE NAME] service

ARCHITECTURE (follow PromptOptimizationService pattern):
Structure:
- MainService.js (orchestrator, max 500 lines)
- services/service-name/
  - SpecializedService1.js (max 300 lines)
  - SpecializedService2.js (max 300 lines)
  - Repository.js (data access, max 200 lines)
- templates/ (external .md files for prompts)

REFERENCE IMPLEMENTATION:
server/src/services/prompt-optimization/PromptOptimizationService.js
server/src/services/VideoConceptService.js

PATTERNS:
- Orchestrator pattern: Main service delegates to specialized services
- Repository pattern: Data access separated
- Dependency injection: Constructor injection for all dependencies
- Strategy pattern: Mode-specific behavior
- Template service: Prompts in .md files, not hardcoded

CONSTRAINTS:
- Main orchestrator: max 500 lines
- Specialized services: max 300 lines each
- Single responsibility per service
- No hardcoded prompts (use template files)
- Must be testable (dependency injection)

BEFORE IMPLEMENTING:
1. Show proposed service hierarchy
2. List all services with responsibilities
3. Show template structure
4. Explain dependency graph
5. Confirm pattern matches existing services

TESTING:
- Must include unit tests for each service
- Mock dependencies in tests
```

**Example Usage:**
```bash
claude-code "Add AnalyticsService for tracking prompt usage and quality metrics

ARCHITECTURE (follow PromptOptimizationService pattern):
[paste template]"
```

---

## Template 4: Modify Existing Backend Service

```
Modify [SERVICE NAME] to [FEATURE DESCRIPTION]

CURRENT ARCHITECTURE:
- Location: server/src/services/[ServiceName]/
- Current structure: [list specialized services]
- Pattern: [Orchestrator/Repository/Strategy/etc]
- Current line count: [main file line count]

CONSTRAINTS:
- Maintain orchestrator pattern
- New business logic → create new specialized service
- New data access → extend repository
- New prompts → add .md template file
- MUST NOT exceed 500 lines in orchestrator

BEFORE IMPLEMENTING:
1. Identify which specialized service handles this
2. If none exist, propose new specialized service
3. Show where logic will live
4. Confirm orchestrator stays thin

REFERENCE:
server/src/services/[similar service]/

VALIDATION:
After changes: wc -l server/src/services/[ServiceName]/*.js
```

**Example Usage:**
```bash
claude-code "Modify PromptOptimizationService to add custom temperature strategies per domain

CURRENT ARCHITECTURE:
- Location: server/src/services/prompt-optimization/PromptOptimizationService.js
- Current structure: ContextInference, ModeDetection, QualityAssessment, StrategyFactory
- Pattern: Orchestrator with specialized services
- Current line count: ~400 lines

[paste template]"
```

---

## Template 5: Full-Stack Feature (Frontend + Backend)

```
Add [FEATURE NAME] feature (full-stack)

FRONTEND:
- Location: client/src/[features|components]/[feature-name]/
- Architecture: VideoConceptBuilder pattern
- Components: [list expected components]
- Max lines: 500 for orchestrators, 200 for UI components

BACKEND:
- Location: server/src/services/[service-name]/
- Architecture: PromptOptimizationService pattern
- Services: [list expected services]
- Max lines: 500 for orchestrators, 300 for specialized services

API CONTRACT:
Define API endpoints first:
- Endpoint: [method] [path]
- Request: [shape]
- Response: [shape]

IMPLEMENTATION ORDER:
1. Backend first (service + tests)
2. Frontend API layer
3. Frontend hooks
4. Frontend components

BEFORE IMPLEMENTING:
1. Show complete file structure (both frontend + backend)
2. Show API contract
3. Confirm patterns match existing architecture
4. List all files with estimated line counts

REFERENCE:
- Frontend: client/src/components/VideoConceptBuilder/
- Backend: server/src/services/VideoConceptService.js
```

**Example Usage:**
```bash
claude-code "Add collaborative editing feature where users can share and co-edit prompts

[paste full-stack template]

FRONTEND:
- Location: client/src/features/collaboration/
- Components: CollaborationPanel, SharedPromptCard, InviteModal
- Max lines: 200 per component

BACKEND:
- Location: server/src/services/CollaborationService/
- Services: ShareService, PermissionService, RealtimeService
- Max lines: 300 per service

API CONTRACT:
- POST /api/prompts/:id/share { email, permission }
- GET /api/prompts/shared { }
- PUT /api/prompts/:id/collaborators/:userId { permission }
"
```

---

## Template 6: Refactor Existing Code

```
Refactor [FILE/COMPONENT NAME] to follow architecture standards

CURRENT STATE:
- File: [path]
- Current lines: [count]
- Problems: [god object/tight coupling/mixed concerns/etc]

TARGET STATE:
- Pattern: [VideoConceptBuilder OR PromptOptimizationService]
- Proposed structure: [show directory structure]
- Reduction: [current lines] → [estimated new lines]

REFACTORING STEPS:
1. Create directory structure
2. Extract API calls to api/ layer
3. Extract state management to hooks/useReducer
4. Extract configuration to config/
5. Extract business logic to utils/ or hooks/
6. Break large components into smaller ones
7. Wire everything together in main orchestrator
8. Verify tests pass

BEFORE IMPLEMENTING:
1. Show current file structure
2. Show proposed new structure
3. Estimate lines per new file
4. Identify risky changes
5. Create backup file first

REFERENCE:
- Frontend refactor: client/src/components/VideoConceptBuilder/REFACTORING_SUMMARY.md
- Backend refactor: server/src/services/VideoConceptService.js (see header comment)

VALIDATION AFTER:
- All tests pass
- No file over limits
- Pattern matches reference implementation
```

**Example Usage:**
```bash
claude-code "Refactor HistorySidebar.jsx - currently 450 lines with mixed concerns

CURRENT STATE:
- File: client/src/features/history/HistorySidebar.jsx
- Current lines: 450
- Problems: API calls inline, business logic in component, no state management pattern

TARGET STATE:
- Pattern: VideoConceptBuilder
- Proposed structure:
  HistorySidebar/
  ├── HistorySidebar.jsx (~200 lines)
  ├── hooks/useHistoryState.js
  ├── api/historyApi.js
  ├── components/HistoryItem.jsx
  └── components/HistoryFilter.jsx

[paste refactoring template]"
```

---

## Quick Reference: Architecture Patterns

### Frontend (React)
**Pattern:** VideoConceptBuilder
**Location:** `client/src/components/VideoConceptBuilder/`
**Key files to reference:**
- `VideoConceptBuilder.jsx` (orchestrator)
- `hooks/useVideoConceptState.js` (useReducer)
- `api/videoConceptApi.js` (API layer)
- `config/elementConfig.js` (configuration)
- `REFACTORING_SUMMARY.md` (explanation)

### Backend (Services)
**Pattern:** PromptOptimizationService
**Location:** `server/src/services/prompt-optimization/PromptOptimizationService.js`
**Key concepts:**
- Orchestrator delegates to specialized services
- Each service < 300 lines, single responsibility
- Repository pattern for data access
- Templates in .md files

---

## File Size Limits Reference

| File Type | Max Lines | Reasoning |
|-----------|-----------|-----------|
| Orchestrator Component/Service | 500 | Main files that compose many pieces (see note below) |
| Regular UI Component | 200 | If larger, extract subcomponents |
| React Hook | 150 | Single concern per hook |
| Specialized Service | 300 | Focused business logic services |
| Utility | 100 | Pure functions, focused |
| Config | 200 | Data only, no logic |
| API Layer | 150 | Just fetch wrappers |

**Why Orchestrators Get 500 Lines:**
Orchestrator components/services compose multiple smaller pieces. This composition requires more lines for imports, hook calls, event handlers, and JSX/function composition. Examples:
- `VideoConceptBuilder.jsx` (519 lines) - well-architected orchestrator
- `PromptOptimizerContainer.jsx` (400 lines) - delegates to hooks/components/services

Both are well-architected despite size because they **delegate** to hooks/components/services rather than containing business logic. If your orchestrator has business logic, it should be extracted.

---

## Emergency Override

If you MUST exceed limits temporarily (tech debt, prototype, etc):

```
[Your request]

ARCHITECTURAL OVERRIDE:
File [path] will temporarily exceed [X] lines because [reason].
Plan to refactor by [date/milestone].
Tracking in issue #[number].

This is a conscious decision, not an oversight.
```

But this should be rare. If you're using it often, your architecture needs adjustment.

---

## Validation Commands

Run these after Claude Code makes changes:

```bash
# Check all file sizes
find client/src server/src -type f \( -name "*.js" -o -name "*.jsx" \) -exec wc -l {} + | sort -rn | head -20

# Check specific directory
find client/src/components/VideoConceptBuilder -name "*.jsx" -exec wc -l {} +

# Check regular components (should be < 200 lines)
find client/src -name "*.jsx" -path "*/components/*" -exec wc -l {} + | awk '$1 > 200 {print "❌ Component over 200: " $0}'

# Check orchestrator components (should be < 500 lines)
find client/src -name "*.jsx" ! -path "*/components/*" -exec wc -l {} + | awk '$1 > 500 {print "❌ Orchestrator over 500: " $0}'

# Check orchestrator services (should be < 500 lines)
find server/src/services -maxdepth 1 -name "*.js" -exec wc -l {} + | awk '$1 > 500 {print "❌ Service orchestrator over 500: " $0}'

# Check specialized services (should be < 300 lines)
find server/src/services -mindepth 2 -name "*.js" -exec wc -l {} + | awk '$1 > 300 {print "❌ Specialized service over 300: " $0}'
```

---

## Tips for Using These Templates

1. **Copy-paste the entire template** into your claude-code request
2. **Fill in the bracketed [PLACEHOLDERS]** with your specific details
3. **Reference existing code** - always point to a similar component/service
4. **Be specific about constraints** - Claude Code needs explicit boundaries
5. **Request structure before implementation** - always ask to see the plan first
6. **Validate after** - run the validation commands to confirm limits

---

## Saving Time: Create Aliases

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
# Alias for quick validation
alias check-sizes="find client/src server/src -type f \( -name '*.js' -o -name '*.jsx' \) -exec wc -l {} + | sort -rn | head -20"

# Check regular components (should be < 200 lines)
alias check-fe="find client/src -name '*.jsx' -path '*/components/*' -exec wc -l {} + | awk '\$1 > 200 {print \"❌ Component over 200: \" \$0}'"

# Check orchestrator components (should be < 500 lines)
alias check-fe-main="find client/src -name '*.jsx' ! -path '*/components/*' -exec wc -l {} + | awk '\$1 > 500 {print \"❌ Orchestrator over 500: \" \$0}'"

# Check orchestrator services (should be < 500 lines)
alias check-be-main="find server/src/services -maxdepth 1 -name '*.js' -exec wc -l {} + | awk '\$1 > 500 {print \"❌ Service orchestrator over 500: \" \$0}'"

# Check specialized services (should be < 300 lines)
alias check-be-spec="find server/src/services -mindepth 2 -name '*.js' -exec wc -l {} + | awk '\$1 > 300 {print \"❌ Specialized service over 300: \" \$0}'"
```

Then just run:
```bash
check-sizes      # After any Claude Code changes (top 20 files)
check-fe         # Check regular UI components (< 200 lines)
check-fe-main    # Check orchestrator components (< 500 lines)
check-be-main    # Check orchestrator services (< 500 lines)
check-be-spec    # Check specialized services (< 300 lines)
```
