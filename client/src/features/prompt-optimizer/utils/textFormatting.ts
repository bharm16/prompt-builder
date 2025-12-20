/**
 * Text Formatting Layer - Applies 2025 Design Principles
 *
 * Transforms Claude's text output into formatted HTML with inline styles
 * for a contentEditable experience. Users can edit while maintaining formatting.
 */

/**
 * Escapes HTML special characters to prevent XSS attacks
 */
const escapeHtml = (str: string | null | undefined = ''): string =>
  String(str)
    // Strip inline event handlers to avoid leftover "onxxx=" substrings
    .replace(/on[a-z]+(\s*)=/gi, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/**
 * Text formatter class that handles parsing and HTML generation
 */
class TextFormatter {
  private rawText: string;
  private lines: string[];
  private result: string[];
  private endsWithNewline: boolean;

  constructor(text: string | null | undefined) {
    this.rawText = String(text);
    this.lines = this.rawText.split(/\r?\n/);
    this.result = [];
    this.endsWithNewline = /\r?\n$/.test(this.rawText);
  }

  /**
   * Determines if a newline should be appended after a line
   */
  private shouldAppendNewline(index: number): boolean {
    if (!Number.isInteger(index)) return false;
    if (index < this.lines.length - 1) {
      return true;
    }
    return index === this.lines.length - 1 && this.endsWithNewline;
  }

  /**
   * Appends a block of HTML with appropriate newline handling
   */
  private appendBlock(html: string, lineIndex: number): void {
    this.result.push(html);
    if (this.shouldAppendNewline(lineIndex)) {
      this.result.push('\n');
    }
  }

  /**
   * Pushes a gap (empty line) element
   */
  private pushGap(lineIndex: number): void {
    this.appendBlock('<div class="prompt-line prompt-line--gap" data-variant="gap"><br /></div>', lineIndex);
  }

  /**
   * Pushes a separator line
   */
  private pushSeparator(lineIndex: number): void {
    this.appendBlock('<div class="prompt-line prompt-line--separator" data-variant="separator">———</div>', lineIndex);
  }

  /**
   * Pushes a heading element
   */
  private pushHeading(raw: string, lineIndex: number): void {
    const cleaned = raw
      .replace(/^#{1,6}\s+/, '')
      .replace(/^\*\*(.+)\*\*:?$/, '$1')
      .replace(/:$/, '')
      .trim();
    const className = 'prompt-line prompt-line--heading';
    this.appendBlock(`<div class="${className}" data-variant="heading">${escapeHtml(cleaned)}</div>`, lineIndex);
  }

  /**
   * Pushes a section element (text ending with colon)
   */
  private pushSection(raw: string, lineIndex: number): void {
    this.appendBlock(
      `<div class="prompt-line prompt-line--section" data-variant="section">${escapeHtml(
        raw.trim()
      )}</div>`,
      lineIndex
    );
  }

  /**
   * Pushes a paragraph element
   */
  private pushParagraph(raw: string, lineIndex: number): void {
    this.appendBlock(
      `<div class="prompt-line prompt-line--paragraph" data-variant="paragraph">${escapeHtml(
        raw.trim()
      )}</div>`,
      lineIndex
    );
  }

  /**
   * Pushes an ordered list item
   */
  private pushOrderedItem(label: string, text: string, lineIndex: number, isLastInGroup: boolean): void {
    this.appendBlock(
      `<div class="prompt-line prompt-line--ordered" data-variant="ordered" data-variant-index="${escapeHtml(
        label
      )}"><span class="prompt-ordered-index">${escapeHtml(
        label
      )}</span><span class="prompt-ordered-text">${escapeHtml(text.trim())}</span></div>`,
      lineIndex
    );
    if (isLastInGroup && this.shouldAppendNewline(lineIndex + 0.5)) {
      this.result.push('\n');
    }
  }

  /**
   * Pushes a bullet list item
   */
  private pushBulletItem(text: string, lineIndex: number, isLastInGroup: boolean): void {
    this.appendBlock(
      `<div class="prompt-line prompt-line--bullet" data-variant="bullet"><span class="prompt-bullet-marker">•</span><span class="prompt-bullet-text">${escapeHtml(
        text.trim()
      )}</span></div>`,
      lineIndex
    );
    if (isLastInGroup && this.shouldAppendNewline(lineIndex + 0.5)) {
      this.result.push('\n');
    }
  }

  /**
   * Checks if a line is a separator
   */
  private isSeparator(trimmed: string): boolean {
    return /^[=\-*_━─═▬▭]{3,}$/.test(trimmed);
  }

  /**
   * Checks if a line is a heading
   */
  private isHeading(trimmed: string): boolean {
    return /^#{1,6}\s+/.test(trimmed) || /^\*\*[^*]+\*\*:?$/.test(trimmed) || /^[A-Z][A-Z\s]{3,}$/.test(trimmed);
  }

  /**
   * Checks if a line is an ordered list item
   */
  private isOrderedItem(trimmed: string): boolean {
    return /^\d+\.\s+/.test(trimmed);
  }

  /**
   * Checks if a line is a bullet list item
   */
  private isBulletItem(trimmed: string): boolean {
    return /^[-*•]\s+/.test(trimmed);
  }

  /**
   * Checks if a line is a section header (ends with colon)
   */
  private isSection(trimmed: string): boolean {
    return /^.+:$/.test(trimmed);
  }

  /**
   * Checks if a line is a blockquote
   */
  private isBlockquote(trimmed: string): boolean {
    return /^>\s*/.test(trimmed);
  }

  /**
   * Processes all lines and generates formatted HTML
   */
  format(): { html: string } {
    for (let i = 0; i < this.lines.length; i += 1) {
      const lineIndex = i;
      const line = this.lines[i] ?? '';
      const trimmed = line.trim();

      if (!trimmed) {
        this.pushGap(lineIndex);
        continue;
      }

      if (this.isSeparator(trimmed)) {
        this.pushSeparator(lineIndex);
        continue;
      }

      if (this.isHeading(trimmed)) {
        this.pushHeading(trimmed, lineIndex);
        continue;
      }

      // Handle ordered lists
      if (this.isOrderedItem(trimmed)) {
        while (i < this.lines.length && this.isOrderedItem((this.lines[i] ?? '').trim())) {
          const currentIndex = i;
          const current = (this.lines[currentIndex] ?? '').trim();
          const match = current.match(/^(\d+)\.\s+(.*)$/);
          const nextLine = this.lines[i + 1] ?? '';
          const nextTrimmed = nextLine.trim();
          const nextBreaks =
            i + 1 >= this.lines.length ||
            nextTrimmed === '' ||
            !this.isOrderedItem(nextTrimmed);
          if (match) {
            const itemText = match[2] ?? '';
            this.pushOrderedItem(`${match[1]}.`, itemText, currentIndex, nextBreaks);
          }
          i += 1;
        }
        i -= 1;
        continue;
      }

      // Handle bullet lists
      if (this.isBulletItem(trimmed)) {
        while (i < this.lines.length && this.isBulletItem((this.lines[i] ?? '').trim())) {
          const currentIndex = i;
          const current = (this.lines[currentIndex] ?? '').trim().replace(/^[-*•]\s+/, '');
          const nextLine = this.lines[i + 1] ?? '';
          const nextTrimmed = nextLine.trim();
          const nextBreaks =
            i + 1 >= this.lines.length ||
            nextTrimmed === '' ||
            !this.isBulletItem(nextTrimmed);
          this.pushBulletItem(current, currentIndex, nextBreaks);
          i += 1;
        }
        i -= 1;
        continue;
      }

      if (this.isSection(trimmed)) {
        this.pushSection(trimmed, lineIndex);
        continue;
      }

      if (this.isBlockquote(trimmed)) {
        this.pushParagraph(trimmed.replace(/^>\s*/, ''), lineIndex);
        continue;
      }

      this.pushParagraph(trimmed, lineIndex);
    }

    return { html: this.result.join('') };
  }
}

/**
 * Converts plain text to formatted HTML with semantic structure
 */
export const formatTextToHTML = (text: string | null | undefined): { html: string } => {
  if (text == null) return { html: '' };

  const formatter = new TextFormatter(text);
  return formatter.format();
};

/**
 * Escapes HTML for ML highlighting mode
 * Preserves whitespace and newlines for span offset matching
 */
export function escapeHTMLForMLHighlighting(text: string): string {
  const escaped = (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  return `<div style="white-space: pre-wrap; line-height: 1.6; font-size: 0.9375rem; font-family: var(--font-geist-sans);">${escaped}</div>`;
}
