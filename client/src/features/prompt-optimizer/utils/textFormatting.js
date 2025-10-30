/**
 * Text Formatting Layer - Applies 2025 Design Principles
 *
 * Transforms Claude's text output into formatted HTML with inline styles
 * for a contentEditable experience. Users can edit while maintaining formatting.
 */

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param {string} str - The string to escape
 * @returns {string} HTML-safe string
 */
const escapeHtml = (str = '') =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/**
 * Text formatter class that handles parsing and HTML generation
 */
class TextFormatter {
  constructor(text) {
    this.rawText = String(text);
    this.lines = this.rawText.split(/\r?\n/);
    this.result = [];
    this.endsWithNewline = /\r?\n$/.test(this.rawText);
  }

  /**
   * Determines if a newline should be appended after a line
   */
  shouldAppendNewline(index) {
    if (!Number.isInteger(index)) return false;
    if (index < this.lines.length - 1) {
      return true;
    }
    return index === this.lines.length - 1 && this.endsWithNewline;
  }

  /**
   * Appends a block of HTML with appropriate newline handling
   */
  appendBlock(html, lineIndex) {
    this.result.push(html);
    if (this.shouldAppendNewline(lineIndex)) {
      this.result.push('\n');
    }
  }

  /**
   * Pushes a gap (empty line) element
   */
  pushGap(lineIndex) {
    this.appendBlock('<div class="prompt-line prompt-line--gap" data-variant="gap"><br /></div>', lineIndex);
  }

  /**
   * Pushes a separator line
   */
  pushSeparator(lineIndex) {
    this.appendBlock('<div class="prompt-line prompt-line--separator" data-variant="separator">———</div>', lineIndex);
  }

  /**
   * Pushes a heading element
   */
  pushHeading(raw, lineIndex) {
    const cleaned = raw.replace(/^#{1,6}\s+/, '').replace(/^\*\*(.+)\*\*:?$/, '$1').trim();
    const className = 'prompt-line prompt-line--heading';
    this.appendBlock(`<div class="${className}" data-variant="heading">${escapeHtml(cleaned)}</div>`, lineIndex);
  }

  /**
   * Pushes a section element (text ending with colon)
   */
  pushSection(raw, lineIndex) {
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
  pushParagraph(raw, lineIndex) {
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
  pushOrderedItem(label, text, lineIndex, isLastInGroup) {
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
  pushBulletItem(text, lineIndex, isLastInGroup) {
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
  isSeparator(trimmed) {
    return /^[=\-*_━─═▬▭]{3,}$/.test(trimmed);
  }

  /**
   * Checks if a line is a heading
   */
  isHeading(trimmed) {
    return /^#{1,6}\s+/.test(trimmed) || /^\*\*[^*]+\*\*:?$/.test(trimmed) || /^[A-Z][A-Z\s]{3,}$/.test(trimmed);
  }

  /**
   * Checks if a line is an ordered list item
   */
  isOrderedItem(trimmed) {
    return /^\d+\.\s+/.test(trimmed);
  }

  /**
   * Checks if a line is a bullet list item
   */
  isBulletItem(trimmed) {
    return /^[-*•]\s+/.test(trimmed);
  }

  /**
   * Checks if a line is a section header (ends with colon)
   */
  isSection(trimmed) {
    return /^.+:$/.test(trimmed);
  }

  /**
   * Checks if a line is a blockquote
   */
  isBlockquote(trimmed) {
    return /^>\s*/.test(trimmed);
  }

  /**
   * Processes all lines and generates formatted HTML
   */
  format() {
    for (let i = 0; i < this.lines.length; i += 1) {
      const lineIndex = i;
      const line = this.lines[i];
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
        while (i < this.lines.length && this.isOrderedItem(this.lines[i].trim())) {
          const currentIndex = i;
          const current = this.lines[currentIndex].trim();
          const match = current.match(/^(\d+)\.\s+(.*)$/);
          const nextBreaks = i + 1 >= this.lines.length || this.lines[i + 1].trim() === '' || !this.isOrderedItem(this.lines[i + 1].trim());
          if (match) {
            this.pushOrderedItem(`${match[1]}.`, match[2], currentIndex, nextBreaks);
          }
          i += 1;
        }
        i -= 1;
        continue;
      }

      // Handle bullet lists
      if (this.isBulletItem(trimmed)) {
        while (i < this.lines.length && this.isBulletItem(this.lines[i].trim())) {
          const currentIndex = i;
          const current = this.lines[currentIndex].trim().replace(/^[-*•]\s+/, '');
          const nextBreaks = i + 1 >= this.lines.length || this.lines[i + 1].trim() === '' || !this.isBulletItem(this.lines[i + 1].trim());
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
 * @param {string} text - Raw text input
 * @returns {Object} { html: string } - Formatted HTML
 */
export const formatTextToHTML = (text) => {
  if (text == null) return { html: '' };

  const formatter = new TextFormatter(text);
  return formatter.format();
};
