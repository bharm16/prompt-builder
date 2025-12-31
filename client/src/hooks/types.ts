export interface Span {
  text: string;
  start: number;
  end: number;
  category?: string;
  confidence?: number;
}

export interface ValidationIssue {
  type: string;
  missingParent?: string;
  affectedSpans?: Span[];
  message: string;
  count?: number;
}

export interface ValidationSuggestion {
  action: string;
  parentCategory?: string;
  message: string;
  example?: string;
  priority?: string;
}

export interface ValidationResult {
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
  suggestions: ValidationSuggestion[];
  isValid: boolean;
  hasOrphans: boolean;
  orphanCount: number;
}

export interface HierarchyValidationOptions {
  enabled?: boolean;
  strictMode?: boolean;
  showSuggestions?: boolean;
}

export interface CanAddCategoryResult {
  canAdd: boolean;
  warning: string | null;
  missingParent: string | null;
}

export interface PromptDebuggerState {
  inputPrompt: string;
  displayedPrompt?: string;
  optimizedPrompt?: string;
  selectedMode?: string;
  promptContext?: unknown;
  highlights?: Highlight[];
}

export interface Highlight {
  text: string;
  category?: string;
  confidence?: number;
}

export interface User {
  uid: string;
  [key: string]: unknown;
}

export interface PromptHistoryEntry {
  id?: string;
  uuid?: string;
  timestamp?: string;
  input: string;
  output: string;
  score?: number | null;
  mode?: string;
  targetModel?: string | null;
  brainstormContext?: unknown | null;
  highlightCache?: unknown | null;
  versions?: unknown[];
}

export interface Toast {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}
