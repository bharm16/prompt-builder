/**
 * Regression test: Sidebar panel state leaks onto /assets.
 *
 * When navigating from the workspace (with Styles panel open) to /assets,
 * the persisted localStorage value caused the Styles panel to render on the
 * assets page. The forceDefault option ensures non-session routes ignore
 * persisted state and always use the default panel.
 */
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useToolSidebarState } from "../useToolSidebarState";

describe("regression: forceDefault ignores persisted panel state", () => {
  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("uses default panel when forceDefault is true, ignoring localStorage", () => {
    window.localStorage.setItem("tool-sidebar:activePanel", "styles");

    const { result } = renderHook(() =>
      useToolSidebarState("studio", { forceDefault: true }),
    );

    expect(result.current.activePanel).toBe("studio");
  });

  it("reads localStorage when forceDefault is false (default)", () => {
    window.localStorage.setItem("tool-sidebar:activePanel", "styles");

    const { result } = renderHook(() =>
      useToolSidebarState("studio", { forceDefault: false }),
    );

    expect(result.current.activePanel).toBe("styles");
  });
});
