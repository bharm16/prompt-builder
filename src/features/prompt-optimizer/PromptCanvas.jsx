import React, { useRef, useEffect, useState, memo, useMemo } from 'react';
import {
  Copy,
  Download,
  Plus,
  FileText,
  Check,
} from 'lucide-react';
import { SuggestionsPanel } from '../../components/PromptEnhancementEditor';
import { useToast } from '../../components/Toast';

/**
 * Text Formatting Layer - Applies 2025 Design Principles
 *
 * Transforms Claude's text output into formatted HTML with inline styles
 * for a contentEditable experience. Users can edit while maintaining formatting.
 */
const formatTextToHTML = (text) => {
  if (!text) return '';

  const lines = text.split('\n');
  let html = '';
  let i = 0;

  // Helper function to remove emojis
  const removeEmojis = (str) => {
    return str.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
  };

  // Escape HTML to prevent XSS
  const escapeHtml = (str) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip empty lines but preserve spacing
    if (!trimmedLine) {
      html += '<div style="height: 0.5rem;"></div>';
      i++;
      continue;
    }

    // Headers surrounded by separator lines
    if (trimmedLine.match(/^[=\-*_━─═▬▭]+$/)) {
      if (i + 2 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const afterLine = lines[i + 2].trim();

        if (nextLine && nextLine.length > 0 && afterLine.match(/^[=\-*_━─═▬▭]+$/)) {
          const cleanText = escapeHtml(removeEmojis(nextLine));
          html += `<h1 style="font-size: 1.5rem; font-weight: 700; color: rgb(23, 23, 23); margin-bottom: 1.5rem; margin-top: 3rem; line-height: 1.2; letter-spacing: -0.025em;">${cleanText}</h1>`;
          i += 3;
          continue;
        }
      }
      i++;
      continue;
    }

    // Main headings (ALL CAPS or lines with ### or **)
    if (trimmedLine.match(/^[A-Z\s]{5,}:?$/) ||
        trimmedLine.match(/^#{1,3}\s+(.+)$/) ||
        trimmedLine.match(/^\*\*(.+)\*\*:?$/)) {
      const cleanText = escapeHtml(removeEmojis(
        trimmedLine
          .replace(/^#+\s+/, '')
          .replace(/^\*\*(.+)\*\*:?$/, '$1')
          .replace(/:$/, '')
      ));
      html += `<h2 style="font-size: 1.25rem; font-weight: 600; color: rgb(23, 23, 23); margin-bottom: 1rem; margin-top: 2rem; line-height: 1.2; letter-spacing: -0.025em;">${cleanText}</h2>`;
      i++;
      continue;
    }

    // Section headers (lines ending with colon)
    if (trimmedLine.match(/^.+:$/)) {
      const cleanText = escapeHtml(removeEmojis(trimmedLine.replace(/:$/, '')));
      html += `<h3 style="font-size: 1rem; font-weight: 600; color: rgb(38, 38, 38); margin-bottom: 0.75rem; margin-top: 1.5rem; line-height: 1.2; letter-spacing: -0.025em;">${cleanText}</h3>`;
      i++;
      continue;
    }

    // Bullet points
    if (trimmedLine.match(/^[-•]\s+(.+)$/)) {
      const cleanText = escapeHtml(removeEmojis(trimmedLine.replace(/^[-•]\s+/, '')));
      html += `<div style="display: flex; gap: 0.75rem; margin-bottom: 0.5rem;"><span style="color: rgb(163, 163, 163); margin-top: 0.25rem; flex-shrink: 0;">•</span><p style="font-size: 15px; color: rgb(64, 64, 64); line-height: 1.625; flex: 1; margin: 0;">${cleanText}</p></div>`;
      i++;
      continue;
    }

    // Numbered lists
    if (trimmedLine.match(/^\d+\.\s+(.+)$/)) {
      const match = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
      const cleanText = escapeHtml(removeEmojis(match[2]));
      html += `<div style="display: flex; gap: 0.75rem; margin-bottom: 0.5rem;"><span style="color: rgb(115, 115, 115); font-weight: 500; margin-top: 0.125rem; flex-shrink: 0; font-size: 0.875rem;">${match[1]}.</span><p style="font-size: 15px; color: rgb(64, 64, 64); line-height: 1.625; flex: 1; margin: 0;">${cleanText}</p></div>`;
      i++;
      continue;
    }

    // Regular paragraph text
    let paragraphLines = [trimmedLine];
    i++;
    while (i < lines.length &&
           lines[i].trim() &&
           !lines[i].trim().match(/^[-•]\s+/) &&
           !lines[i].trim().match(/^\d+\.\s+/) &&
           !lines[i].trim().match(/^[A-Z\s]{5,}:?$/) &&
           !lines[i].trim().match(/^.+:$/) &&
           !lines[i].trim().match(/^#{1,3}\s+/) &&
           !lines[i].trim().match(/^\*\*(.+)\*\*:?$/) &&
           !lines[i].trim().match(/^[=\-*_━─═▬▭]+$/)) {
      paragraphLines.push(lines[i].trim());
      i++;
    }

    const paragraphText = escapeHtml(removeEmojis(paragraphLines.join(' ').replace(/\*\*/g, '')));
    html += `<p style="font-size: 15px; color: rgb(64, 64, 64); line-height: 1.625; margin-bottom: 1rem;">${paragraphText}</p>`;
  }

  return html;
};

// Minimal Floating Toolbar Component
const FloatingToolbar = memo(({
  onCopy,
  onExport,
  onCreateNew,
  copied,
  showExportMenu,
  onToggleExportMenu
}) => {
  const exportMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        onToggleExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu, onToggleExportMenu]);

  return (
    <div className="fixed top-4 right-6 z-20 flex items-center gap-1 bg-white border border-neutral-200 rounded-lg shadow-sm px-1 py-1">
      <button
        onClick={onCopy}
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          copied
            ? 'text-green-700 bg-green-50'
            : 'text-neutral-700 hover:bg-neutral-100'
        }`}
        aria-label={copied ? 'Prompt copied' : 'Copy prompt'}
        title="Copy"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied && <span className="text-xs">Copied</span>}
      </button>

      <div className="relative" ref={exportMenuRef}>
        <button
          onClick={() => onToggleExportMenu(!showExportMenu)}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-neutral-700 rounded-md hover:bg-neutral-100 transition-colors"
          aria-expanded={showExportMenu}
          title="Export"
        >
          <Download className="h-4 w-4" />
        </button>
        {showExportMenu && (
          <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 z-30">
            <button
              onClick={() => onExport('text')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <FileText className="h-4 w-4" />
              Text (.txt)
            </button>
            <button
              onClick={() => onExport('markdown')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <FileText className="h-4 w-4" />
              Markdown (.md)
            </button>
            <button
              onClick={() => onExport('json')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <FileText className="h-4 w-4" />
              JSON (.json)
            </button>
          </div>
        )}
      </div>

      <div className="w-px h-6 bg-neutral-200 mx-1" />

      <button
        onClick={onCreateNew}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-neutral-900 rounded-md hover:bg-neutral-800 transition-colors"
        title="New prompt"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
});

FloatingToolbar.displayName = 'FloatingToolbar';

// Main PromptCanvas Component
export const PromptCanvas = ({
  inputPrompt,
  displayedPrompt,
  optimizedPrompt,
  qualityScore,
  selectedMode,
  currentMode,
  onDisplayedPromptChange,
  onSkipAnimation,
  suggestionsData,
  onFetchSuggestions,
  onCreateNew
}) => {
  const [copied, setCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const editorRef = useRef(null);
  const toast = useToast();

  // Memoize formatted HTML
  const formattedHTML = useMemo(() => formatTextToHTML(displayedPrompt), [displayedPrompt]);

  const handleCopy = () => {
    navigator.clipboard.writeText(displayedPrompt);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = (format) => {
    let content = '';
    const timestamp = new Date().toLocaleString();

    if (format === 'markdown') {
      content = `# Prompt Optimization\n\n**Date:** ${timestamp}\n\n## Original Prompt\n${inputPrompt}\n\n## Optimized Prompt\n${displayedPrompt}`;
    } else if (format === 'json') {
      content = JSON.stringify(
        {
          timestamp,
          original: inputPrompt,
          optimized: displayedPrompt,
          qualityScore,
          mode: selectedMode,
        },
        null,
        2
      );
    } else {
      content = `PROMPT OPTIMIZATION\nDate: ${timestamp}\n\n=== ORIGINAL ===\n${inputPrompt}\n\n=== OPTIMIZED ===\n${displayedPrompt}`;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-optimization.${format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    toast.success(`Exported as ${format.toUpperCase()}`);
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    let text = selection.toString().trim();

    if (text.length > 0 && onFetchSuggestions) {
      const cleanedText = text.replace(/^-\s*/, '');
      const range = selection.getRangeAt(0).cloneRange();
      // Use original displayedPrompt (without formatting) for suggestions context
      onFetchSuggestions(cleanedText, text, displayedPrompt, range);
    }
  };

  const handleCopyEvent = (e) => {
    // Always copy the original unformatted text
    e.clipboardData.setData('text/plain', displayedPrompt);
    e.preventDefault();
  };

  const handleInput = (e) => {
    // Extract plain text from the contentEditable div
    const newText = e.currentTarget.innerText || e.currentTarget.textContent || '';
    if (onDisplayedPromptChange) {
      onDisplayedPromptChange(newText);
    }
  };

  // Update the editor content when displayedPrompt changes
  useEffect(() => {
    if (editorRef.current && formattedHTML) {
      // Only update if content has actually changed to preserve cursor position
      if (editorRef.current.innerHTML !== formattedHTML) {
        const selection = window.getSelection();
        const hadFocus = document.activeElement === editorRef.current;

        editorRef.current.innerHTML = formattedHTML;

        // Restore focus if it had it before
        if (hadFocus && selection) {
          try {
            editorRef.current.focus();
            // Move cursor to end
            const range = document.createRange();
            range.selectNodeContents(editorRef.current);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          } catch (e) {
            // Ignore errors with cursor positioning
          }
        }
      }
    }
  }, [formattedHTML]);

  return (
    <div className="fixed inset-0 flex bg-neutral-50" style={{ marginLeft: 'var(--sidebar-width, 0px)' }}>
      {/* Floating Toolbar */}
      <FloatingToolbar
        onCopy={handleCopy}
        onExport={handleExport}
        onCreateNew={onCreateNew}
        copied={copied}
        showExportMenu={showExportMenu}
        onToggleExportMenu={setShowExportMenu}
      />

      {/* Main Content Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Narrow Left Sidebar - Original Prompt */}
        <div className="w-72 flex-shrink-0 flex flex-col border-r border-neutral-200 bg-neutral-50 overflow-hidden">
          <div className="flex-shrink-0 px-5 py-4 border-b border-neutral-200 bg-white">
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
              Your Input
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-5">
              <div
                className="text-[13px] text-neutral-600 whitespace-pre-wrap"
                style={{
                  lineHeight: '1.6',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
                  letterSpacing: '-0.01em'
                }}
              >
                {inputPrompt}
              </div>
            </div>
          </div>
        </div>

        {/* Main Editor Area - Optimized Prompt */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-12 py-16">
              <div
                ref={editorRef}
                onMouseUp={handleTextSelection}
                onCopy={handleCopyEvent}
                onInput={handleInput}
                contentEditable
                suppressContentEditableWarning
                className="min-h-[calc(100vh-8rem)] outline-none focus:outline-none cursor-text"
                style={{
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
                  caretColor: 'rgb(23, 23, 23)',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                }}
                role="textbox"
                aria-label="Optimized prompt"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - AI Suggestions Panel (Always Visible) */}
      <SuggestionsPanel suggestionsData={suggestionsData || { show: false }} />
    </div>
  );
};
