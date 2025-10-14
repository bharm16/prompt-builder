import React, { useRef, useEffect, useState, memo } from 'react';
import {
  User,
  Edit,
  Check,
  X,
  Copy,
  Download,
  Plus,
  FileText,
} from 'lucide-react';
import { SuggestionsPanel } from '../../components/PromptEnhancementEditor';
import { useToast } from '../../components/Toast';

// Canvas Toolbar Component
const CanvasToolbar = memo(({
  currentMode,
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
    <div className="sticky top-0 z-10 flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        {/* Left actions group */}
        <button
          onClick={onCopy}
          className={`btn-ghost btn-sm hover-scale ${copied ? 'text-success-600' : ''}`}
          aria-label={copied ? 'Prompt copied' : 'Copy prompt'}
          title="Copy (⌘C)"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
        </button>

        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => onToggleExportMenu(!showExportMenu)}
            className="btn-ghost btn-sm hover-scale"
            aria-expanded={showExportMenu}
            aria-label="Export menu"
            title="Export"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
          {showExportMenu && (
            <div className="dropdown-menu top-full mt-2 w-44 left-0">
              <button
                onClick={() => onExport('text')}
                className="dropdown-item"
              >
                <FileText className="h-4 w-4" />
                Text (.txt)
              </button>
              <button
                onClick={() => onExport('markdown')}
                className="dropdown-item"
              >
                <FileText className="h-4 w-4" />
                Markdown (.md)
              </button>
              <button
                onClick={() => onExport('json')}
                className="dropdown-item"
              >
                <FileText className="h-4 w-4" />
                JSON (.json)
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onCreateNew}
          className="btn-primary btn-sm hover-scale"
          title="New prompt (⌘N)"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New</span>
        </button>
      </div>
    </div>
  );
});

CanvasToolbar.displayName = 'CanvasToolbar';

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
  const [isEditingInput, setIsEditingInput] = useState(false);
  const [editedInput, setEditedInput] = useState('');
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

  const handleEdit = () => {
    setIsEditingInput(true);
    setEditedInput(inputPrompt);
  };

  const handleSaveEdit = async () => {
    if (!editedInput.trim()) {
      toast.warning('Input cannot be empty');
      return;
    }
    setIsEditingInput(false);
    // Parent component should handle re-optimization
    if (onDisplayedPromptChange) {
      onDisplayedPromptChange(editedInput);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingInput(false);
    setEditedInput('');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(displayedPrompt);
    setCopied(true);
    toast.success('Copied to clipboard!');
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
      // Remove leading dash and whitespace from bullet points for suggestions
      const cleanedText = text.replace(/^-\s*/, '');
      const range = selection.getRangeAt(0).cloneRange();
      // Pass both cleaned text (for suggestions) and original text (for replacement)
      onFetchSuggestions(cleanedText, text, displayedPrompt, range);
    }
  };

  const handleCopyEvent = (e) => {
    // Ensure proper text copying from contentEditable
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      const selectedText = selection.toString();
      e.clipboardData.setData('text/plain', selectedText);
      e.preventDefault();
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden animate-fade-in" style={{ marginLeft: 'var(--sidebar-width, 0px)' }}>
      {/* Your Input Container - Full Width */}
      <div className="flex-shrink-0 w-full border-b border-neutral-200 bg-gradient-to-b from-neutral-50/50 to-transparent">
        <div className="max-w-3xl mx-auto px-8 py-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Your Input
                </span>
                {!isEditingInput && (
                  <button
                    onClick={handleEdit}
                    className="text-neutral-400 hover:text-neutral-700 transition-colors"
                    aria-label="Edit input"
                    title="Edit your input"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {isEditingInput ? (
                <div className="space-y-3">
                  <textarea
                    value={editedInput}
                    onChange={(e) => setEditedInput(e.target.value)}
                    className="w-full resize-none bg-white border border-neutral-300 rounded-lg px-4 py-3 text-base text-neutral-900 leading-relaxed focus:border-neutral-400 focus:outline-none transition-all shadow-sm"
                    rows={3}
                    autoFocus
                    placeholder="Enter your prompt..."
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveEdit}
                      className="btn-primary btn-sm hover-scale"
                      disabled={!editedInput.trim()}
                    >
                      <Check className="h-4 w-4" />
                      <span>Save & Re-optimize</span>
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="btn-ghost btn-sm hover-scale"
                    >
                      <X className="h-4 w-4" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-700 leading-relaxed">
                  {inputPrompt}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Canvas Toolbar - Full Width */}
      <CanvasToolbar
        currentMode={currentMode}
        onCopy={handleCopy}
        onExport={handleExport}
        onCreateNew={onCreateNew}
        copied={copied}
        showExportMenu={showExportMenu}
        onToggleExportMenu={setShowExportMenu}
      />

      {/* Canvas and Suggestions Container */}
      <div className="flex flex-1 items-start gap-0 overflow-hidden bg-white">
        {/* Canvas - Main Document */}
        <div className="flex-1 flex flex-col h-full">
          {/* Canvas Document Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-8 py-12">
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
                className="w-full min-h-screen bg-transparent text-[15px] leading-relaxed text-neutral-900 outline-none focus:outline-none transition-all duration-200"
                style={{
                  lineHeight: '1.75',
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

        {/* Right Side - Suggestions Panel */}
        <SuggestionsPanel suggestionsData={suggestionsData} />
      </div>
    </div>
  );
};