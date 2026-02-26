# Workspace Simplification Plan

> **Status:** Ready for implementation  
> **Supersedes:** CONTINUITY_SESSION_UNIFICATION_PLAN.md (partially implemented)  
> **Last Updated:** 2025-02-01

---

## Executive Summary

The Continuity Session Unification Plan was partially implemented, adding unified routes (`/session/:id/continuity`) and a `continuity` tool to the ToolRail. However, during review we identified a fundamental issue: **Create, Studio, and Continuity are not three different tools—they're the same workspace in different states.**

This plan simplifies the architecture by:
1. Merging Create and Studio (they render identical components)
2. Making Continuity an emergent feature based on session state, not a separate destination
3. Removing the ContinuityPage creation form entirely
4. Integrating existing continuity components into the main workspace

---

## Current State Analysis

### What Was Implemented (From Unification Plan)

| Feature | Status |
|---------|--------|
| Routes: `/session/:id/studio`, `/session/:id/create`, `/session/:id/continuity` | ✅ Implemented |
| `ActiveTool = 'create' \| 'studio' \| 'continuity'` | ✅ Implemented |
| Continuity in ToolRail | ✅ Implemented |
| Legacy redirects `/continuity/*` → `/session/*/continuity` | ✅ Implemented |
| Unified Session schema | ✅ Implemented |
| v2 API endpoints | ✅ Implemented |

### Problems with Current State

1. **Create and Studio are identical**
   - Both render `PromptOptimizerWorkspace` with a `mode` prop
   - The `mode` prop has no meaningful behavioral difference
   - Two ToolRail items point to the same thing

2. **Continuity is a separate page with a pointless creation form**
   - `ContinuityPage.tsx` forces users to configure "default continuity mode" and "style strength" upfront
   - Users don't know what these settings mean before they have content
   - This is premature configuration—settings should emerge as users add shots

3. **Mental model fragmentation**
   - Users must understand "create a continuity session" as a separate action
   - But continuity is just what happens when you add shots to a session

### Existing Continuity Components (Reusable)

These components already exist and will be reused:

```
client/src/features/continuity/components/
├── ContinuitySession/
│   ├── SessionTimeline.tsx      ← Reuse: horizontal shot timeline
│   ├── ShotCard.tsx             ← Reuse: individual shot thumbnail
│   └── ContinuitySession.tsx    ← Delete: standalone page layout
├── ShotEditor/                   ← Reuse: shot prompt editing
├── StyleReferencePanel/          ← Reuse: style reference controls
└── ContinueSceneButton/          ← Reuse: entry point to sequence mode
```

---

## Target Architecture

### Core Principle

**One workspace. Session state determines UI.**

```
Session has 0 shots    → Normal prompt editor
Session has 1+ shots   → Prompt editor + shot timeline + style controls
```

### ToolRail Simplification

| Before | After |
|--------|-------|
| Sessions | Sessions |
| Create | **Remove** |
| Studio | **Remove** (optional: keep as alias) |
| Chars | Chars |
| Styles | Styles |
| Continuity | **Remove** |

The workspace is always visible. The ToolRail switches what panel appears on the left (sessions list, characters library, styles library), not what's in the main workspace.

### Route Simplification

| Before | After | Notes |
|--------|-------|-------|
| `/` | `/` | Workspace with last session |
| `/session/:id` | `/session/:id` | Workspace with session |
| `/session/:id/studio` | Redirect → `/session/:id` | Compatibility |
| `/session/:id/create` | Redirect → `/session/:id` | Remove |
| `/session/:id/continuity` | Redirect → `/session/:id` | Remove (timeline shows based on state) |
| `/session/new/continuity` | Redirect → `/` | Remove |
| `/create` | Redirect → `/` | Remove |

---

## UI Specification

### State 1: Session with No Shots

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ToolRail │ GenerationControls          │  Main Workspace                     │
│          │                             │                                      │
│ Sessions │ ┌─────────────────────────┐ │  ┌──────────────────────────────┐   │
│   ↑      │ │ Prompt                  │ │  │                              │   │
│ active   │ │ ┌─────────────────────┐ │ │  │    [Generated Video]         │   │
│          │ │ │ man running away    │ │ │  │         ▶ 0:05              │   │
│ Chars    │ │ │ from camera, dyn... │ │ │  │                              │   │
│          │ │ └─────────────────────┘ │ │  └──────────────────────────────┘   │
│ Styles   │ │                         │ │                                      │
│          │ │ [Draft]  [Render]       │ │  ┌──────────────────────────────┐   │
│          │ │                         │ │  │ + Continue as Sequence       │   │
│          │ │ ┌─ Versions ──────────┐ │ │  │   Add more shots to build    │   │
│          │ │ │ [v2] [v1]           │ │ │  │   a consistent scene         │   │
│          │ │ └─────────────────────┘ │ │  └──────────────────────────────┘   │
│          │ └─────────────────────────┘ │                                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Normal prompt editor behavior (already exists)
- "Continue as Sequence" button appears after first successful video generation
- No shot timeline visible

### State 2: Session with Shots (Sequence Mode)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ToolRail │ GenerationControls          │  Main Workspace                     │
│          │                             │                                      │
│ Sessions │ ┌─────────────────────────┐ │  ┌──────────────────────────────┐   │
│          │ │ Shot 2 Prompt          │ │  │  [Shot 1]       [Shot 2]      │   │
│ Chars    │ │ ┌─────────────────────┐ │ │  │    ✓ Done        Current     │   │
│          │ │ │ Close-up of his     │ │ │  └──────────────────────────────┘   │
│ Styles   │ │ │ face, rain drops... │ │ │                                      │
│          │ │ └─────────────────────┘ │ │  ┌──────────────────────────────┐   │
│          │ │                         │ │  │                              │   │
│          │ │ ┌─ Style Reference ───┐ │ │  │    [Current Shot Preview]    │   │
│          │ │ │ Source: [Shot 1 ▾]  │ │ │  │                              │   │
│          │ │ │ Strength: ━━━●━ 0.6 │ │ │  └──────────────────────────────┘   │
│          │ │ │                     │ │ │                                      │
│          │ │ │ Mode:               │ │ │  ┌─ Versions (Shot 2) ─────────┐   │
│          │ │ │ ◉ Frame Bridge      │ │ │  │ [v2 preview] [v1 preview]   │   │
│          │ │ │ ○ Style Match       │ │ │  └──────────────────────────────┘   │
│          │ │ └─────────────────────┘ │ │                                      │
│          │ │                         │ │                                      │
│          │ │ [Draft]  [Render]       │ │                                      │
│          │ └─────────────────────────┘ │                                      │
├──────────┴─────────────────────────────┴──────────────────────────────────────┤
│ Shot Timeline                                                                 │
│ [Shot 1 ✓] ──→ [Shot 2 ●] ──→ [+]                                            │
│  "man running..."  "Close-up..."                                              │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Changes from single-shot mode:**
1. **Shot timeline** appears docked at bottom
2. **Style Reference section** appears in GenerationControls
3. **Prompt label** changes to "Shot N Prompt"
4. **Versions panel** scoped to current shot

### UI Behaviors

| User Action | Result |
|-------------|--------|
| Click "+ Continue as Sequence" | Session gains `continuity` block, current video becomes Shot 1, timeline appears |
| Click shot in timeline | Loads that shot's prompt/settings into editor, scrolls workspace to that shot's video |
| Click [+] in timeline | Creates new empty shot draft, clears editor |
| Change style reference dropdown | Updates current shot's style reference |
| Adjust strength slider | Updates current shot's style strength |
| Generate | Result added to current shot |

---

## Implementation Phases

### Phase 1: Remove Create/Studio/Continuity Distinction

**Objective:** Simplify to one workspace that adapts based on session state.

#### 1.1 Simplify ToolRail Config

```typescript
// client/src/components/ToolSidebar/config/toolNavConfig.ts

// BEFORE
export const toolNavItems: ToolNavItem[] = [
  { id: 'sessions', icon: LayoutGrid, label: 'Sessions', variant: 'header' },
  { id: 'create', icon: Sparkles, label: 'Create', variant: 'default' },
  { id: 'studio', icon: SlidersHorizontal, label: 'Studio', variant: 'default' },
  { id: 'characters', icon: Users, label: 'Chars', variant: 'default' },
  { id: 'styles', icon: Palette, label: 'Styles', variant: 'default' },
  { id: 'continuity', icon: FilmSlate, label: 'Continuity', variant: 'default' },
];

// AFTER
export const toolNavItems: ToolNavItem[] = [
  { id: 'sessions', icon: LayoutGrid, label: 'Sessions', variant: 'header' },
  { id: 'characters', icon: Users, label: 'Chars', variant: 'default' },
  { id: 'styles', icon: Palette, label: 'Styles', variant: 'default' },
];
```

#### 1.2 Simplify ActiveTool Type

```typescript
// client/src/contexts/AppShellContext.tsx

// BEFORE
export type ActiveTool = 'create' | 'studio' | 'continuity';

// AFTER
export type ActiveTool = 'sessions' | 'characters' | 'styles';
// Or remove entirely if ToolRail just switches panels, not workspace content
```

#### 1.3 Simplify Routes

```typescript
// client/src/App.tsx

// REMOVE these routes:
<Route path="/create" element={<WorkspaceRoute tool="create" />} />
<Route path="/session/:sessionId/create" element={<WorkspaceRoute tool="create" />} />
<Route path="/session/:sessionId/continuity" element={<WorkspaceRoute tool="continuity" />} />
<Route path="/session/new/continuity" element={<WorkspaceRoute tool="continuity" />} />

// ADD redirects for compatibility:
<Route path="/create" element={<Navigate to="/" replace />} />
<Route path="/session/:sessionId/create" element={<Navigate to="/session/:sessionId" replace />} />
<Route path="/session/:sessionId/continuity" element={<Navigate to="/session/:sessionId" replace />} />
<Route path="/session/new/continuity" element={<Navigate to="/" replace />} />

// KEEP these routes:
<Route path="/" element={<WorkspaceRoute />} />
<Route path="/session/:sessionId" element={<WorkspaceRoute />} />
<Route path="/session/:sessionId/studio" element={<Navigate to="/session/:sessionId" replace />} />
```

#### 1.4 Simplify MainWorkspace

```typescript
// client/src/components/layout/MainWorkspace.tsx

// BEFORE
export function MainWorkspace(): React.ReactElement {
  const { activeTool, convergenceHandoff } = useAppShell();

  if (activeTool === 'continuity') {
    return (
      <AppShell>
        <ContinuityPage />
      </AppShell>
    );
  }

  return (
    <GenerationControlsProvider>
      <PromptOptimizerWorkspace
        convergenceHandoff={activeTool === 'studio' ? convergenceHandoff : null}
        mode={activeTool}
      />
    </GenerationControlsProvider>
  );
}

// AFTER
export function MainWorkspace(): React.ReactElement {
  const { convergenceHandoff } = useAppShell();

  return (
    <GenerationControlsProvider>
      <PromptOptimizerWorkspace convergenceHandoff={convergenceHandoff} />
    </GenerationControlsProvider>
  );
}
```

#### 1.5 Remove `mode` Prop from PromptOptimizerWorkspace

Since Create and Studio are identical, remove the `mode` prop entirely.

**Deliverables:**
- [ ] ToolRail reduced to: Sessions, Chars, Styles
- [ ] Routes simplified with redirects for compatibility
- [ ] `MainWorkspace` no longer conditionally renders `ContinuityPage`
- [ ] `PromptOptimizerWorkspace` no longer accepts `mode` prop

---

### Phase 2: Integrate Shot Timeline into Workspace

**Objective:** Shot timeline appears automatically when session has shots.

#### 2.1 Create Workspace-Integrated Timeline

Reuse existing `SessionTimeline` but adapt for workspace integration:

```
client/src/features/prompt-optimizer/components/ShotTimeline/
├── WorkspaceShotTimeline.tsx    # Wrapper for workspace integration
├── index.ts
```

```typescript
// WorkspaceShotTimeline.tsx
interface WorkspaceShotTimelineProps {
  shots: ContinuityShot[];
  currentShotId: string | null;
  onShotSelect: (shotId: string) => void;
  onAddShot: () => void;
}

export function WorkspaceShotTimeline({ 
  shots, 
  currentShotId, 
  onShotSelect, 
  onAddShot 
}: WorkspaceShotTimelineProps): React.ReactElement | null {
  // Don't render if no shots
  if (shots.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-[var(--tool-rail-width)] right-0 h-20 border-t border-border bg-surface-1">
      <SessionTimeline
        shots={shots}
        selectedShotId={currentShotId}
        onSelectShot={onShotSelect}
        onGenerateShot={() => {}} // Handled by GenerationControls
        onViewAsset={() => {}}    // Handled by workspace
      />
      <button onClick={onAddShot} className="...">+</button>
    </div>
  );
}
```

#### 2.2 Add Timeline to Workspace Layout

```typescript
// In PromptOptimizerWorkspace or its layout component
const { session } = useSession();
const isSequenceMode = (session?.continuity?.shots?.length ?? 0) > 0;

return (
  <div className="flex flex-col h-full">
    <div className="flex-1 overflow-auto">
      {/* Existing workspace content */}
    </div>
    
    {isSequenceMode && (
      <WorkspaceShotTimeline
        shots={session.continuity.shots}
        currentShotId={currentShotId}
        onShotSelect={handleShotSelect}
        onAddShot={handleAddShot}
      />
    )}
  </div>
);
```

**Deliverables:**
- [ ] `WorkspaceShotTimeline` component created
- [ ] Timeline renders when `session.continuity.shots.length > 0`
- [ ] Timeline docked at bottom of workspace
- [ ] Shot selection syncs with editor state

---

### Phase 3: Make Editor Shot-Aware

**Objective:** Prompt editor operates on current shot when in sequence mode.

#### 3.1 Add Shot State to GenerationControlsStore

```typescript
// Extend existing store
interface GenerationControlsState {
  // ... existing fields
  
  // Sequence mode state
  currentShotId: string | null;
  isSequenceMode: boolean; // Derived from session
  
  // Actions
  selectShot: (shotId: string) => void;
  clearCurrentShot: () => void;
}
```

#### 3.2 Update Prompt Loading Logic

```typescript
// When currentShotId changes:
useEffect(() => {
  if (!currentShotId || !session?.continuity?.shots) return;
  
  const shot = session.continuity.shots.find(s => s.id === currentShotId);
  if (shot) {
    // Load shot's prompt into editor
    setPromptInput(shot.prompt);
    setGenerationParams(shot.generationParams);
  }
}, [currentShotId, session?.continuity?.shots]);
```

#### 3.3 Update Prompt Saving Logic

```typescript
// When prompt changes in sequence mode:
const handlePromptChange = async (newPrompt: string) => {
  if (isSequenceMode && currentShotId) {
    // Update current shot
    await updateShot(currentShotId, { prompt: newPrompt });
  } else {
    // Update session root prompt (existing behavior)
    await updateSession({ prompt: { input: newPrompt } });
  }
};
```

#### 3.4 Scope Versions to Current Shot

```typescript
// Versions panel
const versions = isSequenceMode && currentShotId
  ? session.continuity.shots.find(s => s.id === currentShotId)?.versions ?? []
  : session.prompt?.versions ?? [];
```

#### 3.5 Update Labels

```typescript
// Prompt label
const promptLabel = isSequenceMode && currentShotId
  ? `Shot ${shotIndex + 1} Prompt`
  : 'Prompt';
```

**Deliverables:**
- [ ] Editor loads prompt from current shot in sequence mode
- [ ] Edits save to current shot in sequence mode
- [ ] Versions panel scoped to current shot
- [ ] Labels reflect shot context

---

### Phase 4: Add Style Reference Controls to GenerationControls

**Objective:** Style reference picker appears in GenerationControls when in sequence mode.

#### 4.1 Create Inline Style Controls

Adapt existing `StyleReferencePanel` for inline use in GenerationControls:

```typescript
// client/src/features/prompt-optimizer/components/StyleReferenceControls/
// StyleReferenceControls.tsx

interface StyleReferenceControlsProps {
  shots: ContinuityShot[];
  currentShot: ContinuityShot | null;
  onStyleReferenceChange: (shotId: string) => void;
  onStrengthChange: (strength: number) => void;
  onModeChange: (mode: ContinuityMode) => void;
}

export function StyleReferenceControls({
  shots,
  currentShot,
  onStyleReferenceChange,
  onStrengthChange,
  onModeChange,
}: StyleReferenceControlsProps): React.ReactElement | null {
  // Don't render for shot 1 (no previous shots to reference)
  if (!currentShot || shots.length < 2) return null;
  
  const previousShots = shots.filter(s => /* created before current shot */);
  
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-3">
      <h3 className="text-xs font-medium text-muted uppercase tracking-wide">
        Style Reference
      </h3>
      
      {/* Source shot dropdown */}
      <select 
        value={currentShot.styleReference?.sourceId ?? previousShots[0]?.id}
        onChange={(e) => onStyleReferenceChange(e.target.value)}
        className="w-full ..."
      >
        {previousShots.map((shot, i) => (
          <option key={shot.id} value={shot.id}>
            Shot {i + 1}: {shot.prompt.slice(0, 30)}...
          </option>
        ))}
      </select>
      
      {/* Strength slider */}
      <div>
        <label className="text-xs text-muted">Strength</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={currentShot.styleReference?.strength ?? 0.6}
          onChange={(e) => onStrengthChange(Number(e.target.value))}
          className="w-full"
        />
      </div>
      
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          className={`flex-1 py-1 rounded text-xs ${
            currentShot.continuityMode === 'frame-bridge' 
              ? 'bg-accent text-white' 
              : 'bg-surface-3 text-muted'
          }`}
          onClick={() => onModeChange('frame-bridge')}
        >
          Frame Bridge
        </button>
        <button
          className={`flex-1 py-1 rounded text-xs ${
            currentShot.continuityMode === 'style-match' 
              ? 'bg-accent text-white' 
              : 'bg-surface-3 text-muted'
          }`}
          onClick={() => onModeChange('style-match')}
        >
          Style Match
        </button>
      </div>
    </div>
  );
}
```

#### 4.2 Integrate into GenerationControlsPanel

```typescript
// GenerationControlsPanel.tsx
const { session } = useSession();
const isSequenceMode = (session?.continuity?.shots?.length ?? 0) > 0;
const currentShot = /* get from store */;

return (
  <div className="space-y-4">
    {/* Prompt editor */}
    <PromptEditor ... />
    
    {/* Style reference controls - only in sequence mode */}
    {isSequenceMode && (
      <StyleReferenceControls
        shots={session.continuity.shots}
        currentShot={currentShot}
        onStyleReferenceChange={handleStyleReferenceChange}
        onStrengthChange={handleStrengthChange}
        onModeChange={handleModeChange}
      />
    )}
    
    {/* Generation buttons */}
    <GenerationButtons ... />
    
    {/* Versions */}
    <VersionsPanel ... />
  </div>
);
```

**Deliverables:**
- [ ] `StyleReferenceControls` component created
- [ ] Controls appear below prompt editor in sequence mode
- [ ] Source shot dropdown lists all previous shots
- [ ] Strength slider updates current shot
- [ ] Mode toggle switches between frame-bridge and style-match

---

### Phase 5: Add "Continue as Sequence" Entry Point

**Objective:** Users can convert a session to sequence mode with one click.

#### 5.1 Show Entry Point After First Generation

```typescript
// In workspace, after video display
const hasGeneratedVideo = (session?.prompt?.keyframes?.length ?? 0) > 0 
  || /* check for generated videos */;
const isSequenceMode = (session?.continuity?.shots?.length ?? 0) > 0;

{hasGeneratedVideo && !isSequenceMode && (
  <ContinueAsSequenceButton onClick={handleStartSequence} />
)}
```

#### 5.2 Implement Conversion Logic

```typescript
const handleStartSequence = async () => {
  // 1. Get current video/generation data
  const currentVideo = session.prompt?.keyframes?.[0] 
    ?? /* latest generation */;
  
  // 2. Create Shot 1 from current state
  const shot1: CreateShotInput = {
    prompt: session.prompt?.output ?? session.prompt?.input ?? '',
    sourceAssetId: currentVideo?.assetId,
    generationParams: session.prompt?.generationParams,
  };
  
  // 3. Update session with continuity block
  await updateSession({
    continuity: {
      shots: [], // Will be populated by addShot
      settings: {
        generationMode: 'continuity',
        defaultContinuityMode: 'frame-bridge',
        defaultStyleStrength: 0.6,
      },
    },
  });
  
  // 4. Add the first shot
  const createdShot = await addShot(shot1);
  
  // 5. UI automatically updates (timeline appears)
  setCurrentShotId(createdShot.id);
};
```

#### 5.3 Wire Existing "Continue Scene" Button

The screenshot shows a "Continue Scene" button already exists. Wire it to `handleStartSequence`:

```typescript
// Find existing ContinueSceneButton usage and update
<ContinueSceneButton 
  onClick={handleStartSequence}
  disabled={!hasGeneratedVideo || isSequenceMode}
/>
```

**Deliverables:**
- [ ] "Continue as Sequence" / "Continue Scene" button wired to conversion logic
- [ ] Clicking creates Shot 1 from current video
- [ ] Session gains `continuity` block
- [ ] Timeline appears automatically
- [ ] Editor switches to shot-aware mode

---

### Phase 6: Delete Legacy Continuity Code

**Objective:** Remove code made obsolete by workspace integration.

#### 6.1 Files to Delete

```
client/src/pages/ContinuityPage.tsx
```

#### 6.2 Components to Repurpose/Keep

```
client/src/features/continuity/
├── api/                          # KEEP: API calls still needed
├── components/
│   ├── ContinuitySession/
│   │   ├── SessionTimeline.tsx   # KEEP: Reused in workspace
│   │   ├── ShotCard.tsx          # KEEP: Used by timeline
│   │   └── ContinuitySession.tsx # DELETE: Standalone page layout
│   ├── ShotEditor/               # EVALUATE: May merge with prompt editor
│   ├── StyleReferencePanel/      # REPURPOSE: Inline in GenerationControls
│   └── ContinueSceneButton/      # KEEP: Entry point
├── context/                      # EVALUATE: May merge into session context
├── hooks/                        # KEEP: Reusable logic
├── types.ts                      # KEEP
└── utils/                        # KEEP
```

#### 6.3 Code to Remove from App.tsx

```typescript
// Remove continuity-specific routes (replaced with redirects in Phase 1)
// Remove ContinuityPage lazy import
```

#### 6.4 Code to Remove from MainWorkspace.tsx

```typescript
// Remove ContinuityPage import
// Remove continuity conditional rendering
```

**Deliverables:**
- [ ] `ContinuityPage.tsx` deleted
- [ ] `ContinuitySession.tsx` deleted
- [ ] No dead imports remaining
- [ ] All continuity functionality accessible via unified workspace

---

## State Management Architecture

### Unified Session State

```typescript
interface UnifiedSessionState {
  session: Session | null;
  loading: boolean;
  error: string | null;
  
  // Sequence mode
  currentShotId: string | null;
  isSequenceMode: boolean; // Derived: session?.continuity?.shots?.length > 0
  
  // Actions
  loadSession: (id: string) => Promise<void>;
  updateSession: (updates: Partial<Session>) => Promise<void>;
  
  // Shot actions (only available in sequence mode)
  addShot: (input: CreateShotInput) => Promise<ContinuityShot>;
  updateShot: (shotId: string, updates: Partial<ContinuityShot>) => Promise<void>;
  deleteShot: (shotId: string) => Promise<void>;
  selectShot: (shotId: string) => void;
  generateShot: (shotId: string) => Promise<void>;
  
  // Style reference actions
  updateStyleReference: (shotId: string, ref: StyleReference) => Promise<void>;
  updateContinuityMode: (shotId: string, mode: ContinuityMode) => Promise<void>;
  
  // Conversion
  startSequence: () => Promise<void>; // Convert single-shot to sequence
}
```

### Derived State

```typescript
const isSequenceMode = (session?.continuity?.shots?.length ?? 0) > 0;

const currentShot = isSequenceMode && currentShotId
  ? session.continuity.shots.find(s => s.id === currentShotId)
  : null;

const currentShotIndex = isSequenceMode && currentShotId
  ? session.continuity.shots.findIndex(s => s.id === currentShotId)
  : -1;

const hasGeneratedVideo = (session?.prompt?.keyframes?.length ?? 0) > 0;
```

---

## API Changes

### No New Endpoints Required

Existing v2 endpoints handle all operations:

| Endpoint | Usage |
|----------|-------|
| `POST /api/v2/sessions/:id/shots` | Add shot (called by `addShot`) |
| `PATCH /api/v2/sessions/:id/shots/:shotId` | Update shot |
| `POST /api/v2/sessions/:id/shots/:shotId/generate` | Generate shot video |
| `PUT /api/v2/sessions/:id/style-reference` | Update style reference |
| `PUT /api/v2/sessions/:id/settings` | Update continuity settings |

### Session Update for Conversion

The `startSequence` action uses:

```typescript
PATCH /api/v2/sessions/:id
{
  continuity: {
    shots: [],
    settings: {
      generationMode: 'continuity',
      defaultContinuityMode: 'frame-bridge',
      defaultStyleStrength: 0.6,
    },
  },
}
```

Followed by:

```typescript
POST /api/v2/sessions/:id/shots
{
  prompt: '...',
  sourceAssetId: '...',
  generationParams: {...},
}
```

---

## Testing Checklist

### Functional Tests

- [ ] New session starts in single-shot mode (no timeline)
- [ ] "Continue as Sequence" appears after first video generation
- [ ] Clicking "Continue as Sequence" creates Shot 1 from current video
- [ ] Shot timeline appears after conversion
- [ ] Clicking shot in timeline loads its prompt into editor
- [ ] Edits in editor save to current shot
- [ ] Generating adds result to current shot
- [ ] Style reference dropdown shows previous shots
- [ ] Style strength slider updates shot
- [ ] Continuity mode toggle works
- [ ] Adding new shot via [+] creates empty draft
- [ ] Versions panel shows correct shot's versions

### Regression Tests

- [ ] Single-shot workflow still works end-to-end
- [ ] Preview generation works in both modes
- [ ] Share links still work
- [ ] Session loading from URL works
- [ ] ToolRail navigation works correctly

### Edge Cases

- [ ] Session with shots but no completed videos
- [ ] Switching sessions preserves/clears shot selection
- [ ] Error handling for failed shot creation
- [ ] Error handling for failed shot generation
- [ ] Large sessions with many shots remain performant

### Route Compatibility

- [ ] `/create` redirects to `/`
- [ ] `/session/:id/create` redirects to `/session/:id`
- [ ] `/session/:id/continuity` redirects to `/session/:id`
- [ ] `/session/new/continuity` redirects to `/`
- [ ] `/continuity` redirects (already implemented)
- [ ] `/continuity/:id` redirects (already implemented)

---

## Migration Notes

### No Data Migration Required

This is a UI simplification. The data model from the unification plan is already in place:

- Sessions already support `continuity` block
- Shots are already stored in `session.continuity.shots`
- Style references are already stored per-shot

### Feature Flag (Optional)

If desired, gate behind `WORKSPACE_V2_ENABLED`:

```typescript
const useWorkspaceV2 = useFeatureFlag('WORKSPACE_V2_ENABLED');

// In MainWorkspace
if (!useWorkspaceV2 && activeTool === 'continuity') {
  return <ContinuityPage />; // Legacy path
}
```

---

## Effort Estimate

| Phase | Estimate |
|-------|----------|
| Phase 1: Remove Create/Studio/Continuity distinction | 0.5 days |
| Phase 2: Integrate shot timeline | 1 day |
| Phase 3: Make editor shot-aware | 1.5 days |
| Phase 4: Add style reference controls | 1 day |
| Phase 5: Add "Continue as Sequence" entry point | 0.5 days |
| Phase 6: Delete legacy code | 0.5 days |
| Testing & polish | 1 day |
| **Total** | **6 days** |

---

## Success Criteria

1. **Zero separate continuity destinations** — No ContinuityPage, no continuity route
2. **One workspace component** — No conditional page rendering based on ActiveTool
3. **Emergent multi-shot** — Timeline appears automatically when shots exist
4. **No creation form** — Users don't configure continuity settings upfront
5. **Seamless transition** — Single-shot to multi-shot is one click
6. **All existing functionality preserved** — Shot generation, style reference, versioning

---

## Appendix: Component Responsibility Matrix

| Component | Single-Shot Mode | Sequence Mode |
|-----------|------------------|---------------|
| PromptEditor | Edits `session.prompt.input` | Edits `currentShot.prompt` |
| GenerationButtons | Generates to session | Generates to current shot |
| VersionsPanel | Shows `session.prompt.versions` | Shows `currentShot.versions` |
| StyleReferenceControls | Hidden | Visible |
| WorkspaceShotTimeline | Hidden | Visible |
| ContinueAsSequenceButton | Visible (if has video) | Hidden |
