import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { z } from 'zod';
import type { AppSettings } from '../types';

const STORAGE_KEY = 'app-settings';

const FONT_SIZES = ['small', 'medium', 'large'] as const;
const EXPORT_FORMATS = ['text', 'markdown', 'json'] as const;

const SettingsSchema = z.object({
  darkMode: z.boolean(),
  fontSize: z.enum(FONT_SIZES),
  autoSave: z.boolean(),
  exportFormat: z.enum(EXPORT_FORMATS),
});

const PartialSettingsSchema = SettingsSchema.partial();

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  fontSize: 'medium',
  autoSave: true,
  exportFormat: 'markdown',
};

const normalizeSettings = (settings: Partial<AppSettings>): AppSettings => {
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  return { ...merged, darkMode: false };
};

const loadSettings = (): AppSettings => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = PartialSettingsSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return DEFAULT_SETTINGS;
    const cleaned = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined)
    ) as Partial<AppSettings>;
    return normalizeSettings(cleaned);
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const persistSettings = (settings: AppSettings): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
};

export const useSettingsStorage = (): {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  resetSettings: () => void;
} => {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  useEffect(() => {
    persistSettings(settings);
  }, [settings]);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    persistSettings(DEFAULT_SETTINGS);
  }, []);

  return { settings, setSettings, resetSettings };
};
