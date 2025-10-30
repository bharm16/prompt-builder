/**
 * Export Service
 * Handles exporting prompts in various formats (text, markdown, JSON)
 */

/**
 * Export service for generating and downloading prompt files
 */
export class ExportService {
  /**
   * Exports prompt as plain text
   * @param {Object} params
   * @param {string} params.inputPrompt - Original prompt
   * @param {string} params.displayedPrompt - Optimized prompt
   * @returns {string} Plain text content
   */
  static exportAsText({ inputPrompt, displayedPrompt }) {
    const timestamp = new Date().toLocaleString();
    return `PROMPT OPTIMIZATION\nDate: ${timestamp}\n\n=== ORIGINAL ===\n${inputPrompt}\n\n=== OPTIMIZED ===\n${displayedPrompt}`;
  }

  /**
   * Exports prompt as markdown
   * @param {Object} params
   * @param {string} params.inputPrompt - Original prompt
   * @param {string} params.displayedPrompt - Optimized prompt
   * @returns {string} Markdown content
   */
  static exportAsMarkdown({ inputPrompt, displayedPrompt }) {
    const timestamp = new Date().toLocaleString();
    return `# Prompt Optimization\n\n**Date:** ${timestamp}\n\n## Original Prompt\n${inputPrompt}\n\n## Optimized Prompt\n${displayedPrompt}`;
  }

  /**
   * Exports prompt as JSON
   * @param {Object} params
   * @param {string} params.inputPrompt - Original prompt
   * @param {string} params.displayedPrompt - Optimized prompt
   * @param {number} [params.qualityScore] - Quality score
   * @param {string} [params.selectedMode] - Selected mode
   * @returns {string} JSON content
   */
  static exportAsJson({ inputPrompt, displayedPrompt, qualityScore, selectedMode }) {
    return JSON.stringify(
      {
        timestamp: new Date().toLocaleString(),
        original: inputPrompt,
        optimized: displayedPrompt,
        qualityScore,
        mode: selectedMode,
      },
      null,
      2
    );
  }

  /**
   * Downloads a file with the given content
   * @param {string} content - File content
   * @param {string} filename - Name of the file to download
   * @param {string} [mimeType='text/plain'] - MIME type
   */
  static downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Gets the appropriate file extension for a format
   * @param {string} format - Export format (text, markdown, json)
   * @returns {string} File extension
   */
  static getFileExtension(format) {
    const extensions = {
      text: 'txt',
      markdown: 'md',
      json: 'json',
    };
    return extensions[format] || 'txt';
  }

  /**
   * Gets the appropriate MIME type for a format
   * @param {string} format - Export format (text, markdown, json)
   * @returns {string} MIME type
   */
  static getMimeType(format) {
    const mimeTypes = {
      text: 'text/plain',
      markdown: 'text/markdown',
      json: 'application/json',
    };
    return mimeTypes[format] || 'text/plain';
  }

  /**
   * Exports and downloads a prompt in the specified format
   * @param {string} format - Export format (text, markdown, json)
   * @param {Object} data - Data to export
   */
  static export(format, data) {
    let content = '';

    switch (format) {
      case 'markdown':
        content = this.exportAsMarkdown(data);
        break;
      case 'json':
        content = this.exportAsJson(data);
        break;
      case 'text':
      default:
        content = this.exportAsText(data);
        break;
    }

    const filename = `prompt-optimization.${this.getFileExtension(format)}`;
    const mimeType = this.getMimeType(format);

    this.downloadFile(content, filename, mimeType);
  }
}
