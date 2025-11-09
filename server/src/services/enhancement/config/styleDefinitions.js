/**
 * Style definitions for style transfer
 */

export const STYLE_DEFINITIONS = {
  technical: {
    formality: 'high',
    jargon: 'specialized',
    structure: 'systematic',
    tone: 'objective',
    examples: 'code snippets, specifications, metrics',
  },
  creative: {
    formality: 'low',
    jargon: 'accessible',
    structure: 'flowing',
    tone: 'engaging',
    examples: 'metaphors, imagery, narrative',
  },
  academic: {
    formality: 'high',
    jargon: 'scholarly',
    structure: 'argumentative',
    tone: 'authoritative',
    examples: 'citations, evidence, analysis',
  },
  casual: {
    formality: 'low',
    jargon: 'everyday',
    structure: 'conversational',
    tone: 'friendly',
    examples: 'personal anecdotes, simple comparisons',
  },
  formal: {
    formality: 'high',
    jargon: 'professional',
    structure: 'hierarchical',
    tone: 'respectful',
    examples: 'case studies, reports, documentation',
  },
};

/**
 * Default style if target style not found
 */
export const DEFAULT_STYLE = 'formal';

