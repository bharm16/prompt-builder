# Codex Implementation Plan: Credit System UX

## Problem
New users see functional Generate/Preview buttons with credit costs displayed ("· 80 cr") but have zero credits, no balance visibility, and no purchase funnel when generation fails. The server returns a 402 with `INSUFFICIENT_CREDITS` error code, but the client treats it as a generic error.

All infrastructure exists but is disconnected. This plan wires it together.

---

## Task 1: CreditBalanceContext (global provider)

**Why:** `useUserCreditBalance` currently lives only in `BillingPage.tsx`. Every downstream component (ToolRail, GenerationFooter, generation hooks) needs access without prop-drilling.

**Create:** `client/src/context/CreditBalanceContext.tsx`

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import { useUserCreditBalance } from '@/hooks/useUserCreditBalance';

interface CreditBalanceContextValue {
  balance: number | null;
  isLoading: boolean;
  error: string | null;
}

const CreditBalanceContext = createContext<CreditBalanceContextValue>({
  balance: null,
  isLoading: false,
  error: null,
});

export function CreditBalanceProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: ReactNode;
}) {
  const state = useUserCreditBalance(userId);
  return (
    <CreditBalanceContext.Provider value={state}>
      {children}
    </CreditBalanceContext.Provider>
  );
}

export function useCreditBalance(): CreditBalanceContextValue {
  return useContext(CreditBalanceContext);
}
```

**Mount:** Find the top-level layout component that wraps the workspace (likely `AppShell` or the route-level component that renders `ToolSidebar`). Wrap it in `<CreditBalanceProvider userId={user?.uid ?? null}>`. The provider must be above both `ToolSidebar` and the generations panel in the tree.

Search for where `<ToolSidebar` is rendered and wrap at that level or one level above.

---

## Task 2: Credit Balance Display in ToolRail

**File:** `client/src/components/ToolSidebar/components/ToolRail.tsx`

**What:** Add an always-visible credit balance pill above the Home icon in the bottom section.

**Implementation:**

1. Import `useCreditBalance` from `@/context/CreditBalanceContext`
2. Import `Link` (already imported)
3. Inside the component, call `const { balance, isLoading } = useCreditBalance();`
4. In the bottom `<div>` (the one with `flex flex-col items-center gap-1.5 pb-1`), add the credit display **above** the Home `<Link>`:

```tsx
{/* ── Credit balance ── */}
<Link
  to="/billing"
  className="flex h-8 w-full flex-col items-center justify-center rounded-lg hover:bg-[#151720] transition-colors"
  aria-label={`${balance ?? 0} credits — view billing`}
>
  {isLoading ? (
    <div className="h-2.5 w-6 animate-pulse rounded bg-[#1A1C22]" />
  ) : (
    <>
      <span className={cn(
        'text-[10px] font-bold tabular-nums leading-none',
        balance === 0 || balance === null
          ? 'text-amber-400'
          : 'text-[#8B92A5]'
      )}>
        {balance ?? 0}
      </span>
      <span className="text-[8px] text-[#555B6E] leading-none mt-0.5">cr</span>
    </>
  )}
</Link>
```

Import `cn` from `@/utils/cn` if not already imported.

**Behavior:**
- Shows credit count with "cr" label
- Amber/yellow when balance is 0 (visual urgency)
- Gray otherwise (matches rail aesthetic)
- Links to `/billing` on click
- Real-time updates via Firestore listener (automatic from the context)
- Loading skeleton while Firestore initializes

---

## Task 3: InsufficientCreditsModal Component

**Create:** `client/src/components/modals/InsufficientCreditsModal.tsx`

This replaces the existing `CreditPurchaseModal` (which is a page section, not a dialog) for the error-triggered flow.

**Props interface:**
```tsx
interface InsufficientCreditsModalProps {
  open: boolean;
  onClose: () => void;
  required: number;       // cost of attempted operation
  available: number;      // user's current balance
  operation: string;      // e.g. "Sora render", "Wan preview", "Image preview"
}
```

**Implementation requirements:**
- Use existing `Sheet` or `Dialog` component from `@promptstudio/system/components/ui` (check what's available — `Sheet` is already used in `ToolSidebar.tsx`)
- Match the dark theme: `bg-[#111318]`, `border-[#1A1C22]`, text colors `#8B92A5` / `#555B6E` / white
- Content sections:
  1. **Header:** "Insufficient Credits" title with X close button
  2. **Deficit display:** Show `available` / `required` with a visual bar or simple text: "You have **{available}** credits. This {operation} costs **{required}** credits. You need **{required - available}** more."
  3. **Quick buy section:** Show the smallest `CREDIT_PACK` from `@/features/billing/creditPacks` that covers the deficit (`pack.credits >= required - available`). Show as a primary CTA button: "Buy {pack.name} — {pack.price} ({pack.credits} cr)"
  4. **Subscription upsell:** If user has no subscription (no `subscriptionTier` field — for MVP, always show this), show one-liner: "Or subscribe from $19/mo for 500 credits/month" linking to `/billing`
  5. **Dismiss:** "Maybe later" text button that calls `onClose`

**Purchase action:** Reuse `createCheckoutSession` from `@/api/billingApi` (same as `CreditPurchaseModal` does). On click: call `createCheckoutSession(pack.priceId)`, redirect to `url`.

**Import dependencies:**
- `CREDIT_PACKS` from `@/features/billing/creditPacks`
- `createCheckoutSession` from `@/api/billingApi`

---

## Task 4: Credit Gate State Management

**Create:** `client/src/hooks/useCreditGate.ts`

This hook provides the pre-flight check and modal state for any component that triggers generation.

```tsx
import { useState, useCallback } from 'react';
import { useCreditBalance } from '@/context/CreditBalanceContext';
import type { InsufficientCreditsModalState } from '@/features/convergence/types';

interface CreditGateResult {
  /** Returns true if user has enough credits. Returns false and opens modal if not. */
  checkCredits: (cost: number, operation: string) => boolean;
  /** Modal state — null when closed */
  insufficientCreditsModal: InsufficientCreditsModalState | null;
  /** Close the modal */
  dismissModal: () => void;
  /** Current balance for UI display */
  balance: number | null;
  isLoading: boolean;
}

export function useCreditGate(): CreditGateResult {
  const { balance, isLoading } = useCreditBalance();
  const [modal, setModal] = useState<InsufficientCreditsModalState | null>(null);

  const checkCredits = useCallback(
    (cost: number, operation: string): boolean => {
      const available = balance ?? 0;
      if (available >= cost) return true;
      setModal({ required: cost, available, operation });
      return false;
    },
    [balance]
  );

  const dismissModal = useCallback(() => setModal(null), []);

  return {
    checkCredits,
    insufficientCreditsModal: modal,
    dismissModal,
    balance,
    isLoading,
  };
}
```

---

## Task 5: Wire Credit Gate into GenerationControlsPanel

**File:** `client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/GenerationControlsPanel.tsx`

This is where `handleGenerate` is defined (around line 97). This is the right interception point — before the generation request hits the server.

**Changes:**

1. Import `useCreditGate` and `InsufficientCreditsModal`:
```tsx
import { useCreditGate } from '@/hooks/useCreditGate';
import { InsufficientCreditsModal } from '@/components/modals/InsufficientCreditsModal';
```

2. Inside the component, call the hook:
```tsx
const { checkCredits, insufficientCreditsModal, dismissModal, balance } = useCreditGate();
```

3. **Modify `handleGenerate`** (the callback around line 97). Before the existing logic that calls `onDraft` or `onRender`, add the credit check:

```tsx
const handleGenerate = useCallback(
  (overrides?: GenerationOverrides) => {
    // Determine cost based on tier and model
    const selectedModelIdForGeneration = /* existing logic */;

    // Find cost from model config
    let cost: number;
    if (tier === 'draft') {
      cost = VIDEO_DRAFT_MODEL.cost;
    } else {
      const renderModel = VIDEO_RENDER_MODELS.find(m => m.id === selectedModelIdForGeneration);
      cost = renderModel?.cost ?? VIDEO_RENDER_MODELS[0].cost;
    }

    // Determine operation label
    const operationLabel = tier === 'draft'
      ? `${VIDEO_DRAFT_MODEL.label} preview`
      : (VIDEO_RENDER_MODELS.find(m => m.id === selectedModelIdForGeneration)?.label ?? 'Video') + ' render';

    // PRE-FLIGHT CREDIT CHECK
    if (!checkCredits(cost, operationLabel)) return;

    // ... existing generation logic unchanged ...
  },
  [/* existing deps + checkCredits, tier */]
);
```

4. Also gate the image/storyboard generation if those paths exist in this component. Check if `handleImageGenerate` or `handleStoryboard` callbacks exist and apply the same pattern:
   - Image preview: cost = `IMAGE_MODEL.cost` (1 credit), operation = "Image preview"
   - Storyboard: cost = `STORYBOARD_COST` (4 credits), operation = "Storyboard"

   Import `IMAGE_MODEL, STORYBOARD_COST` from `@components/ToolSidebar/config/modelConfig`.

5. **Render the modal** at the bottom of the JSX return, before the closing fragment/div:

```tsx
<InsufficientCreditsModal
  open={insufficientCreditsModal !== null}
  onClose={dismissModal}
  required={insufficientCreditsModal?.required ?? 0}
  available={insufficientCreditsModal?.available ?? 0}
  operation={insufficientCreditsModal?.operation ?? ''}
/>
```

---

## Task 6: Disable Generate Button When Balance is Zero

**File:** `client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/components/GenerationFooter.tsx`

**Changes:**

1. Add a new prop to `GenerationFooterProps`:
```tsx
creditBalance?: number | null;
```

2. Compute disabled state:
```tsx
const hasSufficientCredits = creditBalance !== null && creditBalance !== undefined
  ? creditBalance >= (creditCost ?? 0)
  : true; // don't block if balance unknown (loading)
const isDisabled = isGenerateDisabled || !hasSufficientCredits;
```

3. Replace `disabled={isGenerateDisabled}` with `disabled={isDisabled}` on the button.

4. Add a tooltip or title attribute when disabled due to credits:
```tsx
title={!hasSufficientCredits ? `Need ${creditCost} credits (you have ${creditBalance ?? 0})` : undefined}
```

5. **In `GenerationControlsPanel.tsx`**, pass `creditBalance={balance}` to `<GenerationFooter>` (from the `useCreditGate` hook result).

---

## Task 7: Handle 402 Server Response Gracefully (Belt + Suspenders)

The pre-flight check (Task 5) should catch most cases, but there's a race condition: balance could change between check and server call (concurrent tabs, subscriptions expiring). This is the belt-and-suspenders server-side catch.

**File:** `client/src/features/prompt-optimizer/GenerationsPanel/hooks/useGenerationActions.ts`

**In each catch block** (there are 3: `generateDraft` ~line 420, `generateStoryboard` ~line 497, `generateRender` ~line 659), add special handling for 402:

```tsx
} catch (error) {
  if (controller.signal.aborted) return;

  // Check for insufficient credits (402 from server)
  const isInsufficientCredits =
    error instanceof ApiError &&
    error.status === 402 &&
    typeof error.response === 'object' &&
    error.response !== null &&
    'code' in error.response &&
    (error.response as Record<string, unknown>).code === 'INSUFFICIENT_CREDITS';

  if (isInsufficientCredits) {
    // Don't show as a failed generation — show the modal instead
    // Remove the in-progress generation card
    dispatch({ type: 'REMOVE_GENERATION', payload: generation.id });
    inFlightRef.current.delete(generation.id);

    // Emit a custom event that the parent can listen to
    window.dispatchEvent(
      new CustomEvent('insufficient-credits', {
        detail: {
          required: /* credit cost — use the same cost calculation from the top of this function */,
          operation: /* model label */,
        },
      })
    );
    return;
  }

  // ... existing error handling unchanged ...
}
```

**Import** `ApiError` from `@/services/http/ApiError`.

**Check:** Verify that a `REMOVE_GENERATION` action type exists in the generations reducer. If not, use `UPDATE_GENERATION` with `status: 'failed'` and a special error message, or just don't add the generation to state in the first place (but the pre-flight should prevent this path).

**In `GenerationControlsPanel.tsx`**, add an event listener for the custom event:

```tsx
useEffect(() => {
  const handler = (e: CustomEvent) => {
    const { required, operation } = e.detail;
    const available = balance ?? 0;
    // Open the modal using the same state setter from useCreditGate
    // This requires exposing a setModal or similar from the hook
  };
  window.addEventListener('insufficient-credits', handler as EventListener);
  return () => window.removeEventListener('insufficient-credits', handler as EventListener);
}, [balance]);
```

**Alternative (simpler):** Instead of custom events, add a `onInsufficientCredits` callback to the generation actions options/context that the panel passes down. This is architecturally cleaner. Use whichever approach fits the existing patterns — check if `useGenerationActions` accepts callbacks via its options. If it does, add `onInsufficientCredits?: (required: number, operation: string) => void` to the options type and call it from the catch block.

---

## Task 8: Credit Balance in GenerationFooter Inline Display

**File:** `client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/components/GenerationFooter.tsx`

Currently shows: `· 80 cr`

Change to show: `· 80 cr · bal: 12` (or similar compact format).

In the credit cost `<span>`, update:

```tsx
<span className="whitespace-nowrap text-[11px] tabular-nums text-[#555B6E]">
  {creditCost !== null ? `· ${creditCost} cr` : ''}
  {creditBalance !== null && creditBalance !== undefined && (
    <span className={cn(
      'ml-1',
      creditBalance < (creditCost ?? 0) ? 'text-amber-400' : 'text-[#555B6E]'
    )}>
      · {creditBalance} bal
    </span>
  )}
</span>
```

This turns amber when balance < cost, providing inline visual warning.

---

## File Inventory (all changes)

| Action | File Path |
|--------|-----------|
| **CREATE** | `client/src/context/CreditBalanceContext.tsx` |
| **CREATE** | `client/src/hooks/useCreditGate.ts` |
| **CREATE** | `client/src/components/modals/InsufficientCreditsModal.tsx` |
| **EDIT** | `client/src/components/ToolSidebar/components/ToolRail.tsx` — add balance display |
| **EDIT** | `client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/GenerationControlsPanel.tsx` — wire credit gate + modal |
| **EDIT** | `client/src/components/ToolSidebar/components/panels/GenerationControlsPanel/components/GenerationFooter.tsx` — add `creditBalance` prop, disable button, inline display |
| **EDIT** | `client/src/features/prompt-optimizer/GenerationsPanel/hooks/useGenerationActions.ts` — 402 error handling in 3 catch blocks |
| **EDIT** | App shell / layout component (find where `<ToolSidebar` is rendered) — wrap in `<CreditBalanceProvider>` |

---

## Existing Code References (do not modify these, just consume them)

| What | Path | Notes |
|------|------|-------|
| Credit balance hook | `client/src/hooks/useUserCreditBalance.ts` | Firestore real-time listener, returns `{ balance, isLoading, error }` |
| Model costs | `client/src/components/ToolSidebar/config/modelConfig.ts` | `VIDEO_DRAFT_MODEL.cost=5`, `VIDEO_RENDER_MODELS[].cost`, `IMAGE_MODEL.cost=1`, `STORYBOARD_COST=4` |
| Credit packs | `client/src/features/billing/creditPacks.ts` | `CREDIT_PACKS[]` with `priceId`, `credits`, `price` |
| Subscription tiers | `client/src/features/billing/subscriptionTiers.ts` | `SUBSCRIPTION_TIERS[]` |
| Checkout API | `client/src/api/billingApi.ts` | `createCheckoutSession(priceId)` → `{ url }` |
| ApiError class | `client/src/services/http/ApiError.ts` | Has `.status`, `.response` properties |
| ApiResponseHandler | `client/src/services/http/ApiResponseHandler.ts` | On non-OK response, throws `ApiError` with parsed JSON body as `.response` |
| Error codes (server) | `server/src/routes/generationErrorCodes.ts` | `INSUFFICIENT_CREDITS` code sent in 402 response body `{ code }` |
| Error messages config | `client/src/features/convergence/utils/errorMessages.ts` | `INSUFFICIENT_CREDITS` entry exists |
| InsufficientCreditsModalState type | `client/src/features/convergence/types.ts` lines 460-463 | `{ required: number; available: number; operation: string }` |
| User type | `client/src/hooks/types.ts` line 63 | `User { uid: string; email?; displayName?; photoURL? }` |
| cn utility | `client/src/utils/cn.ts` | Tailwind class merger |

---

## Design Constraints

- **Dark theme only.** Background: `#0D0E12` / `#111318`. Borders: `#1A1C22`. Text: `#8B92A5` (secondary), `#555B6E` (muted), white (primary). Purple accent: `#6C5CE7` → `#8B5CF6`.
- **ToolRail is 56px wide** (`w-14`). Credit display must fit within this constraint.
- **GenerationFooter is 64px tall.** Don't increase height.
- **No new npm dependencies.** Use existing UI components from `@promptstudio/system/components/ui`.
- **Max file sizes:** Components ≤200 lines, hooks ≤150 lines, context files ≤50 lines.

---

## NOT in Scope (future work, do not implement)

- Free tier starter credit grant (requires server-side signup hook changes)
- Onboarding tooltip/banner for first-time users
- Subscription status detection (showing "subscribed" badge vs "free")
- Credit history or transaction log UI
- Low-balance warning notifications
