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
 * Transforms Claude's text output into a visually rich, typographically styled
 * presentation WITHOUT modifying the source. Uses proper heading hierarchy,
 * refined typography, and removes markdown symbols.
 *
 * Preserves original text for:
 * - Copy operations (toolbar & selection)
 * - Export operations (all formats)
 * - Text editing (strips formatting back to plain text)
 */
const parseAndFormatText = (text) => {
  if (!text) return [];

  const lines = text.split('\n');
  const elements = [];
  let i = 0;

  // Helper function to remove emojis
  const removeEmojis = (str) => {
    return str.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Skip empty lines but preserve spacing
    if (!trimmedLine) {
      elements.push({ type: 'spacer', key: `spacer-${i}` });
      i++;
      continue;
    }

    // Headers surrounded by separator lines (=== or --- or *** or Unicode box drawing)
    // Include Unicode box drawing characters: ━ ─ ═ ▬ ▭ etc.
    if (trimmedLine.match(/^[=\-*_━─═▬▭]+$/)) {
      // Check if this is the start of a surrounded header
      if (i + 2 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const afterLine = lines[i + 2].trim();

        if (nextLine && nextLine.length > 0 && afterLine.match(/^[=\-*_━─═▬▭]+$/)) {
          // This is a surrounded header - biggest size
          const cleanText = removeEmojis(nextLine);
          elements.push({ type: 'title', text: cleanText, key: `title-${i}` });
          i += 3; // Skip the opening line, text, and closing line
          continue;
        }
      }
      // If not part of surrounded header, just skip the line itself
      i++;
      continue;
    }

    // Main headings (ALL CAPS or lines with ### or **) - second largest
    if (trimmedLine.match(/^[A-Z\s]{5,}:?$/) ||
        trimmedLine.match(/^#{1,3}\s+(.+)$/) ||
        trimmedLine.match(/^\*\*(.+)\*\*:?$/)) {
      const cleanText = removeEmojis(
        trimmedLine
          .replace(/^#+\s+/, '')
          .replace(/^\*\*(.+)\*\*:?$/, '$1')
          .replace(/:$/, '')
      );
      elements.push({ type: 'heading', text: cleanText, key: `heading-${i}` });
      i++;
      continue;
    }

    // Section headers (lines ending with colon) - third largest
    if (trimmedLine.match(/^.+:$/)) {
      const cleanText = removeEmojis(trimmedLine.replace(/:$/, ''));
      elements.push({ type: 'subheading', text: cleanText, key: `subheading-${i}` });
      i++;
      continue;
    }

    // Bullet points
    if (trimmedLine.match(/^[-•]\s+(.+)$/)) {
      const cleanText = removeEmojis(trimmedLine.replace(/^[-•]\s+/, ''));
      elements.push({ type: 'bullet', text: cleanText, key: `bullet-${i}` });
      i++;
      continue;
    }

    // Numbered lists
    if (trimmedLine.match(/^\d+\.\s+(.+)$/)) {
      const match = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
      elements.push({ type: 'numbered', number: match[1], text: removeEmojis(match[2]), key: `numbered-${i}` });
      i++;
      continue;
    }

    // Regular paragraph text
    let paragraphLines = [trimmedLine];
    i++;
    // Collect consecutive non-empty lines that aren't special formats
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

    const paragraphText = removeEmojis(paragraphLines.join(' ').replace(/\*\*/g, ''));
    elements.push({
      type: 'paragraph',
      text: paragraphText,
      key: `paragraph-${i}`
    });
  }

  return elements;
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

  // Parse text into structured elements (memoized for performance)
  const parsedElements = useMemo(() => parseAndFormatText(displayedPrompt), [displayedPrompt]);

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
                className="min-h-[calc(100vh-8rem)] outline-none focus:outline-none"
                style={{
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
                }}
                role="article"
                aria-label="Optimized prompt"
              >
                {parsedElements.length === 0 ? (
                  <p className="text-neutral-400 text-sm">Your optimized prompt will appear here...</p>
                ) : (
                  parsedElements.map((element) => {
                    switch (element.type) {
                      case 'title':
                        return (
                          <h1
                            key={element.key}
                            className="text-2xl font-bold text-neutral-900 mb-6 mt-12 first:mt-0 tracking-tight"
                          >
                            {element.text}
                          </h1>
                        );
                      case 'heading':
                        return (
                          <h2
                            key={element.key}
                            className="text-xl font-semibold text-neutral-900 mb-4 mt-8 tracking-tight"
                          >
                            {element.text}
                          </h2>
                        );
                      case 'subheading':
                        return (
                          <h3
                            key={element.key}
                            className="text-base font-semibold text-neutral-800 mb-3 mt-6 tracking-tight"
                          >
                            {element.text}
                          </h3>
                        );
                      case 'bullet':
                        return (
                          <div key={element.key} className="flex gap-3 mb-2">
                            <span className="text-neutral-400 mt-1 flex-shrink-0">•</span>
                            <p className="text-[15px] text-neutral-700 leading-relaxed flex-1">
                              {element.text}
                            </p>
                          </div>
                        );
                      case 'numbered':
                        return (
                          <div key={element.key} className="flex gap-3 mb-2">
                            <span className="text-neutral-500 font-medium mt-0.5 flex-shrink-0 text-sm">
                              {element.number}.
                            </span>
                            <p className="text-[15px] text-neutral-700 leading-relaxed flex-1">
                              {element.text}
                            </p>
                          </div>
                        );
                      case 'paragraph':
                        return (
                          <p
                            key={element.key}
                            className="text-[15px] text-neutral-700 leading-relaxed mb-4"
                          >
                            {element.text}
                          </p>
                        );
                      case 'spacer':
                        return <div key={element.key} className="h-2" />;
                      default:
                        return null;
                    }
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - AI Suggestions Panel (Always Visible) */}
      <SuggestionsPanel suggestionsData={suggestionsData || { show: false }} />
    </div>
  );
};
