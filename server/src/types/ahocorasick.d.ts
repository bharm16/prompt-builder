declare module 'ahocorasick' {
  /**
   * AhoCorasick search result tuple: [endIndex, matchedPatterns]
   * - endIndex: The position where the match ends in the text
   * - matchedPatterns: Array of patterns that matched at this position
   */
  type AhoCorasickMatch = [number, string[]];

  class AhoCorasick {
    constructor(keywords: string[]);
    search(text: string): AhoCorasickMatch[];
  }

  export = AhoCorasick;
}
