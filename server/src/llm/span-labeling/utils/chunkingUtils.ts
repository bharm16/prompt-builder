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

interface SpanLike {
  start: number;
  end: number;
  role?: string;
  category?: string;
  [key: string]: unknown;
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

      const startOffset = sentencesForChunk[0].startOffset;
      const endOffset = sentencesForChunk[sentencesForChunk.length - 1].endOffset;

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
    // Enhanced sentence splitter that handles common edge cases
    // Matches sentences ending with . ! ? followed by space or end of string
    // Handles common abbreviations like Dr. Mr. Ms. etc.
    const sentenceRegex = /[^.!?]+[.!?]+(?=\s|$)/g;
    const sentences: SentenceSlice[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    
    while ((match = sentenceRegex.exec(text)) !== null) {
      const sentenceText = match[0].trim();
      if (sentenceText.length > 0) {
        sentences.push({
          text: sentenceText,
          startOffset: match.index,
          endOffset: match.index + match[0].length,
        });
        lastIndex = match.index + match[0].length;
      }
    }
    
    // Handle final text without sentence terminator
    if (lastIndex < text.length) {
      const remainingText = text.slice(lastIndex).trim();
      if (remainingText.length > 0) {
        sentences.push({
          text: remainingText,
          startOffset: lastIndex,
          endOffset: text.length,
        });
      }
    }
    
    // If no sentences were detected, treat entire text as one sentence
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
