export type FontSize = 'small' | 'medium' | 'large';
export type ExportFormat = 'text' | 'markdown' | 'json';

export interface AppSettings {
  darkMode: boolean;
  fontSize: FontSize;
  autoSave: boolean;
  exportFormat: ExportFormat;
}

export interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetSettings: () => void;
  onClearAllData?: () => void;
}
