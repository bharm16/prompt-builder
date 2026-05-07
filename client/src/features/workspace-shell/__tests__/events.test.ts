import { describe, expect, it, vi } from "vitest";
import {
  PROMPT_FOCUS_INTENT,
  addPromptFocusIntentListener,
  dispatchPromptFocusIntent,
  addContinueSceneListener,
  dispatchContinueScene,
} from "../events";

describe("CanvasWorkspace events", () => {
  it("dispatches and listens for prompt focus intent events", () => {
    const listener = vi.fn();
    const remove = addPromptFocusIntentListener(listener);

    dispatchPromptFocusIntent({ source: "tool-rail" });

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0]?.[0] as CustomEvent<{
      source?: string;
    }>;
    expect(event.type).toBe(PROMPT_FOCUS_INTENT);
    expect(event.detail.source).toBe("tool-rail");

    remove();
    dispatchPromptFocusIntent({ source: "tool-rail" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("CONTINUE_SCENE", () => {
  it("dispatches the event with the fromGenerationId payload", () => {
    const handler = vi.fn();
    const unsubscribe = addContinueSceneListener(handler);

    dispatchContinueScene({ fromGenerationId: "gen-42" });

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0]?.[0] as CustomEvent<{
      fromGenerationId: string;
    }>;
    expect(event.detail.fromGenerationId).toBe("gen-42");

    unsubscribe();
  });

  it("stops delivering events after unsubscribe", () => {
    const handler = vi.fn();
    const unsubscribe = addContinueSceneListener(handler);
    unsubscribe();

    dispatchContinueScene({ fromGenerationId: "gen-99" });

    expect(handler).not.toHaveBeenCalled();
  });
});
