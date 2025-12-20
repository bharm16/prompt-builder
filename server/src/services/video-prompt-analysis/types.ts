/**
 * Types for video prompt analysis services
 * Shared type definitions used across video prompt analysis modules
 */

/**
 * Constraint configuration
 */
export interface ConstraintConfig {
  mode: string;
  minWords: number;
  maxWords: number;
  maxSentences: number;
  slotDescriptor: string;
  disallowTerminalPunctuation?: boolean;
  formRequirement?: string;
  focusGuidance?: string[];
  extraRequirements?: string[];
}

/**
 * Constraint generation details
 */
export interface ConstraintDetails {
  highlightWordCount?: number | undefined;
  phraseRole?: string | null | undefined;
  highlightedText?: string | undefined;
  highlightedCategory?: string | null | undefined;
  highlightedCategoryConfidence?: number | null | undefined;
}

/**
 * Constraint generation options
 */
export interface ConstraintOptions {
  forceMode?: string;
}

/**
 * Span object for guidance analysis
 */
export interface GuidanceSpan {
  category?: string;
  text?: string;
  [key: string]: unknown;
}

/**
 * Edit history entry
 */
export interface EditHistoryEntry {
  category?: string;
  original?: string;
  replacement?: string;
}

/**
 * Existing elements analysis result
 */
export interface ExistingElements {
  timeOfDay: string | null;
  location: string | null;
  mood: string | null;
  subject: {
    core: string;
    appearance: boolean;
    emotion: boolean;
    details: boolean;
  };
  lighting: {
    direction: boolean;
    quality: boolean;
    temperature: boolean;
    intensity: boolean;
  };
  camera: {
    movement: boolean;
    lens: boolean;
    angle: boolean;
    framing: boolean;
  };
  action: string;
  style: string | null;
}

/**
 * Category relationships analysis
 */
export interface CategoryRelationships {
  constraints: string[];
  opportunities: string[];
}

