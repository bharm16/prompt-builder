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
import SuggestionsPanel from '../../components/SuggestionsPanel';
import { useToast } from '../../components/Toast';
import { useSpanLabeling } from './hooks/useSpanLabeling.js';
import { createCanonicalText } from '../../utils/canonicalText.js';
import { buildTextNodeIndex, wrapRangeSegments } from '../../utils/anchorRanges.js';
import { PromptContext } from '../../utils/PromptContext.js';

const LLM_PARSER_VERSION = 'llm-v1';

/**
 * Text Formatting Layer - Applies 2025 Design Principles
 *
 * Transforms Claude's text output into formatted HTML with inline styles
 * for a contentEditable experience. Users can edit while maintaining formatting.
 */
export const formatTextToHTML = (text) => {
  if (text == null) return { html: '' };

  const escapeHtmlLocal = (str = '') =>
    String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const lines = String(text).split(/\r?\n/);
  const result = [];

  const pushGap = () => {
    result.push('<div class="prompt-line prompt-line--gap" data-variant="gap"><br /></div>');
  };

  const pushSeparator = () => {
    result.push('<div class="prompt-line prompt-line--separator" data-variant="separator">———</div>');
  };

  const pushHeading = (raw) => {
    const cleaned = raw.replace(/^#{1,6}\s+/, '').replace(/^\*\*(.+)\*\*:?$/, '$1').trim();
    const className = 'prompt-line prompt-line--heading';
    result.push(`<div class="${className}" data-variant="heading">${escapeHtmlLocal(cleaned)}</div>`);
  };

  const pushSection = (raw) => {
    result.push(
      `<div class="prompt-line prompt-line--section" data-variant="section">${escapeHtmlLocal(
        raw.trim()
      )}</div>`
    );
  };

  const pushParagraph = (raw) => {
    result.push(
      `<div class="prompt-line prompt-line--paragraph" data-variant="paragraph">${escapeHtmlLocal(
        raw.trim()
      )}</div>`
    );
  };

  const pushOrderedItems = (items) => {
    items.forEach(({ label, text }) => {
      result.push(
        `<div class="prompt-line prompt-line--ordered" data-variant="ordered" data-variant-index="${escapeHtmlLocal(
          label
        )}"><span class="prompt-ordered-index">${escapeHtmlLocal(
          label
        )}</span><span class="prompt-ordered-text">${escapeHtmlLocal(text.trim())}</span></div>`
      );
    });
  };

  const pushBulletItems = (items) => {
    items.forEach((text) => {
      result.push(
        `<div class="prompt-line prompt-line--bullet" data-variant="bullet"><span class="prompt-bullet-marker">•</span><span class="prompt-bullet-text">${escapeHtmlLocal(
          text.trim()
        )}</span></div>`
      );
    });
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      pushGap();
      continue;
    }

    if (/^[=\-*_━─═▬▭]{3,}$/.test(trimmed)) {
      pushSeparator();
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed) || /^\*\*[^*]+\*\*:?$/.test(trimmed) || /^[A-Z][A-Z\s]{3,}$/.test(trimmed)) {
      pushHeading(trimmed);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const orderedItems = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const current = lines[i].trim();
        const match = current.match(/^(\d+)\.\s+(.*)$/);
        if (match) {
          orderedItems.push({ label: `${match[1]}.`, text: match[2] });
        }
        i += 1;
      }
      i -= 1;
      pushOrderedItems(orderedItems);
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const bulletItems = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        const current = lines[i].trim().replace(/^[-*•]\s+/, '');
        bulletItems.push(current);
        i += 1;
      }
      i -= 1;
      pushBulletItems(bulletItems);
      continue;
    }

    if (/^.+:$/.test(trimmed)) {
      pushSection(trimmed);
      continue;
    }

    if (/^>\s*/.test(trimmed)) {
      pushParagraph(trimmed.replace(/^>\s*/, ''));
      continue;
    }

    pushParagraph(trimmed);
  }

  return { html: result.join('') };
};

export const VALUE_WORD_STYLE_BLOCK = `
        .prompt-line {
          font-size: 0.9375rem;
          color: rgb(64, 64, 64);
          line-height: 1.6;
          margin-bottom: 0.75rem;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .prompt-line--heading {
          font-size: 1.25rem;
          font-weight: 600;
          color: rgb(23, 23, 23);
          margin-top: 2rem;
          margin-bottom: 1rem;
          letter-spacing: -0.02em;
        }

        .prompt-line--section {
          font-size: 1rem;
          font-weight: 600;
          color: rgb(38, 38, 38);
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }

        .prompt-line--bullet,
        .prompt-line--ordered {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .prompt-bullet-marker,
        .prompt-ordered-index {
          flex-shrink: 0;
          color: rgb(120, 120, 120);
          font-weight: 500;
          font-size: 0.875rem;
        }

        .prompt-ordered-text,
        .prompt-bullet-text {
          flex: 1;
          display: block;
        }

        .prompt-line--gap {
          height: 0.75rem;
        }

        .prompt-line--separator {
          color: rgb(212, 212, 212);
          font-size: 0.75rem;
          letter-spacing: 0.4em;
          text-transform: uppercase;
        }

        .prompt-line--code {
          background: rgba(243, 244, 246, 0.6);
          padding: 0.75rem;
          border-radius: 6px;
          font-size: 0.875rem;
          margin-bottom: 1rem;
          overflow-x: auto;
          white-space: pre-wrap;
        }

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
    { name: 'Lighting', color: 'rgba(253, 224, 71, 0.2)', border: 'rgba(253, 224, 71, 0.6)', example: 'golden hour lighting, neon glow', source: 'nlp' },
    { name: 'Shot Framing', color: 'rgba(147, 197, 253, 0.18)', border: 'rgba(59, 130, 246, 0.45)', example: 'wide shot, low-angle shot', source: 'nlp' },
    { name: 'Camera Movement', color: 'rgba(56, 189, 248, 0.18)', border: 'rgba(56, 189, 248, 0.55)', example: 'dolly in, pan left', source: 'nlp' },
    { name: 'Depth of Field', color: 'rgba(251, 146, 60, 0.18)', border: 'rgba(251, 146, 60, 0.5)', example: 'shallow depth of field, creamy bokeh', source: 'nlp' },
    { name: 'Color Palette', color: 'rgba(244, 114, 182, 0.2)', border: 'rgba(244, 114, 182, 0.55)', example: 'teal and orange, muted pastels', source: 'nlp' },
    { name: 'Environment Details', color: 'rgba(34, 197, 94, 0.18)', border: 'rgba(34, 197, 94, 0.55)', example: 'rain-soaked alley, frozen tundra', source: 'nlp' },
    { name: 'Technical Specs', color: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.5)', example: '35mm, 24fps, 2.39:1', source: 'nlp' },
    { name: 'Descriptive Language', color: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.4)', example: 'soft shadows, weathered hands', source: 'nlp' },
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
  const highlightStateRef = useRef({ wrappers: [], nodeIndex: null });
  const toast = useToast();

  const enableMLHighlighting = selectedMode === 'video';

  const labelingPolicy = useMemo(
    () => ({
      nonTechnicalWordLimit: 6,
      allowOverlap: false,
    }),
    []
  );

  const {
    spans: labeledSpans,
    meta: labeledMeta,
    status: labelingStatus,
    error: labelingError,
  } = useSpanLabeling({
    text: enableMLHighlighting ? displayedPrompt : '',
    enabled: enableMLHighlighting && Boolean(displayedPrompt?.trim()),
    maxSpans: 20,
    minConfidence: 0.5,
    policy: labelingPolicy,
    templateVersion: 'v1',
    debounceMs: 500,
  });

  const [parseResult, setParseResult] = useState(() => ({
    canonical: createCanonicalText(displayedPrompt ?? ''),
    spans: [],
    meta: null,
    status: 'idle',
    error: null,
    displayText: displayedPrompt ?? '',
  }));

  // Debug: Track promptContext received in PromptCanvas
  useEffect(() => {
    console.log('[DEBUG] PromptCanvas received promptContext:', {
      exists: !!promptContext,
      hasContext: promptContext?.hasContext ? promptContext.hasContext() : false,
      elements: promptContext?.elements,
      timestamp: new Date().toISOString()
    });
  }, [promptContext]);


  const unwrapHighlight = (element) => {
    if (!element || !element.parentNode) return;
    const parent = element.parentNode;
    while (element.firstChild) {
      parent.insertBefore(element.firstChild, element);
    }
    parent.removeChild(element);
  };

  const clearHighlights = () => {
    const { wrappers } = highlightStateRef.current;
    if (wrappers?.length) {
      wrappers.forEach((wrapper) => unwrapHighlight(wrapper));
    }
    highlightStateRef.current = { wrappers: [], nodeIndex: null };
  };

  useEffect(() => () => clearHighlights(), []);

  // Memoize formatted HTML - highlights applied post-render
  const { html: formattedHTML } = useMemo(
    () => formatTextToHTML(displayedPrompt, enableMLHighlighting, promptContext),
    [displayedPrompt, enableMLHighlighting, promptContext]
  );

  useEffect(() => {
    const canonical = createCanonicalText(displayedPrompt ?? '');
    const currentText = displayedPrompt ?? '';

    if (!enableMLHighlighting || !currentText.trim()) {
      setParseResult({
        canonical,
        spans: [],
        meta: labeledMeta,
        status: labelingStatus,
        error: labelingError,
        displayText: currentText,
      });
      return;
    }

    const highlights = convertLabeledSpansToHighlights({
      spans: labeledSpans,
      text: currentText,
      canonical,
    });

    setParseResult({
      canonical,
      spans: highlights,
      meta: labeledMeta,
      status: labelingStatus,
      error: labelingError,
      displayText: currentText,
    });
  }, [
    labeledSpans,
    labeledMeta,
    labelingStatus,
    labelingError,
    enableMLHighlighting,
    displayedPrompt,
  ]);


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
    if (selectedMode !== 'video') {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const rawText = selection.toString();
    const trimmed = rawText.trim();
    if (!trimmed) {
      return;
    }

    if (onFetchSuggestions) {
      const cleanedText = trimmed.replace(/^-\s*/, '') || trimmed;
      const range = selection.getRangeAt(0).cloneRange();
      const offsets = getSelectionOffsets(range);
      onFetchSuggestions({
        highlightedText: cleanedText,
        originalText: trimmed,
        displayedPrompt,
        range,
        offsets,
        metadata: null,
        trigger: 'selection',
      });
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

        let metadata = null;
        if (node.dataset) {
          const {
            category,
            source,
            spanId,
            start,
            end,
            startGrapheme,
            endGrapheme,
            validatorPass,
            confidence,
            quote,
            leftCtx,
            rightCtx,
            idempotencyKey,
          } = node.dataset;

          metadata = {
            category: category || null,
            source: source || null,
            spanId: spanId || null,
            start: start ? Number(start) : -1,
            end: end ? Number(end) : -1,
            startGrapheme: startGrapheme ? Number(startGrapheme) : -1,
            endGrapheme: endGrapheme ? Number(endGrapheme) : -1,
            validatorPass: validatorPass !== 'false',
            confidence: confidence ? Number(confidence) : null,
            quote: quote || wordText,
            leftCtx: leftCtx || '',
            rightCtx: rightCtx || '',
            idempotencyKey: idempotencyKey || null,
          };

          if (metadata.spanId && Array.isArray(parseResult?.spans)) {
            const spanDetail = parseResult.spans.find((span) => span.id === metadata.spanId);
            if (spanDetail) {
              metadata.span = { ...spanDetail };
            }
          }
        }

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
          onFetchSuggestions({
            highlightedText: wordText,
            originalText: wordText,
            displayedPrompt,
            range: rangeClone,
            offsets,
            metadata,
            trigger: 'highlight',
          });
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

        // Clear existing highlights before rewriting the HTML content
        clearHighlights();

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
      clearHighlights();
      editorRef.current.innerHTML = '<p style="color: rgb(163, 163, 163); font-size: 0.875rem;">Your optimized prompt will appear here...</p>';
    }
  }, [displayedPrompt, formattedHTML]);

  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;

    clearHighlights();

    const spans = parseResult?.spans;
    if (!enableMLHighlighting || !Array.isArray(spans) || !spans.length) {
      return;
    }

    const displayText = parseResult?.displayText ?? root.textContent ?? '';
    if (!displayText) {
      return;
    }

    const wrappers = [];
    const coverage = [];

    let nodeIndex = buildTextNodeIndex(root);

    const sortedSpans = [...spans]
      .filter((span) => {
        const start = Number(span.displayStart ?? span.start);
        const end = Number(span.displayEnd ?? span.end);
        return Number.isFinite(start) && Number.isFinite(end) && end > start;
      })
      .map((span) => {
        const start = Number(span.displayStart ?? span.start);
        const end = Number(span.displayEnd ?? span.end);
        const snapped = snapSpanToTokenBoundaries(displayText, start, end);
        return snapped
          ? {
              span,
              highlightStart: snapped.start,
              highlightEnd: snapped.end,
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.highlightStart - a.highlightStart);

    sortedSpans.forEach(({ span, highlightStart, highlightEnd }) => {
      if (rangeOverlaps(coverage, highlightStart, highlightEnd)) {
        return;
      }

      const expectedText = span.displayQuote ?? span.quote ?? '';
      const actualSlice = displayText.slice(highlightStart, highlightEnd);
      if (expectedText && actualSlice !== expectedText) {
        console.warn('SPAN_MISMATCH', {
          id: span.id,
          expected: expectedText,
          found: actualSlice,
        });
        return;
      }

      const segmentWrappers = wrapRangeSegments({
        root,
        start: highlightStart,
        end: highlightEnd,
        nodeIndex,
        createWrapper: () => {
          const el = root.ownerDocument.createElement('span');
          el.className = `value-word value-word-${span.category}`;
          el.dataset.category = span.category;
          el.dataset.source = span.source;
          el.dataset.spanId = span.id;
          el.dataset.start = String(span.start);
          el.dataset.end = String(span.end);
          el.dataset.startDisplay = String(highlightStart);
          el.dataset.endDisplay = String(highlightEnd);
          el.dataset.startGrapheme = String(span.startGrapheme ?? '');
          el.dataset.endGrapheme = String(span.endGrapheme ?? '');
          el.dataset.validatorPass = span.validatorPass === false ? 'false' : 'true';
          el.dataset.idempotencyKey = span.idempotencyKey ?? '';
          const color = PromptContext.getCategoryColor?.(span.category);
          if (color) {
            el.style.backgroundColor = color.bg;
            el.style.borderBottom = `2px solid ${color.border}`;
            el.style.padding = '1px 3px';
            el.style.borderRadius = '3px';
          }
          return el;
        },
      });

      if (!segmentWrappers.length) {
        return;
      }

      segmentWrappers.forEach((wrapper) => {
        wrapper.dataset.quote = span.quote ?? '';
        wrapper.dataset.leftCtx = span.leftCtx ?? '';
        wrapper.dataset.rightCtx = span.rightCtx ?? '';
        wrapper.dataset.displayQuote = span.displayQuote ?? span.quote ?? '';
        wrapper.dataset.displayLeftCtx = span.displayLeftCtx ?? '';
        wrapper.dataset.displayRightCtx = span.displayRightCtx ?? '';
        wrapper.dataset.source = span.source ?? '';
        if (typeof span.confidence === 'number') {
          wrapper.dataset.confidence = String(span.confidence);
        }
        wrappers.push(wrapper);
      });

      coverage.push({ start: highlightStart, end: highlightEnd });
      nodeIndex = buildTextNodeIndex(root);
    });

    highlightStateRef.current = { wrappers, nodeIndex: null };
  }, [parseResult, enableMLHighlighting, formattedHTML]);

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

const CONTEXT_WINDOW_CHARS = 20;

function isWordBoundary(text, index) {
  if (index <= 0 || index >= text.length) {
    return true;
  }
  const prev = text[index - 1];
  const current = text[index];
  return !(/\w/.test(prev) && /\w/.test(current));
}

function snapSpanToTokenBoundaries(text, start, end) {
  if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }

  let safeStart = Math.max(0, start);
  let safeEnd = Math.min(text.length, end);

  while (safeStart > 0 && !isWordBoundary(text, safeStart)) {
    safeStart -= 1;
  }

  while (safeEnd < text.length && !isWordBoundary(text, safeEnd)) {
    safeEnd += 1;
  }

  if (safeEnd <= safeStart) {
    return null;
  }

  return { start: safeStart, end: safeEnd };
}

function rangeOverlaps(ranges, start, end) {
  return ranges.some((range) => !(end <= range.start || start >= range.end));
}

const ROLE_TO_CATEGORY = {
  Wardrobe: 'wardrobe',
  Appearance: 'appearance',
  Lighting: 'lighting',
  TimeOfDay: 'timeOfDay',
  CameraMove: 'cameraMove',
  Framing: 'framing',
  Environment: 'environment',
  Color: 'color',
  Technical: 'technical',
  Descriptive: 'descriptive',
};

const convertLabeledSpansToHighlights = ({ spans, text, canonical }) => {
  if (!Array.isArray(spans) || !text) {
    return [];
  }

  return spans
    .map((span, index) => {
      if (!span || typeof span !== 'object') {
        return null;
      }

      const role = typeof span.role === 'string' ? span.role : 'Descriptive';
      const category = ROLE_TO_CATEGORY[role] || 'descriptive';
      const start = Number(span.start);
      const end = Number(span.end);

      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return null;
      }

      const clampedStart = Math.max(0, Math.min(text.length, start));
      const clampedEnd = Math.max(clampedStart, Math.min(text.length, end));
      if (clampedEnd <= clampedStart) {
        return null;
      }

      const slice = text.slice(clampedStart, clampedEnd);
      if (!slice) {
        return null;
      }

      const leftCtx = text.slice(
        Math.max(0, clampedStart - CONTEXT_WINDOW_CHARS),
        clampedStart
      );
      const rightCtx = text.slice(
        clampedEnd,
        Math.min(text.length, clampedEnd + CONTEXT_WINDOW_CHARS)
      );

      const startGrapheme = canonical?.graphemeIndexForCodeUnit
        ? canonical.graphemeIndexForCodeUnit(clampedStart)
        : undefined;
      const endGrapheme = canonical?.graphemeIndexForCodeUnit
        ? canonical.graphemeIndexForCodeUnit(clampedEnd)
        : undefined;

      return {
        id: span.id ?? `llm_${category}_${index}_${clampedStart}_${clampedEnd}`,
        category,
        role,
        start: clampedStart,
        end: clampedEnd,
        displayStart: clampedStart,
        displayEnd: clampedEnd,
        quote: slice,
        displayQuote: slice,
        leftCtx,
        rightCtx,
        displayLeftCtx: leftCtx,
        displayRightCtx: rightCtx,
        source: 'llm',
        confidence:
          typeof span.confidence === 'number' ? span.confidence : undefined,
        validatorPass: true,
        startGrapheme,
        endGrapheme,
        version: LLM_PARSER_VERSION,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.start === b.start) {
        return a.end - b.end;
      }
      return a.start - b.start;
    });
};
