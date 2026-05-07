import { renderHook, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWorkspaceProject } from "../useWorkspaceProject";

describe("useWorkspaceProject", () => {
  it("returns a name string and a rename callback", () => {
    const { result } = renderHook(() => useWorkspaceProject());
    expect(typeof result.current.name).toBe("string");
    expect(typeof result.current.rename).toBe("function");
  });

  it("name is non-empty", () => {
    const { result } = renderHook(() => useWorkspaceProject());
    expect(result.current.name.length).toBeGreaterThan(0);
  });

  it("rename updates the surfaced name", () => {
    const { result } = renderHook(() => useWorkspaceProject());
    act(() => {
      result.current.rename("Beach Sunset Spec");
    });
    expect(result.current.name).toBe("Beach Sunset Spec");
  });

  it("rename ignores whitespace-only input", () => {
    const { result } = renderHook(() => useWorkspaceProject());
    const original = result.current.name;
    act(() => {
      result.current.rename("   ");
    });
    expect(result.current.name).toBe(original);
  });
});
