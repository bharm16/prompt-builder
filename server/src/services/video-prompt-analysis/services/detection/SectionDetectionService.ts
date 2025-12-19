import { logger } from '@infrastructure/Logger';
import { normalizeText } from '../../utils/textHelpers.js';

/**
 * Section detection patterns
 */
const SECTION_PATTERNS = {
  main_prompt: {
    headers: ['main prompt', 'primary description', 'core concept', 'scene description'],
    keywords: ['describe', 'showing', 'featuring', 'depicting', 'establishing'],
    position: 'early', // Usually in first 30% of prompt
  },
  technical_specs: {
    headers: ['technical specs', 'technical specifications', 'camera settings', 'render settings'],
    keywords: ['camera:', 'lens:', 'aperture:', 'iso:', 'framerate:', 'resolution:', 'aspect ratio:'],
    position: 'middle', // Usually in middle section
  },
  alternatives: {
    headers: ['alternative', 'variations', 'other options', 'alternatives'],
    keywords: ['alternatively', 'or:', 'option:', 'variation:', 'could also'],
    position: 'late', // Usually near end
  },
  style_direction: {
    headers: ['style', 'visual style', 'aesthetic', 'reference'],
    keywords: ['style:', 'aesthetic:', 'inspired by', 'similar to', 'like', 'reminiscent'],
    position: 'any',
  },
} as const;

/**
 * Section-specific constraints and requirements
 */
const SECTION_CONSTRAINTS = {
  main_prompt: {
    tone: 'descriptive',
    precision: 'moderate',
    creativity: 'high',
    requirements: [
      'Clear, vivid descriptions',
      'Focus on key visual elements',
      'Narrative flow',
      'Sensory details',
    ],
    avoid: ['Technical jargon in narrative', 'Ambiguous pronouns', 'Overly abstract concepts'],
  },
  technical_specs: {
    tone: 'technical',
    precision: 'high',
    creativity: 'low',
    requirements: [
      'Exact parameter values',
      'Standard terminology',
      'Measurable specifications',
      'Format: "Parameter: value"',
    ],
    avoid: ['Poetic language', 'Vague descriptors', 'Approximate values', 'Creative interpretations'],
  },
  alternatives: {
    tone: 'suggestive',
    precision: 'moderate',
    creativity: 'very high',
    requirements: [
      'Diverse variations',
      'Different creative directions',
      'Clear alternatives',
      'Distinct from main prompt',
    ],
    avoid: ['Minor tweaks', 'Same concept rephrased', 'Technical specifications'],
  },
  style_direction: {
    tone: 'referential',
    precision: 'high',
    creativity: 'moderate',
    requirements: [
      'Specific visual references',
      'Art/film movements',
      'Named artists or works',
      'Clear aesthetic descriptors',
    ],
    avoid: ['Generic style terms', 'Vague comparisons', 'Mixed metaphors'],
  },
} as const;

export type SectionId = keyof typeof SECTION_PATTERNS;

export interface SectionConstraints {
  tone: string;
  precision: string;
  creativity: string;
  requirements: readonly string[];
  avoid: readonly string[];
}

interface SectionPatterns {
  headers: readonly string[];
  keywords: readonly string[];
  position: 'early' | 'middle' | 'late' | 'any';
}

/**
 * Service responsible for detecting prompt template section
 */
export class SectionDetectionService {
  private readonly log = logger.child({ service: 'SectionDetectionService' });

  /**
   * Detect which section of the prompt template is being edited
   */
  detectSection(
    highlightedText: string | null | undefined,
    fullPrompt: string | null | undefined,
    contextBefore: string = ''
  ): SectionId {
    const operation = 'detectSection';
    
    if (!highlightedText || !fullPrompt) {
      this.log.debug('Missing input, returning default section', {
        operation,
      });
      return 'main_prompt'; // Default
    }
    
    this.log.debug('Detecting prompt section', {
      operation,
      highlightLength: highlightedText.length,
      fullPromptLength: fullPrompt.length,
    });

    const normalizedPrompt = normalizeText(fullPrompt);
    const normalizedContext = normalizeText(contextBefore);
    const normalizedHighlight = normalizeText(highlightedText);

    // Calculate relative position in prompt
    const position = this._calculatePosition(highlightedText, fullPrompt);

    // Score each section
    const scores: Record<string, number> = {};
    for (const [section, patterns] of Object.entries(SECTION_PATTERNS)) {
      scores[section] = this._scoreSection(
        normalizedPrompt,
        normalizedContext,
        normalizedHighlight,
        patterns,
        position
      );
    }

    // Return section with highest score
    const entries = Object.entries(scores);
    const maxScore = Math.max(...entries.map(([, score]) => score));

    if (maxScore === 0) {
      return 'main_prompt'; // Default if no matches
    }

    return (entries.find(([, score]) => score === maxScore)?.[0] as SectionId) || 'main_prompt';
  }

  /**
   * Calculate relative position of highlight in prompt (0-1)
   */
  private _calculatePosition(highlightedText: string, fullPrompt: string): number {
    const index = fullPrompt.indexOf(highlightedText);
    if (index === -1) {
      return 0.5; // Middle if not found
    }
    return index / fullPrompt.length;
  }

  /**
   * Score a section based on pattern matches
   */
  private _scoreSection(
    normalizedPrompt: string,
    normalizedContext: string,
    normalizedHighlight: string,
    patterns: SectionPatterns,
    position: number
  ): number {
    let score = 0;

    // Check for section headers in context before (strong signal)
    patterns.headers.forEach((header) => {
      if (normalizedContext.includes(header)) {
        score += 10; // Very strong signal
      }
    });

    // Check for section headers anywhere in prompt (medium signal)
    patterns.headers.forEach((header) => {
      if (normalizedPrompt.includes(header) && !normalizedContext.includes(header)) {
        score += 3;
      }
    });

    // Check for keywords in context or highlight (medium signal)
    patterns.keywords.forEach((keyword) => {
      if (normalizedContext.includes(keyword) || normalizedHighlight.includes(keyword)) {
        score += 2;
      }
    });

    // Check position match (weak signal)
    if (patterns.position !== 'any') {
      if (patterns.position === 'early' && position < 0.3) {
        score += 1;
      } else if (patterns.position === 'middle' && position >= 0.3 && position <= 0.7) {
        score += 1;
      } else if (patterns.position === 'late' && position > 0.7) {
        score += 1;
      }
    }

    return score;
  }

  /**
   * Get section-specific constraints
   */
  getSectionConstraints(section: string | null | undefined): SectionConstraints | null {
    if (!section || !(section in SECTION_CONSTRAINTS)) {
      return null;
    }

    return SECTION_CONSTRAINTS[section as SectionId];
  }

  /**
   * Get section-specific guidance for a category
   */
  getSectionGuidance(section: string | null | undefined, category: string | null | undefined): string[] {
    if (!section || !category) {
      return [];
    }

    const constraints = this.getSectionConstraints(section);
    if (!constraints) {
      return [];
    }

    const guidance: string[] = [];
    const normalizedCategory = category.toLowerCase();

    // Section-specific category guidance
    if (section === 'main_prompt') {
      guidance.push('Use descriptive, narrative language');
      guidance.push('Focus on visual storytelling');
      if (normalizedCategory.includes('action') || normalizedCategory.includes('movement')) {
        guidance.push('Describe action with vivid, cinematic detail');
      }
    }

    if (section === 'technical_specs') {
      guidance.push('Use precise technical terminology');
      guidance.push('Provide exact values and measurements');
      guidance.push('Format as "Parameter: value" pairs');
      if (normalizedCategory.includes('camera')) {
        guidance.push('Specify: lens (35mm, 50mm), aperture (f/2.8), movement type');
      }
      if (normalizedCategory.includes('lighting')) {
        guidance.push('Include: color temp (3200K, 5600K), intensity, direction');
      }
    }

    if (section === 'alternatives') {
      guidance.push('Offer truly different creative directions');
      guidance.push('Explore variations that change the mood or approach');
      guidance.push('Each alternative should feel distinct');
    }

    if (section === 'style_direction') {
      guidance.push('Reference specific visual styles or artists');
      guidance.push('Name art movements, film styles, or known works');
      if (normalizedCategory.includes('style')) {
        guidance.push('Use terms like: noir, surrealism, impressionist, cyberpunk');
      }
    }

    return guidance;
  }

  /**
   * Format section context for prompt inclusion
   */
  formatSectionContext(section: string | null | undefined): string {
    if (!section) {
      return '';
    }

    const constraints = this.getSectionConstraints(section);
    if (!constraints) {
      return '';
    }

    const sectionName = section
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    let context = `\n**PROMPT SECTION: ${sectionName}**\n`;
    context += `Tone: ${constraints.tone.charAt(0).toUpperCase() + constraints.tone.slice(1)}\n`;
    context += `Precision Required: ${constraints.precision.charAt(0).toUpperCase() + constraints.precision.slice(1)}\n`;
    context += `Requirements:\n`;
    constraints.requirements.forEach((req) => {
      context += `- ${req}\n`;
    });
    context += `Avoid:\n`;
    constraints.avoid.forEach((avoid) => {
      context += `- ${avoid}\n`;
    });

    return context;
  }
}

