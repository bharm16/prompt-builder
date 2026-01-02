import type { LucideIcon } from 'lucide-react';
import type { User } from '@hooks/types';
import type { FormData } from '@/PromptImprovementForm';
import type { PromptContext } from '@utils/PromptContext/PromptContext';
import type { SuggestionItem, SuggestionPayload } from './PromptCanvas/types';

/**
 * Prompt optimization mode configuration
 */
export interface PromptMode {
  id: string;
  name: string;
  icon: LucideIcon;
  description?: string;
}

/**
 * Props for ModeDropdown component
 */
export interface ModeDropdownProps {
  modes: PromptMode[];
  selectedMode: string;
  onModeChange: (modeId: string) => void;
}

/**
 * Props for PromptInput component
 */
export interface PromptInputProps {
  inputPrompt: string;
  onInputChange: (value: string) => void;
  selectedMode: string;
  onModeChange: (modeId: string) => void;
  selectedModel?: string; // New: selected video model
  onModelChange?: (modelId: string) => void; // New: handler for model change
  onOptimize: () => void;
  onShowBrainstorm?: () => void;
  isProcessing: boolean;
  modes: PromptMode[];
  aiNames?: readonly string[];
  currentAIIndex?: number;
}

/**
 * Props for CategoryLegend component
 */
export interface CategoryLegendProps {
  show: boolean;
  onClose: () => void;
  hasContext?: boolean;
  isSuggestionsOpen?: boolean;
}

/**
 * Export format type
 */
export type ExportFormat = 'text' | 'markdown' | 'json';

/**
 * Props for FloatingToolbar component
 */
export interface FloatingToolbarProps {
  onCopy: () => void;
  onExport: (format: ExportFormat) => void;
  onCreateNew: () => void;
  onShare: () => void;
  copied: boolean;
  shared: boolean;
  showExportMenu: boolean;
  onToggleExportMenu: (show: boolean) => void;
  showLegend: boolean;
  onToggleLegend: (show: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  promptText?: string;
  showModelMenu: boolean;
  onToggleModelMenu: (show: boolean) => void;
  hoveredSpanId?: string | null;
}

/**
 * Props for PromptEditor component
 */
export interface PromptEditorProps {
  onTextSelection: (e: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onCopyEvent: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  onInput: (e: React.FormEvent<HTMLDivElement>) => void;
}

/**
 * Props for PromptInputSection component
 */
export interface PromptInputSectionProps {
  aiNames?: readonly string[];
  onOptimize: () => void;
  onShowBrainstorm?: () => void;
}

/**
 * Props for LoadingSkeleton component
 */
export interface LoadingSkeletonProps {
  selectedMode: string;
}

/**
 * Props for PromptModals component
 */
export interface PromptModalsProps {
  onImprovementComplete?: (enhancedPrompt: string, formData: FormData) => void;
  onConceptComplete?: (
    finalConcept: string,
    elements: Record<string, unknown>,
    metadata: Record<string, unknown>
  ) => void;
  onSkipBrainstorm?: () => void;
}

/**
 * Props for PromptResultsSection component
 */
export interface PromptResultsSectionProps {
  onDisplayedPromptChange: (text: string) => void;
  onReoptimize: (promptToOptimize?: string) => Promise<void>;
  onFetchSuggestions: (payload?: SuggestionPayload) => void;
  onSuggestionClick: (suggestion: SuggestionItem | string) => void;
  onHighlightsPersist: (highlights: {
    spans: Array<{ start: number; end: number; category: string; confidence: number }>;
    meta: Record<string, unknown> | null;
    signature: string;
    cacheId?: string | null;
    source?: string;
    [key: string]: unknown;
  }) => void;
  onUndo: () => void;
  onRedo: () => void;
  stablePromptContext?: PromptContext | null;
}

/**
 * Props for PromptSidebar component
 */
export interface PromptSidebarProps {
  user: User | null;
}

// Re-export User type for convenience
export type { User };
