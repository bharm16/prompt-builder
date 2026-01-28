/**
 * Text Chunking Utilities for Large Prompt Processing
 * 
 * Splits large texts into processable chunks while preserving sentence boundaries.
 * Enables handling of prompts that exceed LLM token limits.
 * 
 * CHUNKING STRATEGY:
 * - Split at sentence boundaries to maintain semantic coherence
 * - Track offsets to reconstruct span positions
 * - Merge results from multiple chunks
 * - Handle overlapping spans at chunk boundaries
 */

import type { SpanLike } from '../types.js';

interface SentenceSlice {
  text: string;
  startOffset: number;
  endOffset: number;
}

interface SentenceSliceWithCount extends SentenceSlice {
  wordCount: number;
}

interface TextChunk {
  text: string;
  startOffset: number;
  endOffset: number;
  wordCount: number;
}

interface ChunkResult {
  spans?: SpanLike[];
  chunkOffset: number;
}

/**
 * Text Chunker class for processing large texts
 */
export class TextChunker {
  private maxChunkSize: number;
  private overlapWords: number;

  constructor(maxChunkSize = 400, overlapWords = 0) {
    this.maxChunkSize = maxChunkSize; // words per chunk
    this.overlapWords = Math.max(0, overlapWords);
  }
  
  /**
   * Split text into chunks at sentence boundaries
   * @param {string} text - Text to chunk
   * @returns {Array<Object>} Array of chunks with offsets
   */
  chunkText(text: unknown): TextChunk[] {
    if (!text || typeof text !== 'string') {
      return [];
    }
    
    const sentences = this.splitIntoSentences(text);
    if (sentences.length === 0) {
      return [];
    }

    const sentenceEntries: SentenceSliceWithCount[] = sentences.map(sentence => ({
      ...sentence,
      wordCount: sentence.text.split(/\s+/).filter(w => w.length > 0).length,
    }));

    const chunks: TextChunk[] = [];

    let currentSentences: SentenceSliceWithCount[] = [];
    let currentWordCount = 0;

    const pushChunk = (sentencesForChunk: SentenceSliceWithCount[], wordCount: number): void => {
      if (!sentencesForChunk.length) {
        return;
      }

      const firstSentence = sentencesForChunk[0];
      const lastSentence = sentencesForChunk[sentencesForChunk.length - 1];
      if (!firstSentence || !lastSentence) return;

      const startOffset = firstSentence.startOffset;
      const endOffset = lastSentence.endOffset;

      chunks.push({
        text: text.slice(startOffset, endOffset),
        startOffset,
        endOffset,
        wordCount,
      });
    };
    
    for (const sentence of sentenceEntries) {
      // If adding this sentence exceeds limit, start new chunk
      if (currentWordCount > 0 &&
          currentWordCount + sentence.wordCount > this.maxChunkSize) {
        pushChunk(currentSentences, currentWordCount);

        const overlap = this.getOverlapSentences(currentSentences);
        currentSentences = overlap.sentences;
        currentWordCount = overlap.wordCount;
      }

      currentSentences.push(sentence);
      currentWordCount += sentence.wordCount;
    }
    
    // Add final chunk
    pushChunk(currentSentences, currentWordCount);
    
    return chunks;
  }
  
  /**
   * Split text into sentences with offset tracking
   * @param {string} text - Text to split
   * @returns {Array<Object>} Sentences with positions
   */
  splitIntoSentences(text: string): SentenceSlice[] {
    // Sentence splitter that respects line-based sections (headings, bullets)
    const sentences: SentenceSlice[] = [];
    const lineRegex = /.*(?:\n|$)/g;
    const sentenceRegex = /[^.!?]+[.!?]+(?=\s|$)/g;
    let match: RegExpExecArray | null;

    while ((match = lineRegex.exec(text)) !== null) {
      if (match[0].length === 0) {
        lineRegex.lastIndex += 1;
        if (lineRegex.lastIndex > text.length) break;
        continue;
      }
      const lineText = match[0];
      const lineStart = match.index;
      const lineEnd = match.index + lineText.length;
      const trimmed = lineText.trim();

      if (!trimmed) {
        continue;
      }

      const isBullet = /^[-*•]\s+/.test(trimmed);
      const isHeading = /^#{1,6}\s+/.test(trimmed) || (/^\*\*.+\*\*$/.test(trimmed) && trimmed.length > 4);

      if (isBullet || isHeading) {
        const offsetWithinLine = lineText.indexOf(trimmed);
        sentences.push({
          text: trimmed,
          startOffset: lineStart + offsetWithinLine,
          endOffset: lineStart + offsetWithinLine + trimmed.length,
        });
        continue;
      }

      sentenceRegex.lastIndex = 0;
      let hadSentence = false;
      let sentenceMatch: RegExpExecArray | null;

      while ((sentenceMatch = sentenceRegex.exec(lineText)) !== null) {
        const sentenceText = sentenceMatch[0].trim();
        if (!sentenceText) continue;
        const offsetWithinLine = sentenceMatch[0].indexOf(sentenceText);
        sentences.push({
          text: sentenceText,
          startOffset: lineStart + sentenceMatch.index + offsetWithinLine,
          endOffset: lineStart + sentenceMatch.index + offsetWithinLine + sentenceText.length,
        });
        hadSentence = true;
      }

      if (!hadSentence) {
        const offsetWithinLine = lineText.indexOf(trimmed);
        sentences.push({
          text: trimmed,
          startOffset: lineStart + offsetWithinLine,
          endOffset: lineStart + offsetWithinLine + trimmed.length,
        });
      }
    }

    if (sentences.length === 0 && text.trim().length > 0) {
      sentences.push({
        text: text.trim(),
        startOffset: 0,
        endOffset: text.length,
      });
    }

    return sentences;
  }
  
  /**
   * Merge spans from multiple chunks back together
   * Adjusts span positions by chunk offset
   * @param {Array<Object>} chunkResults - Results from each chunk
   * @returns {Array<Object>} Merged spans
   */
  mergeChunkedSpans(chunkResults: ChunkResult[]): SpanLike[] {
    const mergedSpans: SpanLike[] = [];
    const seenSpans = new Set<string>(); // Track to avoid duplicates
    
    for (const { spans, chunkOffset } of chunkResults) {
      if (!Array.isArray(spans)) {
        continue;
      }
      
      for (const span of spans) {
        // Adjust span positions by chunk offset
        const adjustedSpan: SpanLike = {
          ...span,
          start: span.start + chunkOffset,
          end: span.end + chunkOffset,
        };
        
        // Create unique key to detect duplicates
        const spanKey = `${adjustedSpan.start}-${adjustedSpan.end}-${adjustedSpan.category || adjustedSpan.role}`;
        
        if (!seenSpans.has(spanKey)) {
          mergedSpans.push(adjustedSpan);
          seenSpans.add(spanKey);
        }
      }
    }
    
    // Sort by position for consistent ordering
    return mergedSpans.sort((a, b) => a.start - b.start);
  }
  
  /**
   * Check if text needs chunking
   * @param {string} text - Text to check
   * @returns {boolean} True if text exceeds chunk size
   */
  needsChunking(text: unknown): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    return wordCount > this.maxChunkSize;
  }

  private getOverlapSentences(sentences: SentenceSliceWithCount[]): {
    sentences: SentenceSliceWithCount[];
    wordCount: number;
  } {
    if (!this.overlapWords || sentences.length === 0) {
      return { sentences: [], wordCount: 0 };
    }

    const overlap: SentenceSliceWithCount[] = [];
    let overlapWordCount = 0;

    for (let i = sentences.length - 1; i >= 0; i -= 1) {
      const sentence = sentences[i];
      if (!sentence) continue;
      overlapWordCount += sentence.wordCount;
      overlap.unshift(sentence);

      if (overlapWordCount >= this.overlapWords) {
        break;
      }
    }

    return { sentences: overlap, wordCount: overlapWordCount };
  }
}

/**
 * Helper function to count words in text
 * @param {string} text - Text to count
 * @returns {number} Word count
 */
export function countWords(text: unknown): number {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

export default TextChunker;
