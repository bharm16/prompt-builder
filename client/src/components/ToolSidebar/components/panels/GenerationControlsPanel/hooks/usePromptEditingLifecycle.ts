import { useCallback, type KeyboardEvent, type RefObject } from 'react';
import { useEditingPersistence } from './useEditingPersistence';
import type { GenerationControlsPanelProps } from '../types';

interface UsePromptEditingLifecycleOptions {
  prompt: string;
  selectedModel: string;
  canOptimize: boolean;
  isOptimizing: boolean;
  showResults: boolean;
  genericOptimizedPrompt: string | null;
  onOptimize: GenerationControlsPanelProps['onOptimize'];
  onPromptChange: GenerationControlsPanelProps['onPromptChange'];
  resolvedPromptInputRef: RefObject<HTMLTextAreaElement>;
  handleModelChange: (model: string) => void;
  handleAutocompleteKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => boolean;
}

interface UsePromptEditingLifecycleResult {
  isEditing: boolean;
  resetEditingState: () => void;
  handleEditClick: () => void;
  handleCancelEdit: () => void;
  handleUpdate: () => void;
  handleReoptimize: () => void;
  handlePromptKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function usePromptEditingLifecycle({
  prompt,
  selectedModel,
  canOptimize,
  isOptimizing,
  showResults,
  genericOptimizedPrompt,
  onOptimize,
  onPromptChange,
  resolvedPromptInputRef,
  handleModelChange,
  handleAutocompleteKeyDown,
}: UsePromptEditingLifecycleOptions): UsePromptEditingLifecycleResult {
  const {
    isEditing,
    setIsEditing,
    originalInputPrompt,
    setOriginalInputPrompt,
    originalSelectedModel,
    setOriginalSelectedModel,
    resetEditingState,
  } = useEditingPersistence();

  const handleEditClick = useCallback((): void => {
    if (!canOptimize || isOptimizing) {
      return;
    }
    setOriginalInputPrompt(prompt);
    setOriginalSelectedModel(selectedModel);
    setIsEditing(true);
    setTimeout(() => {
      resolvedPromptInputRef.current?.focus();
    }, 0);
  }, [
    canOptimize,
    isOptimizing,
    prompt,
    resolvedPromptInputRef,
    selectedModel,
    setIsEditing,
    setOriginalInputPrompt,
    setOriginalSelectedModel,
  ]);

  const handleCancelEdit = useCallback((): void => {
    if (!canOptimize) return;
    onPromptChange?.(originalInputPrompt);
    if (originalSelectedModel !== undefined) {
      handleModelChange(originalSelectedModel);
    }
    resetEditingState();
  }, [
    canOptimize,
    handleModelChange,
    onPromptChange,
    originalInputPrompt,
    originalSelectedModel,
    resetEditingState,
  ]);

  const handleUpdate = useCallback((): void => {
    if (!canOptimize || isOptimizing || !onOptimize) {
      return;
    }
    const promptChanged = prompt !== originalInputPrompt;
    const modelChanged =
      typeof originalSelectedModel === 'string' &&
      originalSelectedModel !== selectedModel;
    const compilePrompt =
      typeof genericOptimizedPrompt === 'string' && genericOptimizedPrompt.trim()
        ? genericOptimizedPrompt
        : null;

    if (modelChanged && !promptChanged && compilePrompt) {
      void onOptimize(prompt, {
        compileOnly: true,
        compilePrompt,
        createVersion: true,
      });
    } else {
      void onOptimize(prompt);
    }

    resetEditingState();
  }, [
    canOptimize,
    genericOptimizedPrompt,
    isOptimizing,
    onOptimize,
    originalInputPrompt,
    originalSelectedModel,
    prompt,
    selectedModel,
    resetEditingState,
  ]);

  const handleReoptimize = useCallback((): void => {
    if (!canOptimize || isOptimizing || !onOptimize) {
      return;
    }
    void onOptimize(prompt);
  }, [canOptimize, isOptimizing, onOptimize, prompt]);

  const handlePromptKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): void => {
      if (handleAutocompleteKeyDown(event)) {
        return;
      }
      if (!canOptimize || isOptimizing || !onOptimize) {
        return;
      }
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (!showResults) {
          if (prompt.trim()) {
            void onOptimize(prompt);
          }
        } else if (isEditing) {
          handleUpdate();
        } else {
          handleReoptimize();
        }
      }
    },
    [
      canOptimize,
      handleAutocompleteKeyDown,
      handleReoptimize,
      handleUpdate,
      isEditing,
      isOptimizing,
      onOptimize,
      prompt,
      showResults,
    ]
  );

  return {
    isEditing,
    resetEditingState,
    handleEditClick,
    handleCancelEdit,
    handleUpdate,
    handleReoptimize,
    handlePromptKeyDown,
  };
}
