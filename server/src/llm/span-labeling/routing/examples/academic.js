/**
 * Academic Example Bank - Research and Formal Language
 * 
 * Examples focused on scholarly writing, research terminology, citations,
 * methodology descriptions, and formal academic concepts. Helps the model
 * correctly identify technical terms, research elements, and academic structures.
 * 
 * From PDF: Context-aware example selection for different writing domains.
 */

export const academicExamples = [
  {
    input: "According to Smith et al. (2023), the methodology employed a mixed-methods approach",
    output: {
      spans: [
        { text: "Smith et al. (2023)", role: "reference.citation", confidence: 0.95 },
        { text: "methodology", role: "academic.concept", confidence: 0.9 },
        { text: "mixed-methods approach", role: "academic.method", confidence: 0.9 }
      ],
      meta: {
        version: "v3.0",
        notes: "Academic citation and methodology terminology"
      }
    },
    domains: ['academic', 'research'],
    keywords: ['citation', 'et al', 'methodology', 'mixed-methods', 'approach'],
    ambiguity: 'citation_format'
  },

  {
    input: "The hypothesis posits that increased neural plasticity correlates with cognitive enhancement",
    output: {
      spans: [
        { text: "hypothesis", role: "academic.concept", confidence: 0.95 },
        { text: "neural plasticity", role: "academic.term", confidence: 0.9 },
        { text: "correlates with", role: "academic.relationship", confidence: 0.85 },
        { text: "cognitive enhancement", role: "academic.term", confidence: 0.9 }
      ],
      meta: {
        version: "v3.0",
        notes: "Scientific hypothesis with technical terminology"
      }
    },
    domains: ['academic', 'scientific'],
    keywords: ['hypothesis', 'neural', 'plasticity', 'correlates', 'cognitive'],
    ambiguity: 'scientific_terminology'
  },

  {
    input: "Statistical analysis revealed a significant p-value of 0.03 with 95% confidence interval",
    output: {
      spans: [
        { text: "Statistical analysis", role: "academic.method", confidence: 0.95 },
        { text: "significant", role: "academic.qualifier", confidence: 0.85 },
        { text: "p-value of 0.03", role: "data.statistic", confidence: 0.95 },
        { text: "95% confidence interval", role: "data.statistic", confidence: 0.95 }
      ],
      meta: {
        version: "v3.0",
        notes: "Statistical terminology and quantitative measures"
      }
    },
    domains: ['academic', 'statistics', 'research'],
    keywords: ['statistical', 'analysis', 'p-value', 'confidence interval', 'significant'],
    ambiguity: 'statistical_measures'
  },

  {
    input: "The literature review synthesizes findings from 47 peer-reviewed publications",
    output: {
      spans: [
        { text: "literature review", role: "academic.section", confidence: 0.95 },
        { text: "synthesizes", role: "academic.action", confidence: 0.85 },
        { text: "findings", role: "academic.concept", confidence: 0.85 },
        { text: "47 peer-reviewed publications", role: "reference.source", confidence: 0.9 }
      ],
      meta: {
        version: "v3.0",
        notes: "Academic paper structure and source description"
      }
    },
    domains: ['academic', 'research'],
    keywords: ['literature review', 'synthesizes', 'peer-reviewed', 'publications', 'findings'],
    ambiguity: 'academic_structure'
  },

  {
    input: "Participants (N=156) were randomly assigned to control and experimental groups",
    output: {
      spans: [
        { text: "Participants", role: "academic.subject", confidence: 0.9 },
        { text: "N=156", role: "data.sample", confidence: 0.95 },
        { text: "randomly assigned", role: "academic.method", confidence: 0.9 },
        { text: "control", role: "academic.group", confidence: 0.9 },
        { text: "experimental groups", role: "academic.group", confidence: 0.9 }
      ],
      meta: {
        version: "v3.0",
        notes: "Research methodology and sample description"
      }
    },
    domains: ['academic', 'research', 'methodology'],
    keywords: ['participants', 'sample size', 'randomly assigned', 'control', 'experimental'],
    ambiguity: 'research_design'
  },

  {
    input: "The theoretical framework draws on Vygotsky's sociocultural theory and constructivism",
    output: {
      spans: [
        { text: "theoretical framework", role: "academic.concept", confidence: 0.95 },
        { text: "Vygotsky", role: "reference.scholar", confidence: 0.95 },
        { text: "sociocultural theory", role: "academic.theory", confidence: 0.95 },
        { text: "constructivism", role: "academic.theory", confidence: 0.95 }
      ],
      meta: {
        version: "v3.0",
        notes: "Theoretical underpinnings and scholarly references"
      }
    },
    domains: ['academic', 'theory'],
    keywords: ['theoretical', 'framework', 'vygotsky', 'sociocultural', 'constructivism'],
    ambiguity: 'theoretical_foundations'
  },

  {
    input: "Data collection employed semi-structured interviews and thematic analysis",
    output: {
      spans: [
        { text: "Data collection", role: "academic.process", confidence: 0.9 },
        { text: "semi-structured interviews", role: "academic.method", confidence: 0.95 },
        { text: "thematic analysis", role: "academic.method", confidence: 0.95 }
      ],
      meta: {
        version: "v3.0",
        notes: "Qualitative research methods"
      }
    },
    domains: ['academic', 'research', 'methodology'],
    keywords: ['data collection', 'interviews', 'thematic analysis', 'semi-structured'],
    ambiguity: 'qualitative_methods'
  },

  {
    input: "The findings suggest a causal relationship, though limitations include sample bias",
    output: {
      spans: [
        { text: "findings", role: "academic.result", confidence: 0.9 },
        { text: "causal relationship", role: "academic.relationship", confidence: 0.95 },
        { text: "limitations", role: "academic.concept", confidence: 0.9 },
        { text: "sample bias", role: "academic.limitation", confidence: 0.9 }
      ],
      meta: {
        version: "v3.0",
        notes: "Results interpretation and methodological limitations"
      }
    },
    domains: ['academic', 'research'],
    keywords: ['findings', 'causal', 'relationship', 'limitations', 'bias'],
    ambiguity: 'results_and_limitations'
  },

  {
    input: "The construct validity was assessed through confirmatory factor analysis (CFA)",
    output: {
      spans: [
        { text: "construct validity", role: "academic.concept", confidence: 0.95 },
        { text: "assessed", role: "academic.action", confidence: 0.85 },
        { text: "confirmatory factor analysis", role: "academic.method", confidence: 0.95 },
        { text: "CFA", role: "academic.abbreviation", confidence: 0.9 }
      ],
      meta: {
        version: "v3.0",
        notes: "Psychometric validation and statistical methods"
      }
    },
    domains: ['academic', 'statistics', 'methodology'],
    keywords: ['construct validity', 'confirmatory', 'factor analysis', 'CFA'],
    ambiguity: 'validation_methods'
  },

  {
    input: "The meta-analysis aggregated effect sizes (Cohen's d) across 23 studies",
    output: {
      spans: [
        { text: "meta-analysis", role: "academic.method", confidence: 0.95 },
        { text: "aggregated", role: "academic.action", confidence: 0.85 },
        { text: "effect sizes", role: "data.statistic", confidence: 0.9 },
        { text: "Cohen's d", role: "data.statistic", confidence: 0.95 },
        { text: "23 studies", role: "reference.source", confidence: 0.85 }
      ],
      meta: {
        version: "v3.0",
        notes: "Meta-analytic terminology and effect size measures"
      }
    },
    domains: ['academic', 'statistics', 'meta-analysis'],
    keywords: ['meta-analysis', 'effect sizes', 'cohen', 'studies', 'aggregated'],
    ambiguity: 'meta_analytic_terms'
  }
];

