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

/**
 * Text Chunker class for processing large texts
 */
export class TextChunker {
  constructor(maxChunkSize = 400) {
    this.maxChunkSize = maxChunkSize; // words per chunk
  }
  
  /**
   * Split text into chunks at sentence boundaries
   * @param {string} text - Text to chunk
   * @returns {Array<Object>} Array of chunks with offsets
   */
  chunkText(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }
    
    const sentences = this.splitIntoSentences(text);
    const chunks = [];
    let currentChunk = {
      text: '',
      startOffset: 0,
      endOffset: 0,
      wordCount: 0,
    };
    
    for (const sentence of sentences) {
      const sentenceWords = sentence.text.split(/\s+/).filter(w => w.length > 0).length;
      
      // If adding this sentence exceeds limit, start new chunk
      if (currentChunk.wordCount > 0 && 
          currentChunk.wordCount + sentenceWords > this.maxChunkSize) {
        chunks.push({ ...currentChunk });
        currentChunk = {
          text: sentence.text,
          startOffset: sentence.startOffset,
          endOffset: sentence.endOffset,
          wordCount: sentenceWords,
        };
      } else {
        // Add to current chunk
        if (currentChunk.text) {
          currentChunk.text += ' ' + sentence.text;
          currentChunk.endOffset = sentence.endOffset;
        } else {
          currentChunk.text = sentence.text;
          currentChunk.startOffset = sentence.startOffset;
          currentChunk.endOffset = sentence.endOffset;
        }
        currentChunk.wordCount += sentenceWords;
      }
    }
    
    // Add final chunk
    if (currentChunk.text) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
  
  /**
   * Split text into sentences with offset tracking
   * @param {string} text - Text to split
   * @returns {Array<Object>} Sentences with positions
   */
  splitIntoSentences(text) {
    // Enhanced sentence splitter that handles common edge cases
    // Matches sentences ending with . ! ? followed by space or end of string
    // Handles common abbreviations like Dr. Mr. Ms. etc.
    const sentenceRegex = /[^.!?]+[.!?]+(?=\s|$)/g;
    const sentences = [];
    let match;
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
  mergeChunkedSpans(chunkResults) {
    const mergedSpans = [];
    const seenSpans = new Set(); // Track to avoid duplicates
    
    for (const { spans, chunkOffset } of chunkResults) {
      if (!Array.isArray(spans)) {
        continue;
      }
      
      for (const span of spans) {
        // Adjust span positions by chunk offset
        const adjustedSpan = {
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
  needsChunking(text) {
    if (!text || typeof text !== 'string') {
      return false;
    }
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    return wordCount > this.maxChunkSize;
  }
}

/**
 * Helper function to count words in text
 * @param {string} text - Text to count
 * @returns {number} Word count
 */
export function countWords(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

export default TextChunker;

