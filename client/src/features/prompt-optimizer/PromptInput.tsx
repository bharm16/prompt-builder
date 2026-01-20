import React from 'react';
import { useDebugLogger } from '@hooks/useDebugLogger';
import { ModelSelectorDropdown } from './components/ModelSelectorDropdown';
import type { CapabilityValue } from '@shared/capabilities';
import type { PromptInputProps } from './types';
import { useWorkflowChipSeen } from './PromptInput/hooks/useWorkflowChipSeen';
import { usePromptInputCapabilities, type PromptInputFieldInfo } from './PromptInput/hooks/usePromptInputCapabilities';
import { Button } from '@promptstudio/system/components/ui/button';
import { Textarea } from '@promptstudio/system/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@promptstudio/system/components/ui/dropdown-menu';
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
  const { hasSeenWorkflowChip, markWorkflowChipSeen } = useWorkflowChipSeen();

  const [isFocused, setIsFocused] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [isCanvasHovered, setIsCanvasHovered] = React.useState(false);
  const [ctaFlash, setCtaFlash] = React.useState(false);
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
    const handleFocusEditor = (): void => {
      textareaRef.current?.focus();
    };
    window.addEventListener('po:focus-editor', handleFocusEditor);
    return () => window.removeEventListener('po:focus-editor', handleFocusEditor);
  }, []);

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

  const formatSettingDisplay = (key: string, val: CapabilityValue): string => {
    if (key === 'duration_s') return `${val}s`;
    if (key === 'fps') return `${val} fps`;
    return String(val);
  };

  const getSettingValue = (info: PromptInputFieldInfo, key: string): string => {
    return String(generationParams[key] ?? info.field.default ?? '');
  };

  const handleSettingChange = (info: PromptInputFieldInfo, key: string, value: string): void => {
    const nextValue: CapabilityValue = info.field.type === 'int' ? Number(value) : value;
    handleParamChange(key, nextValue);
  };

  return (
    <div className="relative w-full">
      <div className="relative z-10 mx-auto w-full max-w-5xl px-5 py-10 md:px-12 md:py-12">
        <div className="flex flex-col gap-4">
          {/* Title block */}
          <header className="space-y-2">
            <h1
              className={cn(
                'font-semibold tracking-tight text-foreground transition-all duration-150',
                'text-heading-32 leading-tight'
              )}
            >
              Describe the shot
            </h1>
          </header>

          <section className="flex flex-col gap-3" aria-label="Prompt input">
            <div
              className={cn(
                'relative flex-1 min-w-0 min-h-44 rounded-xl border border-transparent bg-surface-2 p-5 transition-all duration-150',
                isFocused && 'min-h-52 border-accent/50 ring-1 ring-accent/20',
                !isFocused && isCanvasHovered && 'bg-surface-2'
              )}
              onMouseEnter={() => setIsCanvasHovered(true)}
              onMouseLeave={() => setIsCanvasHovered(false)}
            >
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
                className="w-full min-h-28 resize-none bg-transparent p-0 text-body text-foreground leading-relaxed placeholder:text-muted placeholder:font-normal focus-visible:outline-none selection:bg-accent/20 selection:text-foreground"
                aria-label="Prompt input"
                aria-busy={isProcessing}
              />

              {/* Connected controls bar */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  {onModelChange && (
                    <ModelSelectorDropdown selectedModel={selectedModel} onModelChange={onModelChange} variant="pillDark" />
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-8 rounded-full px-3 text-label-12 font-semibold"
                        aria-label="Settings"
                      >
                        Settings ▾
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" sideOffset={8} className="w-72 rounded-xl bg-surface-2">
                      <DropdownMenuLabel>Settings</DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      {aspectRatioInfo && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                              <span>Aspect ratio</span>
                              <span className="shrink-0 text-label-12 text-muted">
                                {formatSettingDisplay(
                                  'aspect_ratio',
                                  getSettingValue(aspectRatioInfo, 'aspect_ratio')
                                )}
                              </span>
                            </span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="rounded-xl bg-surface-2">
                            <DropdownMenuRadioGroup
                              value={getSettingValue(aspectRatioInfo, 'aspect_ratio')}
                              onValueChange={(value) => handleSettingChange(aspectRatioInfo, 'aspect_ratio', value)}
                            >
                              {aspectRatioInfo.allowedValues.map((value) => (
                                <DropdownMenuRadioItem key={String(value)} value={String(value)}>
                                  {formatSettingDisplay('aspect_ratio', value)}
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}

                      {resolutionInfo && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                              <span>Resolution</span>
                              <span className="shrink-0 text-label-12 text-muted">
                                {formatSettingDisplay(
                                  'resolution',
                                  getSettingValue(resolutionInfo, 'resolution')
                                )}
                              </span>
                            </span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="rounded-xl bg-surface-2">
                            <DropdownMenuRadioGroup
                              value={getSettingValue(resolutionInfo, 'resolution')}
                              onValueChange={(value) => handleSettingChange(resolutionInfo, 'resolution', value)}
                            >
                              {resolutionInfo.allowedValues.map((value) => (
                                <DropdownMenuRadioItem key={String(value)} value={String(value)}>
                                  {formatSettingDisplay('resolution', value)}
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}

                      {durationInfo && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                              <span>Duration</span>
                              <span className="shrink-0 text-label-12 text-muted">
                                {formatSettingDisplay(
                                  'duration_s',
                                  getSettingValue(durationInfo, 'duration_s')
                                )}
                              </span>
                            </span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="rounded-xl bg-surface-2">
                            <DropdownMenuRadioGroup
                              value={getSettingValue(durationInfo, 'duration_s')}
                              onValueChange={(value) => handleSettingChange(durationInfo, 'duration_s', value)}
                            >
                              {durationInfo.allowedValues.map((value) => (
                                <DropdownMenuRadioItem key={String(value)} value={String(value)}>
                                  {formatSettingDisplay('duration_s', value)}
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}

                      {fpsInfo && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                              <span>Frame rate</span>
                              <span className="shrink-0 text-label-12 text-muted">
                                {formatSettingDisplay('fps', getSettingValue(fpsInfo, 'fps'))}
                              </span>
                            </span>
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="rounded-xl bg-surface-2">
                            <DropdownMenuRadioGroup
                              value={getSettingValue(fpsInfo, 'fps')}
                              onValueChange={(value) => handleSettingChange(fpsInfo, 'fps', value)}
                            >
                              {fpsInfo.allowedValues.map((value) => (
                                <DropdownMenuRadioItem key={String(value)} value={String(value)}>
                                  {formatSettingDisplay('fps', value)}
                                </DropdownMenuRadioItem>
                              ))}
                            </DropdownMenuRadioGroup>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}

                      {audioInfo && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuCheckboxItem
                            checked={Boolean(generationParams.audio ?? audioInfo.field.default ?? false)}
                            onCheckedChange={(checked) => handleParamChange('audio', Boolean(checked))}
                          >
                            Audio
                          </DropdownMenuCheckboxItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 rounded-full px-3 text-label-12 font-medium text-muted"
                      >
                        Examples ▾
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" sideOffset={8} className="w-96 rounded-xl bg-surface-2">
                      <DropdownMenuLabel>Try one</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {[
                        'Wide shot of a lone cyclist on a foggy bridge, cinematic, slow push in.',
                        'Close-up of hands assembling a tiny robot, macro lens, soft studio light.',
                        'Tracking shot through a neon alley, rain, reflections, handheld energy.',
                      ].map((example) => (
                        <DropdownMenuItem
                          key={example}
                          onSelect={() => {
                            onInputChange(example);
                            window.setTimeout(() => textareaRef.current?.focus(), 0);
                          }}
                        >
                          {example}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <Button
                  type="button"
                  onClick={handleOptimizeClick}
                  disabled={isCtaDisabled}
                  title={!inputPrompt.trim() ? 'Write a rough shot first' : undefined}
                  className={cn(
                    'group h-10 rounded-lg px-4',
                    isProcessing && 'justify-between px-3',
                    ctaFlash && 'ring-2 ring-accent/20 shadow-md'
                  )}
                  aria-label="Optimize prompt"
                  variant="gradient"
                  size="xl"
                >
                  {isProcessing ? (
                    <>
                      <span
                        className="h-3 w-3 animate-spin rounded-full border-2 border-app/40 border-t-app"
                        aria-hidden="true"
                      />
                      <span className="text-body">Optimizing</span>
                      <span className="text-label-12 text-app/80" aria-hidden="true">
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
            </div>
          </section>

          {/* Workflow hint (single instance) */}
          {(!hasSeenWorkflowChip || !hasContent) && (
            <div
              className="flex items-center justify-center rounded-md border border-border/60 bg-surface-2 px-2.5 py-1.5 text-label-12 font-medium text-muted"
              role="status"
            >
              Structure → Refine → Generate
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
