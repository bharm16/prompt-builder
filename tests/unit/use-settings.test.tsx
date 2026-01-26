/**
 * Unit tests for useSettings
 */

import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useSettings } from '@components/Settings/hooks/useSettings';
import { useSettingsStorage } from '@components/Settings/hooks/useSettingsStorage';
import { useSettingsDomSync } from '@components/Settings/hooks/useSettingsDomSync';
import type { AppSettings } from '@components/Settings/types';

vi.mock('@components/Settings/hooks/useSettingsStorage', () => ({
  useSettingsStorage: vi.fn(),
}));

vi.mock('@components/Settings/hooks/useSettingsDomSync', () => ({
  useSettingsDomSync: vi.fn(),
}));

const mockUseSettingsStorage = vi.mocked(useSettingsStorage);
const mockUseSettingsDomSync = vi.mocked(useSettingsDomSync);

const baseSettings: AppSettings = {
  darkMode: false,
  fontSize: 'medium',
  autoSave: true,
  exportFormat: 'markdown',
};

describe('useSettings', () => {
  it('syncs settings to the DOM each render', () => {
    mockUseSettingsStorage.mockReturnValue({
      settings: baseSettings,
      setSettings: vi.fn(),
      resetSettings: vi.fn(),
    });

    renderHook(() => useSettings());

    expect(mockUseSettingsDomSync).toHaveBeenCalledWith(baseSettings);
  });

  describe('edge cases', () => {
    it('updates only the specified setting key', () => {
      const setSettings = vi.fn();
      const resetSettings = vi.fn();

      mockUseSettingsStorage.mockReturnValue({
        settings: baseSettings,
        setSettings,
        resetSettings,
      });

      const { result } = renderHook(() => useSettings());

      act(() => {
        result.current.updateSetting('fontSize', 'large');
      });

      expect(setSettings).toHaveBeenCalledWith(expect.any(Function));
      const updater = setSettings.mock.calls[0]?.[0] as (prev: AppSettings) => AppSettings;
      const updated = updater(baseSettings);

      expect(updated).toEqual({
        ...baseSettings,
        fontSize: 'large',
      });
    });
  });

  describe('core behavior', () => {
    it('exposes resetSettings from storage hook', () => {
      const resetSettings = vi.fn();
      mockUseSettingsStorage.mockReturnValue({
        settings: baseSettings,
        setSettings: vi.fn(),
        resetSettings,
      });

      const { result } = renderHook(() => useSettings());

      expect(result.current.resetSettings).toBe(resetSettings);
    });
  });
});
