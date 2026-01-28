export const SECTION_NAMES = ['main', 'technicalSpecs', 'alternatives'] as const;
export type SectionName = (typeof SECTION_NAMES)[number];

export interface PromptSections {
  main: { start: number; end: number };
  technicalSpecs: { start: number; end: number } | null;
  alternatives: { start: number; end: number } | null;
}

export interface JudgeScores {
  coverage: number;
  precision: number;
  granularity: number;
  taxonomy: number;
  technicalSpecs: number;
}

export const MISSED_SEVERITIES = ['critical', 'important', 'minor'] as const;
export type MissedSeverity = (typeof MISSED_SEVERITIES)[number];

export interface MissedElement {
  text: string;
  expectedRole: string;
  category: string;
  severity: MissedSeverity;
}

export const GRANULARITY_ERROR_TYPES = ['too_fine', 'too_coarse', 'other'] as const;
export type GranularityErrorType = (typeof GRANULARITY_ERROR_TYPES)[number];

export interface GranularityError {
  text: string;
  spanIndex?: number | null;
  reason: GranularityErrorType;
}

export const FALSE_POSITIVE_REASONS = [
  'section_header',
  'abstract_concept',
  'non_visual',
  'instruction_text',
  'duplicate',
  'other',
] as const;
export type FalsePositiveReason = (typeof FALSE_POSITIVE_REASONS)[number];

export interface FalsePositive {
  text: string;
  assignedRole: string;
  reason: FalsePositiveReason;
  spanIndex?: number | null;
}

export interface TaxonomyError {
  text: string;
  assignedRole: string;
  expectedRole: string;
  spanIndex?: number | null;
}

export const CATEGORY_NAMES = [
  'shot',
  'subject',
  'action',
  'environment',
  'lighting',
  'camera',
  'style',
  'technical',
  'audio',
] as const;
export type CategoryName = (typeof CATEGORY_NAMES)[number];

export interface CategoryScore {
  coverage: number;
  precision: number;
}

export type CategoryScores = Record<CategoryName, CategoryScore>;

export interface EnhancedJudgeResult {
  scores: JudgeScores;
  totalScore: number;
  missedElements: MissedElement[];
  falsePositives: FalsePositive[];
  taxonomyErrors: TaxonomyError[];
  granularityErrors: GranularityError[];
  categoryScores: CategoryScores;
  notes: string;
}

export interface LegacyJudgeResult {
  scores: JudgeScores;
  totalScore: number;
  missedElements?: string[];
  incorrectExtractions?: string[];
  notes?: string;
}

export type AnyJudgeResult = EnhancedJudgeResult | LegacyJudgeResult;

export interface PromptRecord {
  id: string;
  input: string;
  output: string;
  timestamp?: string;
  generatedAt?: string;
  error?: string | null;
}

export interface EvaluationDataset {
  metadata?: {
    generatedAt: string;
    promptCount: number;
  };
  prompts?: PromptRecord[];
}

export interface SpanResult {
  text: string;
  role: string;
  confidence: number;
  start: number;
  end: number;
  section?: SectionName;
}

export interface SpanLabelingMeta {
  version: string;
  notes: string;
  source?: string;
  closedVocab?: number;
  openVocab?: number;
  latency?: number;
  tier1Latency?: number;
  tier2Latency?: number;
  optimization?: Record<string, unknown>;
}

export interface EvaluationResult {
  promptId: string;
  input: string;
  output: string;
  spanCount: number;
  spans: SpanResult[];
  meta: SpanLabelingMeta | null;
  judgeResult: AnyJudgeResult | null;
  error: string | null;
  latencyMs: number;
  sections?: PromptSections;
}

export interface FalsePositiveReasonCounts {
  section_header: number;
  abstract_concept: number;
  non_visual: number;
  instruction_text: number;
  duplicate: number;
  other: number;
}

export interface ErrorsBySection {
  main: { falsePositives: number; missed: number };
  technicalSpecs: { falsePositives: number; missed: number };
  alternatives: { falsePositives: number; missed: number };
}

export interface ConfidenceAnalysis {
  buckets: {
    high: { range: [number, number]; total: number; errors: number; errorRate: number };
    medium: { range: [number, number]; total: number; errors: number; errorRate: number };
    low: { range: [number, number]; total: number; errors: number; errorRate: number };
  };
  recommendedThreshold: number | null;
  notes: string;
}

export interface SnapshotSummary {
  avgScore: number;
  avgSpanCount: number;
  scoreDistribution: Record<string, number>;
  commonMissedElements?: string[];
  commonIncorrectExtractions?: string[];
  errorCount: number;
  pipelineSources?: {
    nlp: number;
    llm: number;
    unknown: number;
  };
  spanSources?: {
    closedVocab: number;
    openVocab: number;
    llm: number;
  };
  avgCategoryScores?: CategoryScores;
  falsePositiveReasons?: FalsePositiveReasonCounts;
  topTaxonomyErrors?: Array<{
    assignedRole: string;
    expectedRole: string;
    count: number;
  }>;
  topGranularityErrors?: Array<{
    reason: GranularityErrorType;
    count: number;
    examples: string[];
  }>;
  errorsBySection?: ErrorsBySection;
  confidenceAnalysis?: ConfidenceAnalysis;
  latencyStats?: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  missedCountsByCategory?: Record<string, number>;
}

export interface Snapshot {
  timestamp: string;
  promptCount: number;
  sourceFile: string;
  judgeModel?: string;
  results: EvaluationResult[];
  summary: SnapshotSummary;
}
