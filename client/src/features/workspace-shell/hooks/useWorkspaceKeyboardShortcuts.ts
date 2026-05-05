import { useEffect } from "react";
import { dispatchPromptFocusIntent } from "../events";

/**
 * Mounts global keyboard shortcuts for the unified workspace.
 *
 * Phase 3 baseline:
 *   - ⌘K / Ctrl+K → focus the composer (via PROMPT_FOCUS_INTENT)
 *
 * Phase 3.5 follow-up (intentionally omitted here — needs an active-shot
 * + active-variant index lifted into the orchestrator):
 *   - J / K → previous / next shot
 *   - H / L → previous / next variant within the active shot
 */
export function useWorkspaceKeyboardShortcuts(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase();
      const isMod = event.metaKey || event.ctrlKey;

      if (isMod && key === "k") {
        event.preventDefault();
        dispatchPromptFocusIntent({ source: "tool-rail" });
      }
      // J/K/H/L navigation deferred to Phase 3.5 — see hook docstring.
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
