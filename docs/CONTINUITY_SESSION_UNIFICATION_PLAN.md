# Continuity Session Unification Plan

## Goal
Make Continuity part of the **single core Session model** so all creative workflows live inside one session lifecycle and one workspace shell.

## Why
- Users should not have to understand two different session types.
- The ToolRail is the only workspace nav; all creative tools must live inside it.
- Today, Continuity is a separate session type + route; this creates fragmentation in routing, state, and discoverability.

## Current State (Summary)
- Continuity has its own routes: `/continuity` and `/continuity/:sessionId`.
- Continuity uses its own data model and context provider.
- Consistency is not a separate page; it is a workflow inside the GenerationControls panel.

## Target State
- **One Session model** that includes continuity data.
- Continuity becomes a **mode/tab inside a session**, not a separate session root.
- ToolRail switches modes within the same session: Create / Studio / Continuity.
- Legacy continuity routes redirect into unified session routes.

---

## Phase 1 — Unify the Session Contract
**Objective:** Define a single session schema that includes continuity data.

- Decide the canonical Session type (likely the existing prompt/generation session).
- Extend it with continuity fields:
  - shots[]
  - continuity settings (default mode, style strength)
  - style references / scene proxy
- Map current ContinuitySession fields to the unified schema.
- Update API schemas accordingly.

**Deliverables:**
- Unified Session schema + API contract
- Field mapping document (old ContinuitySession → unified Session)

---

## Phase 2 — Routing Unification
**Objective:** Make Continuity a mode inside a session route.

- Replace `/continuity/:sessionId` with a session-scoped route:
  - Example: `/session/:id/continuity` or `/prompt/:id/continuity`
- Keep `/continuity/:sessionId` as a legacy redirect to the unified route.
- Ensure the workspace shell (ToolRail) is always visible.

**Deliverables:**
- New session-scoped continuity routes
- Redirects for legacy continuity routes

---

## Phase 3 — State and Context Merge
**Objective:** Remove the separate ContinuitySessionProvider.

- Move continuity state/actions into the unified session store/context.
- Scope all continuity actions to the same session id.
- Make the Continuity UI consume the unified session context.

**Deliverables:**
- Single session provider
- Continuity components updated to use unified session state

---

## Phase 4 — Data Migration + Compatibility
**Objective:** Preserve existing continuity sessions.

- Add migration logic to translate legacy continuity sessions into unified sessions.
- Handle missing/partial fields gracefully.
- Keep the legacy continuity endpoint temporarily to support old deep links.

**Deliverables:**
- Migration script or server-side migration path
- Backwards-compatible route redirects

---

## Phase 5 — UI & Navigation Alignment
**Objective:** Make Continuity discoverable in the ToolRail.

- Add Continuity as a ToolRail item under the workspace sidebar.
- Treat it as a mode inside the session (like Create/Studio).
- If “Consistency” is just Studio, rename or clarify within Studio rather than as a separate route.

**Deliverables:**
- ToolRail: Continuity entry
- Workspace mode switch within a session

---

## Risks / Considerations
- Requires server and client API changes.
- Migration must preserve existing continuity data.
- Must avoid breaking existing deep links and workflows.
- Requires a clear decision on the canonical Session model.

---

## Recommendation
Proceed with unification in phases. Keep Continuity as its own session type only as a temporary compatibility layer while migrating data and routing.

---

## Assessment & Gaps (From Codebase Review)

### Overall Assessment
Reasonable direction, but incomplete. The plan identifies the right fragmentation problem, yet it lacks concrete definitions and operational details required to execute safely.

### What’s Correct
1. The current Continuity route and session model are fragmented from the ToolRail experience.
2. The phased breakdown (schema → routing → state → migration → UI) is appropriate.
3. Keeping legacy routes as redirects is the right compatibility move.

### Critical Gaps to Address
1. **No concrete unified schema**
   The plan must specify the actual unified session type (fields, optionality, defaults), not just “extend the canonical session.”
   Today you have structurally different models (single‑prompt vs multi‑shot).
2. **Storage model mismatch**
   Prompt sessions are stored via client/local fallback while Continuity sessions are server‑side.
   The plan must decide where the unified session lives (server‑only vs hybrid) and how local fallback behaves.
3. **ActiveTool expansion is missing**
   `ActiveTool` is currently `'create' | 'studio'`.
   Adding Continuity as a mode requires type expansion + persistence updates.
4. **No field mapping**
   The plan says “mapping doc” but doesn’t define how `ContinuitySession → Session` maps.
   This is central to migration.
5. **API consolidation/versioning**
   Continuity has multiple endpoints that can’t be ignored.
   The plan needs a versioning or deprecation strategy.
6. **Testing & validation strategy**
   No checklist for migration correctness, perf, or UI behavior.
7. **Rollback plan**
   Data migration without rollback is risky.

### Architectural Risks
- **Single‑prompt vs multi‑shot collision**
  These are different workflows. If you unify too literally, the resulting session can become bloated or confusing.
- **Schema bloat**
  A single session may need to hold prompts, shots, keyframes, versions, style references, and continuity settings. This needs explicit scoping rules.

---

## Unified Session Schema (Concrete Proposal)

### Design Choice
- **Session supports multi‑shot as an optional capability**.
  Single‑prompt workflows remain valid with `shots` undefined/empty.

### Proposed Types (Draft)

```ts
// Canonical session (single source of truth)
type Session = {
  id: string;
  userId: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed' | 'archived';

  // Core prompt workflow (existing)
  prompt?: {
    input?: string;
    output?: string;
    versions?: Array<{
      id: string;
      input: string;
      output?: string;
      createdAt: string;
      generationParams?: CapabilityValues;
      keyframes?: KeyframeTile[];
      highlightCache?: unknown;
    }>;
    generationParams?: CapabilityValues;
    keyframes?: KeyframeTile[];
    highlightCache?: unknown;
  };

  // Continuity workflow (optional)
  continuity?: {
    shots: ContinuityShot[];
    primaryStyleReference?: StyleReference | null;
    sceneProxy?: SceneProxy | null;
    settings: {
      generationMode: 'continuity' | 'standard';
      defaultContinuityMode: 'frame-bridge' | 'style-match' | 'native' | 'none';
      defaultStyleStrength: number;
    };
  };
};
```

### Mapping (ContinuitySession → Session)

```text
ContinuitySession.id                → Session.id
ContinuitySession.userId            → Session.userId
ContinuitySession.name              → Session.name
ContinuitySession.createdAt         → Session.createdAt
ContinuitySession.updatedAt         → Session.updatedAt
ContinuitySession.shots             → Session.continuity.shots
ContinuitySession.primaryStyleRef   → Session.continuity.primaryStyleReference
ContinuitySession.sceneProxy        → Session.continuity.sceneProxy
ContinuitySession.defaultSettings   → Session.continuity.settings
```

### Mapping (PromptData → Session)

```text
PromptData.uuid                     → Session.id
PromptData.userId                   → Session.userId
PromptData.title                    → Session.name
PromptData.input/output             → Session.prompt.input/output
PromptData.versions                 → Session.prompt.versions
PromptData.generationParams         → Session.prompt.generationParams
PromptData.keyframes                → Session.prompt.keyframes
PromptData.highlightCache           → Session.prompt.highlightCache
```

---

## Storage Decision (Required)

### Options
1. **Server‑only Session store**
   All sessions live server‑side; localStorage becomes a cache only.
   Pros: single source of truth, easier migration.
   Cons: offline/latency sensitivity.
2. **Hybrid Session store**
   Server is canonical, but localStorage keeps a lightweight draft cache.
   Pros: preserves current UX.
   Cons: more complexity.

### Recommendation
Adopt **server‑canonical** for unified sessions, with localStorage only as a transient draft cache (not authoritative).

---

## API Strategy (Required)

### Versioning / Migration
- Introduce a unified session API (v2).
- Keep Continuity endpoints as a compatibility layer during Phase 4.
- Add redirect/translation layer for `/continuity/:id` to `/session/:id/continuity`.
- Prompt optimize/suggestion endpoints remain in v1 for now; v2 only defines session CRUD + continuity endpoints.

---

## Testing & Validation (Required)

### Minimum Checklist
1. Migration correctness (shots, settings, style refs preserved).
2. Legacy continuity deep links redirect and load successfully.
3. Single‑prompt sessions still load without continuity fields.
4. Performance: large sessions with many shots remain usable.
5. UI navigation: ToolRail switches modes without losing session context.

---

## Rollback Plan (Required)
- Take a full backup of continuity session data before migration.
- Keep legacy endpoints read‑only for a fixed window.
- Provide a reversible mapping script to restore legacy sessions if needed.

---

## Update: Phase Deliverables (Expanded)

### Phase 1 — Unify the Session Contract (Expanded)
- Finalize the unified Session schema (above).
- Publish mapping tables and optionality rules.
- Decide server‑canonical vs hybrid storage.

### Phase 2 — Routing Unification (Expanded)
- Introduce session‑scoped continuity route.
- Ensure ToolRail remains visible for continuity routes.

### Phase 3 — State and Context Merge (Expanded)
- Extend ActiveTool type to include `'continuity'`.
- Persist and restore active tool selection.
- Replace ContinuitySessionProvider with unified Session provider.
- Continuity remains separate for now, but the unified session provider becomes the canonical store and can expose continuity slices as needed.
- Evaluate merging GenerationControlsStore into the unified provider after session unification stabilizes.

**Concrete change (example):**
```ts
// client/src/contexts/AppShellContext.tsx
export type ActiveTool = 'create' | 'studio' | 'continuity';
```

### Phase 4 — Data Migration + Compatibility (Expanded)
- Implement migration scripts and dry runs.
- Add fallbacks for partially migrated data.

### Phase 5 — UI & Navigation Alignment (Expanded)
- Add Continuity to ToolRail.
- Clarify “Consistency” as a Studio workflow (no separate route).

**Concrete change (example):**
```ts
// client/src/components/ToolSidebar/config/toolNavConfig.ts
{
  id: 'continuity',
  icon: Film, // or another icon in the existing system set
  label: 'Continuity',
  variant: 'default',
},
```

#### Component Migration Table

| Component | Action |
|-----------|--------|
| `client/src/pages/ContinuityPage.tsx` | Remove (replaced by unified session route) |
| `client/src/features/continuity/context/ContinuitySessionContext.tsx` | Remove (merge into unified session provider) |
| `client/src/features/continuity/context/ContinuitySessionProvider` | Remove |
| `client/src/components/layout/MainWorkspace.tsx` | Extend to handle `continuity` mode |
| `client/src/components/ToolSidebar/components/ToolRail.tsx` | Add continuity nav handling |
| `client/src/contexts/AppShellContext.tsx` | Expand `ActiveTool` type |

---

## Decisions Required (Blockers)
1. **Session identity**: Is `Session.id` the Firestore doc ID or the prompt UUID?
2. **Route prefix**: Use `/session/:id/*` or reuse `/prompt/:uuid/*`?
3. **Session creation trigger**: When is a Session created (explicit vs implicit)?

---

## Session Identity (id vs uuid)

### Problem
`PromptData` currently has both a `uuid` and an implicit Firestore doc ID, which can differ.

### Required Decision
- If **Session.id = Firestore doc ID**:
  - Map `PromptData.uuid` to a `prompt.uuid` field.
  - Use doc ID for all routing and lookups.
- If **Session.id = uuid**:
  - Migrate Firestore to use uuid as document ID or maintain an index from uuid → doc ID.

### Recommendation
Use **Firestore doc ID** as the canonical `Session.id` and store UUID as a secondary field for backward compatibility and share links.

---

## userId Backfill

### Problem
`PromptData` does not explicitly store `userId`, but continuity sessions do.

### Options
- Backfill `userId` from Firestore path (`users/{userId}/prompts/{docId}`).
- Add a migration pass that injects `userId` into the unified session record.

### Recommendation
Backfill from Firestore path during migration; do not rely on client inference.

---

## Unified Routes (Before → After)

| Before | After | Notes |
|--------|-------|-------|
| `/continuity/:id` | `/session/:id/continuity` | Redirect legacy to unified |
| `/prompt/:uuid` | `/session/:id/studio` | Redirect legacy to unified |
| `/` | `/session/:id/studio` | Default to last session or create new |
| `/create` | `/session/:id/create` or `/session/new/create` | Decision required |
| `/share/:uuid` | `/share/:uuid` | Keep as-is; map internally to session id via uuid index |

**Decision required:** Choose `/session/:id/*` or keep `/prompt/:uuid/*` as the canonical base.

---

## API v2 Endpoint Spec (Proposed)

### Sessions
- `GET /api/v2/sessions`
- `GET /api/v2/sessions/:id`
- `POST /api/v2/sessions`
- `PATCH /api/v2/sessions/:id`
- `DELETE /api/v2/sessions/:id`

### Continuity (session-scoped)
- `POST /api/v2/sessions/:id/shots`
- `POST /api/v2/sessions/:id/shots/:shotId/generate`
- `PUT /api/v2/sessions/:id/style-reference`
- `PUT /api/v2/sessions/:id/settings`
- `POST /api/v2/sessions/:id/scene-proxy`

### Deprecation Timeline (Proposed)
- **Week 0**: Ship v2 endpoints + adapters
- **Week 4**: Mark v1 continuity endpoints deprecated (warnings)
- **Week 8**: Remove v1 endpoints

---

## Session Creation UX (Required)

### Current Behavior
- Prompt sessions are created implicitly (e.g., on optimize).
- Continuity sessions are created explicitly via a button.

### Decision Required
Choose one:
1. **Implicit creation**: auto-create session on first meaningful action.
2. **Explicit creation**: require a "New Session" step for all workflows.

### Recommendation
Use **implicit creation for prompt workflows**, explicit for continuity flows, but unify the session object under the hood.

### /create Route Decision (Explicit)
- **Decision**: Keep `/create` session-less.
- **Behavior**: Create a new session implicitly on first optimize/generate, then redirect to `/session/:id/create` (or stay and attach session silently).

---

## Schema Refinements

- If `prompt` exists, **`prompt.input` should be required**.
- If `continuity` exists, it must include `shots: []` even if empty.
- Add a session lifecycle `status` (e.g., `active | completed | archived`).

---

## Migration Script Detail (Required)

### Minimum Requirements
- Server-side migration for Firestore prompt docs and continuity sessions.
- One-time `userId` backfill for legacy prompt data.
- Dry-run mode that validates without writes.
- Estimated runtime based on dataset size (include sampling).
- Dry-run output: counts by type (prompt sessions, continuity sessions, failures) + sample diffs for 1–2 sessions per type.

---

## Feature Flag Plan (Required)

- `UNIFIED_SESSIONS_ENABLED`
  - Gate new routes, unified API, and unified store.
  - Rollout: 10% → 50% → 100% with rollback toggle.

---

## Effort Estimate (Single Engineer)

| Phase | Estimate |
|-------|----------|
| Phase 1: Schema | 1 week |
| Phase 2: Routing | 1 week |
| Phase 3: State merge | 1.5 weeks |
| Phase 4: Migration | 1-2 weeks |
| Phase 5: UI alignment | 1 week |
| **Total** | **5-7 weeks** |
