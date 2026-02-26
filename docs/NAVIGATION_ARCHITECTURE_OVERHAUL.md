# PromptCanvas Navigation Architecture Overhaul

> **Status:** Planning  
> **Author:** Architecture Review  
> **Last Updated:** 2025-02-01  
> **Estimated Duration:** 10-14 days

## Executive Summary

This plan addresses the navigation fragmentation, prop drilling, duplicate implementations, and discoverability issues in PromptCanvas. The goal is a unified workspace experience where authenticated users never lose context while navigating.

**Key Problems Solved:**
- Dual navigation shells causing context loss
- 34-prop drilling through ToolSidebar
- Duplicate History implementations (SessionsPanel vs HistoryPage)
- Asset management fragmentation
- No onboarding/home state for new users
- Ghost routes and placeholder pages

**Timeline:** 2-3 weeks  
**Risk Level:** Medium (touches routing, but phased approach minimizes blast radius)

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Phase 1: Context Architecture Foundation](#phase-1-context-architecture-foundation)
3. [Phase 2: Navigation Unification](#phase-2-navigation-unification)
4. [Phase 3: History Consolidation](#phase-3-history-consolidation)
5. [Phase 4: Asset Library Integration](#phase-4-asset-library-integration)
6. [Phase 5: Workspace Home State](#phase-5-workspace-home-state)
7. [Phase 6: Cleanup](#phase-6-cleanup)
8. [Risk Mitigation](#risk-mitigation)
9. [Success Metrics](#success-metrics)

---

## Current State Analysis

### Dual Navigation Shells

The app currently renders two entirely different shells depending on the route:

| Shell | Routes | Navigation | Key Files |
|-------|--------|------------|-----------|
| Marketing Shell (TopNavbar) | `/home`, `/pricing`, `/history`, `/account`, `/share/:uuid` | Horizontal top nav | `AppShell`, `TopNavbar` |
| Workspace Shell (ToolSidebar) | `/`, `/session/:id`, `/assets` | 60px icon rail | `toolNavConfig.ts`, `ToolRail.tsx` |

**Problem:** Zero shared navigation between them. Users in the workspace can't reach History, Pricing, or Docs. Users on marketing pages can't access Sessions, Characters, or Styles.

### Duplicate History Implementations

| Component | Location | Features |
|-----------|----------|----------|
| `SessionsPanel` | Sidebar (400px panel) | 5-item limit, chip filters, keyboard nav, rename modal |
| `HistoryPage` | Full page `/history` | Card layout, different search, no filters, full-width |

These are separate implementations with different filters, different state, and no shared hooks.

### Asset Fragmentation

| Surface | Scope | Capabilities |
|---------|-------|--------------|
| `CharactersPanel` | Characters only | Insert trigger, edit, create |
| `AssetLibrary` (`/assets`) | All types | Full CRUD, image management, filtering |
| `AssetsSidebar` | Inline in workspace | Detection via @-triggers |

### Prop Drilling

`ToolSidebarProps` has **34 props**. The threading path is:

```
PromptOptimizerWorkspace (creates toolSidebarProps with 34 fields)
    → PromptOptimizerWorkspaceView
        → AppShell
            → ToolSidebar
                → SessionsPanel / GenerationControlsPanel / CharactersPanel
```

### Underutilized Context

`AppShellContext` holds exactly one thing: `convergenceHandoff`. Meanwhile, 34 props are being threaded manually.

### Ghost Routes

11 redirect routes exist for removed features (`/create`, `/continuity`, `/consistent`, etc.) plus `/consistent` is still in `WORKSPACE_ROUTES_EXACT` and `NAV_ITEMS`.

---

## Phase 1: Context Architecture Foundation

**Duration:** 2-3 days  
**Files touched:** ~8 new/modified  
**Risk:** Low (internal refactor, no UX changes)

### Objective

Eliminate prop drilling by extracting shared workspace state into React Context. This is prerequisite work that makes all subsequent phases easier.

### 1.1 Create WorkspaceContext

**New file:** `client/src/contexts/WorkspaceContext.tsx`

```typescript
import React, {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useCallback,
  type ReactNode,
} from 'react';
import type { PromptHistoryEntry } from '@hooks/types';
import type { Asset, AssetType } from '@shared/types/asset';
import type { User } from '@features/prompt-optimizer/context/types';
import type { ToolPanelType } from '@components/ToolSidebar/types';

// ─────────────────────────────────────────────────────────────────────────────
// State Interface
// ─────────────────────────────────────────────────────────────────────────────

interface WorkspaceState {
  // Session/History
  history: PromptHistoryEntry[];
  filteredHistory: PromptHistoryEntry[];
  isLoadingHistory: boolean;
  searchQuery: string;
  currentPromptUuid: string | null;
  currentPromptDocId: string | null;
  activeStatusLabel: string;
  activeModelLabel: string;

  // Assets
  assets: Asset[];
  assetsByType: Record<AssetType, Asset[]>;
  isLoadingAssets: boolean;

  // User
  user: User | null;

  // UI
  activePanel: ToolPanelType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions Interface
// ─────────────────────────────────────────────────────────────────────────────

interface WorkspaceActions {
  // History actions
  setSearchQuery: (query: string) => void;
  loadFromHistory: (entry: PromptHistoryEntry) => void;
  createNew: () => void;
  deleteFromHistory: (id: string) => void;
  duplicateEntry: (entry: PromptHistoryEntry) => void;
  renameEntry: (entry: PromptHistoryEntry, title: string) => void;

  // Asset actions
  refreshAssets: () => Promise<void>;
  insertTrigger: (trigger: string, range?: { start: number; end: number }) => void;
  editAsset: (assetId: string) => void;
  createAsset: (type: AssetType) => void;
  createFromTrigger: (trigger: string) => void;

  // UI actions
  setActivePanel: (panel: ToolPanelType) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context Value (structured for potential future split)
// ─────────────────────────────────────────────────────────────────────────────

interface WorkspaceContextValue {
  state: WorkspaceState;
  actions: WorkspaceActions;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }
  // Destructure for convenience - consumers get flat access
  return { ...context.state, ...context.actions };
}

// Optional: If we need to split later for performance
export function useWorkspaceState(): WorkspaceState {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspaceState must be used within WorkspaceProvider');
  }
  return context.state;
}

export function useWorkspaceActions(): WorkspaceActions {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspaceActions must be used within WorkspaceProvider');
  }
  return context.actions;
}
```

### 1.2 Create WorkspaceProvider

Extract state initialization from `PromptOptimizerWorkspace.tsx` into the provider:

```typescript
// In WorkspaceContext.tsx (continued)

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps): React.ReactElement {
  const user = useAuthUser();
  const { sessionId } = useParams<{ sessionId?: string }>();
  
  // ─────────────────────────────────────────────────────────────────────────
  // IMPORTANT: History must be initialized at provider level, not lazily
  // This ensures WorkspaceHome has access to history even with no session
  // ─────────────────────────────────────────────────────────────────────────
  const promptHistory = usePromptHistory(user);
  const assetsSidebar = useAssetsSidebar();
  
  const [activePanel, setActivePanel] = useState<ToolPanelType>('studio');
  const [currentPromptUuid, setCurrentPromptUuid] = useState<string | null>(null);
  const [currentPromptDocId, setCurrentPromptDocId] = useState<string | null>(null);
  
  // ... additional state as needed
  
  // ─────────────────────────────────────────────────────────────────────────
  // Memoized state object
  // ─────────────────────────────────────────────────────────────────────────
  const state: WorkspaceState = useMemo(() => ({
    history: promptHistory.history,
    filteredHistory: promptHistory.filteredHistory,
    isLoadingHistory: promptHistory.isLoadingHistory,
    searchQuery: promptHistory.searchQuery,
    currentPromptUuid,
    currentPromptDocId,
    activeStatusLabel: '', // Computed in consumer
    activeModelLabel: '',  // Computed in consumer
    assets: assetsSidebar.assets,
    assetsByType: assetsSidebar.byType,
    isLoadingAssets: assetsSidebar.isLoading,
    user,
    activePanel,
  }), [
    promptHistory.history,
    promptHistory.filteredHistory,
    promptHistory.isLoadingHistory,
    promptHistory.searchQuery,
    currentPromptUuid,
    currentPromptDocId,
    assetsSidebar.assets,
    assetsSidebar.byType,
    assetsSidebar.isLoading,
    user,
    activePanel,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Stable action references (use useCallback to prevent re-renders)
  // ─────────────────────────────────────────────────────────────────────────
  const actions: WorkspaceActions = useMemo(() => ({
    setSearchQuery: promptHistory.setSearchQuery,
    loadFromHistory: (entry) => {
      // Implementation moved from PromptOptimizerWorkspace
    },
    createNew: () => {
      // Implementation moved from PromptOptimizerWorkspace
    },
    deleteFromHistory: promptHistory.deleteFromHistory,
    duplicateEntry: (entry) => {
      // Implementation moved from PromptOptimizerWorkspace
    },
    renameEntry: (entry, title) => {
      // Implementation moved from PromptOptimizerWorkspace
    },
    refreshAssets: assetsSidebar.refresh,
    insertTrigger: (trigger, range) => {
      // Implementation - needs promptInputRef access
    },
    editAsset: (assetId) => {
      // Implementation
    },
    createAsset: (type) => {
      // Implementation
    },
    createFromTrigger: (trigger) => {
      // Implementation
    },
    setActivePanel,
  }), [promptHistory, assetsSidebar]);

  const value: WorkspaceContextValue = useMemo(
    () => ({ state, actions }),
    [state, actions]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
```

### 1.3 Refactor ToolSidebar Props

**Before (34 props):**
```typescript
interface ToolSidebarProps {
  user: User | null;
  history: PromptHistoryEntry[];
  filteredHistory: PromptHistoryEntry[];
  isLoadingHistory: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // ... 28 more props
}
```

**After (~12 props, generation-specific only):**
```typescript
interface ToolSidebarProps {
  // Only props specific to generation controls
  prompt: string;
  onPromptChange?: (prompt: string) => void;
  onOptimize?: (prompt?: string, options?: OptimizationOptions) => Promise<void>;
  showResults?: boolean;
  isProcessing?: boolean;
  isRefining?: boolean;
  genericOptimizedPrompt?: string | null;
  promptInputRef?: RefObject<HTMLTextAreaElement | null>;
  onDraft: (model: DraftModel, overrides?: GenerationOverrides) => void;
  onRender: (model: string, overrides?: GenerationOverrides) => void;
  onImageUpload?: (file: File) => void | Promise<void>;
  onStoryboard: () => void;
}
```

### 1.4 Update Component Tree

```
App.tsx
└── WorkspaceProvider          ← NEW: Wraps workspace routes
    └── PromptOptimizerWorkspace
        └── ToolSidebar        ← Now uses useWorkspace() for shared state
            ├── SessionsPanel  ← Uses useWorkspace()
            ├── CharactersPanel ← Uses useWorkspace()
            └── ...
```

### 1.5 Update ToolSidebar to Use Context

**File:** `components/ToolSidebar/ToolSidebar.tsx`

```typescript
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function ToolSidebar(props: ToolSidebarProps): ReactElement {
  const {
    // Generation-specific props only
    prompt,
    onPromptChange,
    onOptimize,
    // ...
  } = props;

  // Shared state from context
  const {
    user,
    history,
    filteredHistory,
    isLoadingHistory,
    searchQuery,
    setSearchQuery,
    loadFromHistory,
    createNew,
    deleteFromHistory,
    duplicateEntry,
    renameEntry,
    currentPromptUuid,
    currentPromptDocId,
    assets,
    assetsByType,
    isLoadingAssets,
    insertTrigger,
    editAsset,
    createAsset,
    activePanel,
    setActivePanel,
  } = useWorkspace();

  // ... rest of component
}
```

### 1.6 Files to Modify

| File | Change |
|------|--------|
| `contexts/WorkspaceContext.tsx` | **Create** |
| `contexts/index.ts` | Export new context |
| `App.tsx` | Wrap workspace routes with `WorkspaceProvider` |
| `PromptOptimizerWorkspace.tsx` | Remove state that moves to context |
| `ToolSidebar/ToolSidebar.tsx` | Use `useWorkspace()` hook |
| `ToolSidebar/components/panels/SessionsPanel.tsx` | Use `useWorkspace()` hook |
| `ToolSidebar/components/panels/CharactersPanel.tsx` | Use `useWorkspace()` hook |
| `ToolSidebar/types.ts` | Slim down `ToolSidebarProps` |

### 1.7 Performance Considerations

The initial implementation uses a single `WorkspaceContext`. If profiling reveals excessive re-renders (particularly in `SessionsPanel` or `CharactersPanel` when unrelated state changes), split into:

- `WorkspaceStateContext` — Reactive state (history, assets, activePanel, searchQuery)
- `WorkspaceActionsContext` — Stable callbacks (loadFromHistory, createNew, etc.)

The current structure with `{ state, actions }` makes this split trivial:

```typescript
// Future split if needed:
const WorkspaceStateContext = createContext<WorkspaceState | null>(null);
const WorkspaceActionsContext = createContext<WorkspaceActions | null>(null);

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  // ... same setup
  
  return (
    <WorkspaceActionsContext.Provider value={actions}>
      <WorkspaceStateContext.Provider value={state}>
        {children}
      </WorkspaceStateContext.Provider>
    </WorkspaceActionsContext.Provider>
  );
}
```

**Measurement approach:**
1. Use React DevTools Profiler during development
2. Look for "cascading renders" when typing in search or switching panels
3. If >50ms re-renders occur in unrelated components, implement the split

### 1.8 Validation Criteria

- [ ] All existing tests pass
- [ ] No visual changes to UI
- [ ] `ToolSidebarProps` reduced to ≤12 props
- [ ] SessionsPanel, CharactersPanel render correctly with context
- [ ] History loads correctly even when landing on `/` with no session

---

## Phase 2: Navigation Unification

**Duration:** 3-4 days  
**Files touched:** ~12  
**Risk:** Medium (routing changes)

### Objective

Eliminate the dual-shell problem. Authenticated users stay in workspace shell with cross-navigation to marketing pages.

### 2.1 New Navigation Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATED USER SHELL                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐  ┌────────────────────────────────────────────────────────┐   │
│  │ ToolRail │  │                    Main Content                         │   │
│  │          │  │                                                         │   │
│  │ [+] New  │  │  / or /session/:id  → PromptOptimizerWorkspace         │   │
│  │ ──────── │  │  /assets            → AssetLibrary                      │   │
│  │ Sessions │  │  /history           → HistoryPage (embedded)            │   │
│  │ Studio   │  │  /pricing           → PricingPage (embedded)            │   │
│  │ Assets   │  │  /account           → AccountPage (embedded)            │   │
│  │ ──────── │  │  /settings/billing  → BillingPage (embedded)            │   │
│  │ History  │  │                                                         │   │
│  │ ──────── │  │                                                         │   │
│  │ [⚙] User │  │                                                         │   │
│  │          │  │                                                         │   │
│  └──────────┘  └────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      UNAUTHENTICATED USER SHELL                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────── TopNavbar ────────────────────────────┐    │
│  │  [Logo]    Products   Pricing   Docs   History        [Sign In]     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│                           Marketing Pages                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Update Route Configuration

**File:** `components/navigation/AppShell/constants.ts`

```typescript
import { Clock, CreditCard, FileText, Home, MessageCircle, Package, Layers, History, User } from '@promptstudio/system/components/ui';
import type { NavItem } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Route Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Routes that show NO shell (auth flow) */
export const AUTH_ROUTES = [
  '/signin',
  '/signup',
  '/forgot-password',
  '/email-verification',
  '/reset-password',
  '/login',
  '/register',
] as const;

/** 
 * Routes that show WORKSPACE shell for authenticated users
 * but MARKETING shell for unauthenticated users 
 */
export const HYBRID_ROUTES = [
  '/pricing',
  '/history',
  '/account',
  '/settings/billing',
  '/settings/billing/invoices',
] as const;

/** Routes that ALWAYS show workspace shell (require auth context) */
export const WORKSPACE_ROUTES_EXACT = [
  '/',
  '/assets',
] as const;

export const WORKSPACE_ROUTE_PREFIXES = [
  '/prompt/',
  '/session/',
] as const;

/** Routes that ALWAYS show marketing shell */
export const MARKETING_ROUTES = [
  '/home',
  '/products',
  '/docs',
  '/contact',
  '/privacy-policy',
  '/terms-of-service',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Navigation Items
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Navigation items for TopNavbar (unauthenticated users)
 */
export const TOP_NAV_ITEMS: readonly NavItem[] = [
  { to: '/products', label: 'Products', icon: Package },
  { to: '/pricing', label: 'Pricing', icon: CreditCard },
  { to: '/docs', label: 'Docs', icon: FileText },
  { to: '/history', label: 'History', icon: History },
  { to: '/contact', label: 'Support', icon: MessageCircle },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Type Utilities
// ─────────────────────────────────────────────────────────────────────────────

export type AuthRoute = (typeof AUTH_ROUTES)[number];
export type HybridRoute = (typeof HYBRID_ROUTES)[number];
export type WorkspaceRouteExact = (typeof WORKSPACE_ROUTES_EXACT)[number];
export type WorkspaceRoutePrefix = (typeof WORKSPACE_ROUTE_PREFIXES)[number];
export type MarketingRoute = (typeof MARKETING_ROUTES)[number];
```

### 2.3 Update Shell Resolution Logic

**File:** `components/navigation/AppShell/hooks/useNavigationConfig.ts`

```typescript
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthUser } from '@hooks/useAuthUser';
import {
  AUTH_ROUTES,
  HYBRID_ROUTES,
  TOP_NAV_ITEMS,
  WORKSPACE_ROUTE_PREFIXES,
  WORKSPACE_ROUTES_EXACT,
} from '../constants';
import type { NavigationConfig, ShellVariant } from '../types';

/**
 * Determines shell variant based on current pathname and auth state.
 */
function resolveVariant(pathname: string, isAuthenticated: boolean): ShellVariant {
  // Auth pages: no shell
  if ((AUTH_ROUTES as readonly string[]).includes(pathname)) {
    return 'none';
  }

  // Workspace routes: always sidebar
  if ((WORKSPACE_ROUTES_EXACT as readonly string[]).includes(pathname)) {
    return 'sidebar';
  }
  if (WORKSPACE_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return 'sidebar';
  }

  // Hybrid routes: sidebar if authenticated, topnav if not
  if ((HYBRID_ROUTES as readonly string[]).includes(pathname)) {
    return isAuthenticated ? 'sidebar' : 'topnav';
  }

  // Everything else: marketing shell
  return 'topnav';
}

/**
 * Provides navigation configuration based on current route and auth state.
 */
export function useNavigationConfig(): NavigationConfig {
  const location = useLocation();
  const user = useAuthUser();
  const isAuthenticated = user !== null;

  const variant = useMemo(
    () => resolveVariant(location.pathname, isAuthenticated),
    [location.pathname, isAuthenticated]
  );

  const navItems = useMemo(() => ({
    topNav: TOP_NAV_ITEMS,
  }), []);

  return {
    variant,
    navItems,
    currentPath: location.pathname,
    isAuthenticated,
  };
}
```

### 2.4 Update ToolRail Configuration

**File:** `components/ToolSidebar/config/toolNavConfig.ts`

```typescript
import { Plus, Wand2, Clock, Layers, History, CreditCard, User, Settings } from '@promptstudio/system/components/ui';
import type { ToolNavItem } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Primary Tool Navigation
// ─────────────────────────────────────────────────────────────────────────────

export const TOOL_NAV_ITEMS: readonly ToolNavItem[] = [
  // Header action
  { id: 'new', icon: Plus, label: 'New', variant: 'header' },
  
  // Primary tools (panels)
  { id: 'studio', icon: Wand2, label: 'Studio', variant: 'default' },
  { id: 'sessions', icon: Clock, label: 'Sessions', variant: 'default' },
  
  // Route-based navigation
  { id: 'assets', icon: Layers, label: 'Assets', variant: 'default', route: '/assets' },
  { id: 'history', icon: History, label: 'History', variant: 'default', route: '/history' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Footer Navigation (account, billing, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export const TOOL_FOOTER_ITEMS: readonly ToolNavItem[] = [
  { id: 'pricing', icon: CreditCard, label: 'Pricing', variant: 'footer', route: '/pricing' },
  { id: 'account', icon: User, label: 'Account', variant: 'footer', route: '/account' },
] as const;
```

### 2.5 Update ToolNavItem Type

**File:** `components/ToolSidebar/types.ts`

```typescript
export interface ToolNavItem {
  id: ToolPanelType | string;
  icon: AppIcon;
  label: string;
  variant: 'header' | 'default' | 'footer';
  /** If set, clicking navigates to this route instead of switching panels */
  route?: string;
}
```

### 2.6 Add Route-Based Navigation to ToolRail

**File:** `components/ToolSidebar/components/ToolRail.tsx`

```typescript
import { useNavigate, useLocation } from 'react-router-dom';
import { TOOL_NAV_ITEMS, TOOL_FOOTER_ITEMS } from '../config/toolNavConfig';

interface ToolNavButtonProps {
  item: ToolNavItem;
  isActive: boolean;
  onClick: () => void;
}

function ToolNavButton({ item, isActive, onClick }: ToolNavButtonProps): ReactElement {
  const Icon = item.icon;
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
            isActive
              ? 'bg-[#2C3037] text-white'
              : 'text-[#A1AFC5] hover:bg-[#1B1E23] hover:text-white'
          )}
          aria-label={item.label}
        >
          <Icon className="h-5 w-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function ToolRail({
  activePanel,
  onPanelChange,
  user,
  onCreateNew,
}: ToolRailProps): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();

  const handleItemClick = (item: ToolNavItem) => {
    if (item.id === 'new') {
      onCreateNew();
      return;
    }
    
    if (item.route) {
      navigate(item.route);
      return;
    }
    
    // Panel-based navigation
    onPanelChange(item.id as ToolPanelType);
  };

  const isItemActive = (item: ToolNavItem): boolean => {
    if (item.route) {
      return location.pathname === item.route;
    }
    return activePanel === item.id;
  };

  return (
    <div className="flex h-full w-[60px] flex-col border-r border-[#1E1F25] bg-[#0D0E11]">
      {/* Primary nav items */}
      <div className="flex flex-1 flex-col items-center gap-1 py-3">
        {TOOL_NAV_ITEMS.map((item) => (
          <ToolNavButton
            key={item.id}
            item={item}
            isActive={isItemActive(item)}
            onClick={() => handleItemClick(item)}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-[#1E1F25]" />

      {/* Footer nav items */}
      <div className="flex flex-col items-center gap-1 py-3">
        {TOOL_FOOTER_ITEMS.map((item) => (
          <ToolNavButton
            key={item.id}
            item={item}
            isActive={isItemActive(item)}
            onClick={() => handleItemClick(item)}
          />
        ))}
        
        {/* User menu */}
        {user && (
          <UserMenuButton user={user} />
        )}
      </div>
    </div>
  );
}
```

### 2.7 Create WorkspaceShell Component

**New file:** `components/navigation/WorkspaceShell.tsx`

```typescript
import React from 'react';
import { Outlet } from 'react-router-dom';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { ToolSidebar } from '@components/ToolSidebar';
import { GenerationControlsProvider } from '@/features/prompt-optimizer/context/GenerationControlsContext';

/**
 * Shell for authenticated workspace routes.
 * Provides sidebar navigation and shared workspace context.
 */
export function WorkspaceShell(): React.ReactElement {
  return (
    <WorkspaceProvider>
      <GenerationControlsProvider>
        <div className="flex h-full min-h-0 overflow-hidden bg-app">
          <ToolSidebar
            // Generation-specific props will be passed from page components
            // or managed via additional context
            prompt=""
            onDraft={() => {}}
            onRender={() => {}}
            onStoryboard={() => {}}
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-black">
            <Outlet />
          </div>
        </div>
      </GenerationControlsProvider>
    </WorkspaceProvider>
  );
}
```

### 2.8 Update App.tsx Routing

**File:** `App.tsx`

```typescript
import { WorkspaceShell } from '@components/navigation/WorkspaceShell';

function AppRoutes(): React.ReactElement {
  return (
    <Routes>
      {/* ─────────────────────────────────────────────────────────────────────
          Auth routes (no shell)
          ───────────────────────────────────────────────────────────────────── */}
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/email-verification" element={<EmailVerificationPage />} />
      <Route path="/reset-password" element={<PasswordResetPage />} />
      <Route path="/login" element={<Navigate to="/signin" replace />} />
      <Route path="/register" element={<Navigate to="/signup" replace />} />

      {/* ─────────────────────────────────────────────────────────────────────
          Marketing shell (unauthenticated)
          ───────────────────────────────────────────────────────────────────── */}
      <Route element={<MarketingShell />}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />
        <Route path="/contact" element={<ContactSupportPage />} />
        <Route path="/support" element={<Navigate to="/contact" replace />} />
        <Route
          path="/share/:uuid"
          element={
            <FeatureErrorBoundary featureName="Shared Prompt">
              <SharedPrompt />
            </FeatureErrorBoundary>
          }
        />
      </Route>

      {/* ─────────────────────────────────────────────────────────────────────
          Workspace shell (authenticated)
          Note: Hybrid routes (/pricing, /history, /account) are handled
          by shell resolution logic in useNavigationConfig
          ───────────────────────────────────────────────────────────────────── */}
      <Route element={<WorkspaceShell />}>
        <Route path="/" element={<WorkspaceRoute />} />
        <Route path="/session/:sessionId" element={<WorkspaceRoute />} />
        <Route
          path="/assets"
          element={
            <FeatureErrorBoundary featureName="Asset Library">
              <AssetsPage />
            </FeatureErrorBoundary>
          }
        />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/settings/billing" element={<BillingPage />} />
        <Route path="/settings/billing/invoices" element={<BillingInvoicesPage />} />
        <Route path="/billing" element={<Navigate to="/settings/billing" replace />} />
      </Route>

      {/* ─────────────────────────────────────────────────────────────────────
          Legacy redirects (prompt UUID resolution)
          ───────────────────────────────────────────────────────────────────── */}
      <Route path="/prompt/:uuid" element={<PromptRedirect />} />
    </Routes>
  );
}
```

### 2.9 Files to Modify

| File | Change |
|------|--------|
| `navigation/AppShell/constants.ts` | Add `HYBRID_ROUTES`, restructure route lists |
| `navigation/AppShell/hooks/useNavigationConfig.ts` | Add auth-aware resolution |
| `navigation/WorkspaceShell.tsx` | **Create** |
| `ToolSidebar/config/toolNavConfig.ts` | Add route-based nav items, footer items |
| `ToolSidebar/types.ts` | Add `route` to `ToolNavItem` |
| `ToolSidebar/components/ToolRail.tsx` | Support route navigation |
| `App.tsx` | Restructure routes with WorkspaceShell |
| `pages/HistoryPage.tsx` | Adapt for embedded display (remove redundant headers) |
| `pages/PricingPage.tsx` | Adapt for embedded display |
| `pages/AccountPage.tsx` | Adapt for embedded display |
| `pages/BillingPage.tsx` | Adapt for embedded display |

### 2.10 Validation Criteria

- [ ] Authenticated users see sidebar on all routes except auth pages
- [ ] Unauthenticated users see TopNavbar on marketing pages
- [ ] Hybrid routes (/pricing, /history) show correct shell based on auth
- [ ] ToolRail shows History, Assets, Pricing, Account links
- [ ] Navigation between workspace and embedded pages maintains context
- [ ] Browser back/forward works correctly
- [ ] Active state highlights correct item in ToolRail

---

## Phase 3: History Consolidation

**Duration:** 1-2 days  
**Files touched:** ~4  
**Risk:** Low

### Objective

Make `SessionsPanel` and `HistoryPage` share underlying functionality while keeping both surfaces. SessionsPanel becomes the quick-access view; HistoryPage becomes the full-featured view.

### 3.1 Extract Shared History Hook

**New file:** `features/history/hooks/useHistoryView.ts`

```typescript
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { PromptHistoryEntry } from '@hooks/types';
import {
  hasVideoArtifact,
  isRecentEntry,
  resolveHistoryThumbnail,
} from '../utils/historyMedia';
import {
  extractDisambiguator,
  normalizeTitle,
  resolveEntryTitle,
} from '../utils/historyTitles';
import {
  formatModelLabel,
  normalizeProcessingLabel,
  resolveEntryStage,
} from '../utils/historyStages';
import { formatRelativeOrDate } from '../utils/historyDates';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface FilterState {
  videosOnly: boolean;
  recentOnly: boolean;
}

export interface HistoryRow {
  entry: PromptHistoryEntry;
  stage: string;
  title: string;
  meta: string;
  isSelected: boolean;
  processingLabel: string | null;
  key: string;
  thumbnailUrl: string | null;
}

interface UseHistoryViewOptions {
  /** Initial display limit (SessionsPanel uses 5, HistoryPage uses Infinity) */
  initialLimit?: number;
  /** Enable chip filters */
  enableFilters?: boolean;
}

interface UseHistoryViewReturn {
  // Data
  displayedHistory: PromptHistoryEntry[];
  totalCount: number;
  promptRows: HistoryRow[];
  
  // Filters
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterState: FilterState;
  setFilterState: React.Dispatch<React.SetStateAction<FilterState>>;
  hasActiveFilters: boolean;
  
  // Pagination
  showAll: boolean;
  setShowAll: (show: boolean) => void;
  hasMore: boolean;
  
  // Keyboard navigation
  focusedKey: string | null;
  setFocusedKey: (key: string | null) => void;
  
  // Row lookup
  rowByKey: Map<string, HistoryRow>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook Implementation
// ─────────────────────────────────────────────────────────────────────────────

export function useHistoryView(options: UseHistoryViewOptions = {}): UseHistoryViewReturn {
  const { initialLimit = 5, enableFilters = true } = options;
  
  const {
    history,
    filteredHistory,
    searchQuery,
    setSearchQuery,
    currentPromptUuid,
    currentPromptDocId,
    activeStatusLabel,
    activeModelLabel,
  } = useWorkspace();

  const [showAll, setShowAll] = useState(initialLimit === Infinity);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<FilterState>({
    videosOnly: false,
    recentOnly: false,
  });

  // Reset focused key when filter results change
  useEffect(() => {
    setFocusedKey(null);
  }, [filteredHistory.length, filterState]);

  // Apply chip filters
  const filteredByChips = useMemo(() => {
    if (!enableFilters) return filteredHistory;
    
    return filteredHistory.filter((entry) => {
      if (filterState.videosOnly && !hasVideoArtifact(entry)) {
        return false;
      }
      if (filterState.recentOnly && !isRecentEntry(entry)) {
        return false;
      }
      return true;
    });
  }, [filteredHistory, filterState, enableFilters]);

  // Apply pagination
  const displayedHistory = useMemo(() => {
    if (showAll || initialLimit === Infinity) {
      return filteredByChips;
    }
    return filteredByChips.slice(0, initialLimit);
  }, [filteredByChips, showAll, initialLimit]);

  // Compute row data
  const promptRows = useMemo((): HistoryRow[] => {
    const baseTitles = displayedHistory.map((entry) =>
      normalizeTitle(resolveEntryTitle(entry))
    );
    const counts = new Map<string, number>();
    baseTitles.forEach((title) => counts.set(title, (counts.get(title) ?? 0) + 1));
    const seen = new Map<string, number>();

    return displayedHistory.map((entry, index) => {
      const stage = resolveEntryStage(entry);
      const baseTitle = baseTitles[index] ?? 'Untitled';
      const hasDupes = (counts.get(baseTitle) ?? 0) > 1;
      const nextSeen = (seen.get(baseTitle) ?? 0) + 1;
      seen.set(baseTitle, nextSeen);

      const isSelected = Boolean(
        (currentPromptUuid && entry.uuid === currentPromptUuid) ||
          (currentPromptDocId && entry.id === currentPromptDocId)
      );

      const dateLabel = formatRelativeOrDate(entry.timestamp);
      const fallbackModelLabel =
        isSelected && typeof activeModelLabel === 'string'
          ? formatModelLabel(activeModelLabel)
          : null;
      const modelLabel =
        formatModelLabel(typeof entry.targetModel === 'string' ? entry.targetModel : null) ??
        fallbackModelLabel;

      const normalizedActiveStatus =
        typeof activeStatusLabel === 'string' && activeStatusLabel.trim()
          ? activeStatusLabel
          : '';
      const normalizedProcessingStatus =
        normalizedActiveStatus === 'Optimizing' ? 'Refining' : normalizedActiveStatus;
      const processingLabel =
        isSelected && normalizedProcessingStatus
          ? normalizeProcessingLabel(normalizedProcessingStatus)
          : null;
      const effectiveProcessingLabel =
        isSelected &&
        (normalizedActiveStatus === 'Refining' || normalizedActiveStatus === 'Optimizing')
          ? processingLabel
          : null;

      const meta = dateLabel;

      const disambiguator =
        extractDisambiguator(entry.input) ??
        (() => {
          const model =
            formatModelLabel(typeof entry.targetModel === 'string' ? entry.targetModel : null) ??
            modelLabel;
          if (!model) return null;
          return nextSeen === 1 ? model : `alt ${nextSeen}`;
        })() ??
        `alt ${nextSeen}`;

      const title = hasDupes ? `${baseTitle} - ${disambiguator}` : baseTitle;
      const key = entry.id ?? entry.uuid ?? `${entry.timestamp ?? ''}-${title}`;

      return {
        entry,
        stage,
        title,
        meta,
        isSelected,
        processingLabel: effectiveProcessingLabel,
        key,
        thumbnailUrl: resolveHistoryThumbnail(entry),
      };
    });
  }, [
    displayedHistory,
    currentPromptUuid,
    currentPromptDocId,
    activeStatusLabel,
    activeModelLabel,
  ]);

  const rowByKey = useMemo(() => {
    return new Map(promptRows.map((row) => [row.key, row]));
  }, [promptRows]);

  const hasActiveFilters = filterState.videosOnly || filterState.recentOnly;
  const hasMore = filteredByChips.length > initialLimit;

  return {
    displayedHistory,
    totalCount: filteredByChips.length,
    promptRows,
    searchQuery,
    setSearchQuery,
    filterState,
    setFilterState,
    hasActiveFilters,
    showAll,
    setShowAll,
    hasMore,
    focusedKey,
    setFocusedKey,
    rowByKey,
  };
}
```

### 3.2 Refactor SessionsPanel

**File:** `components/ToolSidebar/components/panels/SessionsPanel.tsx`

```typescript
import { useHistoryView } from '@features/history/hooks/useHistoryView';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function SessionsPanel({ onBack }: { onBack?: () => void }): ReactElement {
  const {
    displayedHistory,
    totalCount,
    promptRows,
    searchQuery,
    setSearchQuery,
    filterState,
    setFilterState,
    hasActiveFilters,
    showAll,
    setShowAll,
    hasMore,
    focusedKey,
    setFocusedKey,
    rowByKey,
  } = useHistoryView({ initialLimit: 5, enableFilters: true });

  const {
    loadFromHistory,
    createNew,
    deleteFromHistory,
    duplicateEntry,
    renameEntry,
    isLoadingHistory,
  } = useWorkspace();

  // ... keyboard navigation logic (same as before)
  // ... rename modal state (same as before)
  
  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="h-12 px-4 flex items-center justify-between">
          {/* ... */}
        </div>

        {/* Search */}
        <div className="px-4 py-2">
          {/* ... same search input ... */}
        </div>

        {/* Filter chips */}
        <div className="px-4 py-2 flex gap-2">
          {/* ... same filter buttons ... */}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {/* ... same rendering logic using promptRows ... */}
        </div>

        {/* Footer with View All link */}
        {hasMore && (
          <div className="px-4 py-2 flex items-center justify-between border-t border-[#1E1F25]">
            <Button
              onClick={() => setShowAll(!showAll)}
              variant="ghost"
              size="sm"
              className="text-label-sm text-[#7C839C]"
            >
              {showAll ? 'See less' : `See more (${totalCount - 5} more)`}
            </Button>
            <Link
              to="/history"
              className="text-xs text-[#3B82F6] hover:underline"
            >
              View all →
            </Link>
          </div>
        )}
      </div>

      {/* Rename modal - same as before */}
    </>
  );
}
```

### 3.3 Refactor HistoryPage

**File:** `pages/HistoryPage.tsx`

```typescript
import { useHistoryView } from '@features/history/hooks/useHistoryView';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function HistoryPage(): React.ReactElement {
  const {
    displayedHistory,
    totalCount,
    promptRows,
    searchQuery,
    setSearchQuery,
    filterState,
    setFilterState,
    hasActiveFilters,
  } = useHistoryView({ initialLimit: Infinity, enableFilters: true });

  const { user, loadFromHistory, isLoadingHistory } = useWorkspace();

  return (
    <div className="h-full overflow-y-auto bg-app">
      <Section spacing="ps-6">
        <Container size="lg">
          <div className="relative overflow-hidden rounded-lg border border-border bg-surface-1 p-6">
            {/* ... gradient background ... */}

            <div className="relative flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-semibold text-foreground tracking-tight">
                  History
                </h1>
                <p className="text-muted max-w-2xl">
                  Search across every optimized output you've saved.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Search input */}
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
                  <Input
                    className="pl-11 pr-10"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search prompts…"
                  />
                  {/* Clear button */}
                </div>

                {/* Filter chips - NOW AVAILABLE on HistoryPage too! */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterState((prev) => ({ ...prev, videosOnly: !prev.videosOnly }))}
                    className={cn(
                      'h-8 px-3 rounded-md border text-sm',
                      filterState.videosOnly
                        ? 'border-[#3B82F6] bg-[#3B82F6]/10 text-[#3B82F6]'
                        : 'border-border text-muted hover:text-foreground'
                    )}
                  >
                    Videos only
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterState((prev) => ({ ...prev, recentOnly: !prev.recentOnly }))}
                    className={cn(
                      'h-8 px-3 rounded-md border text-sm',
                      filterState.recentOnly
                        ? 'border-[#3B82F6] bg-[#3B82F6]/10 text-[#3B82F6]'
                        : 'border-border text-muted hover:text-foreground'
                    )}
                  >
                    Last 7 days
                  </button>
                </div>

                <span className="text-sm text-muted tabular-nums">
                  {totalCount} {searchQuery ? 'results' : 'prompts'}
                </span>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Results grid */}
      <Container size="lg">
        {isLoadingHistory ? (
          <div className="py-12 text-center">
            <div className="ps-spinner-sm mx-auto mb-3" />
            <p className="text-sm text-muted">Loading history…</p>
          </div>
        ) : promptRows.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted">
              {searchQuery
                ? `No results for "${searchQuery}".`
                : hasActiveFilters
                ? 'No prompts match these filters.'
                : 'No prompts saved yet.'}
            </p>
          </div>
        ) : (
          <div className="pb-16 grid grid-cols-1 gap-4">
            {promptRows.map((row) => (
              <HistoryCard
                key={row.key}
                row={row}
                onLoad={() => loadFromHistory(row.entry)}
              />
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
```

### 3.4 Files to Modify

| File | Change |
|------|--------|
| `features/history/hooks/useHistoryView.ts` | **Create** |
| `features/history/index.ts` | Export new hook |
| `ToolSidebar/components/panels/SessionsPanel.tsx` | Use shared hook |
| `pages/HistoryPage.tsx` | Use shared hook, add filter chips |

### 3.5 Validation Criteria

- [ ] SessionsPanel and HistoryPage show consistent data
- [ ] Filters work identically on both surfaces
- [ ] "View all →" link navigates to HistoryPage
- [ ] Search state syncs between views (via context)
- [ ] Filter state is independent per view (local state)

---

## Phase 4: Asset Library Integration

**Duration:** 1-2 days  
**Files touched:** ~5  
**Risk:** Low

### Objective

Make AssetLibrary accessible from ToolRail while keeping it as a standalone page. Add navigation integration for seamless workflow.

### 4.1 ToolRail Configuration

Already handled in Phase 2:

```typescript
{ id: 'assets', icon: Layers, label: 'Assets', variant: 'default', route: '/assets' },
```

### 4.2 Update AssetLibrary for Embedded Display

**File:** `features/assets/AssetLibrary.tsx`

```typescript
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@components/Toast';

export function AssetLibrary(): React.ReactElement {
  const navigate = useNavigate();
  const toast = useToast();
  const { insertTrigger } = useWorkspace();
  
  // ... existing state and handlers ...

  const handleInsertIntoPrompt = useCallback(
    (asset: Asset) => {
      insertTrigger(asset.trigger);
      toast.success(
        <div className="flex items-center gap-3">
          <span>@{asset.trigger} added to prompt</span>
          <button
            onClick={() => navigate('/')}
            className="text-xs text-[#3B82F6] hover:underline"
          >
            Return to Studio
          </button>
        </div>,
        { duration: 5000 }
      );
    },
    [insertTrigger, toast, navigate]
  );

  return (
    <div className="flex h-full flex-col bg-surface-1">
      {/* Header - simplified for embedded display */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-muted" />
          <h2 className="text-lg font-semibold text-foreground">Asset Library</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted hover:text-foreground"
          >
            ← Back to Studio
          </button>
          <button
            type="button"
            onClick={() => actions.openEditor('create')}
            className="flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-500"
          >
            <Plus className="h-4 w-4" />
            New Asset
          </button>
        </div>
      </div>

      {/* ... rest of component with handleInsertIntoPrompt added to AssetGrid */}
      
      {filteredAssets.length > 0 && (
        <AssetGrid
          assets={filteredAssets}
          selectedAsset={selectedAsset}
          onSelect={actions.selectAsset}
          onEdit={(asset) => actions.openEditor('edit', asset)}
          onDelete={handleDeleteAsset}
          onSelectForGeneration={handleSelectForGeneration}
          onInsertIntoPrompt={handleInsertIntoPrompt}  // NEW
        />
      )}
    </div>
  );
}
```

### 4.3 Update AssetGrid to Show Insert Action

**File:** `features/assets/components/AssetGrid.tsx`

```typescript
interface AssetGridProps {
  // ... existing props ...
  onInsertIntoPrompt?: (asset: Asset) => void;
}

// In AssetCard, add insert button:
{onInsertIntoPrompt && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onInsertIntoPrompt(asset);
    }}
    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
    title="Insert into prompt"
  >
    <Plus className="h-4 w-4 text-white" />
  </button>
)}
```

### 4.4 Files to Modify

| File | Change |
|------|--------|
| `features/assets/AssetLibrary.tsx` | Add insert action, back navigation |
| `features/assets/components/AssetGrid.tsx` | Add insert button |
| `features/assets/components/AssetCard.tsx` | Show insert button on hover |
| `pages/AssetsPage.tsx` | Ensure proper layout for embedded display |

### 4.5 Validation Criteria

- [ ] Assets icon in ToolRail navigates to /assets
- [ ] AssetLibrary displays correctly in workspace shell
- [ ] "Insert into prompt" works and shows toast with return option
- [ ] "Back to Studio" returns to workspace
- [ ] All CRUD operations work as before

---

## Phase 5: Workspace Home State

**Duration:** 1-2 days  
**Files touched:** ~3  
**Risk:** Low (additive)

### Objective

When users land on `/` with no active session, show a useful home state instead of a blank canvas.

### 5.1 Create WorkspaceHome Component

**New file:** `features/prompt-optimizer/components/WorkspaceHome.tsx`

```typescript
import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Lightbulb, Sparkles, AtSign, Command, Image } from '@promptstudio/system/components/ui';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { PromptHistoryEntry } from '@hooks/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface WorkspaceHomeProps {
  onCreateNew: () => void;
  onLoadFromHistory: (entry: PromptHistoryEntry) => void;
  onOpenConceptBuilder: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent Session Card
// ─────────────────────────────────────────────────────────────────────────────

interface RecentSessionCardProps {
  entry: PromptHistoryEntry;
  onClick: () => void;
}

function RecentSessionCard({ entry, onClick }: RecentSessionCardProps): React.ReactElement {
  const title = entry.title || entry.output?.slice(0, 60) || 'Untitled';
  const timestamp = entry.timestamp
    ? new Date(entry.timestamp).toLocaleDateString()
    : '';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 w-full rounded-lg border border-[#2C3037] bg-[#1E1F25] p-3 text-left transition-colors hover:border-[#3B82F6] hover:bg-[#1E1F25]/80"
    >
      {/* Thumbnail placeholder */}
      <div className="h-12 w-12 rounded-md bg-[#2C3037] flex items-center justify-center">
        <Sparkles className="h-5 w-5 text-[#A1AFC5]" />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{title}</p>
        <p className="text-xs text-[#A1AFC5]">{timestamp}</p>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton Loader
// ─────────────────────────────────────────────────────────────────────────────

function RecentSessionsSkeleton(): React.ReactElement {
  return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="h-[72px] animate-pulse rounded-lg bg-[#2C3037]"
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function WorkspaceHome({
  onCreateNew,
  onLoadFromHistory,
  onOpenConceptBuilder,
}: WorkspaceHomeProps): React.ReactElement {
  const { history, isLoadingHistory } = useWorkspace();
  const recentSessions = history.slice(0, 5);

  return (
    <div className="flex h-full flex-col items-center justify-center px-8">
      <div className="w-full max-w-2xl space-y-8">
        {/* ─────────────────────────────────────────────────────────────────
            Header
            ───────────────────────────────────────────────────────────────── */}
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
          <p className="mt-2 text-sm text-[#A1AFC5]">
            Pick up where you left off or start something new
          </p>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            Quick Actions
            ───────────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={onCreateNew}
            className="flex flex-col items-center gap-3 rounded-xl border border-[#2C3037] bg-[#1E1F25] p-6 transition-colors hover:border-[#3B82F6] hover:bg-[#1E1F25]/80"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3B82F6]/10">
              <Plus className="h-6 w-6 text-[#3B82F6]" />
            </div>
            <span className="text-sm font-medium text-white">New Prompt</span>
            <span className="text-xs text-[#A1AFC5]">Start from scratch</span>
          </button>

          <button
            type="button"
            onClick={onOpenConceptBuilder}
            className="flex flex-col items-center gap-3 rounded-xl border border-[#2C3037] bg-[#1E1F25] p-6 transition-colors hover:border-[#A855F7] hover:bg-[#1E1F25]/80"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#A855F7]/10">
              <Lightbulb className="h-6 w-6 text-[#A855F7]" />
            </div>
            <span className="text-sm font-medium text-white">Concept Builder</span>
            <span className="text-xs text-[#A1AFC5]">Guided creation with templates</span>
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            Recent Sessions
            ───────────────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[#A1AFC5]">Recent Sessions</h2>
            <Link
              to="/history"
              className="text-xs text-[#3B82F6] hover:underline"
            >
              View all
            </Link>
          </div>

          {isLoadingHistory ? (
            <RecentSessionsSkeleton />
          ) : recentSessions.length > 0 ? (
            <div className="space-y-2">
              {recentSessions.map((entry) => (
                <RecentSessionCard
                  key={entry.id ?? entry.uuid}
                  entry={entry}
                  onClick={() => onLoadFromHistory(entry)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#2C3037] p-6 text-center">
              <p className="text-sm text-[#A1AFC5]">
                No sessions yet. Create your first prompt above!
              </p>
            </div>
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            Feature Discovery
            ───────────────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-[#2C3037] bg-[#1E1F25]/50 p-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-[#A1AFC5]">
            Pro Tips
          </h3>
          <ul className="mt-3 space-y-3">
            <li className="flex items-start gap-3 text-sm text-[#A1AFC5]">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#3B82F6]/10">
                <AtSign className="h-3.5 w-3.5 text-[#3B82F6]" />
              </div>
              <span>
                Use <code className="rounded bg-[#2C3037] px-1.5 py-0.5 text-xs text-white">@triggers</code> to reference your saved characters in prompts
              </span>
            </li>
            <li className="flex items-start gap-3 text-sm text-[#A1AFC5]">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#A855F7]/10">
                <Command className="h-3.5 w-3.5 text-[#A855F7]" />
              </div>
              <span>
                Press <kbd className="rounded bg-[#2C3037] px-1.5 py-0.5 text-xs text-white">⌘K</kbd> to quick optimize any selected text
              </span>
            </li>
            <li className="flex items-start gap-3 text-sm text-[#A1AFC5]">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#22C55E]/10">
                <Image className="h-3.5 w-3.5 text-[#22C55E]" />
              </div>
              <span>
                Upload keyframes for image-to-video generation with consistent subjects
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
```

### 5.2 Integrate into PromptOptimizerWorkspace

**File:** `features/prompt-optimizer/PromptOptimizerContainer/PromptOptimizerWorkspace.tsx`

```typescript
import { WorkspaceHome } from '../components/WorkspaceHome';

function PromptOptimizerContent({
  user,
  convergenceHandoff,
}: PromptOptimizerContentProps): React.ReactElement {
  // ... existing code ...

  // Determine if we should show workspace home
  const hasActiveSession = Boolean(sessionId) || Boolean(currentPromptUuid);
  const hasContent = Boolean(promptOptimizer.inputPrompt?.trim()) || showResults;
  const showWorkspaceHome = !hasActiveSession && !hasContent && !isLoading;

  // ─────────────────────────────────────────────────────────────────────────
  // Render workspace home if no active session
  // ─────────────────────────────────────────────────────────────────────────
  if (showWorkspaceHome) {
    return (
      <AppShell toolSidebarProps={toolSidebarProps}>
        <WorkspaceHome
          onCreateNew={handleCreateNewWithKeyframes}
          onLoadFromHistory={handleLoadFromHistory}
          onOpenConceptBuilder={() => setShowBrainstorm(true)}
        />
      </AppShell>
    );
  }

  // ... rest of existing render logic ...
}
```

### 5.3 Files to Modify

| File | Change |
|------|--------|
| `features/prompt-optimizer/components/WorkspaceHome.tsx` | **Create** |
| `features/prompt-optimizer/components/RecentSessionCard.tsx` | **Create** (or inline) |
| `PromptOptimizerContainer/PromptOptimizerWorkspace.tsx` | Conditionally render home |
| `features/prompt-optimizer/index.ts` | Export WorkspaceHome |

### 5.4 Validation Criteria

- [ ] Landing on `/` without session shows WorkspaceHome
- [ ] Loading state shows skeleton while history loads
- [ ] "New Prompt" creates new session and shows canvas
- [ ] "Concept Builder" opens brainstorm modal
- [ ] Recent sessions are clickable and load correctly
- [ ] "View all" navigates to /history
- [ ] Feature tips are visible and styled correctly

---

## Phase 6: Cleanup

**Duration:** 0.5 days  
**Files touched:** ~5  
**Risk:** None

### 6.1 Remove Ghost Routes

**File:** `App.tsx`

Remove all redirect routes for deleted features:

```typescript
// DELETE ALL OF THESE:
<Route path="/create" element={<Navigate to="/" replace />} />
<Route path="/session/:sessionId/studio" element={<Navigate to="/session/:sessionId" replace />} />
<Route path="/session/:sessionId/create" element={<Navigate to="/session/:sessionId" replace />} />
<Route path="/session/:sessionId/continuity" element={<Navigate to="/session/:sessionId" replace />} />
<Route path="/session/new/continuity" element={<Navigate to="/" replace />} />
<Route path="/continuity" element={<Navigate to="/" replace />} />
<Route path="/continuity/:sessionId" element={<Navigate to="/session/:sessionId" replace />} />
<Route path="/consistent" element={<Navigate to="/" replace />} />
```

### 6.2 Clean Up Constants

**File:** `components/navigation/AppShell/constants.ts`

Remove `/consistent` from **THREE** places:

```typescript
// 1. WORKSPACE_ROUTES_EXACT - REMOVE '/consistent'
export const WORKSPACE_ROUTES_EXACT = ['/', '/assets'] as const;

// 2. NAV_ITEMS - DELETE the consistency entry entirely
// REMOVE: { to: '/consistent', label: 'Consistency', icon: Video, showInTopNav: false, showInSidebar: true },

// 3. If WORKSPACE_ROUTES_EXACT was updated in Phase 2, verify '/consistent' is not present
```

### 6.3 Verification Step

After changes, verify no orphaned references:

```bash
# Run from project root
grep -r "consistent" --include="*.ts" --include="*.tsx" client/src/

# Should return zero results (or only legitimate uses like "consistent" in comments/docs)
```

### 6.4 Update or Hide Placeholder Pages

**Option A (Recommended): Remove from navigation**

Already handled in Phase 2 by not including in `TOOL_NAV_ITEMS` or `TOOL_FOOTER_ITEMS`.

**Option B: Add coming-soon messaging**

**File:** `pages/ProductsPage.tsx`

```typescript
export function ProductsPage(): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-white">Products</h1>
        <p className="mt-2 text-sm text-[#A1AFC5]">
          Product documentation is being updated.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block text-sm text-[#3B82F6] hover:underline"
        >
          ← Back to Studio
        </Link>
      </div>
    </div>
  );
}
```

### 6.5 Remove StylesPanel from ToolRail (Optional)

If styles functionality is not planned:

**File:** `components/ToolSidebar/config/toolNavConfig.ts`

```typescript
// REMOVE or comment out:
// { id: 'styles', icon: Palette, label: 'Styles', variant: 'default' },
```

**File:** `components/ToolSidebar/ToolSidebar.tsx`

```typescript
// REMOVE the styles panel rendering:
// {activePanel === 'styles' && <StylesPanel />}
```

### 6.6 Files to Modify

| File | Change |
|------|--------|
| `App.tsx` | Remove ghost routes |
| `navigation/AppShell/constants.ts` | Remove `/consistent` from all locations |
| `ToolSidebar/config/toolNavConfig.ts` | Remove styles (optional) |
| `ToolSidebar/ToolSidebar.tsx` | Remove StylesPanel rendering (optional) |
| `pages/ProductsPage.tsx` | Add coming-soon or improve |
| `pages/DocsPage.tsx` | Add coming-soon or improve |

### 6.7 Validation Criteria

- [ ] `grep -r "consistent"` returns no route references
- [ ] No 404s on previously-redirected routes
- [ ] Nav doesn't show placeholder items
- [ ] All tests pass
- [ ] No console warnings about missing routes

---

## Risk Mitigation

### Feature Flag Option (Phase 2)

If routing changes feel risky, gate behind a feature flag:

```typescript
// In useNavigationConfig.ts
const useNewNav = new URLSearchParams(window.location.search).get('newNav') === 'true';

function resolveVariant(pathname: string, isAuthenticated: boolean): ShellVariant {
  if (!useNewNav) {
    // Return legacy behavior
    return legacyResolveVariant(pathname);
  }
  // New behavior
  // ...
}
```

### Rollback Points

Each phase is independently deployable:

| Phase | Rollback Strategy |
|-------|-------------------|
| 1 | Revert context, restore prop drilling |
| 2 | Revert routing, restore dual shells |
| 3 | Revert hook extraction, restore duplicate implementations |
| 4 | Minimal - additive changes only |
| 5 | Minimal - additive changes only |
| 6 | Restore routes if needed (unlikely) |

### Testing Strategy

1. **Unit tests:** Run full suite after each phase
2. **Integration tests:** Verify navigation flows with Playwright
3. **Manual QA:** Test on staging before production
4. **Monitoring:** Track 404s, navigation errors post-deploy

---

## Success Metrics

After completion:

- [ ] Single navigation shell for authenticated users
- [ ] ≤12 props on ToolSidebar (down from 34)
- [ ] History accessible from sidebar AND full page with shared filters
- [ ] Assets accessible from ToolRail route
- [ ] New users see WorkspaceHome instead of blank canvas
- [ ] Zero ghost routes
- [ ] Zero placeholder nav items in active navigation
- [ ] All existing tests pass
- [ ] No increase in bundle size >5%

---

## Implementation Checklist

### Phase 1: Context Architecture Foundation
- [ ] Create `WorkspaceContext.tsx`
- [ ] Create `WorkspaceProvider`
- [ ] Update `App.tsx` to wrap with provider
- [ ] Refactor `ToolSidebar` to use context
- [ ] Refactor `SessionsPanel` to use context
- [ ] Refactor `CharactersPanel` to use context
- [ ] Update `ToolSidebarProps` types
- [ ] Run test suite
- [ ] Performance profiling

### Phase 2: Navigation Unification
- [ ] Update `constants.ts` with new route categories
- [ ] Update `useNavigationConfig.ts` with auth-aware resolution
- [ ] Create `WorkspaceShell.tsx`
- [ ] Update `toolNavConfig.ts` with route-based items
- [ ] Update `ToolRail.tsx` for route navigation
- [ ] Restructure `App.tsx` routing
- [ ] Update embedded pages (History, Pricing, Account, Billing)
- [ ] Run test suite
- [ ] Manual navigation testing

### Phase 3: History Consolidation
- [ ] Create `useHistoryView.ts` hook
- [ ] Refactor `SessionsPanel` to use hook
- [ ] Refactor `HistoryPage` to use hook
- [ ] Add filter chips to HistoryPage
- [ ] Add "View all" link to SessionsPanel
- [ ] Run test suite

### Phase 4: Asset Library Integration
- [ ] Update `AssetLibrary.tsx` with insert action
- [ ] Add "Back to Studio" navigation
- [ ] Update `AssetGrid` with insert button
- [ ] Run test suite

### Phase 5: Workspace Home State
- [ ] Create `WorkspaceHome.tsx`
- [ ] Create `RecentSessionCard` component
- [ ] Integrate into `PromptOptimizerWorkspace`
- [ ] Add loading skeleton
- [ ] Run test suite

### Phase 6: Cleanup
- [ ] Remove ghost routes from `App.tsx`
- [ ] Remove `/consistent` from constants
- [ ] Run `grep` verification
- [ ] Update/hide placeholder pages
- [ ] Remove StylesPanel (optional)
- [ ] Run full test suite
- [ ] Final manual QA

---

## Appendix: File Reference

### New Files Created

| File | Phase | Purpose |
|------|-------|---------|
| `contexts/WorkspaceContext.tsx` | 1 | Shared workspace state |
| `navigation/WorkspaceShell.tsx` | 2 | Authenticated user shell |
| `features/history/hooks/useHistoryView.ts` | 3 | Shared history logic |
| `features/prompt-optimizer/components/WorkspaceHome.tsx` | 5 | Landing state |

### Major Files Modified

| File | Phases | Changes |
|------|--------|---------|
| `App.tsx` | 1, 2, 6 | Provider wrapping, route restructuring, cleanup |
| `ToolSidebar/ToolSidebar.tsx` | 1, 2 | Context usage, simplified props |
| `ToolSidebar/components/ToolRail.tsx` | 2 | Route-based navigation |
| `navigation/AppShell/constants.ts` | 2, 6 | Route categories, cleanup |
| `navigation/AppShell/hooks/useNavigationConfig.ts` | 2 | Auth-aware resolution |
| `ToolSidebar/components/panels/SessionsPanel.tsx` | 1, 3 | Context usage, shared hook |
| `pages/HistoryPage.tsx` | 3 | Shared hook, filters |
| `features/assets/AssetLibrary.tsx` | 4 | Insert action, navigation |
| `PromptOptimizerContainer/PromptOptimizerWorkspace.tsx` | 1, 5 | State extraction, home rendering |
