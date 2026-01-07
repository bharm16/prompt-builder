import React from 'react';
import { useDebugLogger } from '@hooks/useDebugLogger';
import { ModelSelectorDropdown } from './components/ModelSelectorDropdown';
import type { CapabilityValue } from '@shared/capabilities';
import type { PromptInputProps } from './types';
import { useCoverageMeters } from './PromptInput/hooks/useCoverageMeters';
import { useWorkflowChipSeen } from './PromptInput/hooks/useWorkflowChipSeen';
import { usePromptInputCapabilities, type PromptInputFieldInfo } from './PromptInput/hooks/usePromptInputCapabilities';
import './PromptInput.css';

/**
 * Main prompt input component with mode selection and optimization trigger
 */
export const PromptInput = ({
  inputPrompt,
  onInputChange,
  selectedModel, // New prop
  onModelChange, // New prop
  generationParams,
  onGenerationParamsChange,
  onOptimize,
  onShowBrainstorm,
  isProcessing,
  aiNames,
  currentAIIndex,
}: PromptInputProps): React.ReactElement => {
  // App is video-only now; keep a local constant for logging/behavior.
  const selectedMode = 'video' as const;

  const debug = useDebugLogger('PromptInput', { 
    mode: selectedMode, 
    hasInput: !!inputPrompt,
    isProcessing,
  });

  const { aspectRatioInfo, durationInfo, resolutionInfo, fpsInfo, audioInfo } =
    usePromptInputCapabilities({ selectedModel, generationParams });
  const coverageMeters = useCoverageMeters(inputPrompt);
  const { hasSeenWorkflowChip, markWorkflowChipSeen } = useWorkflowChipSeen();

  const [isFocused, setIsFocused] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const examplesPopoverRef = React.useRef<HTMLDivElement>(null);
  const examplesButtonRef = React.useRef<HTMLButtonElement>(null);
  const [isCanvasHovered, setIsCanvasHovered] = React.useState(false);
  const [isExamplesOpen, setIsExamplesOpen] = React.useState(false);
  const [ctaFlash, setCtaFlash] = React.useState(false);
  const [modifierKeyLabel, setModifierKeyLabel] = React.useState<'⌘' | 'Ctrl'>('⌘');
  const [loadingStepIndex, setLoadingStepIndex] = React.useState(0);

  const hasContent = inputPrompt.length > 0;
  const isCtaDisabled = !inputPrompt.trim() || isProcessing;

  const handleParamChange = (key: string, value: CapabilityValue): void => {
    onGenerationParamsChange({
      ...generationParams,
      [key]: value,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      debug.logAction('optimizeViaKeyboard', { 
        mode: selectedMode,
        promptLength: inputPrompt.length,
        modifier: e.metaKey ? 'cmd' : 'ctrl',
      });
      setCtaFlash(true);
      window.setTimeout(() => setCtaFlash(false), 120);
      onOptimize();
    }
  };

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMac =
      typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
    setModifierKeyLabel(isMac ? '⌘' : 'Ctrl');
  }, []);

  React.useEffect(() => {
    const handleFocusEditor = (): void => {
      textareaRef.current?.focus();
    };
    window.addEventListener('po:focus-editor', handleFocusEditor);
    return () => window.removeEventListener('po:focus-editor', handleFocusEditor);
  }, []);

  React.useEffect(() => {
    if (!isExamplesOpen) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setIsExamplesOpen(false);
    };
    const onMouseDown = (e: MouseEvent): void => {
      const target = e.target as Node;
      const popover = examplesPopoverRef.current;
      const button = examplesButtonRef.current;
      if (popover?.contains(target)) return;
      if (button?.contains(target)) return;
      setIsExamplesOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [isExamplesOpen]);

  React.useEffect(() => {
    if (!isProcessing) {
      setLoadingStepIndex(0);
      return;
    }
    const id = window.setInterval(() => {
      setLoadingStepIndex((i) => (i + 1) % 3);
    }, 900);
    return () => window.clearInterval(id);
  }, [isProcessing]);

  const handleOptimizeClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    
    if (inputPrompt && inputPrompt.trim()) {
      debug.logAction('optimizeViaButton', { 
        mode: selectedMode,
        promptLength: inputPrompt.length,
        selectedModel // Log selected model
      });
      markWorkflowChipSeen();
      onOptimize();
    }
  };

  const renderDropdown = (info: PromptInputFieldInfo | null, key: string, label: string) => {
    if (!info) return null;
    
    // For duration, append 's' to the value for display if it's a number
    const formatDisplay = (val: CapabilityValue): string => {
      if (key === 'duration_s') return `${val}s`;
      if (key === 'fps') return `${val} fps`;
      return String(val);
    };

    return (
      <div className="flex items-center">
        <select
          value={String(generationParams[key] || info.field.default || '')}
          onChange={(e) => {
            const nextValue: CapabilityValue =
              info.field.type === 'int' ? Number(e.target.value) : e.target.value;
            handleParamChange(key, nextValue);
          }}
          className="prompt-input__control-pill prompt-input__control-select h-8 px-[10px] pr-[30px] text-[13px] font-medium rounded-[10px] cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%23FFF%22%20stroke-opacity%3D%220.78%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat"
          aria-label={label}
        >
          {info.allowedValues.map((value) => (
            <option key={String(value)} value={String(value)}>
              {formatDisplay(value)}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const renderAudioToggle = () => {
    if (!audioInfo) return null;
    const isEnabled = Boolean(generationParams.audio ?? audioInfo.field.default ?? false);
    
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          onClick={() => handleParamChange('audio', !isEnabled)}
          className="prompt-input__control-pill prompt-input__control-toggle group flex items-center gap-1.5 h-8 px-[10px] rounded-[10px] transition-colors"
        >
           {isEnabled ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
           ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <line x1="23" y1="9" x2="17" y2="15"></line>
              <line x1="17" y1="9" x2="23" y2="15"></line>
            </svg>
           )}
           <span className={`text-sm ${isEnabled ? 'text-white' : 'text-white/60'}`}>
             Audio
           </span>
        </button>
      </div>
    );
  };

  return (
    <div className="prompt-input">
      <div className="prompt-input__container">
        <div className="prompt-input__stack">
          {/* Title block */}
          <header className="prompt-input__title-block">
            <h1
              className="prompt-input__title"
              style={{
                fontSize: hasContent ? 32 : 48,
                lineHeight: hasContent ? '36px' : '52px',
                letterSpacing: '-0.02em',
                fontWeight: 680,
                color: '#0B0F1A',
              }}
            >
              Describe the shot
            </h1>

            <div
              className="prompt-input__subtitle-wrap"
              style={{
                maxHeight: hasContent ? 0 : 40,
                opacity: hasContent ? 0 : 1,
                marginTop: hasContent ? 0 : 10,
              }}
              aria-hidden={hasContent}
            >
              <p className="prompt-input__subtitle">Camera, subject, lighting, motion — start rough.</p>
            </div>
          </header>

          {/* Input canvas + CTA */}
          <section className="prompt-input__canvas-section" aria-label="Prompt input">
            <div
              className={[
                'prompt-input__canvas',
                isFocused ? 'prompt-input__canvas--focused' : '',
                !isFocused && isCanvasHovered ? 'prompt-input__canvas--hovered' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onMouseEnter={() => setIsCanvasHovered(true)}
              onMouseLeave={() => setIsCanvasHovered(false)}
            >
              {/* Subtle caret shimmer (not the native caret) */}
              {!inputPrompt && (
                <span
                  aria-hidden="true"
                  className="prompt-input__empty-caret pointer-events-none absolute left-[20px] top-[22px] h-[22px] w-[2px] empty-state-caret-pulse"
                />
              )}

              <label htmlFor="prompt-input" className="sr-only">
                Prompt
              </label>
              <textarea
                id="prompt-input"
                ref={textareaRef}
                value={inputPrompt}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={'Wide shot of …\nCamera: … Lighting: … Motion: …'}
                autoFocus={!hasContent}
                rows={3}
                readOnly={isProcessing}
                className="prompt-input__textarea"
                aria-label="Prompt input"
                aria-busy={isProcessing}
              />

              {/* Micro-toolbar */}
              <div className="prompt-input__micro-toolbar">
                <span className="prompt-input__micro-hint">
                  {modifierKeyLabel}⏎ Optimize
                </span>
                <span className="prompt-input__micro-dot" aria-hidden="true">
                  ·
                </span>
                <span className="prompt-input__micro-hint">⇧⏎ New line</span>
                <span className="prompt-input__micro-dot" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  className="prompt-input__micro-link"
                  ref={examplesButtonRef}
                  onClick={() => setIsExamplesOpen((v) => !v)}
                  aria-expanded={isExamplesOpen}
                  aria-haspopup="dialog"
                >
                  Examples
                </button>
              </div>

              {isExamplesOpen && (
                <div className="prompt-input__examples-popover" ref={examplesPopoverRef} role="dialog" aria-label="Examples">
                  <div className="prompt-input__examples-title">Try one</div>
                  {[
                    'Wide shot of a lone cyclist on a foggy bridge, cinematic, slow push in.',
                    'Close-up of hands assembling a tiny robot, macro lens, soft studio light.',
                    'Tracking shot through a neon alley, rain, reflections, handheld energy.',
                  ].map((example) => (
                    <button
                      key={example}
                      type="button"
                      className="prompt-input__example-item"
                      onClick={() => {
                        onInputChange(example);
                        setIsExamplesOpen(false);
                        window.setTimeout(() => textareaRef.current?.focus(), 0);
                      }}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="prompt-input__cta-row">
              <button
                type="button"
                onClick={handleOptimizeClick}
                disabled={isCtaDisabled}
                title={!inputPrompt.trim() ? 'Write a rough shot first' : undefined}
                className={[
                  'prompt-input__optimize-btn',
                  isProcessing ? 'prompt-input__optimize-btn--loading' : '',
                  ctaFlash ? 'prompt-input__optimize-btn--flash' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-label="Optimize prompt"
              >
                {isProcessing ? (
                  <>
                    <span className="prompt-input__spinner" aria-hidden="true" />
                    <span className="prompt-input__optimize-label">Optimizing</span>
                    <span className="prompt-input__optimize-step" aria-hidden="true">
                      {['Structuring…', 'Refining…', 'Polishing…'][loadingStepIndex]}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="prompt-input__optimize-label">Optimize</span>
                    <span className="prompt-input__optimize-arrow" aria-hidden="true">
                      →
                    </span>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Control bar */}
          <div className="prompt-input__controls">
            <div className="prompt-input__controls-inner">
              {onModelChange && (
                <ModelSelectorDropdown selectedModel={selectedModel} onModelChange={onModelChange} variant="pillDark" />
              )}
              {renderDropdown(aspectRatioInfo, 'aspect_ratio', 'Aspect Ratio')}
              {renderDropdown(resolutionInfo, 'resolution', 'Resolution')}
              {renderDropdown(durationInfo, 'duration_s', 'Duration')}
              {renderDropdown(fpsInfo, 'fps', 'Frame Rate')}
              {renderAudioToggle()}
              {!hasSeenWorkflowChip || !hasContent ? (
                <div className="prompt-input__workflow-chip prompt-input__workflow-chip--controls" role="status">
                  Workflow: Structure → Refine → Generate
                </div>
              ) : null}
            </div>
          </div>

          {/* Structure promise (coverage meters) */}
          <section className="prompt-input__coverage" aria-label="Structure coverage">
            {coverageMeters.map((category) => (
              <div key={category.key} className="prompt-input__coverage-row">
                <div className="prompt-input__coverage-label">{category.label}</div>
                <div className="prompt-input__coverage-track" aria-hidden="true">
                  <div
                    className="prompt-input__coverage-fill"
                    style={{
                      width: `${Math.round(category.fill * 100)}%`,
                      background: category.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
};
