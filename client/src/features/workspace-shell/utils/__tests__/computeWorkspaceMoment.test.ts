import { describe, expect, it } from "vitest";
import {
  computeWorkspaceMoment,
  type WorkspaceMomentInput,
} from "../computeWorkspaceMoment";

const baseInput: WorkspaceMomentInput = {
  galleryEntriesCount: 0,
  activeShotStatuses: [],
  promptIsEmpty: true,
  tuneOpen: false,
  promptFocused: false,
};

describe("computeWorkspaceMoment", () => {
  it("returns 'empty' when nothing exists and prompt empty/unfocused", () => {
    expect(computeWorkspaceMoment(baseInput)).toBe("empty");
  });

  it("returns 'drafting' when prompt has content but no shots", () => {
    expect(computeWorkspaceMoment({ ...baseInput, promptIsEmpty: false })).toBe(
      "drafting",
    );
  });

  it("returns 'drafting' when prompt focused but no shots", () => {
    expect(computeWorkspaceMoment({ ...baseInput, promptFocused: true })).toBe(
      "drafting",
    );
  });

  it("returns 'drafting' when tune drawer open with no shots", () => {
    expect(computeWorkspaceMoment({ ...baseInput, tuneOpen: true })).toBe(
      "drafting",
    );
  });

  it("returns 'rendering' when active shot has a pending tile", () => {
    expect(
      computeWorkspaceMoment({
        ...baseInput,
        galleryEntriesCount: 1,
        activeShotStatuses: ["pending"],
      }),
    ).toBe("rendering");
  });

  it("returns 'rendering' when active shot has a generating tile", () => {
    expect(
      computeWorkspaceMoment({
        ...baseInput,
        galleryEntriesCount: 1,
        activeShotStatuses: ["generating"],
      }),
    ).toBe("rendering");
  });

  it("returns 'ready' when active shot has a completed tile and prompt is idle", () => {
    expect(
      computeWorkspaceMoment({
        ...baseInput,
        galleryEntriesCount: 1,
        activeShotStatuses: ["completed"],
      }),
    ).toBe("ready");
  });

  it("returns 'rendering' over 'ready' when both states present", () => {
    expect(
      computeWorkspaceMoment({
        ...baseInput,
        galleryEntriesCount: 2,
        activeShotStatuses: ["completed", "generating"],
      }),
    ).toBe("rendering");
  });

  it("never returns 'empty' once any shot exists", () => {
    expect(
      computeWorkspaceMoment({
        ...baseInput,
        galleryEntriesCount: 1,
        activeShotStatuses: ["failed"],
      }),
    ).toBe("drafting");
  });
});
