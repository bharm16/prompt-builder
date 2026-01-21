import type { IconProps } from '@promptstudio/system/components/ui';
import type { User } from '@hooks/types';
import type { FormData } from '@/PromptImprovementForm';
import type { PromptContext } from '@utils/PromptContext/PromptContext';
import type { CapabilityValues } from '@shared/capabilities';
import type { SuggestionItem, SuggestionPayload } from './PromptCanvas/types';
import type { CoherenceIssue } from './components/coherence/useCoherenceAnnotations';
import type { CoherenceRecommendation } from './types/coherence';

/**
 * Prompt optimization mode configuration
 */
export interface PromptMode {
  id: string;
  name: string;
  icon: IconProps['icon'];
  description?: string;
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

export interface OptimizationOptions {
  skipCache?: boolean;
  generationParams?: CapabilityValues;
  compileOnly?: boolean;
  compilePrompt?: string;
  createVersion?: boolean;
}

export interface LockedSpan {
  id: string;
  text: string;
  leftCtx?: string;
  rightCtx?: string;
  category?: string;
  source?: string;
  confidence?: number;
}

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
  hoveredSpanId?: string | null;
  primaryVisible?: boolean;
}

/**
 * Props for PromptEditor component
 */
export interface PromptEditorProps {
  className?: string;
  onTextSelection: (e: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onCopyEvent: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  onInput: (e: React.FormEvent<HTMLDivElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLDivElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLDivElement>) => void;
}

/**
 * Props for LoadingSkeleton component
 */
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
  user: User | null;
  onDisplayedPromptChange: (text: string) => void;
  onReoptimize: (promptToOptimize?: string, options?: OptimizationOptions) => Promise<void>;
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
  coherenceAffectedSpanIds?: Set<string>;
  coherenceSpanIssueMap?: Map<string, 'conflict' | 'harmonization'>;

  // Coherence panel (inline, collapsible)
  coherenceIssues?: CoherenceIssue[];
  isCoherenceChecking?: boolean;
  isCoherencePanelExpanded?: boolean;
  onToggleCoherencePanelExpanded?: () => void;
  onDismissCoherenceIssue?: (issueId: string) => void;
  onDismissAllCoherenceIssues?: () => void;
  onApplyCoherenceFix?: (
    issueId: string,
    recommendation: CoherenceRecommendation
  ) => void;
  onScrollToCoherenceSpan?: (spanId: string) => void;
}

/**
 * Props for PromptSidebar component
 */
export interface PromptSidebarProps {
  user: User | null;
}

// Re-export User type for convenience
export type { User };
