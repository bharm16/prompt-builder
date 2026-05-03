/**
 * Unit tests for useSettingsDomSync
 */

import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { useSettingsDomSync } from "@components/Settings/hooks/useSettingsDomSync";
import type { AppSettings } from "@components/Settings/types";

describe("useSettingsDomSync", () => {
  describe("edge cases", () => {
    it("sets font size attribute on the document element", async () => {
      const settings: AppSettings = {
        fontSize: "large",
        autoSave: true,
        exportFormat: "markdown",
      };

      renderHook(() => useSettingsDomSync(settings));

      await waitFor(() => {
        expect(document.documentElement.getAttribute("data-font-size")).toBe(
          "large",
        );
      });
    });
  });

  describe("core behavior", () => {
    it("updates font size attribute when setting changes", async () => {
      const initialSettings: AppSettings = {
        fontSize: "medium",
        autoSave: true,
        exportFormat: "markdown",
      };

      const { rerender } = renderHook(
        ({ settings }) => useSettingsDomSync(settings),
        { initialProps: { settings: initialSettings } },
      );

      rerender({
        settings: {
          ...initialSettings,
          fontSize: "small",
        },
      });

      await waitFor(() => {
        expect(document.documentElement.getAttribute("data-font-size")).toBe(
          "small",
        );
      });
    });
  });
});
