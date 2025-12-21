import { useState, useEffect } from 'react';
import type { AppSettings } from '../types';

const STORAGE_KEY = 'app-settings';

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  fontSize: 'medium',
  autoSave: true,
  exportFormat: 'markdown',
};

/**
 * Hook for managing user preferences with localStorage persistence.
 * Settings are automatically saved when changed and restored on mount.
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<AppSettings>;
        // Force dark mode to false (light mode only for now)
        parsed.darkMode = false;
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

    // Apply dark mode class to document
    // Force light mode - always remove dark class
    document.documentElement.classList.remove('dark');

    // Apply font size class to document
    document.documentElement.setAttribute('data-font-size', settings.fontSize);
  }, [settings]);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const resetSettings = (): void => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
  };

  return { settings, updateSetting, resetSettings };
}
