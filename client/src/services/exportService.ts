/**
 * Export Service
 * Handles exporting prompts in various formats (text, markdown, JSON)
 */

type ExportFormat = 'text' | 'markdown' | 'json';

interface ExportData {
  inputPrompt: string;
  displayedPrompt: string;
  qualityScore?: number;
  selectedMode?: string;
}

/**
 * Export service for generating and downloading prompt files
 */
export class ExportService {
  /**
   * Exports prompt as plain text
   */
  static exportAsText({ inputPrompt, displayedPrompt }: ExportData): string {
    const timestamp = new Date().toLocaleString();
    return `PROMPT OPTIMIZATION\nDate: ${timestamp}\n\n=== ORIGINAL ===\n${inputPrompt}\n\n=== OPTIMIZED ===\n${displayedPrompt}`;
  }

  /**
   * Exports prompt as markdown
   */
  static exportAsMarkdown({ inputPrompt, displayedPrompt }: ExportData): string {
    const timestamp = new Date().toLocaleString();
    return `# Prompt Optimization\n\n**Date:** ${timestamp}\n\n## Original Prompt\n${inputPrompt}\n\n## Optimized Prompt\n${displayedPrompt}`;
  }

  /**
   * Exports prompt as JSON
   */
  static exportAsJson({
    inputPrompt,
    displayedPrompt,
    qualityScore,
    selectedMode,
  }: ExportData): string {
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
   */
  static downloadFile(
    content: string,
    filename: string,
    mimeType: string = 'text/plain'
  ): void {
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
   */
  static getFileExtension(format: ExportFormat): string {
    const extensions: Record<ExportFormat, string> = {
      text: 'txt',
      markdown: 'md',
      json: 'json',
    };
    return extensions[format] || 'txt';
  }

  /**
   * Gets the appropriate MIME type for a format
   */
  static getMimeType(format: ExportFormat): string {
    const mimeTypes: Record<ExportFormat, string> = {
      text: 'text/plain',
      markdown: 'text/markdown',
      json: 'application/json',
    };
    return mimeTypes[format] || 'text/plain';
  }

  /**
   * Exports and downloads a prompt in the specified format
   */
  static export(format: ExportFormat, data: ExportData): void {
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

