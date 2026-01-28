import { useEffect } from 'react';
import type { AppSettings } from '../types';

export const useSettingsDomSync = (settings: AppSettings): void => {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Force light mode - always remove dark class
    document.documentElement.classList.remove('dark');

    // Apply font size class to document
    document.documentElement.setAttribute('data-font-size', settings.fontSize);
  }, [settings.fontSize]);
};
