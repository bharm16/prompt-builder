import type { PromptVersionEntry } from "@features/prompt-optimizer/types/domain/prompt-session";

interface ComputeIsEmptySessionInput {
  /** Number of gallery entries currently rendered. */
  galleryEntriesCount: number;
  /** Whether a hero generation is currently selected. */
  hasHeroGeneration: boolean;
  /** Whether the user has dropped a start frame onto the canvas. */
  hasStartFrame: boolean;
  /** The prompt text bound to this canvas (output if optimized, input otherwise). */
  prompt: string;
  /** Whether ML span highlighting is currently active (results view). */
  enableMLHighlighting: boolean;
  /** Saved version entries for the current prompt, if any. */
  versions: ReadonlyArray<PromptVersionEntry>;
}

/**
 * Decide whether the canvas should render its empty-state chrome
 * (`NewSessionView` overlay) for the supplied session state.
 *
 * Rule: a session is "empty" only when the user has nothing yet — no
 * generations, no start frame, no saved prompt versions, and no live
 * highlighted prompt. As soon as ANY of those is present, the workspace
 * has content to show and the empty-state copy must step aside.
 *
 * Why `versions.length > 0` is the load-bearing signal: when the user
 * navigates to an existing session, the prompt loader hydrates `prompt`
 * before `showResults` flips to true. During that brief gap,
 * `enableMLHighlighting` is false even though the session has real saved
 * work. Falling back on `versions` lets us recognize "this session has
 * been optimized at least once" independent of UI mode, so the empty-
 * state overlay no longer flashes on top of an active prompt
 * (regression: ISSUE-35).
 */
export function computeIsEmptySession({
  galleryEntriesCount,
  hasHeroGeneration,
  hasStartFrame,
  prompt,
  enableMLHighlighting,
  versions,
}: ComputeIsEmptySessionInput): boolean {
  const hasGenerations = galleryEntriesCount > 0 || hasHeroGeneration;
  if (hasGenerations) return false;
  if (hasStartFrame) return false;

  const trimmedPrompt = prompt.trim();
  // The user has live highlighted output → not empty.
  if (enableMLHighlighting && trimmedPrompt.length > 0) return false;
  // The session has at least one persisted version → an existing session
  // that simply hasn't entered "results view" yet. Not empty.
  if (versions.length > 0 && trimmedPrompt.length > 0) return false;

  return true;
}
