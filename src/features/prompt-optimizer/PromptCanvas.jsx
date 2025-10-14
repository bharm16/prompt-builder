import React, { useRef, useEffect, useState, memo } from 'react';
import {
  Copy,
  Download,
  Plus,
  FileText,
  Check,
} from 'lucide-react';
import { SuggestionsPanel } from '../../components/PromptEnhancementEditor';
import { useToast } from '../../components/Toast';

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

  // Update contentEditable div when displayedPrompt changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.textContent !== displayedPrompt) {
      editorRef.current.textContent = displayedPrompt;
    }
  }, [displayedPrompt]);

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
      onFetchSuggestions(cleanedText, text, displayedPrompt, range);
    }
  };

  const handleCopyEvent = (e) => {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      const selectedText = selection.toString();
      e.clipboardData.setData('text/plain', selectedText);
      e.preventDefault();
    }
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
                  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system',
                  letterSpacing: '-0.011em'
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
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => {
                  onDisplayedPromptChange(e.currentTarget.textContent);
                  onSkipAnimation(true);
                }}
                onMouseUp={handleTextSelection}
                onCopy={handleCopyEvent}
                className="min-h-[calc(100vh-8rem)] text-[15px] text-neutral-900 outline-none focus:outline-none"
                style={{
                  lineHeight: '1.7',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system',
                  letterSpacing: '-0.011em'
                }}
                role="textbox"
                aria-label="Optimized prompt (editable)"
                aria-multiline="true"
                data-placeholder="Your optimized prompt will appear here..."
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
