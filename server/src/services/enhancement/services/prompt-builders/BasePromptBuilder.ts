/**
 * Base Prompt Builder
 * 
 * Contains shared logic for prompt building that both OpenAI and Groq implementations use.
 * Provider-specific builders extend this class and override methods as needed.
 */

import { logger } from '@infrastructure/Logger';
import { extractSemanticSpans } from '../../../nlp/NlpSpanService.js';
import { getParentCategory } from '@shared/taxonomy';
import type {
  PromptBuildParams,
  BrainstormContext,
} from '../types.js';
import type { SharedPromptContext } from './IPromptBuilder.js';

/**
 * Base class with shared prompt building logic
 */
export abstract class BasePromptBuilder {
  protected readonly log = logger.child({ service: 'BasePromptBuilder' });

  /**
   * Resolve the semantic slot for the highlighted text
   */
  protected _resolveSlot({ highlightedText, phraseRole, highlightedCategory }: {
    highlightedText: string;
    phraseRole: string | null;
    highlightedCategory: string | null;
    contextBefore: string;
    contextAfter: string;
  }): string {
    const operation = '_resolveSlot';
    
    this.log.debug('Resolving semantic slot', {
      operation,
      hasHighlightedCategory: !!highlightedCategory,
      hasPhraseRole: !!phraseRole,
      highlightLength: highlightedText.length,
    });
    
    if (highlightedCategory) {
      const parent = getParentCategory(highlightedCategory);
      if (parent) {
        this.log.debug('Resolved slot from category', {
          operation,
          category: highlightedCategory,
          slot: parent,
        });
        return parent;
      }
    }

    if (phraseRole) {
      const parent = getParentCategory(phraseRole);
      if (parent) {
        this.log.debug('Resolved slot from phrase role', {
          operation,
          phraseRole,
          slot: parent,
        });
        return parent;
      }
    }

    if (highlightedText) {
      const result = extractSemanticSpans(highlightedText) as unknown as { spans: Array<{ role: string; confidence: number }> };
      const spans = 'spans' in result ? result.spans : [];
      if (spans.length > 0) {
        const bestSpan = spans.reduce((a, b) => (a.confidence > b.confidence ? a : b));
        const parent = getParentCategory(bestSpan.role);
        if (parent) {
          this.log.debug('Resolved slot from semantic spans', {
            operation,
            role: bestSpan.role,
            confidence: bestSpan.confidence,
            slot: parent,
          });
          return parent;
        }
      }
    }

    this.log.debug('Using default slot', {
      operation,
      slot: 'subject',
    });

    return 'subject';
  }

  /**
   * Pick the appropriate design pattern based on slot and mode
   */
  protected _pickDesign(
    slot: string, 
    isVideoPrompt: boolean, 
    mode: 'rewrite' | 'placeholder'
  ): 'orthogonal' | 'narrative' | 'visual' {
    const operation = '_pickDesign';
    
    let design: 'orthogonal' | 'narrative' | 'visual';
    
    if (mode === 'placeholder') {
      design = slot === 'action' ? 'narrative' : 'visual';
    } else if (slot === 'action') {
      design = 'narrative';
    } else if (slot === 'camera' || slot === 'shot' || slot === 'lighting' || slot === 'technical') {
      design = 'orthogonal';
    } else {
      design = 'visual';
    }
    
    this.log.debug('Design pattern selected', {
      operation,
      slot,
      mode,
      isVideoPrompt,
      design,
    });
    
    return design;
  }

  /**
   * Trim text to a maximum length
   */
  protected _trim(text: string, length: number, fromEnd = false): string {
    if (!text) return '';
    if (text.length <= length) return text;
    return fromEnd ? text.slice(-length) : text.slice(0, length);
  }

  /**
   * Build shared context object
   */
  protected _buildContext({
    highlightedText,
    contextBefore,
    contextAfter,
    fullPrompt,
    brainstormContext,
    editHistory,
    modelTarget,
    promptSection,
    videoConstraints,
    highlightWordCount,
    slot,
    mode,
  }: {
    highlightedText: string;
    contextBefore: string;
    contextAfter: string;
    fullPrompt: string;
    brainstormContext: BrainstormContext | null;
    editHistory: Array<{ original?: string }>;
    modelTarget: string | null;
    promptSection: string | null;
    videoConstraints: { 
      mode?: string; 
      minWords?: number; 
      maxWords?: number; 
      maxSentences?: number; 
      disallowTerminalPunctuation?: boolean; 
      formRequirement?: string; 
      focusGuidance?: string[]; 
      extraRequirements?: string[] 
    } | null;
    highlightWordCount: number | null;
    slot: string;
    mode: 'rewrite' | 'placeholder';
  }): SharedPromptContext {
    // Longer context windows - context is critical for relevance
    const prefix = this._trim(contextBefore, 150, true);
    const suffix = this._trim(contextAfter, 150);
    const inlineContext = `${prefix}[${highlightedText}]${suffix}`;
    
    // Longer prompt preview
    const promptPreview = this._trim(fullPrompt, 600);

    // Build constraint line
    let constraintLine = '';
    if (videoConstraints) {
      const parts: string[] = [];
      if (videoConstraints.minWords || videoConstraints.maxWords) {
        parts.push(`${videoConstraints.minWords || 2}-${videoConstraints.maxWords || 20} words`);
      }
      if (videoConstraints.mode === 'micro') {
        parts.push('noun phrases only');
      }
      constraintLine = parts.join(', ');
    }

    // Add word count hint
    if (Number.isFinite(highlightWordCount) && highlightWordCount) {
      constraintLine = constraintLine 
        ? `${constraintLine}; aim for ~${highlightWordCount} words`
        : `aim for ~${highlightWordCount} words`;
    }

    return {
      highlightedText,
      inlineContext,
      prefix,
      suffix,
      promptPreview,
      constraintLine,
      modelLine: modelTarget ? `Target: ${modelTarget}` : '',
      sectionLine: promptSection ? `Section: ${promptSection}` : '',
      slotLabel: slot || 'subject',
      guidance: '',
      highlightWordCount,
      mode,
      replacementInstruction: '',
    };
  }
}
