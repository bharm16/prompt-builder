import React from 'react';
import { useDebugLogger } from '@hooks/useDebugLogger';
import { ModelSelectorDropdown } from './components/ModelSelectorDropdown';
import type { CapabilityValue } from '@shared/capabilities';
import type { PromptInputProps } from './types';
import { useCoverageMeters } from './PromptInput/hooks/useCoverageMeters';
import { useWorkflowChipSeen } from './PromptInput/hooks/useWorkflowChipSeen';
import { usePromptInputCapabilities, type PromptInputFieldInfo } from './PromptInput/hooks/usePromptInputCapabilities';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@promptstudio/system/components/ui/select';
import { Button } from '@promptstudio/system/components/ui/button';
import { Textarea } from '@promptstudio/system/components/ui/textarea';
import { cn } from '@/utils/cn';

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
  isProcessing,
}: PromptInputProps): React.ReactElement => {
  // App is video-only now; keep a local constant for logging/behavior.
  const selectedMode = 'video' as const;

  const debug = useDebugLogger('PromptInput', { 
    mode: selectedMode, 
    hasInput: !!inputPrompt,
    isProcessing,
  });

  const { aspectRatioInfo, durationInfo, resolutionInfo, fpsInfo, audioInfo } =
    usePromptInputCapabilities({
      generationParams,
      ...(selectedModel ? { selectedModel } : {}),
    });
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
    if (Object.is(generationParams[key], value)) {
      return;
    }
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
        <Select
          value={String(generationParams[key] ?? info.field.default ?? '')}
          onValueChange={(value) => {
            const nextValue: CapabilityValue =
              info.field.type === 'int' ? Number(value) : value;
            handleParamChange(key, nextValue);
          }}
        >
          <SelectTrigger
            className="h-8 rounded-md border border-border bg-surface-3 px-2.5 pr-8 text-body-sm font-medium text-muted transition-colors hover:bg-surface-1 hover:border-border-strong focus-visible:ring-2 focus-visible:ring-accent/20"
            aria-label={label}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {info.allowedValues.map((value) => (
              <SelectItem key={String(value)} value={String(value)}>
                {formatDisplay(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderAudioToggle = () => {
    if (!audioInfo) return null;
    const isEnabled = Boolean(generationParams.audio ?? audioInfo.field.default ?? false);
    
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          onClick={() => handleParamChange('audio', !isEnabled)}
          variant="ghost"
          className={cn(
            'group flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-3 px-2.5 text-body-sm font-medium transition-colors',
            isEnabled ? 'text-foreground' : 'text-faint',
            'hover:bg-surface-1 hover:border-border-strong focus-visible:ring-2 focus-visible:ring-accent/20'
          )}
        >
           {isEnabled ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
           ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-faint">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <line x1="23" y1="9" x2="17" y2="15"></line>
              <line x1="17" y1="9" x2="23" y2="15"></line>
            </svg>
           )}
           <span className="text-body-sm">
             Audio
           </span>
        </Button>
      </div>
    );
  };

  return (
    <div className="relative w-full">
      <div className="relative z-10 mx-auto w-full max-w-5xl px-5 py-14 md:px-12 md:py-16">
        <div className="flex flex-col gap-4 md:gap-5">
          {/* Title block */}
          <header className="space-y-2">
            <h1
              className={cn(
                'font-semibold tracking-tight text-foreground transition-all duration-150',
                hasContent ? 'text-h1 leading-snug' : 'text-heading-40 leading-tight'
              )}
            >
              Describe the shot
            </h1>

            <div
              className={cn(
                'overflow-hidden transition-all duration-150',
                hasContent ? 'mt-0 max-h-0 opacity-0' : 'mt-2.5 max-h-10 opacity-100'
              )}
              aria-hidden={hasContent}
            >
              <p className="text-body text-faint">Camera, subject, lighting, motion — start rough.</p>
            </div>
          </header>

          {/* Input canvas + CTA */}
          <section className="space-y-3" aria-label="Prompt input">
            <div
              className={cn(
                'relative w-full min-h-44 rounded-xl border border-border bg-surface-1 p-5 shadow-sm transition-all duration-150',
                isFocused && 'min-h-52 border-accent/70 ring-2 ring-accent/10',
                !isFocused && isCanvasHovered && 'border-border-strong bg-surface-2'
              )}
              onMouseEnter={() => setIsCanvasHovered(true)}
              onMouseLeave={() => setIsCanvasHovered(false)}
            >
              {/* Subtle caret shimmer (not the native caret) */}
              {!inputPrompt && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-5 top-5 h-5 w-0.5 rounded-full bg-accent/70 animate-pulse"
                />
              )}

              <label htmlFor="prompt-input" className="ps-sr-only">
                Prompt
              </label>
              <Textarea
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
                className="w-full min-h-28 resize-none bg-transparent p-0 pb-6 pr-36 font-mono text-body text-foreground leading-relaxed placeholder:text-faint focus-visible:outline-none selection:bg-accent/20 selection:text-foreground"
                aria-label="Prompt input"
                aria-busy={isProcessing}
              />

              {/* Micro-toolbar */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2 text-label-12 text-faint">
                <span>
                  {modifierKeyLabel}⏎ Optimize
                </span>
                <span className="opacity-60" aria-hidden="true">
                  ·
                </span>
                <span>⇧⏎ New line</span>
                <span className="opacity-60" aria-hidden="true">
                  ·
                </span>
                <Button
                  type="button"
                  className="p-0 text-label-12 text-faint transition-colors hover:text-muted"
                  ref={examplesButtonRef}
                  onClick={() => setIsExamplesOpen((v) => !v)}
                  aria-expanded={isExamplesOpen}
                  aria-haspopup="dialog"
                  variant="ghost"
                >
                  Examples
                </Button>
              </div>

              {isExamplesOpen && (
                <div
                  className="absolute bottom-10 right-3 w-72 rounded-md border border-border bg-surface-3 p-3 shadow-md"
                  ref={examplesPopoverRef}
                  role="dialog"
                  aria-label="Examples"
                >
                  <div className="mb-2 text-label-12 font-semibold text-muted">Try one</div>
                  {[
                    'Wide shot of a lone cyclist on a foggy bridge, cinematic, slow push in.',
                    'Close-up of hands assembling a tiny robot, macro lens, soft studio light.',
                    'Tracking shot through a neon alley, rain, reflections, handheld energy.',
                  ].map((example) => (
                    <Button
                      key={example}
                      type="button"
                      className="w-full rounded-md border border-border bg-surface-1 px-2.5 py-2 text-left text-label-12 text-muted transition-colors hover:border-border-strong hover:bg-surface-2"
                      onClick={() => {
                        onInputChange(example);
                        setIsExamplesOpen(false);
                        window.setTimeout(() => textareaRef.current?.focus(), 0);
                      }}
                      variant="ghost"
                    >
                      {example}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3.5 flex h-10 items-center">
              <Button
                type="button"
                onClick={handleOptimizeClick}
                disabled={isCtaDisabled}
                title={!inputPrompt.trim() ? 'Write a rough shot first' : undefined}
                className={cn(
                  'group inline-flex h-10 items-center gap-2.5 rounded-md border border-accent/60 bg-accent/10 px-3.5 text-body font-semibold text-foreground transition-all duration-150 hover:bg-accent/20',
                  isProcessing && 'min-w-60 justify-between',
                  ctaFlash && 'ring-2 ring-accent/20 shadow-md',
                  isCtaDisabled && 'cursor-not-allowed border-border bg-surface-3 text-faint opacity-70 hover:bg-surface-3'
                )}
                aria-label="Optimize prompt"
                variant="ghost"
              >
                {isProcessing ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent/40 border-t-accent" aria-hidden="true" />
                    <span className="text-body">Optimizing</span>
                    <span className="text-label-12 text-faint" aria-hidden="true">
                      {['Structuring…', 'Refining…', 'Polishing…'][loadingStepIndex]}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-body">Optimize</span>
                    <span className="transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                      →
                    </span>
                  </>
                )}
              </Button>
            </div>
          </section>

          {/* Control bar */}
          <div className="h-11 overflow-x-auto overflow-y-hidden rounded-md border border-border bg-surface-2 px-2 py-1.5 shadow-sm ps-scrollbar-hide">
            <div className="flex h-full min-w-max items-center gap-2">
              {onModelChange && (
                <ModelSelectorDropdown selectedModel={selectedModel} onModelChange={onModelChange} variant="pillDark" />
              )}
              {renderDropdown(aspectRatioInfo, 'aspect_ratio', 'Aspect Ratio')}
              {renderDropdown(resolutionInfo, 'resolution', 'Resolution')}
              {renderDropdown(durationInfo, 'duration_s', 'Duration')}
              {renderDropdown(fpsInfo, 'fps', 'Frame Rate')}
              {renderAudioToggle()}
              {!hasSeenWorkflowChip || !hasContent ? (
                <div className="ml-auto inline-flex h-6 items-center rounded-full border border-border bg-surface-3 px-2.5 text-label-12 font-medium text-faint" role="status">
                  Workflow: Structure → Refine → Generate
                </div>
              ) : null}
            </div>
          </div>

          {/* Structure promise (coverage meters) */}
          <section className="-mt-1.5 grid grid-cols-1 gap-2.5 sm:gap-5 lg:grid-cols-2" aria-label="Structure coverage">
            {coverageMeters.map((category) => (
              <div key={category.key} className="flex h-6 items-center gap-3">
                <div className="w-20 text-label-12 text-faint">{category.label}</div>
                <div className="h-1.5 flex-1 rounded-full bg-border" aria-hidden="true">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-150',
                      category.colorClass
                    )}
                    style={{
                      width: `${Math.round(category.fill * 100)}%`,
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
