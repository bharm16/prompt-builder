import React, { useMemo } from 'react';
import { useDebugLogger } from '@hooks/useDebugLogger';
import { ModelSelectorDropdown } from './components/ModelSelectorDropdown';
import { CapabilitiesPanel } from './components/CapabilitiesPanel';
import { useCapabilities } from './hooks/useCapabilities';
import { resolveFieldState, type CapabilityValue } from '@shared/capabilities';
import type { PromptInputProps } from './types';

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
  const { schema, isLoading, error, target } = useCapabilities(selectedModel);

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
          className="h-8 pl-2 pr-6 text-sm bg-transparent border-none rounded-md text-geist-accents-5 hover:text-geist-foreground hover:bg-geist-accents-1 focus:ring-0 cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20stroke%3D%22%23666%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_4px_center] bg-no-repeat"
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
          className="group flex items-center gap-1.5 h-8 px-2 rounded-md hover:bg-geist-accents-1 transition-colors"
          title="Toggle Audio"
        >
           {isEnabled ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-geist-foreground">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            </svg>
           ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-geist-accents-4">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
              <line x1="23" y1="9" x2="17" y2="15"></line>
              <line x1="17" y1="9" x2="23" y2="15"></line>
            </svg>
           )}
           <span className={`text-sm ${isEnabled ? 'text-geist-foreground' : 'text-geist-accents-5'}`}>
             Audio
           </span>
        </button>
      </div>
    );
  };

  return (
    <div className="mb-12 w-full max-w-4xl text-center animate-fade-in">
      {/* Hero Section */}
      <div className="mb-8">
        <h1 className="text-heading-40 sm:text-heading-72 text-geist-foreground">
          Vidra
        </h1>
        <p className="mt-geist-2 text-copy-16 text-geist-accents-6 max-w-2xl mx-auto">
          From concept to draft
        </p>
      </div>

      {/* Main Input Section - Clean Design */}
      <div className="relative mb-6 w-full">
        <div className="bg-geist-background border border-geist-accents-2 rounded-geist-lg shadow-geist-small transition-all duration-200 focus-within:border-geist-accents-4 focus-within:shadow-geist-medium">
            <label htmlFor="prompt-input" className="sr-only">
              Enter your prompt
            </label>
            <textarea
              id="prompt-input"
              value={inputPrompt}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to create..."
              rows={1}
              className="w-full resize-none bg-transparent text-[16px] text-geist-foreground placeholder-geist-accents-6 placeholder:font-medium outline-none leading-relaxed px-geist-6 pt-geist-6 pb-0 rounded-t-geist-lg font-sans"
              style={{
                border: 'none',
                boxShadow: 'none',
                outline: 'none',
              }}
              aria-label="Prompt input"
            />

          {/* Action Bar */}
          <div className="flex items-center justify-between px-geist-4 py-geist-2 bg-geist-background">
            <div className="flex items-center gap-geist-2 flex-wrap">
              {/* Video model selector */}
              {onModelChange && (
                <div className="flex items-center">
                  <ModelSelectorDropdown
                    selectedModel={selectedModel}
                    onModelChange={onModelChange}
                  />
                </div>
              )}

              {/* Params Dropdowns */}
              {renderDropdown(aspectRatioInfo, 'aspect_ratio', 'Aspect Ratio')}
              {renderDropdown(resolutionInfo, 'resolution', 'Resolution')}
              {renderDropdown(durationInfo, 'duration_s', 'Duration')}
              {renderDropdown(fpsInfo, 'fps', 'Frame Rate')}
              
              {/* Audio Toggle */}
              {renderAudioToggle()}
            </div>

            <button
              onClick={handleOptimizeClick}
              disabled={!inputPrompt.trim() || isProcessing}
              className="inline-flex items-center gap-geist-2 px-geist-4 py-1.5 text-button-16 text-white bg-orange-500 rounded-geist hover:bg-orange-600 shadow-geist-small transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-geist-background"
              aria-label="Optimize prompt"
              title="Optimize (⌘Enter)"
            >
              <span>Optimize</span>
            </button>
          </div>

          <div className="border-t border-geist-accents-2 px-geist-4 py-geist-3 bg-geist-background rounded-b-geist-lg">
            <CapabilitiesPanel
              selectedModel={selectedModel}
              generationParams={generationParams}
              onChange={onGenerationParamsChange}
              schema={schema}
              isLoading={isLoading}
              error={error}
              targetLabel={target.label}
              excludeFields={['aspect_ratio', 'resolution', 'duration_s', 'fps', 'audio']}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
