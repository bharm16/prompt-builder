import type {
  AIService,
  BrainstormContext,
  DiversityEnforcer,
  EnhancementEngineVersion,
  EnhancementResult,
  Suggestion,
  VideoConstraints,
  VideoService,
} from "../services/types.js";

export type GenerationMode = "enumerated" | "templated" | "guided_llm";

export type GrammarKind =
  | "adjective_phrase"
  | "adverb_phrase"
  | "noun_phrase"
  | "technical_phrase"
  | "time_phrase"
  | "verb_phrase"
  | "freeform";

export type SemanticFamily =
  | "action"
  | "audio"
  | "camera_angle"
  | "camera_focus"
  | "camera_lens"
  | "camera_movement"
  | "environment_context"
  | "environment_location"
  | "environment_weather"
  | "lighting_direction"
  | "lighting_quality"
  | "lighting_source"
  | "lighting_time_of_day"
  | "shot_type"
  | "style_aesthetic"
  | "style_color_grade"
  | "style_film_stock"
  | "subject_appearance"
  | "subject_identity"
  | "technical_aspect_ratio"
  | "technical_duration"
  | "technical_frame_rate"
  | "technical_resolution"
  | "visual_abstract";

export interface SlotGrammar {
  kind: GrammarKind;
  minWords: number;
  maxWords: number;
}

export interface EnumeratedOption {
  text: string;
  families?: SemanticFamily[];
}

export interface TemplateDefinition {
  name: string;
  orderedSlots: string[];
}

export interface TemplatedPolicyConfig {
  templates: TemplateDefinition[];
  slots: Record<string, string[]>;
  requiredSlots?: string[];
  optionalSlots?: string[];
  invalidCombinations?: Array<Record<string, string[]>>;
  renderRules?: {
    joinWith?: string;
    dedupeCaseInsensitive?: boolean;
  };
  dedupeRules?: {
    normalizeHyphenation?: boolean;
    trimWhitespace?: boolean;
  };
}

export interface RescueStrategy {
  enabled: boolean;
  maxCalls: number;
}

export interface ScorerWeights {
  familyFit: number;
  contextFit: number;
  literalness: number;
  overlapPenalty: number;
}

export interface SlotPolicy {
  categoryId: string;
  mode: GenerationMode;
  grammar: SlotGrammar;
  targetCount: number;
  minAcceptableCount: number;
  requiredFamilies: SemanticFamily[];
  forbiddenFamilies: SemanticFamily[];
  promptGuidance: string;
  rescueStrategy?: RescueStrategy;
  enumeratedOptions?: EnumeratedOption[];
  templated?: TemplatedPolicyConfig;
  scorerWeights?: ScorerWeights;
}

export interface EnhancementV2Config {
  defaultEngine: EnhancementEngineVersion;
  legacyV1Enabled: boolean;
  policyVersion: string;
}

export interface EnhancementV2RequestContext {
  highlightedText: string;
  contextBefore: string;
  contextAfter: string;
  fullPrompt: string;
  originalUserPrompt: string;
  brainstormContext: BrainstormContext | null;
  highlightedCategory: string | null;
  highlightedCategoryConfidence: number | null;
  isPlaceholder: boolean;
  isVideoPrompt: boolean;
  phraseRole: string | null;
  highlightWordCount: number;
  videoConstraints: VideoConstraints | null;
  modelTarget: string | null;
  promptSection: string | null;
  spanAnchors: string;
  nearbySpanHints: string;
  lockedSpanCategories: string[];
  focusGuidance?: string[];
  debug: boolean;
}

export interface CandidateScoreBreakdown {
  familyFit: number;
  contextFit: number;
  literalness: number;
  overlapPenalty: number;
  total: number;
}

export interface CandidateEvaluation {
  suggestion: Suggestion;
  accepted: boolean;
  score: CandidateScoreBreakdown;
  reasons: string[];
}

export interface EnhancementV2DebugPayload {
  engineVersion: "v2";
  policyVersion: string;
  categoryId: string;
  mode: GenerationMode;
  stageCounts: Record<string, number>;
  rejectionSummary: Record<string, number>;
  modelCallCount: number;
  systemPromptSent?: string;
}

export interface EnhancementV2Execution {
  result: EnhancementResult;
  rawSuggestions: Suggestion[];
  finalSuggestions: Suggestion[];
  debug: EnhancementV2DebugPayload;
}

export interface EnhancementV2Dependencies {
  aiService: AIService;
  videoPromptService: VideoService;
  diversityEnforcer: DiversityEnforcer;
  policyVersion: string;
}
