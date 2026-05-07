import { useCallback, useState } from "react";

export interface UseWorkspaceProjectResult {
  name: string;
  rename: (next: string) => void;
}

/**
 * Surfaces the current project name + rename action for the workspace top bar.
 *
 * Phase 1 stub: this codebase does not yet have a first-class project store.
 * The legacy `CanvasWorkspace` does not display a project name at all, so
 * there is no existing source of truth to read from. Renames are persisted in
 * component state so the inline-rename UI flows end to end.
 *
 * TODO(workspace-shell): when a real project store lands (likely a context
 * provider or a session-derived selector), swap the body of this hook to read
 * from it. The consumer interface (`{ name, rename }`) stays the same.
 */
export function useWorkspaceProject(): UseWorkspaceProjectResult {
  const [name, setName] = useState<string>("Untitled");
  const rename = useCallback((next: string) => {
    const trimmed = next.trim();
    if (trimmed.length === 0) return;
    setName(trimmed);
  }, []);
  return { name, rename };
}
