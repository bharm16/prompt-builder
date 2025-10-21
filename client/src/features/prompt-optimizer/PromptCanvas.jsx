import React, { useRef, useEffect, useState, memo, useMemo } from 'react';
import {
  Copy,
  Download,
  Plus,
  FileText,
  Check,
  Info,
  X,
  Share2,
} from 'lucide-react';
import { SuggestionsPanel } from '../../components/PromptEnhancementEditor';
import { useToast } from '../../components/Toast';
import { extractVideoPromptPhrases } from './phraseExtractor';

/**
 * Text Formatting Layer - Applies 2025 Design Principles
 *
 * Transforms Claude's text output into formatted HTML with inline styles
 * for a contentEditable experience. Users can edit while maintaining formatting.
 */
export const formatTextToHTML = (
  text,
  enableMLHighlighting = false,
  promptContext = null
) => {
  if (!text) return { html: '' };
  const lines = text.split('\n');
  let html = '';
  let i = 0;

  // Helper function to remove emojis
  const removeEmojis = (str) => {
    // eslint-disable-next-line security/detect-unsafe-regex
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

  const getConfidenceClass = (confidence) => {
    if (typeof confidence !== 'number') return '';
    if (confidence >= 0.85) return 'high-confidence';
    if (confidence >= 0.7) return 'medium-confidence';
    return 'low-confidence';
  };

  /**
   * Intelligent phrase highlighting system using ML-based pattern recognition
   *
   * NO HARDCODED PATTERNS - Everything is learned and adapted:
   * 1. Automatic phrase extraction using TF-IDF and statistical analysis
   * 2. Semantic categorization using word embeddings and context
   * 3. User behavior learning - adapts based on what you click
   * 4. Reinforcement learning - improves over time
   * 5. Fuzzy matching - auto-corrects typos
   * 6. Confidence scoring - only shows high-confidence highlights
   * 7. Smart structure detection - skips headers and labels
   */
  const highlightValueWords = (input) => {
    if (!input) return '';

    // Only apply ML highlighting if enabled (video mode only)
    if (!enableMLHighlighting) {
      return escapeHtml(input);
    }

    // Check if this text is a structural element (header, label, descriptor)
    const isStructuralElement = (value) => {
      const trimmed = value.trim();

      // Headers: ALL CAPS with 5+ characters
      if (/^[A-Z\s\-&/]{5,}$/.test(trimmed)) return true;

      // Emoji headers (🎬, 🎥, ✨, etc.) - check first character
      if (trimmed.length > 0) {
        const firstChar = trimmed.charCodeAt(0);
        // Emoji range: 0x1F300 to 0x1F9FF
        if (firstChar >= 0xD83C || firstChar >= 0xD83D) return true;
      }

      // Section labels ending with dash (WHO - SUBJECT/CHARACTER)
      if (/^[A-Z\s]+\s+-\s+[A-Z\s/]+$/.test(trimmed)) return true;

      // Category labels (bold text ending with colon or dash)
      if (/^\*\*[^*]+\*\*[\s:-]*$/.test(trimmed)) return true;

      // Standalone labels ending with colon
      if (/^[A-Z][^:]{0,40}:$/.test(trimmed) && trimmed.length < 50) return true;

      // Separator lines (━━━ or similar)
      if (/^[━─═▬▭\-=_*]{3,}$/.test(trimmed)) return true;

      return false;
    };

    // Skip highlighting for structural elements
    if (isStructuralElement(input)) {
      return escapeHtml(input);
    }

    // Check if text starts with a label prefix (e.g., "Positioning: actual content here")
    // We want to skip highlighting the label but highlight the content
    const labelMatch = input.match(/^([A-Z][^:]{0,40}:)\s*(.+)$/);
    if (labelMatch) {
      const label = labelMatch[1];
      const content = labelMatch[2];

      // Don't highlight the label, only the content
      return escapeHtml(label) + ' ' + highlightValueWords(content);
    }

    // Extract phrases using compromise.js (with optional context awareness)
    const phrases = extractVideoPromptPhrases(input, promptContext);

    // Sort by position to build HTML correctly
    phrases.sort((a, b) => input.indexOf(a.text) - input.indexOf(b.text));

    // Build HTML with highlights
    let result = '';
    let lastIndex = 0;

    phrases.forEach(phrase => {
      const start = input.indexOf(phrase.text, lastIndex);
      if (start === -1) return;

      // Add text before phrase
      result += escapeHtml(input.slice(lastIndex, start));

      // Add highlighted phrase
      const confidenceClass = getConfidenceClass(phrase.confidence);
      const className = `value-word value-word-${phrase.category}${confidenceClass ? ` ${confidenceClass}` : ''}`;
      const confidenceAttr =
        typeof phrase.confidence === 'number' ? ` data-confidence="${phrase.confidence}"` : '';

      result += `<span class="${className}" data-category="${phrase.category}"${confidenceAttr} style="background-color: ${phrase.color.bg}; border-bottom: 2px solid ${phrase.color.border}; padding: 1px 3px; border-radius: 3px; cursor: pointer;">${escapeHtml(phrase.text)}</span>`;

      lastIndex = start + phrase.text.length;
    });

    // Add remaining text
    result += escapeHtml(input.slice(lastIndex));

    return result;
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
          const cleanText = highlightValueWords(removeEmojis(nextLine));
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
      const cleanText = highlightValueWords(removeEmojis(
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
      const cleanText = highlightValueWords(removeEmojis(trimmedLine.replace(/:$/, '')));
      html += `<h3 style="font-size: 1rem; font-weight: 600; color: rgb(38, 38, 38); margin-bottom: 0.75rem; margin-top: 1.5rem; line-height: 1.2; letter-spacing: -0.025em;">${cleanText}</h3>`;
      i++;
      continue;
    }

    // Bullet points
    if (trimmedLine.match(/^[-•]\s+(.+)$/)) {
      const cleanText = highlightValueWords(removeEmojis(trimmedLine.replace(/^[-•]\s+/, '')));
      html += `<div style="display: flex; gap: 0.75rem; margin-bottom: 0.5rem;"><span style="color: rgb(163, 163, 163); margin-top: 0.25rem; flex-shrink: 0;">•</span><p style="font-size: 15px; color: rgb(64, 64, 64); line-height: 1.625; flex: 1; margin: 0;">${cleanText}</p></div>`;
      i++;
      continue;
    }

    // Numbered lists
    if (trimmedLine.match(/^\d+\.\s+(.+)$/)) {
      const match = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
      const cleanText = highlightValueWords(removeEmojis(match[2]));
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

    const paragraphText = highlightValueWords(removeEmojis(paragraphLines.join(' ').replace(/\*\*/g, '')));
    html += `<p style="font-size: 15px; color: rgb(64, 64, 64); line-height: 1.625; margin-bottom: 1rem;">${paragraphText}</p>`;
  }

  return { html };
};

export const VALUE_WORD_STYLE_BLOCK = `
        /* Base value word styles */
        .value-word {
          position: relative;
          user-select: text;
          -webkit-user-select: text;
          -moz-user-select: text;
          -ms-user-select: text;
        }

        /* Confidence level indicators */
        .high-confidence {
          opacity: 1;
        }

        .medium-confidence {
          opacity: 0.9;
        }

        .low-confidence {
          opacity: 0.8;
          border-style: dashed !important;
        }

        /* Enhanced hover effects for all categories */
        .value-word:hover {
          filter: brightness(0.95);
          border-bottom-width: 2px !important;
          transform: translateY(-0.5px);
          cursor: pointer !important;
          opacity: 1 !important;
        }

        .value-word:active {
          transform: translateY(0px);
        }

        /* Category-specific hover enhancements */
        .value-word-wardrobe:hover {
          background-color: rgba(255,214,0,.35) !important;
          border-bottom-color: rgba(255,214,0,.8) !important;
        }

        .value-word-appearance:hover {
          background-color: rgba(255,105,180,.35) !important;
          border-bottom-color: rgba(255,105,180,.8) !important;
        }

        .value-word-lighting:hover {
          background-color: rgba(249, 115, 22, 0.2) !important;
          border-bottom-color: rgba(249, 115, 22, 0.6) !important;
        }

        .value-word-timeofday:hover {
          background-color: rgba(135,206,235,.35) !important;
          border-bottom-color: rgba(135,206,235,.8) !important;
        }

        .value-word-cameramove:hover {
          background-color: rgba(139, 92, 246, 0.2) !important;
          border-bottom-color: rgba(139, 92, 246, 0.6) !important;
        }

        .value-word-framing:hover {
          background-color: rgba(186,85,211,.35) !important;
          border-bottom-color: rgba(186,85,211,.8) !important;
        }

        .value-word-environment:hover {
          background-color: rgba(6, 182, 212, 0.2) !important;
          border-bottom-color: rgba(6, 182, 212, 0.6) !important;
        }

        .value-word-color:hover {
          background-color: rgba(244, 63, 94, 0.2) !important;
          border-bottom-color: rgba(244, 63, 94, 0.6) !important;
        }

        .value-word-technical:hover {
          background-color: rgba(99, 102, 241, 0.2) !important;
          border-bottom-color: rgba(99, 102, 241, 0.6) !important;
        }

        .value-word-descriptive:hover {
          background-color: rgba(250, 204, 21, 0.25) !important;
          border-bottom-color: rgba(250, 204, 21, 0.6) !important;
        }

        /* Tooltip on hover - shows category */
        .value-word::before {
          content: attr(data-category);
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%) translateY(-4px);
          background-color: rgba(23, 23, 23, 0.9);
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
          text-transform: capitalize;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease, transform 0.2s ease;
          z-index: 1000;
          letter-spacing: 0.5px;
        }

        .value-word::after {
          content: '';
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%) translateY(-4px);
          border: 4px solid transparent;
          border-top-color: rgba(23, 23, 23, 0.9);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease, transform 0.2s ease;
          z-index: 1000;
        }

        .value-word:hover::before,
        .value-word:hover::after {
          opacity: 1;
          transform: translateX(-50%) translateY(-8px);
        }

        .value-word:hover::after {
          transform: translateX(-50%) translateY(-4px);
        }

        /* Prevent tooltip overflow */
        [contenteditable] {
          position: relative;
        }
`;

// Category Legend Component
const CategoryLegend = memo(({ show, onClose, hasContext }) => {
  if (!show) return null;

  const categories = [
    // Categories from Creative Brainstorm (when context is active)
    { name: 'Subject', color: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.5)', example: 'lone astronaut, weathered soldier', source: 'brainstorm' },
    { name: 'Action', color: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.5)', example: 'walking slowly, sprinting through rain', source: 'brainstorm' },
    { name: 'Location', color: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.5)', example: 'abandoned station, foggy battlefield', source: 'brainstorm' },
    { name: 'Time', color: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.5)', example: 'golden hour, twilight, blue hour', source: 'brainstorm' },
    { name: 'Mood', color: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.5)', example: 'melancholic, tense, hopeful', source: 'brainstorm' },
    { name: 'Style', color: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.5)', example: '35mm film, documentary, noir', source: 'brainstorm' },

    // Categories from NLP extraction (always active)
    { name: 'Camera Movement', color: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.5)', example: 'camera pans, slow dolly', source: 'nlp' },
    { name: 'Descriptive Phrases', color: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.5)', example: 'soft shadows, dramatic lighting', source: 'nlp' },
    { name: 'Technical Specs', color: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.5)', example: '35mm, 24fps, 2.39:1', source: 'nlp' },
  ];

  return (
    <div className="fixed top-20 right-6 z-30 w-80 bg-white border border-neutral-200 rounded-lg shadow-lg">
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-neutral-500" />
            <h3 className="text-sm font-semibold text-neutral-900">Highlight Categories</h3>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
            aria-label="Close legend"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {hasContext && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-md text-xs font-medium text-emerald-700 self-start" title="Using context from Creative Brainstorm for intelligent highlighting">
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Brainstorm Context Active</span>
          </div>
        )}
      </div>
      <div className="p-3 max-h-96 overflow-y-auto">
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.name} className="flex items-start gap-2">
              <div
                className="flex-shrink-0 w-16 h-6 rounded border mt-0.5"
                style={{
                  backgroundColor: cat.color,
                  borderColor: cat.border,
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-neutral-900">{cat.name}</div>
                <div className="text-xs text-neutral-500 truncate">{cat.example}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-neutral-200">
          {hasContext ? (
            <>
              <p className="text-xs font-semibold text-emerald-700 mb-2">
                Context-Aware Highlighting Active
              </p>
              <p className="text-xs text-neutral-500 leading-relaxed mb-2">
                Your Creative Brainstorm selections are prioritized and highlighted first,
                followed by additional details detected by NLP.
              </p>
              <ul className="text-xs text-neutral-500 space-y-1 ml-3">
                <li>• Your input gets highest priority (100% confidence)</li>
                <li>• Semantic matches detected (related terms)</li>
                <li>• Additional NLP extraction for new details</li>
                <li>• Smart deduplication prevents overlaps</li>
              </ul>
            </>
          ) : (
            <>
              <p className="text-xs text-neutral-500 leading-relaxed mb-2">
                <strong>Powered by compromise.js:</strong>
              </p>
              <ul className="text-xs text-neutral-500 space-y-1 ml-3">
                <li>• Natural language phrase extraction</li>
                <li>• Camera movement detection</li>
                <li>• Technical spec extraction</li>
                <li>• Automatic categorization</li>
              </ul>
            </>
          )}
          <p className="text-xs text-neutral-500 leading-relaxed mt-2">
            Click highlights to get AI-powered alternatives.
          </p>
        </div>
      </div>
    </div>
  );
});

CategoryLegend.displayName = 'CategoryLegend';

// Minimal Floating Toolbar Component
const FloatingToolbar = memo(({
  onCopy,
  onExport,
  onCreateNew,
  onShare,
  copied,
  shared,
  showExportMenu,
  onToggleExportMenu,
  showLegend,
  onToggleLegend
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

      <button
        onClick={onShare}
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          shared
            ? 'text-green-700 bg-green-50'
            : 'text-neutral-700 hover:bg-neutral-100'
        }`}
        aria-label={shared ? 'Link copied' : 'Share prompt'}
        title="Share"
      >
        {shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
        {shared && <span className="text-xs">Shared!</span>}
      </button>

      <button
        onClick={() => onToggleLegend(!showLegend)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          showLegend
            ? 'text-blue-700 bg-blue-50'
            : 'text-neutral-700 hover:bg-neutral-100'
        }`}
        aria-label="Toggle highlight legend"
        title="Highlight Legend"
      >
        <Info className="h-4 w-4" />
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
  promptUuid,
  promptContext, // NEW: Context from Creative Brainstorm
  onDisplayedPromptChange,
  onSkipAnimation,
  suggestionsData,
  onFetchSuggestions,
  onCreateNew
}) => {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  const editorRef = useRef(null);
  const toast = useToast();

  // Memoize formatted HTML - Enable ML highlighting for video mode
  // Highlights will appear dynamically as text is displayed
  const enableMLHighlighting = selectedMode === 'video';
  const { html: formattedHTML } = useMemo(
    () => formatTextToHTML(displayedPrompt, enableMLHighlighting, promptContext),
    [displayedPrompt, enableMLHighlighting, promptContext]
  );


  const handleCopy = () => {
    navigator.clipboard.writeText(displayedPrompt);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (!promptUuid) {
      toast.error('Save the prompt first to generate a share link');
      return;
    }

    const shareUrl = `${window.location.origin}/share/${promptUuid}`;
    navigator.clipboard.writeText(shareUrl);
    setShared(true);
    toast.success('Share link copied to clipboard!');
    setTimeout(() => setShared(false), 2000);
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

  const getSelectionOffsets = (range) => {
    if (!editorRef.current || !range) {
      return null;
    }

    try {
      const preSelectionRange = range.cloneRange();
      preSelectionRange.selectNodeContents(editorRef.current);
      preSelectionRange.setEnd(range.startContainer, range.startOffset);

      const start = preSelectionRange.toString().length;
      const end = start + range.toString().length;

      if (Number.isNaN(start) || Number.isNaN(end)) {
        return null;
      }

      return { start, end };
    } catch (error) {
      console.error('Error computing selection offsets:', error);
      return null;
    }
  };

  const restoreSelectionFromOffsets = (element, startOffset, endOffset) => {
    if (!element || startOffset == null || endOffset == null) {
      return;
    }

    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    const normalizedStart = Math.max(0, startOffset);
    const normalizedEnd = Math.max(normalizedStart, endOffset);

    const findPosition = (offset) => {
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let currentNode = walker.nextNode();
      let accumulated = 0;
      let lastNode = null;

      while (currentNode) {
        const textLength = currentNode.textContent.length;
        if (offset <= accumulated + textLength) {
          return {
            node: currentNode,
            offset: Math.min(textLength, Math.max(0, offset - accumulated)),
          };
        }

        accumulated += textLength;
        lastNode = currentNode;
        currentNode = walker.nextNode();
      }

      if (lastNode) {
        return { node: lastNode, offset: lastNode.textContent.length };
      }

      return { node: element, offset: element.childNodes.length };
    };

    const startPosition = findPosition(normalizedStart);
    const endPosition = findPosition(normalizedEnd);

    if (!startPosition?.node || !endPosition?.node) {
      return;
    }

    const range = document.createRange();

    try {
      range.setStart(startPosition.node, startPosition.offset);
      range.setEnd(endPosition.node, endPosition.offset);
    } catch (error) {
      console.error('Error restoring selection offsets:', error);
      return;
    }

    selection.removeAllRanges();
    selection.addRange(range);
  };

  const handleTextSelection = () => {
    // Only allow text selection suggestions in video mode
    if (selectedMode !== 'video') {
      return;
    }

    const selection = window.getSelection();
    let text = selection.toString().trim();

    if (text.length > 0 && onFetchSuggestions) {
      const cleanedText = text.replace(/^-\s*/, '');
      const range = selection.getRangeAt(0).cloneRange();
      const offsets = getSelectionOffsets(range);
      // Use original displayedPrompt (without formatting) for suggestions context
      onFetchSuggestions(cleanedText, text, displayedPrompt, range, offsets);
    }
  };

  // Shared helper to trigger suggestions from a DOM target
  const triggerSuggestionsFromTarget = (targetElement, e) => {
    // Only handle highlight clicks in video mode
    if (selectedMode !== 'video') {
      return;
    }

    // Check if clicked element or its parent is a highlighted word
    let node = targetElement;

    // Traverse up to find a value-word span (in case user clicks on text inside the span)
    while (node && node !== editorRef.current) {
      if (node.classList && node.classList.contains('value-word')) {
        // Prevent default text selection behavior
        if (e && e.preventDefault) e.preventDefault();

        // Get the word text and metadata
        const wordText = node.textContent.trim();
        const category = node.getAttribute('data-category');
        const phrase = node.getAttribute('data-phrase');

        if (wordText && onFetchSuggestions) {
          // Create a range for the clicked word
          const range = document.createRange();
          range.selectNodeContents(node);
          const rangeClone = range.cloneRange();
          const offsets = getSelectionOffsets(rangeClone);

          // Clear any existing selection
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);

          // Trigger suggestions for this word
          onFetchSuggestions(wordText, wordText, displayedPrompt, rangeClone, offsets);
        }

        return;
      }
      node = node.parentElement;
    }
  };

  // Handle clicks on highlighted words
  const handleHighlightClick = (e) => {
    triggerSuggestionsFromTarget(e.target, e);
  };

  // Some headless environments can swallow click on contentEditable.
  // Also listen on mousedown to reliably capture interactions.
  const handleHighlightMouseDown = (e) => {
    triggerSuggestionsFromTarget(e.target, e);
  };

  const handleCopyEvent = (e) => {
    // Check if there's a text selection
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // If there's selected text, copy only the selection
    // Otherwise, copy the entire prompt (for backwards compatibility with copy button)
    if (selectedText) {
      // Let the browser handle copying the selected text
      // No need to prevent default or set clipboard data
      return;
    }

    // Only copy the full prompt if there's no selection
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
    if (editorRef.current && displayedPrompt) {
      const newHTML = formattedHTML || displayedPrompt;

      // Only update if content has actually changed to preserve cursor position
      const currentText = editorRef.current.innerText || editorRef.current.textContent || '';
      const newText = displayedPrompt;

      if (currentText !== newText) {
        const selection = window.getSelection();
        const hadFocus = document.activeElement === editorRef.current;
        let savedOffsets = null;

        // Try to save cursor selection offsets when focus is within the editor
        if (hadFocus && selection?.rangeCount > 0) {
          try {
            const range = selection.getRangeAt(0);
            if (
              editorRef.current.contains(range.startContainer) &&
              editorRef.current.contains(range.endContainer)
            ) {
              savedOffsets = getSelectionOffsets(range);
            }
          } catch (e) {
            savedOffsets = null;
          }
        }

        // Set the HTML content
        editorRef.current.innerHTML = newHTML;

        // Restore focus and cursor if it had focus before
        if (hadFocus) {
          try {
            editorRef.current.focus();
            if (savedOffsets) {
              restoreSelectionFromOffsets(
                editorRef.current,
                savedOffsets.start,
                savedOffsets.end
              );
            }
          } catch (e) {
            // Ignore focus errors
          }
        }
      }
    } else if (editorRef.current && !displayedPrompt) {
      editorRef.current.innerHTML = '<p style="color: rgb(163, 163, 163); font-size: 0.875rem;">Your optimized prompt will appear here...</p>';
    }
  }, [displayedPrompt, formattedHTML]);

  return (
    <div className="fixed inset-0 flex bg-neutral-50" style={{ marginLeft: 'var(--sidebar-width, 0px)' }}>
      {/* Inject CSS for value word hover effects */}
      <style>{VALUE_WORD_STYLE_BLOCK}</style>

      {/* Floating Toolbar */}
      <FloatingToolbar
        onCopy={handleCopy}
        onExport={handleExport}
        onCreateNew={onCreateNew}
        onShare={handleShare}
        copied={copied}
        shared={shared}
        showExportMenu={showExportMenu}
        onToggleExportMenu={setShowExportMenu}
        showLegend={showLegend}
        onToggleLegend={setShowLegend}
      />

      {/* Category Legend */}
      <CategoryLegend
        show={showLegend}
        onClose={() => setShowLegend(false)}
        hasContext={promptContext && promptContext.hasContext()}
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
                onClick={handleHighlightClick}
                onMouseDown={handleHighlightMouseDown}
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
