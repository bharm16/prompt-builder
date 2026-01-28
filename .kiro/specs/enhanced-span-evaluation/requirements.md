# Requirements Document

## Introduction

This specification defines enhancements to the span labeling evaluation system. The current system uses GPT-4o as a judge to score span extraction quality but provides only basic error information. The enhanced system will provide detailed diagnostics including error typing, section boundary detection, per-category scoring, confidence correlation analysis, and improved comparison reporting to enable actionable improvements to the span labeling pipeline.

## Priority Levels

- **P0**: Core functionality required for MVP - must be implemented first
- **P1**: Important features that enhance diagnostics - implement after P0
- **P2**: Valuable analysis features - implement after P1
- **P3**: Nice-to-have improvements - implement if time permits

## Glossary

- **Evaluation_System**: The span labeling evaluation script that runs span extraction on prompts and uses an LLM judge to assess quality
- **Judge**: The GPT-4o LLM that evaluates span extraction quality against a rubric
- **Span**: A visual control point extracted from a video prompt - a phrase that would produce visually different output if changed
- **Section**: A structural region of a prompt (main content, technical specs, or alternatives)
- **False_Positive**: A span that was incorrectly extracted (should not have been labeled)
- **Missed_Element**: A visual element that should have been extracted but was not
- **Taxonomy_Error**: A span assigned to the wrong role/category
- **Granularity_Error**: A span with incorrect boundaries (too fine or too coarse)
- **Confidence_Score**: A 0-1 value indicating the span labeling system's certainty about an extraction
- **Snapshot**: A saved evaluation result containing all prompt evaluations and summary statistics
- **Span_Index**: The zero-based index of a span in the extracted spans array, used for reliable matching

## Requirements

### Requirement 1: Enhanced Judge Response Schema (P0)

**User Story:** As a developer, I want detailed error typing in judge responses, so that I can identify which pipeline components cause errors and prioritize fixes.

#### TypeScript Interface

```typescript
interface EnhancedJudgeResult {
  scores: {
    coverage: number;      // 1-5
    precision: number;     // 1-5
    granularity: number;   // 1-5
    taxonomy: number;      // 1-5
    technicalSpecs: number; // 1-5
  };
  totalScore: number;
  
  // Detailed missed elements (was just string[])
  missedElements: Array<{
    text: string;
    expectedRole: string;           // e.g., "subject.wardrobe"
    category: string;               // e.g., "subject"
    severity: 'critical' | 'important' | 'minor';
  }>;
  
  // Detailed false positives - uses spanIndex for reliable matching
  falsePositives: Array<{
    spanIndex: number;              // Index in the spans array (0-based)
    text: string;                   // For human readability
    assignedRole: string;
    reason: 'section_header' | 'abstract_concept' | 'non_visual' | 'instruction_text' | 'duplicate' | 'other';
  }>;
  
  // Taxonomy misclassifications - uses spanIndex for reliable matching
  taxonomyErrors: Array<{
    spanIndex: number;              // Index in the spans array (0-based)
    text: string;                   // For human readability
    assignedRole: string;
    expectedRole: string;
  }>;
  
  // Granularity errors
  granularityErrors: Array<{
    spanIndex: number;              // Index in the spans array (0-based)
    text: string;
    issue: 'too_fine' | 'too_coarse';
    suggestion: string;             // What the span should be
  }>;
  
  // Per-category assessment (all 9 taxonomy categories)
  categoryScores: {
    shot: { coverage: number; precision: number };       // 1-5 each
    subject: { coverage: number; precision: number };
    action: { coverage: number; precision: number };
    environment: { coverage: number; precision: number };
    lighting: { coverage: number; precision: number };
    camera: { coverage: number; precision: number };
    style: { coverage: number; precision: number };
    technical: { coverage: number; precision: number };
    audio: { coverage: number; precision: number };
  };
  
  notes: string;
}
```

#### Acceptance Criteria

1. WHEN the Judge evaluates span extraction, THE Evaluation_System SHALL return missed elements with text, expected role, category, and severity (critical/important/minor)
2. WHEN the Judge identifies false positives, THE Evaluation_System SHALL return the spanIndex, text, assigned role, and reason categorized as one of: section_header, abstract_concept, non_visual, instruction_text, duplicate, or other
3. WHEN the Judge identifies taxonomy misclassifications, THE Evaluation_System SHALL return the spanIndex, text, assigned role, and expected role
4. WHEN the Judge identifies granularity errors, THE Evaluation_System SHALL return the spanIndex, text, issue type (too_fine/too_coarse), and suggested correction
5. WHEN the Judge evaluates a prompt, THE Evaluation_System SHALL return per-category scores (coverage and precision) for all nine taxonomy categories: shot, subject, action, environment, lighting, camera, style, technical, and audio
6. IF the Judge response fails schema validation, THEN THE Evaluation_System SHALL fall back to basic parsing and log the validation error

### Requirement 2: Section Boundary Detection (P1)

**User Story:** As a developer, I want to know which prompt section each error occurs in, so that I can identify if certain sections (headers, technical specs, alternatives) are problematic.

#### TypeScript Interface

```typescript
interface PromptSections {
  main: { start: number; end: number };
  technicalSpecs: { start: number; end: number } | null;
  alternatives: { start: number; end: number } | null;
}

// Base span result (existing interface, extended with optional section)
interface SpanResult {
  text: string;
  role: string;
  confidence: number;
  start: number;
  end: number;
  section?: 'main' | 'technicalSpecs' | 'alternatives';  // Added for section tagging
}

interface EvaluationMetadata {
  promptLength: number;
  sections: PromptSections;
  spansBySection: {
    main: number;
    technicalSpecs: number;
    alternatives: number;
  };
}
```

#### Acceptance Criteria

1. WHEN processing a prompt, THE Evaluation_System SHALL detect section boundaries for main content, technical specs, and alternatives sections
2. WHEN a prompt contains "**TECHNICAL SPECS**" or "**Technical Specifications**" header, THE Evaluation_System SHALL mark the start of the technical specs section
3. WHEN a prompt contains "**ALTERNATIVE" or "**VARIATIONS**" header, THE Evaluation_System SHALL mark the start of the alternatives section
4. WHEN a span is extracted, THE Evaluation_System SHALL tag it with its section based on the span's start offset
5. THE Evaluation_System SHALL use simple regex pattern matching for section detection without LLM calls
6. WHEN evaluation completes, THE Evaluation_System SHALL include EvaluationMetadata with prompt length, section boundaries, and span counts per section

### Requirement 3: Enhanced Snapshot Summary (P1)

**User Story:** As a developer, I want aggregated diagnostics in the snapshot summary, so that I can identify systemic issues across all evaluated prompts.

#### TypeScript Interface

```typescript
interface EnhancedSummary {
  // Existing fields
  avgScore: number;
  avgSpanCount: number;
  scoreDistribution: Record<string, number>;
  errorCount: number;
  
  // Enhanced category scores (all 9 taxonomy categories)
  avgCategoryScores: {
    shot: { coverage: number; precision: number };
    subject: { coverage: number; precision: number };
    action: { coverage: number; precision: number };
    environment: { coverage: number; precision: number };
    lighting: { coverage: number; precision: number };
    camera: { coverage: number; precision: number };
    style: { coverage: number; precision: number };
    technical: { coverage: number; precision: number };
    audio: { coverage: number; precision: number };
  };
  
  // Error aggregations
  falsePositiveReasons: {
    section_header: number;
    abstract_concept: number;
    non_visual: number;
    instruction_text: number;
    duplicate: number;
    other: number;
  };
  
  // Top 10 taxonomy confusions
  topTaxonomyErrors: Array<{
    assignedRole: string;
    expectedRole: string;
    count: number;
  }>;
  
  // Section-level error rates
  errorsBySection: {
    main: { falsePositives: number; missed: number };
    technicalSpecs: { falsePositives: number; missed: number };
    alternatives: { falsePositives: number; missed: number };
  };
}
```

#### Acceptance Criteria

1. WHEN computing the snapshot summary, THE Evaluation_System SHALL aggregate average category scores for all nine taxonomy categories (shot, subject, action, environment, lighting, camera, style, technical, audio)
2. WHEN computing the snapshot summary, THE Evaluation_System SHALL count false positive reasons by type (section_header, abstract_concept, non_visual, instruction_text, duplicate, other)
3. WHEN computing the snapshot summary, THE Evaluation_System SHALL identify the top 10 taxonomy confusions as pairs of (assigned role, expected role) with occurrence counts
4. WHEN computing the snapshot summary, THE Evaluation_System SHALL aggregate error counts by section (main, technical specs, alternatives)
5. WHEN loading old snapshots without enhanced fields, THE Evaluation_System SHALL handle missing fields gracefully with default values

### Requirement 4: Confidence Correlation Analysis (P2)

**User Story:** As a developer, I want to understand if confidence scores predict errors, so that I can tune confidence thresholds to filter unreliable extractions.

#### TypeScript Interface

```typescript
interface ConfidenceAnalysis {
  buckets: {
    high: { range: [0.8, 1.0]; total: number; errors: number; errorRate: number };
    medium: { range: [0.6, 0.8]; total: number; errors: number; errorRate: number };
    low: { range: [0.0, 0.6]; total: number; errors: number; errorRate: number };
  };
  recommendedThreshold: number | null;
  notes: string;
}
```

#### Acceptance Criteria

1. WHEN evaluation completes, THE Evaluation_System SHALL compute error rates for confidence buckets: high (0.8-1.0), medium (0.6-0.8), and low (0.0-0.6)
2. WHEN computing confidence correlation, THE Evaluation_System SHALL use spanIndex from false positives to retrieve confidence scores from the original spans array
3. WHEN confidence analysis shows error rate above 50% for a bucket, THE Evaluation_System SHALL recommend raising the threshold above that bucket's lower bound
4. THE Evaluation_System SHALL include total span count and error count for each confidence bucket

### Requirement 5: Enhanced Comparison Report (P3)

**User Story:** As a developer, I want to see detailed changes between snapshots, so that I can understand the impact of pipeline changes on specific categories and error types.

#### Acceptance Criteria

1. WHEN comparing snapshots, THE Evaluation_System SHALL report per-category score changes (not just overall score)
2. WHEN comparing snapshots, THE Evaluation_System SHALL identify new and resolved taxonomy confusions from the top 10 lists
3. WHEN comparing snapshots, THE Evaluation_System SHALL report section error rate changes
4. WHEN comparing snapshots with old format (missing enhanced fields), THE Evaluation_System SHALL handle missing fields gracefully and report only available metrics

### Requirement 6: Judge Prompt Enhancement (P0)

**User Story:** As a developer, I want the judge prompt to request detailed error information, so that the enhanced response schema is properly populated.

#### Acceptance Criteria

1. WHEN the Judge prompt is sent, THE Evaluation_System SHALL request the enhanced response format with all new fields including spanIndex references
2. WHEN the Judge prompt is sent, THE Evaluation_System SHALL explain each error type with examples
3. WHEN the Judge prompt is sent, THE Evaluation_System SHALL require role assignments for all missed and incorrect elements
4. WHEN sending spans to the Judge, THE Evaluation_System SHALL format each span with its index, text, role, and confidence (e.g., "[0] 'Medium Shot' (shot.type, 0.95)")
5. WHEN the Judge prompt is sent, THE Evaluation_System SHALL instruct the judge to use span indices (0-based) for referencing extracted spans in error arrays
6. THE Evaluation_System SHALL validate judge responses fit within GPT-4o token limits (max 4096 output tokens)
