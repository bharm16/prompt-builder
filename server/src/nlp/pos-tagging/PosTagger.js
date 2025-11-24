/**
 * Part-of-Speech Tagger using compromise.js with Penn Treebank tagset
 * 
 * This module provides POS tagging functionality that maps compromise.js tags
 * to the Penn Treebank (PTB) tagset, which is the academic standard for English POS tagging.
 * 
 * The POS tagger is the foundational layer of the NLP pipeline. It assigns grammatical
 * categories to every token, disambiguating function within sentence structure.
 * 
 * For video prompt building, this step is critical to:
 * - Distinguish subjects (Nouns) from dynamics (Verbs)
 * - Identify attributes (Adjectives) vs modifiers (Adverbs)
 * - Detect spatial relationships (Prepositions)
 * - Handle verb tenses for temporal continuity (VBG for ongoing actions)
 */

import nlp from 'compromise';
import { getPTBTag, isVerbTag, PTB_TAGS } from '../utils/PennTreebankTags.js';

/**
 * POS Tagger class
 */
export class PosTagger {
  /**
   * Tag text with Penn Treebank POS tags
   * 
   * @param {string} text - Input text to tag
   * @returns {Array<{word: string, tag: string, index: number, normal: string}>}
   */
  static tagPOS(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const doc = nlp(text);
    const terms = doc.terms().out('array');
    const tokens = [];
    
    let charIndex = 0;
    
    doc.terms().forEach((term, termIndex) => {
      const termText = term.text();
      const normalizedText = term.text('normal');
      
      // Get PTB tag from compromise tags
      const ptbTag = getPTBTag(term);
      
      // Find character position in original text
      const startIndex = text.indexOf(termText, charIndex);
      
      tokens.push({
        word: termText,
        normal: normalizedText,
        tag: ptbTag,
        index: termIndex,
        charStart: startIndex >= 0 ? startIndex : charIndex,
        charEnd: startIndex >= 0 ? startIndex + termText.length : charIndex + termText.length,
        compromiseTags: term.tags || [],
      });
      
      charIndex = startIndex >= 0 ? startIndex + termText.length : charIndex + termText.length;
    });
    
    return tokens;
  }

  /**
   * Tag text and return detailed analysis
   * 
   * @param {string} text - Input text
   * @returns {Object} Detailed POS analysis
   */
  static analyzeText(text) {
    const tokens = PosTagger.tagPOS(text);
    
    return {
      text,
      tokens,
      stats: {
        totalTokens: tokens.length,
        nouns: tokens.filter(t => t.tag.startsWith('NN')).length,
        verbs: tokens.filter(t => isVerbTag(t.tag)).length,
        adjectives: tokens.filter(t => t.tag.startsWith('JJ')).length,
        adverbs: tokens.filter(t => t.tag.startsWith('RB')).length,
      },
    };
  }

  /**
   * Extract tokens by POS tag pattern
   * 
   * @param {string} text - Input text
   * @param {string|RegExp} pattern - Tag pattern (e.g., 'NN' or regex /NN.*\/)
   * @returns {Array<Object>} Matching tokens
   */
  static extractByTag(text, pattern) {
    const tokens = PosTagger.tagPOS(text);
    
    if (typeof pattern === 'string') {
      return tokens.filter(t => t.tag === pattern);
    } else if (pattern instanceof RegExp) {
      return tokens.filter(t => pattern.test(t.tag));
    }
    
    return [];
  }

  /**
   * Extract all nouns from text
   * 
   * @param {string} text - Input text
   * @returns {Array<Object>} Noun tokens
   */
  static extractNouns(text) {
    return PosTagger.extractByTag(text, /^NN/);
  }

  /**
   * Extract all verbs from text
   * 
   * @param {string} text - Input text
   * @returns {Array<Object>} Verb tokens
   */
  static extractVerbs(text) {
    return PosTagger.extractByTag(text, /^VB/);
  }

  /**
   * Extract all adjectives from text
   * 
   * @param {string} text - Input text
   * @returns {Array<Object>} Adjective tokens
   */
  static extractAdjectives(text) {
    return PosTagger.extractByTag(text, /^JJ/);
  }

  /**
   * Extract all adverbs from text
   * 
   * @param {string} text - Input text
   * @returns {Array<Object>} Adverb tokens
   */
  static extractAdverbs(text) {
    return PosTagger.extractByTag(text, /^RB/);
  }

  /**
   * Check if a word at a given position has a specific tag
   * 
   * @param {Array<Object>} tokens - Token array from tagPOS
   * @param {number} index - Token index
   * @param {string|RegExp} pattern - Tag pattern to match
   * @returns {boolean}
   */
  static hasTag(tokens, index, pattern) {
    if (index < 0 || index >= tokens.length) return false;
    
    const tag = tokens[index].tag;
    
    if (typeof pattern === 'string') {
      return tag === pattern;
    } else if (pattern instanceof RegExp) {
      return pattern.test(tag);
    }
    
    return false;
  }

  /**
   * Get the next token with a specific tag
   * 
   * @param {Array<Object>} tokens - Token array
   * @param {number} startIndex - Starting position
   * @param {string|RegExp} pattern - Tag pattern
   * @returns {Object|null} Token or null
   */
  static findNext(tokens, startIndex, pattern) {
    for (let i = startIndex + 1; i < tokens.length; i++) {
      if (PosTagger.hasTag(tokens, i, pattern)) {
        return tokens[i];
      }
    }
    return null;
  }

  /**
   * Get the previous token with a specific tag
   * 
   * @param {Array<Object>} tokens - Token array
   * @param {number} startIndex - Starting position
   * @param {string|RegExp} pattern - Tag pattern
   * @returns {Object|null} Token or null
   */
  static findPrevious(tokens, startIndex, pattern) {
    for (let i = startIndex - 1; i >= 0; i--) {
      if (PosTagger.hasTag(tokens, i, pattern)) {
        return tokens[i];
      }
    }
    return null;
  }

  /**
   * Detect verb tense for temporal continuity in video generation
   * 
   * VBG (gerund) is critical for video as it implies continuous, ongoing action
   * 
   * @param {string} text - Input text
   * @returns {Object} Verb analysis with tenses
   */
  static analyzeVerbTenses(text) {
    const verbs = PosTagger.extractVerbs(text);
    
    return {
      verbs,
      hasContinuousAction: verbs.some(v => v.tag === 'VBG'),
      hasPastAction: verbs.some(v => v.tag === 'VBD'),
      hasBaseForm: verbs.some(v => v.tag === 'VB'),
      tenseDistribution: {
        VB: verbs.filter(v => v.tag === 'VB').length,
        VBD: verbs.filter(v => v.tag === 'VBD').length,
        VBG: verbs.filter(v => v.tag === 'VBG').length,
        VBN: verbs.filter(v => v.tag === 'VBN').length,
        VBP: verbs.filter(v => v.tag === 'VBP').length,
        VBZ: verbs.filter(v => v.tag === 'VBZ').length,
      },
    };
  }
}

export default PosTagger;

