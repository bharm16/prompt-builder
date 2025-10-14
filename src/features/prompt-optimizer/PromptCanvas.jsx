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
    <div className="sticky top-0 z-10 flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-neutral-200 bg-neutral-50 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-neutral-600">{currentMode.name}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onCopy}
          className={`btn-ghost btn-sm hover-scale ripple ${copied ? 'text-success-600' : ''}`}
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
            <div className="dropdown-menu top-full mt-2 w-44 right-0">
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

        <button
          onClick={onCreateNew}
          className="btn-primary btn-sm hover-scale ripple"
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

// Input Edit Section Component
const InputEditSection = ({
  inputPrompt,
  isEditingInput,
  editedInput,
  onEditChange,
  onEdit,
  onSaveEdit,
  onCancelEdit
}) => {
  return (
    <div className="flex-shrink-0 w-full bg-gradient-to-r from-neutral-50 to-neutral-100 border-b-2 border-neutral-200 px-4 py-2">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary-600" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">
              Your Input
            </h3>
          </div>
          {!isEditingInput && (
            <button
              onClick={onEdit}
              className="btn-ghost btn-sm hover-scale"
              aria-label="Edit input"
              title="Edit your input"
            >
              <Edit className="h-3.5 w-3.5" />
              <span className="text-xs">Edit</span>
            </button>
          )}
        </div>

        {isEditingInput ? (
          <div className="space-y-3">
            <textarea
              value={editedInput}
              onChange={(e) => onEditChange(e.target.value)}
              className="w-full resize-none bg-white border-2 border-primary-300 rounded-lg px-4 py-3 text-base text-neutral-900 leading-relaxed focus:border-primary-500 focus:ring focus:ring-primary-500 focus:ring-opacity-20 transition-colors"
              rows={4}
              autoFocus
              placeholder="Enter your prompt..."
            />
            <div className="flex items-center gap-2">
              <button
                onClick={onSaveEdit}
                className="btn-primary btn-sm hover-scale ripple"
                disabled={!editedInput.trim()}
              >
                <Check className="h-4 w-4" />
                <span>Save & Re-optimize</span>
              </button>
              <button
                onClick={onCancelEdit}
                className="btn-secondary btn-sm hover-scale"
              >
                <X className="h-4 w-4" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="text-base text-neutral-900 leading-relaxed">
            {inputPrompt}
          </p>
        )}
      </div>
    </div>
  );
};

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

  return (
    <div className="flex flex-col h-full w-full overflow-hidden animate-fade-in">
      {/* Your Input Container */}
      <InputEditSection
        inputPrompt={inputPrompt}
        isEditingInput={isEditingInput}
        editedInput={editedInput}
        onEditChange={setEditedInput}
        onEdit={handleEdit}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={handleCancelEdit}
      />

      {/* Canvas Toolbar */}
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
      <div className="flex flex-1 items-start gap-0 overflow-hidden">
        {/* Canvas - Main Document */}
        <div className="flex-1 flex flex-col h-full bg-white border-r border-neutral-200 shadow-lg">
          {/* Canvas Document Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 py-4">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => {
                  onDisplayedPromptChange(e.currentTarget.textContent);
                  onSkipAnimation(true);
                }}
                onMouseUp={handleTextSelection}
                className="w-full resize-none bg-transparent font-sans text-sm leading-loose text-neutral-900 outline-none border-0 focus:outline-none"
                style={{
                  minHeight: 'calc(100vh - 200px)',
                  lineHeight: '1.8',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                  paddingLeft: '3em',
                  textIndent: '-3em'
                }}
                role="textbox"
                aria-label="Optimized prompt (editable)"
                aria-multiline="true"
              >
                {!displayedPrompt && <span className="text-neutral-400">Your optimized prompt will appear here...</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Suggestions Panel */}
        <SuggestionsPanel suggestionsData={suggestionsData} />
      </div>
    </div>
  );
};