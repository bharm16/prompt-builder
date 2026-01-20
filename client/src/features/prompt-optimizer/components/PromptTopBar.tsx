import React, { useCallback, useMemo, useRef, useState } from 'react';
import { usePromptState } from '../context/PromptStateContext';
import { Button } from '@promptstudio/system/components/ui/button';
import { Textarea } from '@promptstudio/system/components/ui/textarea';
import {
  Check,
  Icon,
  Pencil,
  SidebarSimple,
  X,
} from '@promptstudio/system/components/ui';
import { useDebugLogger } from '@hooks/useDebugLogger';
import type { OptimizationOptions } from '../types';
import { PromptControlsRow } from './PromptControlsRow';
import { sanitizeText } from '@/features/span-highlighting';
import { cn } from '@/utils/cn';

type PromptTopBarProps = {
  onOptimize: (
    promptToOptimize?: string,
    options?: OptimizationOptions
  ) => Promise<void>;
};

const iconSizes = {
  sm: 16,
} as const;

/**
 * PromptTopBar - Midjourney-style prompt bar
 */
export const PromptTopBar = ({
  onOptimize,
}: PromptTopBarProps): React.ReactElement | null => {
  const {
    showHistory,
    setShowHistory,
    showBrainstorm,
    promptOptimizer,
    outputSaveState,
    outputLastSavedAt,
    selectedModel,
    setSelectedModel,
  } = usePromptState();

  // Hide when brainstorm modal is open
  if (showBrainstorm) {
    return null;
  }

  const debug = useDebugLogger('PromptTopBar');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [originalInputPrompt, setOriginalInputPrompt] = useState('');
  const [originalSelectedModel, setOriginalSelectedModel] = useState<
    string | undefined
  >(undefined);

  const {
    inputPrompt,
    setInputPrompt,
    genericOptimizedPrompt,
    isProcessing,
    isRefining,
    displayedPrompt,
    qualityScore,
  } = promptOptimizer;

  const timeLabel = useMemo(
    () =>
      typeof outputLastSavedAt === 'number'
        ? new Date(outputLastSavedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })
        : null,
    [outputLastSavedAt]
  );

  const saveLabel = useMemo(
    () =>
      outputSaveState === 'saving'
        ? 'Saving...'
        : outputSaveState === 'error'
          ? 'Save failed'
          : outputSaveState === 'saved'
            ? timeLabel
              ? `Saved · ${timeLabel}`
              : 'Saved'
            : '',
    [outputSaveState, timeLabel]
  );

  const isOptimizing = Boolean(isProcessing || isRefining);
  const isInputLocked = !isEditing || isOptimizing;
  const hasInputPrompt = Boolean(inputPrompt.trim());
  const isReoptimizeDisabled = !hasInputPrompt || isProcessing || isRefining;

  const handleInputPromptChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
      const updatedPrompt = sanitizeText(event.target.value);
      debug.logAction('inputPromptEdit', {
        promptLength: updatedPrompt.length,
      });
      setInputPrompt(updatedPrompt);
    },
    [debug, setInputPrompt]
  );

  const handleEditClick = useCallback((): void => {
    if (isOptimizing) {
      return;
    }
    setOriginalInputPrompt(inputPrompt);
    setOriginalSelectedModel(selectedModel);
    setIsEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  }, [inputPrompt, isOptimizing, selectedModel]);

  const handleModelChange = useCallback(
    (_nextModel: string, previousModel: string | undefined): void => {
      if (isOptimizing || isEditing) {
        return;
      }
      setOriginalInputPrompt(inputPrompt);
      setOriginalSelectedModel(previousModel);
      setIsEditing(true);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    },
    [inputPrompt, isEditing, isOptimizing]
  );

  const handleCancel = useCallback((): void => {
    setInputPrompt(originalInputPrompt);
    if (originalSelectedModel !== undefined) {
      setSelectedModel(originalSelectedModel);
    }
    setIsEditing(false);
    setOriginalInputPrompt('');
    setOriginalSelectedModel(undefined);
  }, [
    originalInputPrompt,
    originalSelectedModel,
    setInputPrompt,
    setSelectedModel,
  ]);

  const handleUpdate = useCallback((): void => {
    if (isProcessing || isRefining) {
      return;
    }
    debug.logAction('reoptimize', { promptLength: inputPrompt.length });
    const promptChanged = inputPrompt !== originalInputPrompt;
    const modelChanged =
      typeof originalSelectedModel === 'string' &&
      originalSelectedModel !== selectedModel;
    const genericPrompt =
      typeof genericOptimizedPrompt === 'string' &&
      genericOptimizedPrompt.trim()
        ? genericOptimizedPrompt
        : null;

    if (modelChanged && !promptChanged && genericPrompt) {
      void onOptimize(inputPrompt, {
        compileOnly: true,
        compilePrompt: genericPrompt,
        createVersion: true,
      });
    } else {
      void onOptimize(inputPrompt);
    }
    setIsEditing(false);
    setOriginalInputPrompt('');
    setOriginalSelectedModel(undefined);
  }, [
    debug,
    genericOptimizedPrompt,
    inputPrompt,
    isProcessing,
    isRefining,
    onOptimize,
    originalInputPrompt,
    originalSelectedModel,
    selectedModel,
  ]);

  const handleReoptimize = useCallback((): void => {
    if (isProcessing || isRefining) {
      return;
    }
    debug.logAction('reoptimize', { promptLength: inputPrompt.length });
    void onOptimize(inputPrompt);
  }, [debug, inputPrompt, isProcessing, isRefining, onOptimize]);

  const handleInputPromptKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
      if (isProcessing || isRefining) {
        return;
      }
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (isEditing) {
          handleUpdate();
        } else {
          handleReoptimize();
        }
      }
    },
    [handleReoptimize, handleUpdate, isEditing, isProcessing, isRefining]
  );

  return (
    <header
      className="relative z-40 flex w-full items-center justify-center"
      role="banner"
    >
      <div
        className={cn(
          'px-ps-4 mx-auto flex w-full max-w-7xl flex-nowrap items-center justify-center gap-2',
          isOptimizing && 'opacity-70'
        )}
      >
        <div className="gap-ps-2 ps-glass flex h-14 w-full max-w-4xl flex-1 items-center rounded-xl shadow-sm">
          <Button
            type="button"
            aria-label={showHistory ? 'Hide history' : 'Show history'}
            aria-pressed={showHistory}
            onClick={() => setShowHistory(!showHistory)}
            variant="canvas"
            size="icon-lg"
          >
            <Icon
              icon={SidebarSimple}
              size="md"
              weight="bold"
              aria-hidden="true"
            />
          </Button>

          {saveLabel ? (
            <div
              className="h-ps-6 flex items-center"
              title={saveLabel}
              aria-label={saveLabel}
              data-state={outputSaveState}
            >
              <span
                className={cn(
                  'h-ps-2 w-ps-2 rounded-full',
                  outputSaveState === 'saving' &&
                    'bg-accent ring-accent/10 ring-2',
                  outputSaveState === 'error' &&
                    'bg-error ring-error/10 ring-2',
                  outputSaveState === 'saved' &&
                    'bg-success ring-success/10 ring-2'
                )}
                aria-hidden="true"
              />
            </div>
          ) : null}

          <div className="flex min-w-72 flex-1 items-center">
            <label htmlFor="prompt-topbar-input" className="ps-sr-only">
              Input prompt
            </label>
            <Textarea
              ref={textareaRef}
              id="prompt-topbar-input"
              value={inputPrompt}
              onChange={handleInputPromptChange}
              onKeyDown={handleInputPromptKeyDown}
              placeholder="Describe your shot..."
              readOnly={isInputLocked}
              rows={1}
              wrap="off"
              className="px-ps-3 py-ps-3 text-body-lg text-foreground placeholder:text-faint ps-scrollbar-hide h-full min-h-0 w-full resize-none overflow-x-auto overflow-y-hidden whitespace-nowrap rounded-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Original prompt input"
              aria-readonly={isInputLocked}
              aria-busy={isOptimizing}
            />
          </div>

          {!isEditing ? (
            <Button
              type="button"
              onClick={handleEditClick}
              disabled={isOptimizing}
              aria-label="Edit prompt"
              title="Edit prompt"
              variant="canvas"
              size="icon-lg"
            >
              <Icon icon={Pencil} size="md" weight="bold" aria-hidden="true" />
            </Button>
          ) : (
            <div className="gap-ps-2 flex items-start">
              <Button
                type="button"
                onClick={handleCancel}
                disabled={isOptimizing}
                aria-label="Cancel editing"
                title="Cancel editing"
                variant="canvas"
                size="icon-lg"
              >
                <Icon icon={X} size="md" weight="bold" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                onClick={handleUpdate}
                disabled={isReoptimizeDisabled}
                variant="canvas"
                size="icon-lg"
                aria-label="Update prompt"
                title="Update and re-optimize (Cmd/Ctrl+Enter)"
              >
                <Icon icon={Check} size="md" weight="bold" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>

        <PromptControlsRow
          className="ps-glass px-ps-2 h-14 flex-shrink-0 rounded-xl shadow-sm"
          onModelChange={handleModelChange}
        />
      </div>
    </header>
  );
};
