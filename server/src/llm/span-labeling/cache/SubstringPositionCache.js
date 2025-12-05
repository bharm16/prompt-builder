import { logger } from '@infrastructure/Logger';

/**
 * Optimized substring position finder with caching
 *
 * Performance improvements:
 * - Caches substring positions to avoid repeated indexOf calls
 * - Binary search for closest match to preferred position
 * - Early termination for single occurrence
 *
 * Reduces character offset correction overhead by 20-30ms per request
 * for typical 60-span, 5000-character texts.
 */
export class SubstringPositionCache {
  constructor() {
    this.cache = new Map();
    this.currentText = null;
    this.log = logger.child({ service: 'SubstringPositionCache' });
    // Telemetry for Phase 1
    this.telemetry = {
      exactMatches: 0,
      caseInsensitiveMatches: 0,
      fuzzyMatches: 0,
      failures: 0,
      totalRequests: 0
    };
  }

  /**
   * Get telemetry stats
   */
  getTelemetry() {
    return { ...this.telemetry };
  }

  /**
   * Reset telemetry counters
   */
  resetTelemetry() {
    this.telemetry = {
      exactMatches: 0,
      caseInsensitiveMatches: 0,
      fuzzyMatches: 0,
      failures: 0,
      totalRequests: 0
    };
  }

  /**
   * Light normalization used for fallback matching
   * (removes quotes/markdown noise, collapses whitespace, normalizes unicode)
   */
  _cleanForMatch(value) {
    if (typeof value !== 'string') return '';

    return value
      .normalize('NFD') // Unicode normalization (decompose accented characters)
      .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
      .replace(/[`"'""]/g, '') // Remove quotes
      .replace(/\*\*/g, '') // Remove markdown bold
      .replace(/\s+/g, ' ') // Collapse whitespace
      .toLowerCase()
      .trim();
  }

  /**
   * Lightweight Levenshtein distance (iterative) for fuzzy fallback.
   * Only used when exact/normalized matches fail.
   */
  _levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const aLen = a.length;
    const bLen = b.length;
    let prev = new Array(bLen + 1);
    let curr = new Array(bLen + 1);

    for (let j = 0; j <= bLen; j += 1) {
      prev[j] = j;
    }

    for (let i = 0; i < aLen; i += 1) {
      curr[0] = i + 1;
      for (let j = 0; j < bLen; j += 1) {
        const cost = a[i] === b[j] ? 0 : 1;
        curr[j + 1] = Math.min(
          curr[j] + 1, // insertion
          prev[j + 1] + 1, // deletion
          prev[j] + cost // substitution
        );
      }
      const swap = prev;
      prev = curr;
      curr = swap;
    }

    return prev[bLen];
  }

  /**
   * Fuzzy fallback search when exact match is not found.
   * Anchored on a short prefix to avoid scanning the entire string.
   */
  _fuzzyFind(text, substring) {
    const cleanedTarget = this._cleanForMatch(substring);
    if (!cleanedTarget) return null;

    const targetLen = cleanedTarget.length;
    const lowerText = text.toLowerCase();
    const anchor = cleanedTarget.slice(0, Math.min(6, targetLen));
    const candidateStarts = [];

    // Anchor-driven candidates (primary path)
    if (anchor) {
      let idx = lowerText.indexOf(anchor);
      while (idx !== -1 && candidateStarts.length < 120) {
        candidateStarts.push(Math.max(0, idx - 6));
        idx = lowerText.indexOf(anchor, idx + Math.max(1, anchor.length));
      }
    }

    // Safety net: coarse stride scan if no anchors found
    if (candidateStarts.length === 0) {
      const step = Math.max(4, Math.floor(targetLen / 2)) || 1;
      for (let pos = 0; pos <= text.length - targetLen; pos += step) {
        candidateStarts.push(pos);
        if (candidateStarts.length >= 120) break;
      }
    }

    let best = null;
    for (const start of candidateStarts) {
      const windowEnd = Math.min(text.length, start + targetLen + 10);
      const window = text.slice(start, windowEnd);
      const cleanedWindow = this._cleanForMatch(window);
      if (!cleanedWindow) continue;

      const distance = this._levenshtein(cleanedTarget, cleanedWindow);
      const normalized =
        distance / Math.max(cleanedTarget.length, cleanedWindow.length || 1);

      if (best === null || normalized < best.score) {
        best = { start, end: start + window.length, score: normalized };
      }
    }

    // Require a reasonably close match (<=35% normalized edit distance)
    if (best && best.score <= 0.35) {
      const approxLength = Math.max(substring.length, cleanedTarget.length);
      return {
        start: best.start,
        end: Math.min(text.length, best.start + approxLength),
      };
    }

    return null;
  }

  /**
   * Get all occurrences of a substring in text (with caching)
   * @private
   * @param {string} text - Source text to search
   * @param {string} substring - Substring to find
   * @returns {Array<number>} Array of start positions
   */
  _getOccurrences(text, substring) {
    // Clear cache if text changed (compare by reference for performance)
    // For different text content, this will be different string references
    if (this.currentText !== text) {
      this.cache.clear();
      this.currentText = text;
    }

    // Check cache
    if (this.cache.has(substring)) {
      return this.cache.get(substring);
    }

    // Find all occurrences
    const occurrences = [];
    let index = text.indexOf(substring, 0);
    while (index !== -1) {
      occurrences.push(index);
      index = text.indexOf(substring, index + 1);
    }

    // Cache the result
    this.cache.set(substring, occurrences);
    return occurrences;
  }

  /**
   * Find best matching indices for substring with binary search optimization
   *
   * Uses binary search to find the occurrence closest to the preferred position.
   * This is crucial for LLM-provided approximate offsets.
   *
   * @param {string} text - Source text
   * @param {string} substring - Substring to find
   * @param {number} [preferredStart=0] - Preferred start position hint
   * @returns {Object|null} {start, end} or null if not found
   */
  findBestMatch(text, substring, preferredStart = 0) {
    if (!substring) return null;

    this.telemetry.totalRequests++;

    const occurrences = this._getOccurrences(text, substring);

    if (occurrences.length === 0) {
      // Case-insensitive direct match
      const loweredSource = text.toLowerCase();
      const loweredTarget = substring.toLowerCase();
      const idx = loweredTarget ? loweredSource.indexOf(loweredTarget) : -1;
      if (idx === -1) {
        // Fuzzy fallback for minor typos or spacing differences (Design A - anchored substring extraction)
        this.log.debug('Fuzzy matching required', {
          operation: 'find',
          substringPreview: substring.slice(0, 50),
        });
        const result = this._fuzzyFind(text, substring);
        if (result) {
          this.telemetry.fuzzyMatches++;
          this.log.debug('Fuzzy match found', {
            operation: 'find',
            start: result.start,
            end: result.end,
          });
        } else {
          this.telemetry.failures++;
          this.log.warn('No match found for substring', {
            operation: 'find',
            substringPreview: substring.slice(0, 50),
          });
        }
        return result;
      }
      this.telemetry.caseInsensitiveMatches++;
      return { start: idx, end: idx + loweredTarget.length };
    }

    if (occurrences.length === 1) {
      this.telemetry.exactMatches++;
      return { start: occurrences[0], end: occurrences[0] + substring.length };
    }

    const preferred =
      typeof preferredStart === 'number' && Number.isFinite(preferredStart)
        ? preferredStart
        : 0;

    // Binary search for closest occurrence
    let left = 0;
    let right = occurrences.length - 1;
    let best = occurrences[0];
    let bestDistance = Math.abs(best - preferred);

    // If preferred is before first occurrence, return first
    if (preferred <= occurrences[0]) {
      return { start: occurrences[0], end: occurrences[0] + substring.length };
    }

    // If preferred is after last occurrence, return last
    if (preferred >= occurrences[occurrences.length - 1]) {
      const last = occurrences[occurrences.length - 1];
      return { start: last, end: last + substring.length };
    }

    // Binary search for closest match
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const candidate = occurrences[mid];
      const distance = Math.abs(candidate - preferred);

      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }

      if (candidate < preferred) {
        left = mid + 1;
      } else if (candidate > preferred) {
        right = mid - 1;
      } else {
        // Exact match
        this.telemetry.exactMatches++;
        return { start: candidate, end: candidate + substring.length };
      }
    }

    this.telemetry.exactMatches++; // Multiple occurrences, but we found the best one
    if (preferred !== 0 && bestDistance > 100) {
      this.log.debug('Large offset difference detected', {
        operation: 'find',
        preferred,
        found: best,
        distance: bestDistance,
      });
    }
    return { start: best, end: best + substring.length };
  }

  /**
   * Clear the cache (called between requests)
   */
  clear() {
    this.cache.clear();
    this.currentText = null;
  }
}
