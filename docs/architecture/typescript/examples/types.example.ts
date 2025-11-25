/**
 * Example Types File
 * 
 * This file demonstrates the patterns for defining TypeScript types
 * in the Prompt Builder codebase. Copy and adapt for your features.
 */

// ===========================================
// COMPONENT PROPS
// ===========================================

/**
 * Props for the VideoBuilder component
 * - Required props have no `?`
 * - Optional props use `?`
 * - Callbacks should be fully typed
 */
export interface VideoBuilderProps {
  /** Called when video concept is complete */
  onComplete: (result: VideoResult) => void;
  
  /** Current optimization mode */
  mode: OptimizationMode;
  
  /** Initial prompt to pre-fill (optional) */
  initialPrompt?: string;
  
  /** Custom class name for styling */
  className?: string;
  
  /** Whether the builder is in read-only mode */
  readOnly?: boolean;
}

// ===========================================
// COMPONENT STATE
// ===========================================

/**
 * Internal state for VideoBuilder
 * - All fields required (no undefined in state)
 * - Use specific types, not `any`
 */
export interface VideoBuilderState {
  /** Current wizard step (0-indexed) */
  currentStep: number;
  
  /** Form data collected across steps */
  formData: VideoFormData;
  
  /** Validation errors by field */
  errors: ValidationError[];
  
  /** Whether form is being submitted */
  isSubmitting: boolean;
  
  /** AI-generated suggestions */
  suggestions: string[];
}

// ===========================================
// DOMAIN OBJECTS
// ===========================================

/**
 * Video form data structure
 * - Required fields for minimum viable prompt
 * - Optional fields for enhanced prompts
 */
export interface VideoFormData {
  subject: string;
  action: string;
  location: string;
  
  // Optional enhancements
  atmosphere?: AtmosphereData;
  technical?: TechnicalData;
  metadata?: PromptMetadata;
}

export interface AtmosphereData {
  mood: string;
  lighting: string;
  timeOfDay?: string;
  weather?: string;
}

export interface TechnicalData {
  duration: number;
  aspectRatio: AspectRatio;
  frameRate: number;
  style: VideoStyle;
}

export interface PromptMetadata {
  createdAt: string;
  updatedAt: string;
  version: number;
  tags: string[];
}

// ===========================================
// RESULT TYPES
// ===========================================

/**
 * Result returned when video concept is complete
 */
export interface VideoResult {
  /** Unique identifier */
  id: string;
  
  /** Generated video concept text */
  concept: string;
  
  /** Parsed elements from the concept */
  elements: VideoElements;
  
  /** AI confidence score (0-1) */
  confidence: number;
  
  /** ISO timestamp */
  createdAt: string;
}

export interface VideoElements {
  subject: string;
  action: string;
  location: string;
  atmosphere?: string;
  camera?: string;
}

// ===========================================
// VALIDATION
// ===========================================

export interface ValidationError {
  /** Which field has the error */
  field: keyof VideoFormData;
  
  /** Human-readable error message */
  message: string;
  
  /** Error code for programmatic handling */
  code?: ValidationErrorCode;
}

// ===========================================
// UNION TYPES (Enums alternative)
// ===========================================

/**
 * Optimization modes available in the app
 * Using `as const` array + type derivation for:
 * - Runtime array for validation/iteration
 * - Compile-time union type
 */
export const OPTIMIZATION_MODES = ['video', 'research', 'creative', 'standard'] as const;
export type OptimizationMode = typeof OPTIMIZATION_MODES[number];

export const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '21:9'] as const;
export type AspectRatio = typeof ASPECT_RATIOS[number];

export const VIDEO_STYLES = ['cinematic', 'documentary', 'abstract', 'realistic'] as const;
export type VideoStyle = typeof VIDEO_STYLES[number];

export const VALIDATION_ERROR_CODES = [
  'REQUIRED',
  'MIN_LENGTH',
  'MAX_LENGTH',
  'INVALID_FORMAT',
  'CUSTOM',
] as const;
export type ValidationErrorCode = typeof VALIDATION_ERROR_CODES[number];

// ===========================================
// REDUCER ACTIONS (Discriminated Union)
// ===========================================

/**
 * Actions for VideoBuilder reducer
 * 
 * Pattern: Discriminated union
 * - Each action has unique `type` literal
 * - Payload is specific to action type
 * - TypeScript narrows in switch statements
 */
export type VideoBuilderAction =
  | SetFieldAction
  | SetErrorsAction
  | NavigationAction
  | SubmitAction
  | ResetAction;

interface SetFieldAction {
  type: 'SET_FIELD';
  field: keyof VideoFormData;
  value: string;
}

interface SetErrorsAction {
  type: 'SET_ERRORS';
  errors: ValidationError[];
}

interface NavigationAction {
  type: 'NEXT_STEP' | 'PREV_STEP' | 'GO_TO_STEP';
  step?: number; // Only for GO_TO_STEP
}

interface SubmitAction {
  type: 'SUBMIT_START' | 'SUBMIT_SUCCESS' | 'SUBMIT_ERROR';
  result?: VideoResult; // Only for SUBMIT_SUCCESS
  error?: string; // Only for SUBMIT_ERROR
}

interface ResetAction {
  type: 'RESET';
}

// ===========================================
// GENERIC TYPES
// ===========================================

/**
 * Generic async operation state
 * Reusable across features
 */
export interface AsyncState<T, E = Error> {
  data: T | null;
  isLoading: boolean;
  error: E | null;
}

/**
 * Generic paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: ApiError;
  metadata?: {
    requestId: string;
    timestamp: string;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ===========================================
// UTILITY TYPES
// ===========================================

/**
 * Make all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extract keys of type T that are strings
 */
export type StringKeys<T> = {
  [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];

/**
 * Make specific keys required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

// ===========================================
// TYPE GUARDS
// ===========================================

/**
 * Type guard for VideoFormData
 * Use when validating unknown data
 */
export function isVideoFormData(data: unknown): data is VideoFormData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  
  const obj = data as Record<string, unknown>;
  
  return (
    typeof obj.subject === 'string' &&
    typeof obj.action === 'string' &&
    typeof obj.location === 'string'
  );
}

/**
 * Type guard for ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  
  const obj = error as Record<string, unknown>;
  
  return (
    typeof obj.code === 'string' &&
    typeof obj.message === 'string'
  );
}

/**
 * Type guard for OptimizationMode
 */
export function isOptimizationMode(value: string): value is OptimizationMode {
  return OPTIMIZATION_MODES.includes(value as OptimizationMode);
}
