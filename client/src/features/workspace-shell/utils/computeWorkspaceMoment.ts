import type { Generation } from "@features/generations/types";

export type WorkspaceMoment = "empty" | "drafting" | "rendering" | "ready";

export interface WorkspaceMomentInput {
  /** Total gallery entry count for the current session. */
  galleryEntriesCount: number;
  /** Statuses of tiles in the most recent shot (active shot). */
  activeShotStatuses: ReadonlyArray<Generation["status"]>;
  /** True iff the prompt-bar editor is empty (whitespace only counts as empty). */
  promptIsEmpty: boolean;
  /** True iff the Tune drawer is open. */
  tuneOpen: boolean;
  /** True iff the prompt-bar editor currently has focus. */
  promptFocused: boolean;
}

const RENDERING_STATUSES: ReadonlyArray<Generation["status"]> = [
  "pending",
  "generating",
];

export function computeWorkspaceMoment(
  input: WorkspaceMomentInput,
): WorkspaceMoment {
  const hasAnyShots = input.galleryEntriesCount > 0;
  const activeRendering = input.activeShotStatuses.some((s) =>
    RENDERING_STATUSES.includes(s),
  );
  const activeReady = input.activeShotStatuses.some((s) => s === "completed");

  if (activeRendering) return "rendering";
  if (
    !hasAnyShots &&
    input.promptIsEmpty &&
    !input.tuneOpen &&
    !input.promptFocused
  ) {
    return "empty";
  }
  if (!hasAnyShots) return "drafting";
  if (activeReady) return "ready";
  return "drafting";
}

export function workspaceMomentClass(moment: WorkspaceMoment): string {
  return `workspace--${moment}`;
}
