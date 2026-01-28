# Generations Timeline Implementation Spec

## Overview

Implement a unified generations timeline within the current prompt's GenerationsPanel that:
1. Shows all generations across all prompt versions in a flat list (newest first)
2. Inserts subtle dividers at version boundaries with "prompt changed" indicator
3. Clicking any generation restores that version's prompt to the editor
4. Auto-creates a new version when user generates with a modified prompt

---

## Current Architecture

### Data Model (already exists)

```typescript
// client/src/hooks/types.ts
interface PromptHistoryEntry {
  id?: string;
  uuid?: string;
  versions?: PromptVersionEntry[];
  // ...
}

interface PromptVersionEntry {
  versionId: string;
  label?: string;
  signature: string;  // Hash of prompt text
  prompt: string;
  timestamp: string;
  generations?: Generation[] | null;  // ← Generations attached here
  // ...
}

// client/src/features/prompt-optimizer/GenerationsPanel/types.ts
interface Generation {
  id: string;
  tier: 'draft' | 'render';
  status: 'pending' | 'generating' | 'completed' | 'failed';
  model: string;
  prompt: string;
  promptVersionId: string | null;  // ← Links to version
  createdAt: number;
  mediaUrls: string[];
  mediaType: 'image' | 'video' | 'image-sequence';
  // ...
}
```

### Key Files

| File | Purpose |
|------|---------|
| `client/src/features/prompt-optimizer/PromptCanvas.tsx` | Main orchestrator, owns version state |
| `client/src/features/prompt-optimizer/GenerationsPanel/GenerationsPanel.tsx` | Displays generations, handles draft/render |
| `client/src/features/prompt-optimizer/GenerationsPanel/hooks/useGenerationsState.ts` | Local generation state management |
| `client/src/features/prompt-optimizer/GenerationsPanel/hooks/useGenerationActions.ts` | Draft/render API calls |
| `client/src/features/prompt-optimizer/PromptCanvas/hooks/usePromptVersioning.ts` | Version CRUD, syncs generations to versions |
| `client/src/features/span-highlighting/index.ts` | Exports `createHighlightSignature()` |

### Current Flow

1. User edits prompt → signature changes
2. User clicks "Run Draft" → `generateDraft()` called
3. Generation created with current `promptVersionId`
4. `syncVersionGenerations()` persists to Firestore

**Problem:** If prompt changed but no new version was created, generation attaches to old version with wrong prompt.

---

## Implementation Tasks

### Task 1: Create `useGenerationsTimeline` Hook

**File:** `client/src/features/prompt-optimizer/GenerationsPanel/hooks/useGenerationsTimeline.ts`

**Purpose:** Flatten all generations across all versions into a single timeline with dividers.

```typescript
import { useMemo } from 'react';
import type { PromptVersionEntry } from '@hooks/types';
import type { Generation } from '../types';

export interface TimelineGeneration extends Generation {
  _versionId: string;
  _versionLabel: string;
}

export interface TimelineDivider {
  type: 'divider';
  versionId: string;
  versionLabel: string;
  promptChanged: boolean;
  timestamp: number;
}

export interface TimelineGenerationItem {
  type: 'generation';
  generation: TimelineGeneration;
  timestamp: number;
}

export type TimelineItem = TimelineDivider | TimelineGenerationItem;

interface UseGenerationsTimelineOptions {
  versions: PromptVersionEntry[];
}

export function useGenerationsTimeline({
  versions,
}: UseGenerationsTimelineOptions): TimelineItem[] {
  return useMemo(() => {
    if (!versions.length) return [];

    // 1. Flatten all generations with version metadata
    const allGenerations: TimelineGeneration[] = [];
    
    for (const version of versions) {
      const gens = version.generations ?? [];
      for (const gen of gens) {
        allGenerations.push({
          ...gen,
          _versionId: version.versionId,
          _versionLabel: version.label ?? version.versionId,
        });
      }
    }

    // 2. Sort by createdAt descending (newest first)
    allGenerations.sort((a, b) => b.createdAt - a.createdAt);

    // 3. Build timeline with dividers
    const items: TimelineItem[] = [];
    let lastVersionId: string | null = null;
    let isFirstDivider = true;

    for (const gen of allGenerations) {
      // Insert divider when version changes
      if (gen._versionId !== lastVersionId) {
        items.push({
          type: 'divider',
          versionId: gen._versionId,
          versionLabel: gen._versionLabel,
          promptChanged: !isFirstDivider, // First divider = no "changed" badge
          timestamp: gen.createdAt,
        });
        lastVersionId = gen._versionId;
        isFirstDivider = false;
      }

      items.push({
        type: 'generation',
        generation: gen,
        timestamp: gen.createdAt,
      });
    }

    return items;
  }, [versions]);
}
```

**Tests to consider:**
- Empty versions array → returns empty array
- Single version with generations → one divider (no "changed" badge) + generations
- Multiple versions → dividers between version boundaries with "changed" badge
- Generations sorted newest-first within and across versions

---

### Task 2: Create `VersionDivider` Component

**File:** `client/src/features/prompt-optimizer/GenerationsPanel/components/VersionDivider.tsx`

**Purpose:** Subtle horizontal divider showing version boundary.

```typescript
import React from 'react';
import { cn } from '@/utils/cn';

interface VersionDividerProps {
  versionLabel: string;
  promptChanged: boolean;
  className?: string;
}

export function VersionDivider({
  versionLabel,
  promptChanged,
  className,
}: VersionDividerProps): React.ReactElement {
  return (
    <div
      className={cn(
        'flex items-center gap-3 py-2',
        className
      )}
      role="separator"
      aria-label={`Version ${versionLabel}${promptChanged ? ', prompt changed' : ''}`}
    >
      {/* Left line */}
      <div className="h-px flex-1 bg-[rgb(41,44,50)]" aria-hidden="true" />
      
      {/* Label */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium text-[rgb(107,114,128)] uppercase tracking-wide">
          {versionLabel}
        </span>
        {promptChanged && (
          <span className="text-[10px] font-medium text-[rgb(147,130,100)] bg-[rgb(147,130,100)]/10 px-1.5 py-0.5 rounded">
            prompt changed
          </span>
        )}
      </div>
      
      {/* Right line */}
      <div className="h-px flex-1 bg-[rgb(41,44,50)]" aria-hidden="true" />
    </div>
  );
}
```

**Design notes:**
- Subtle, muted appearance (matches dark theme)
- Non-interactive (no hover states, no click handler)
- "prompt changed" badge uses warm/amber tone to draw attention without being harsh
- Accessible via `role="separator"` and `aria-label`

---

### Task 3: Create `onCreateVersionIfNeeded` Callback

**File:** `client/src/features/prompt-optimizer/PromptCanvas.tsx`

**Purpose:** Create a new version if prompt has changed, return the versionId.

**Add this callback near `handleCreateVersion` (around line 350):**

```typescript
/**
 * Creates a new version if the current prompt differs from the last version.
 * Returns the versionId to use for generation (new or existing).
 * This is called before draft/render to ensure generations attach to correct version.
 */
const createVersionIfNeeded = useCallback((): string => {
  // If no prompt, return empty (shouldn't happen in practice)
  const promptText = (normalizedDisplayedPrompt ?? '').trim();
  if (!promptText) {
    return activeVersion?.versionId ?? '';
  }

  const signature = createHighlightSignature(promptText);
  
  // If no versions exist, create v1
  if (!currentVersions.length) {
    const editCount = versionEditCountRef.current;
    const edits = versionEditsRef.current.length ? [...versionEditsRef.current] : [];
    const newVersion = {
      versionId: `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: 'v1',
      signature,
      prompt: promptText,
      timestamp: new Date().toISOString(),
      highlights: latestHighlightRef.current ?? null,
      preview: null,
      video: null,
      generations: [],
      ...(editCount > 0 ? { editCount } : {}),
      ...(edits.length ? { edits } : {}),
    };

    promptHistory.updateEntryVersions(currentPromptUuid!, currentPromptDocId, [newVersion]);
    setActiveVersionId(newVersion.versionId);
    resetVersionEdits();
    return newVersion.versionId;
  }

  // Check if prompt changed from last version
  const lastVersion = currentVersions[currentVersions.length - 1];
  if (lastVersion && lastVersion.signature === signature) {
    // No change, return existing versionId
    return lastVersion.versionId;
  }

  // Prompt changed, create new version
  const editCount = versionEditCountRef.current;
  const edits = versionEditsRef.current.length ? [...versionEditsRef.current] : [];
  const newVersion = {
    versionId: `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: `v${currentVersions.length + 1}`,
    signature,
    prompt: promptText,
    timestamp: new Date().toISOString(),
    highlights: latestHighlightRef.current ?? null,
    preview: null,
    video: null,
    generations: [],
    ...(editCount > 0 ? { editCount } : {}),
    ...(edits.length ? { edits } : {}),
  };

  promptHistory.updateEntryVersions(currentPromptUuid!, currentPromptDocId, [
    ...currentVersions,
    newVersion,
  ]);
  setActiveVersionId(newVersion.versionId);
  resetVersionEdits();
  return newVersion.versionId;
}, [
  activeVersion?.versionId,
  currentPromptDocId,
  currentPromptUuid,
  currentVersions,
  latestHighlightRef,
  normalizedDisplayedPrompt,
  promptHistory,
  resetVersionEdits,
  setActiveVersionId,
  versionEditCountRef,
  versionEditsRef,
]);
```

---

### Task 4: Create `onRestoreVersion` Callback

**File:** `client/src/features/prompt-optimizer/PromptCanvas.tsx`

**Purpose:** Restore a version's prompt when user clicks a generation.

**This already exists as `handleSelectVersion`. Just ensure it's passed to GenerationsPanel.**

The existing `handleSelectVersion` (around line 320) does exactly what we need:
1. Finds the target version
2. Sets active version ID
3. Updates optimized prompt
4. Applies highlight snapshot
5. Resets edit stacks

---

### Task 5: Update `GenerationsPanel` Props and Rendering

**File:** `client/src/features/prompt-optimizer/GenerationsPanel/GenerationsPanel.tsx`

#### 5.1 Update Props Interface

```typescript
// Add to GenerationsPanelProps interface
export interface GenerationsPanelProps {
  prompt: string;
  promptVersionId: string;
  aspectRatio: string;
  duration?: number;
  fps?: number;
  generationParams?: Record<string, unknown>;
  initialGenerations?: Generation[];
  onGenerationsChange?: (generations: Generation[]) => void;
  className?: string;
  
  // NEW PROPS
  versions: PromptVersionEntry[];  // All versions for timeline
  onRestoreVersion: (versionId: string) => void;  // Called when generation clicked
  onCreateVersionIfNeeded: () => string;  // Called before generate, returns versionId
}
```

#### 5.2 Import New Dependencies

```typescript
import { useGenerationsTimeline, type TimelineItem } from './hooks/useGenerationsTimeline';
import { VersionDivider } from './components/VersionDivider';
import type { PromptVersionEntry } from '@hooks/types';
```

#### 5.3 Use Timeline Hook

```typescript
export function GenerationsPanel({
  prompt,
  promptVersionId,
  aspectRatio,
  // ... existing props
  versions,  // NEW
  onRestoreVersion,  // NEW
  onCreateVersionIfNeeded,  // NEW
}: GenerationsPanelProps): React.ReactElement {
  
  // ... existing hooks
  
  // NEW: Build timeline from all versions
  const timeline = useGenerationsTimeline({ versions });
  
  // ... rest of component
}
```

#### 5.4 Modify Draft/Render Handlers

Update `handleDraft` and `handleRender` to use `onCreateVersionIfNeeded`:

```typescript
const handleDraft = useCallback(
  (model: DraftModel) => {
    if (!prompt.trim()) return;
    
    // NEW: Ensure version exists/is current before generating
    const versionId = onCreateVersionIfNeeded();
    
    generateDraft(model, prompt, { promptVersionId: versionId });
  },
  [generateDraft, prompt, onCreateVersionIfNeeded]
);

const handleRender = useCallback(
  (model: string) => {
    if (!prompt.trim()) return;
    
    // NEW: Ensure version exists/is current before generating
    const versionId = onCreateVersionIfNeeded();
    
    generateRender(model, prompt, { promptVersionId: versionId });
  },
  [generateRender, prompt, onCreateVersionIfNeeded]
);
```

#### 5.5 Update Rendering to Use Timeline

Replace the current `generations.map()` with timeline rendering:

```typescript
{/* Replace existing generations list */}
<div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
  {timeline.length === 0 ? (
    <EmptyState
      onRunDraft={() => handleDraft(defaultDraftModel)}
      isRunDraftDisabled={!prompt.trim() || isGenerating}
    />
  ) : (
    timeline.map((item, index) => {
      if (item.type === 'divider') {
        return (
          <VersionDivider
            key={`divider-${item.versionId}`}
            versionLabel={item.versionLabel}
            promptChanged={item.promptChanged}
          />
        );
      }
      
      return (
        <GenerationCard
          key={item.generation.id}
          generation={item.generation}
          isActive={item.generation.id === activeGenerationId}
          onRetry={handleRetry}
          onDelete={handleDelete}
          onDownload={handleDownload}
          onClick={() => onRestoreVersion(item.generation._versionId)}  // NEW
        />
      );
    })
  )}
</div>
```

#### 5.6 Update `GenerationCard` to Accept `onClick`

**File:** `client/src/features/prompt-optimizer/GenerationsPanel/components/GenerationCard.tsx`

Add `onClick` prop:

```typescript
interface GenerationCardProps {
  generation: Generation;
  isActive: boolean;
  onRetry: (generation: Generation) => void;
  onDelete: (generation: Generation) => void;
  onDownload: (generation: Generation) => void;
  onClick?: () => void;  // NEW
}

export function GenerationCard({
  generation,
  isActive,
  onRetry,
  onDelete,
  onDownload,
  onClick,  // NEW
}: GenerationCardProps): React.ReactElement {
  return (
    <div
      className={cn(
        'relative rounded-lg border transition-colors',
        isActive ? 'border-accent' : 'border-border',
        onClick && 'cursor-pointer hover:border-border-strong'  // NEW
      )}
      onClick={onClick}  // NEW
      role={onClick ? 'button' : undefined}  // NEW
      tabIndex={onClick ? 0 : undefined}  // NEW
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}  // NEW
    >
      {/* ... existing content */}
    </div>
  );
}
```

---

### Task 6: Update `PromptCanvas` to Pass New Props

**File:** `client/src/features/prompt-optimizer/PromptCanvas.tsx`

Find the `<GenerationsPanel>` usage (around line 900) and update:

```typescript
<GenerationsPanel
  prompt={normalizedDisplayedPrompt ?? ''}
  promptVersionId={promptVersionId}
  aspectRatio={effectiveAspectRatio ?? '16:9'}
  duration={durationSeconds ?? undefined}
  fps={fpsNumber ?? undefined}
  generationParams={generationParams ?? undefined}
  initialGenerations={activeVersion?.generations ?? undefined}
  onGenerationsChange={handleGenerationsChange}
  
  // NEW PROPS
  versions={currentVersions}
  onRestoreVersion={handleSelectVersion}
  onCreateVersionIfNeeded={createVersionIfNeeded}
/>
```

There are TWO `<GenerationsPanel>` instances in PromptCanvas.tsx:
1. Desktop (around line 900)
2. Mobile Sheet (around line 950)

**Update both instances with the new props.**

---

### Task 7: Export New Files from Index

**File:** `client/src/features/prompt-optimizer/GenerationsPanel/index.ts`

Ensure exports include new files:

```typescript
export { GenerationsPanel } from './GenerationsPanel';
export type { Generation, GenerationParams, GenerationsPanelProps } from './types';
export { useGenerationsTimeline } from './hooks/useGenerationsTimeline';
export type { TimelineItem, TimelineDivider, TimelineGenerationItem } from './hooks/useGenerationsTimeline';
export { VersionDivider } from './components/VersionDivider';
```

---

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `GenerationsPanel/hooks/useGenerationsTimeline.ts` | **CREATE** | Flattens versions into timeline with dividers |
| `GenerationsPanel/components/VersionDivider.tsx` | **CREATE** | Subtle divider component |
| `GenerationsPanel/GenerationsPanel.tsx` | **MODIFY** | Use timeline, pass new props |
| `GenerationsPanel/components/GenerationCard.tsx` | **MODIFY** | Add onClick prop |
| `GenerationsPanel/index.ts` | **MODIFY** | Export new files |
| `PromptCanvas.tsx` | **MODIFY** | Add `createVersionIfNeeded`, pass new props |

---

## Edge Cases to Handle

1. **No versions exist, user generates**
   - `createVersionIfNeeded()` creates v1, returns its versionId
   - Generation attaches to v1
   - Timeline shows single divider "v1" (no "changed" badge) + generation

2. **User generates multiple times without editing**
   - Same version, no new divider
   - All generations grouped under same version section

3. **User edits, then generates**
   - `createVersionIfNeeded()` detects signature change
   - Creates new version (v2, v3, etc.)
   - New divider appears with "prompt changed" badge
   - Generation attaches to new version

4. **User clicks generation from old version**
   - `onRestoreVersion(versionId)` called
   - `handleSelectVersion` restores prompt, highlights, scrolls version panel
   - User can now generate from that restored state

5. **Empty prompt**
   - Draft/Render buttons already disabled when prompt is empty
   - `createVersionIfNeeded` returns empty string (defensive)

6. **Rapid generation spam**
   - Each generation gets same versionId (prompt hasn't changed between clicks)
   - All attach to same version correctly

---

## Testing Checklist

### Unit Tests

- [ ] `useGenerationsTimeline` returns empty array for empty versions
- [ ] `useGenerationsTimeline` correctly flattens single version
- [ ] `useGenerationsTimeline` inserts dividers at version boundaries
- [ ] `useGenerationsTimeline` marks first divider as `promptChanged: false`
- [ ] `useGenerationsTimeline` marks subsequent dividers as `promptChanged: true`
- [ ] `useGenerationsTimeline` sorts newest-first

### Integration Tests

- [ ] Generating without versions creates v1
- [ ] Generating after edit creates new version
- [ ] Generating without edit reuses existing version
- [ ] Clicking generation restores that version's prompt
- [ ] Version panel scrolls to selected version
- [ ] Both desktop and mobile GenerationsPanel work correctly

### Visual Tests

- [ ] Dividers render with correct styling
- [ ] "prompt changed" badge appears correctly
- [ ] Generation cards show hover state
- [ ] Timeline scrolls correctly with many generations

---

## Architecture Compliance

This implementation follows the project's established patterns:

- **VideoConceptBuilder pattern**: GenerationsPanel remains an orchestrator, new logic extracted to hooks
- **File size limits**: 
  - `useGenerationsTimeline.ts` ~80 lines (under 150 hook limit)
  - `VersionDivider.tsx` ~40 lines (under 200 component limit)
  - Changes to `GenerationsPanel.tsx` add ~50 lines (stays under 500 orchestrator limit)
- **Separation of concerns**: Timeline logic in hook, rendering in components
- **Type safety**: All new interfaces defined with TypeScript

---

## Dependencies

No new npm dependencies required. Uses existing:
- React hooks
- Existing types from `@hooks/types`
- Existing `createHighlightSignature` from span-highlighting
- Existing `cn` utility for classnames

---

## Rollback Plan

If issues arise, changes can be reverted by:
1. Removing new props from `<GenerationsPanel>` calls
2. Reverting `GenerationsPanel.tsx` to use `generations.map()` instead of timeline
3. Keeping new files (they won't be imported)

The feature is additive and doesn't modify core data structures.
