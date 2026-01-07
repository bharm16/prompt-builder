import type { AppSettings } from '../types';
import { useSettingsDomSync } from './useSettingsDomSync';
import { useSettingsStorage } from './useSettingsStorage';

/**
 * Hook for managing user preferences with localStorage persistence.
 * Settings are automatically saved when changed and restored on mount.
 */
export function useSettings() {
  const { settings, setSettings, resetSettings } = useSettingsStorage();
  useSettingsDomSync(settings);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return { settings, updateSetting, resetSettings };
}
