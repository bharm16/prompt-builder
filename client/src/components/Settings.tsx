import React, { useState, useEffect } from 'react';
import { X, Moon, Sun, Type, Save, Trash2, Download, FileText } from 'lucide-react';

type FontSize = 'small' | 'medium' | 'large';
type ExportFormat = 'text' | 'markdown' | 'json';

interface AppSettings {
  darkMode: boolean;
  fontSize: FontSize;
  autoSave: boolean;
  exportFormat: ExportFormat;
}

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetSettings: () => void;
  onClearAllData?: () => void;
}

// Settings hook for managing user preferences
export const useSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    // Always start with light mode by default
    const defaultSettings: AppSettings = {
      darkMode: false,
      fontSize: 'medium',
      autoSave: true,
      exportFormat: 'markdown',
    };

    const saved = localStorage.getItem('app-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<AppSettings>;
        // Force dark mode to false
        parsed.darkMode = false;
        return { ...defaultSettings, ...parsed };
      } catch (e) {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('app-settings', JSON.stringify(settings));

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
    const defaultSettings: AppSettings = {
      darkMode: false,
      fontSize: 'medium',
      autoSave: true,
      exportFormat: 'markdown',
    };
    setSettings(defaultSettings);
    localStorage.setItem('app-settings', JSON.stringify(defaultSettings));
  };

  return { settings, updateSetting, resetSettings };
};

// Settings Panel Component
export default function Settings({
  isOpen,
  onClose,
  settings,
  updateSetting,
  resetSettings,
  onClearAllData,
}: SettingsProps): React.ReactElement | null {
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
    return undefined;
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleResetSettings = (): void => {
    resetSettings();
    setShowConfirmReset(false);
  };

  const handleClearAllData = (): void => {
    if (onClearAllData) {
      onClearAllData();
    }
    setShowConfirmClear(false);
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div className="modal-content-lg animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="card-header flex items-center justify-between bg-gradient-to-r from-primary-50 to-secondary-50">
          <h2 id="settings-title" className="text-heading-20 text-geist-foreground">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="btn-icon-secondary btn-sm"
            aria-label="Close settings"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="card-body space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Appearance Section */}
          <section>
            <h3 className="text-heading-18 text-geist-foreground mb-geist-4">Appearance</h3>

            {/* Dark Mode Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border-2 border-neutral-200 bg-neutral-50 transition-colors duration-200">
              <div className="flex items-center gap-3">
                {settings.darkMode ? (
                  <Moon className="h-5 w-5 text-primary-600" aria-hidden="true" />
                ) : (
                  <Sun className="h-5 w-5 text-warning-600" aria-hidden="true" />
                )}
                <div>
                  <label htmlFor="dark-mode-toggle" className="text-label-16 text-geist-foreground">
                    Dark Mode
                  </label>
                  <p className="text-copy-14 text-geist-accents-6">Use dark theme across the app</p>
                </div>
              </div>
              <button
                id="dark-mode-toggle"
                onClick={() => updateSetting('darkMode', !settings.darkMode)}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-ring
                  ${settings.darkMode ? 'bg-primary-600' : 'bg-neutral-300'}
                `}
                role="switch"
                aria-checked={settings.darkMode}
                aria-label="Toggle dark mode"
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200
                    ${settings.darkMode ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>

            {/* Font Size */}
            <div className="mt-4 p-4 rounded-lg border-2 border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-3 mb-3">
                <Type className="h-5 w-5 text-neutral-600" aria-hidden="true" />
                <label className="text-label-16 text-geist-foreground">Font Size</label>
              </div>
              <div className="flex gap-2">
                {(['small', 'medium', 'large'] as FontSize[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => updateSetting('fontSize', size)}
                    className={`
                      flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 focus-ring
                      ${
                        settings.fontSize === size
                          ? 'bg-primary-600 text-white shadow-md scale-105'
                          : 'bg-white text-neutral-700 hover:bg-neutral-100 border-2 border-neutral-200'
                      }
                    `}
                    aria-pressed={settings.fontSize === size}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Behavior Section */}
          <section>
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Behavior</h3>

            {/* Auto-save Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border-2 border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-3">
                <Save className="h-5 w-5 text-success-600" aria-hidden="true" />
                <div>
                  <label htmlFor="auto-save-toggle" className="font-medium text-neutral-900">
                    Auto-save
                  </label>
                  <p className="text-sm text-neutral-600">Automatically save prompts to history</p>
                </div>
              </div>
              <button
                id="auto-save-toggle"
                onClick={() => updateSetting('autoSave', !settings.autoSave)}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus-ring
                  ${settings.autoSave ? 'bg-success-600' : 'bg-neutral-300'}
                `}
                role="switch"
                aria-checked={settings.autoSave}
                aria-label="Toggle auto-save"
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200
                    ${settings.autoSave ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </button>
            </div>
          </section>

          {/* Export Section */}
          <section>
            <h3 className="text-lg font-semibold text-neutral-900 mb-4">Export Preferences</h3>

            <div className="p-4 rounded-lg border-2 border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-3 mb-3">
                <Download className="h-5 w-5 text-neutral-600" aria-hidden="true" />
                <label className="text-label-16 text-geist-foreground">Default Export Format</label>
              </div>
              <div className="flex gap-2">
                {[
                  { value: 'text' as ExportFormat, label: 'Text' },
                  { value: 'markdown' as ExportFormat, label: 'Markdown' },
                  { value: 'json' as ExportFormat, label: 'JSON' },
                ].map((format) => (
                  <button
                    key={format.value}
                    onClick={() => updateSetting('exportFormat', format.value)}
                    className={`
                      flex-1 px-4 py-2 rounded-lg font-medium transition-all duration-200 focus-ring
                      ${
                        settings.exportFormat === format.value
                          ? 'bg-primary-600 text-white shadow-md scale-105'
                          : 'bg-white text-neutral-700 hover:bg-neutral-100 border-2 border-neutral-200'
                      }
                    `}
                    aria-pressed={settings.exportFormat === format.value}
                  >
                    {format.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Danger Zone */}
          <section>
            <h3 className="text-heading-18 text-error-600 mb-geist-4">Danger Zone</h3>

            <div className="space-y-3">
              {/* Reset Settings */}
              {!showConfirmReset ? (
                <button
                  onClick={() => setShowConfirmReset(true)}
                  className="w-full btn-secondary text-neutral-700 hover:border-warning-400 hover:bg-warning-50"
                >
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  <span>Reset Settings to Default</span>
                </button>
              ) : (
                <div className="p-4 rounded-lg border-2 border-warning-300 bg-warning-50">
                  <p className="text-sm text-warning-900 mb-3">
                    Are you sure? This will reset all settings to their default values.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleResetSettings}
                      className="flex-1 btn-sm bg-warning-600 text-white hover:bg-warning-700"
                    >
                      Yes, Reset
                    </button>
                    <button
                      onClick={() => setShowConfirmReset(false)}
                      className="flex-1 btn-sm btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Clear All Data */}
              {!showConfirmClear ? (
                <button
                  onClick={() => setShowConfirmClear(true)}
                  className="w-full btn-secondary text-neutral-700 hover:border-error-400 hover:bg-error-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span>Clear All Data</span>
                </button>
              ) : (
                <div className="p-4 rounded-lg border-2 border-error-300 bg-error-50">
                  <p className="text-sm text-error-900 mb-3">
                    Are you sure? This will permanently delete all your saved prompts and history.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={handleClearAllData} className="flex-1 btn-sm btn-danger">
                      Yes, Delete All
                    </button>
                    <button
                      onClick={() => setShowConfirmClear(false)}
                      className="flex-1 btn-sm btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="card-footer flex items-center justify-between">
          <p className="text-xs text-neutral-600">Settings are saved automatically</p>
          <button onClick={onClose} className="btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

