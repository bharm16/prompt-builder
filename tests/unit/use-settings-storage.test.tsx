/**
 * Unit tests for useSettingsStorage
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useSettingsStorage } from '@components/Settings/hooks/useSettingsStorage';
import type { AppSettings } from '@components/Settings/types';

const STORAGE_KEY = 'app-settings';

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  fontSize: 'medium',
  autoSave: true,
  exportFormat: 'markdown',
};

describe('useSettingsStorage', () => {
  const originalGetItem = localStorage.getItem;
  const originalSetItem = localStorage.setItem;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.getItem = originalGetItem;
    localStorage.setItem = originalSetItem;
  });

  describe('error handling', () => {
    it('falls back to defaults when storage contains invalid JSON', () => {
      localStorage.getItem = vi.fn(() => '{not-json');

      const { result } = renderHook(() => useSettingsStorage());

      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    });

    it('falls back to defaults when stored schema is invalid', () => {
      localStorage.getItem = vi.fn(() => JSON.stringify({ fontSize: 'giant' }));

      const { result } = renderHook(() => useSettingsStorage());

      expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('edge cases', () => {
    it('normalizes stored settings and forces darkMode off', () => {
      localStorage.getItem = vi.fn(() =>
        JSON.stringify({
          darkMode: true,
          fontSize: 'large',
          autoSave: false,
          exportFormat: 'json',
        })
      );

      const { result } = renderHook(() => useSettingsStorage());

      expect(result.current.settings).toEqual({
        darkMode: false,
        fontSize: 'large',
        autoSave: false,
        exportFormat: 'json',
      });
    });
  });

  describe('core behavior', () => {
    it('persists updated settings to storage', async () => {
      const { result } = renderHook(() => useSettingsStorage());

      act(() => {
        result.current.setSettings((prev) => ({
          ...prev,
          fontSize: 'small',
        }));
      });

      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith(
          STORAGE_KEY,
          JSON.stringify({
            darkMode: false,
            fontSize: 'small',
            autoSave: true,
            exportFormat: 'markdown',
          })
        );
      });
    });

    it('resets settings to defaults and persists them', async () => {
      const { result } = renderHook(() => useSettingsStorage());

      act(() => {
        result.current.resetSettings();
      });

      await waitFor(() => {
        expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
        expect(localStorage.setItem).toHaveBeenCalledWith(
          STORAGE_KEY,
          JSON.stringify(DEFAULT_SETTINGS)
        );
      });
    });
  });
});
