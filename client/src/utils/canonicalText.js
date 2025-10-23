const DEFAULT_SEGMENTER = typeof Intl !== 'undefined'
  ? new Intl.Segmenter('en', { granularity: 'grapheme' })
  : null;

export class CanonicalText {
  constructor(input = '', { segmenter = DEFAULT_SEGMENTER } = {}) {
    this.original = input ?? '';
    this.normalized = typeof input === 'string' ? input.normalize('NFC') : '';
    this.segmenter = segmenter;
    this._graphemes = null;
    this._graphemeStarts = null;
  }

  get length() {
    return this.graphemes.length;
  }

  get graphemes() {
    if (this._graphemes) return this._graphemes;
    if (!this.segmenter) {
      // Fallback: treat each code unit as a grapheme (not ideal but keeps pipeline alive)
      const graphemes = [...this.normalized].map((char, index) => ({
        segment: char,
        index,
        start: index,
        end: index + char.length,
      }));
      this._graphemes = graphemes;
      this._graphemeStarts = graphemes.map(g => g.start);
      this._graphemeStarts.push(this.normalized.length);
      return this._graphemes;
    }

    const graphemes = [];
    const starts = [];
    let currentIndex = 0;
    for (const segment of this.segmenter.segment(this.normalized)) {
      graphemes.push({
        segment: segment.segment,
        index: currentIndex,
        start: segment.index,
        end: segment.index + segment.segment.length,
      });
      starts.push(segment.index);
      currentIndex += 1;
    }
    starts.push(this.normalized.length);
    this._graphemes = graphemes;
    this._graphemeStarts = starts;
    return this._graphemes;
  }

  toCodePoint(index) {
    return this.codeUnitOffsetForGrapheme(index);
  }

  codeUnitOffsetForGrapheme(index) {
    if (index <= 0) return 0;
    if (index >= this.length) return this.normalized.length;
    if (!this._graphemeStarts) {
      this.graphemes; // ensure cache built
    }
    return this._graphemeStarts[index];
  }

  graphemeIndexForCodeUnit(offset) {
    if (offset <= 0) return 0;
    if (offset >= this.normalized.length) return this.length;
    if (!this._graphemeStarts) {
      this.graphemes;
    }
    for (let i = 0; i < this._graphemeStarts.length - 1; i += 1) {
      const start = this._graphemeStarts[i];
      const end = this._graphemeStarts[i + 1];
      if (offset >= start && offset < end) {
        return i;
      }
    }
    return this.length;
  }

  sliceGraphemes(start, end) {
    const normalizedStart = Math.max(0, Math.min(this.length, start));
    const normalizedEnd = Math.max(normalizedStart, Math.min(this.length, end));
    const codeStart = this.codeUnitOffsetForGrapheme(normalizedStart);
    const codeEnd = this.codeUnitOffsetForGrapheme(normalizedEnd);
    return this.normalized.slice(codeStart, codeEnd);
  }

  toJSON() {
    return {
      original: this.original,
      normalized: this.normalized,
      length: this.length,
    };
  }
}

export const createCanonicalText = (input, options) =>
  new CanonicalText(input, options);
