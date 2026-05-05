export const PROMPT_FOCUS_INTENT = "prompt-canvas:focus-intent" as const;

export interface PromptFocusIntentDetail {
  source?: "tool-rail" | "unknown";
}

export type PromptFocusIntentEvent = CustomEvent<PromptFocusIntentDetail>;

const supportsWindow = (): boolean => typeof window !== "undefined";

export function dispatchPromptFocusIntent(
  detail: PromptFocusIntentDetail = { source: "unknown" },
): void {
  if (!supportsWindow()) return;
  window.dispatchEvent(
    new CustomEvent<PromptFocusIntentDetail>(PROMPT_FOCUS_INTENT, { detail }),
  );
}

export function addPromptFocusIntentListener(
  listener: (event: PromptFocusIntentEvent) => void,
): () => void {
  if (!supportsWindow()) return () => {};

  const handler: EventListener = (event) => {
    listener(event as PromptFocusIntentEvent);
  };

  window.addEventListener(PROMPT_FOCUS_INTENT, handler);
  return () => {
    window.removeEventListener(PROMPT_FOCUS_INTENT, handler);
  };
}

/* ─── Continue Scene ────────────────────────────────────────── */

export const CONTINUE_SCENE = "workspace:continue-scene" as const;

export interface ContinueSceneDetail {
  fromGenerationId: string;
}

export type ContinueSceneEvent = CustomEvent<ContinueSceneDetail>;

export function dispatchContinueScene(detail: ContinueSceneDetail): void {
  if (!supportsWindow()) return;
  window.dispatchEvent(
    new CustomEvent<ContinueSceneDetail>(CONTINUE_SCENE, { detail }),
  );
}

export function addContinueSceneListener(
  listener: (event: ContinueSceneEvent) => void,
): () => void {
  if (!supportsWindow()) return () => {};
  const handler: EventListener = (event) => {
    listener(event as ContinueSceneEvent);
  };
  window.addEventListener(CONTINUE_SCENE, handler);
  return () => {
    window.removeEventListener(CONTINUE_SCENE, handler);
  };
}
