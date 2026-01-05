import React, { useMemo } from 'react';
import { useDebugLogger } from '@hooks/useDebugLogger';
import { ModelSelectorDropdown } from './components/ModelSelectorDropdown';
import { useCapabilities } from './hooks/useCapabilities';
import { resolveFieldState } from '@shared/capabilities';
import type { PromptInputProps } from './types';
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

  // Load capabilities schema to access aspect ratio options
  const { schema } = useCapabilities(selectedModel);
  const [hasTyped, setHasTyped] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const HINTS = React.useMemo(
    () =>
      [
        'Try adding camera angle or lens',
        'Lighting and motion make a big difference',
        'Is the camera static or moving?',
      ] as const,
    []
  );
  const [hintIndex, setHintIndex] = React.useState<number>(0);
  const hintVisible = inputPrompt.length >= 20;
  const prevHintVisibleRef = React.useRef<boolean>(false);
  const ghostRows = React.useMemo(
    () =>
      [
        { label: 'Subject', width: 180, color: 'rgb(var(--po-primary-rgb) / 0.35)' },
        { label: 'Camera', width: 120, color: 'rgb(var(--po-accent-rgb) / 0.35)' },
        { label: 'Lighting', width: 220, color: 'rgb(var(--po-primary-rgb) / 0.25)' },
        { label: 'Motion', width: 88, color: 'rgb(var(--po-accent-rgb) / 0.25)' },
        { label: 'Style', width: 150, color: 'rgb(var(--po-primary-rgb) / 0.20)' },
      ] as const,
    []
  );

  // Helper to extract field info
  const getFieldInfo = (fieldName: string) => {
    if (!schema?.fields?.[fieldName]) return null;

    const field = schema.fields[fieldName];
    const state = resolveFieldState(field, generationParams);
    
    if (!state.available || state.disabled) return null;

    const allowedValues = field.type === 'enum' 
      ? state.allowedValues ?? field.values ?? [] 
      : [];

    return { field, allowedValues };
  };

  const aspectRatioInfo = useMemo(() => getFieldInfo('aspect_ratio'), [schema, generationParams]);
  const durationInfo = useMemo(() => getFieldInfo('duration_s'), [schema, generationParams]);
  const resolutionInfo = useMemo(() => getFieldInfo('resolution'), [schema, generationParams]);
  const fpsInfo = useMemo(() => getFieldInfo('fps'), [schema, generationParams]);
  
  // Audio toggle info
  const audioInfo = useMemo(() => {
    if (!schema?.fields?.audio) return null;
    const field = schema.fields.audio;
    const state = resolveFieldState(field, generationParams);
    if (!state.available || state.disabled) return null;
    return { field };
  }, [schema, generationParams]);

  const handleParamChange = (key: string, value: any) => {
    onGenerationParamsChange({
      ...generationParams,
      [key]: value,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // In video mode, require Cmd/Ctrl+Enter to avoid accidental submissions while writing.
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        debug.logAction('optimizeViaKeyboard', { 
          mode: selectedMode,
          promptLength: inputPrompt.length,
          modifier: e.metaKey ? 'cmd' : e.ctrlKey ? 'ctrl' : 'none',
        });
        onOptimize();
      }
    }
  };

  React.useEffect(() => {
    const wasVisible = prevHintVisibleRef.current;
    prevHintVisibleRef.current = hintVisible;

    // When the hint first appears, choose a seed so it doesn't feel repetitive.
    if (!wasVisible && hintVisible) {
      setHintIndex(Math.floor(Math.random() * HINTS.length));
    }
  }, [hintVisible, HINTS.length]);

  React.useEffect(() => {
    if (!hintVisible) return;
    const id = window.setInterval(() => {
      setHintIndex((i) => (i + 1) % HINTS.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, [hintVisible, HINTS.length]);

  const handleOptimizeClick = (e: React.MouseEvent<HTMLButtonElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    
    if (inputPrompt && inputPrompt.trim()) {
      debug.logAction('optimizeViaButton', { 
        mode: selectedMode,
        promptLength: inputPrompt.length,
        selectedModel // Log selected model
      });
      onOptimize();
    }
  };

  const renderDropdown = (info: ReturnType<typeof getFieldInfo>, key: string, label: string) => {
    if (!info) return null;
    
    // For duration, append 's' to the value for display if it's a number
    const formatDisplay = (val: any) => {
      if (key === 'duration_s') return `${val}s`;
      if (key === 'fps') return `${val} fps`;
      return String(val);
    };

    return (
      <div className="flex items-center">
        <select
          value={String(generationParams[key] || info.field.default || '')}
          onChange={(e) => {
            const val = info.field.type === 'int' ? Number(e.target.value) : e.target.value;
            handleParamChange(key, val);
          }}
          className="prompt-input__control-select h-8 pl-3 pr-8 text-[13px] font-medium rounded-[8px] cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%23FFF%22%20stroke-opacity%3D%220.78%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_8px_center] bg-no-repeat"
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
          className="prompt-input__control-toggle group flex items-center gap-1.5 h-8 px-2 rounded-md transition-colors"
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
    <div className="w-full h-full">
      <div className="w-full h-full">
        <div className="w-full pl-6 pr-6 pt-16 lg:pl-24 lg:pr-10 lg:pt-[120px]">
          <div className="w-full max-w-[880px] text-left">
            <h1
              className="text-[56px] font-bold leading-[1.05] tracking-[-0.03em] text-[#0B0B0C] transition-opacity duration-[150ms] ease-out"
              style={{ opacity: hasTyped ? 0.5 : 1 }}
            >
              Describe the shot
            </h1>

            <div
              className="overflow-hidden transition-[max-height,opacity,margin-top] duration-[150ms] ease-out"
              style={{
                marginTop: hasTyped ? 0 : 16,
                maxHeight: hasTyped ? 0 : 80,
                opacity: hasTyped ? 0 : 1,
              }}
            >
              <p className="text-[16px] font-normal leading-[1.6] text-[#6B6F76]">
                Camera, subject, lighting, motion — start rough.
              </p>
            </div>

            <div className="relative mt-10">
              <div
                className={`prompt-input__canvas ${isFocused ? 'prompt-input__canvas--focused' : ''}`}
              >
                {/* Subtle caret pulse overlay (not the native caret) */}
                {!inputPrompt && (
                  <span
                    aria-hidden="true"
                    className="prompt-input__empty-caret pointer-events-none absolute left-8 top-[34px] h-[22px] w-[2px] empty-state-caret-pulse"
                  />
                )}

                <label htmlFor="prompt-input" className="sr-only">
                  Prompt
                </label>
                <textarea
                  id="prompt-input"
                  value={inputPrompt}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (!hasTyped && next.length > 0) setHasTyped(true);
                    onInputChange(next);
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder=""
                  autoFocus={!hasTyped}
                  rows={3}
                  className="prompt-input__textarea w-full resize-none bg-transparent border-none outline-none p-0 text-[18px] leading-[1.8] text-[#111] placeholder:text-[#9AA0A6]"
                  style={{
                    minHeight: '96px',
                  }}
                  aria-label="Prompt input"
                />
              </div>
            </div>

            {/* Optimize CTA (causally attached to input) */}
            <div className="mt-3">
              <button
                type="button"
                onClick={handleOptimizeClick}
                disabled={!inputPrompt.trim() || isProcessing}
                className="prompt-input__optimize-btn inline-flex items-center justify-center h-9 px-4 rounded-[8px] text-white text-[14px] font-semibold transition-[background-color,transform,opacity,box-shadow] disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Optimize prompt"
              >
                Optimize prompt →
              </button>
            </div>

            {/* Progressive guidance (suggestive, not instructional) */}
            <div
              className="mt-2 text-[13px] text-[#9AA0A6] transition-opacity duration-[200ms] ease-out"
              style={{ opacity: hintVisible ? 1 : 0, minHeight: 18 }}
              aria-hidden={!hintVisible}
            >
              {HINTS[hintIndex]}
            </div>

            {/* Model controls (grouped constraint container) */}
            <div className="prompt-input__controls mt-6 rounded-[12px] p-3">
              <div className="flex flex-wrap items-center gap-2">
                {onModelChange && (
                  <ModelSelectorDropdown selectedModel={selectedModel} onModelChange={onModelChange} variant="pillDark" />
                )}
                {renderDropdown(aspectRatioInfo, 'aspect_ratio', 'Aspect Ratio')}
                {renderDropdown(resolutionInfo, 'resolution', 'Resolution')}
                {renderDropdown(durationInfo, 'duration_s', 'Duration')}
                {renderDropdown(fpsInfo, 'fps', 'Frame Rate')}
                {renderAudioToggle()}
              </div>
            </div>

            {/* Ghost "structure promise" (non-interactive, monochrome) */}
            <div className="mt-4 opacity-70 select-none pointer-events-none" aria-hidden="true">
              <div className="space-y-2 text-[12px] text-[#111]">
                {ghostRows.map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <div className="w-[72px]">{row.label}</div>
                    <div
                      className="h-[10px] rounded-[6px]"
                      style={{
                        width: row.width,
                        background: row.color,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
