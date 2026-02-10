import { useCallback, useState, type KeyboardEvent, type RefObject } from 'react';
import type { Asset } from '@shared/types/asset';
import { useTriggerAutocomplete } from '@/features/prompt-optimizer/components/TriggerAutocomplete';
import type { GenerationControlsPanelProps } from '../types';
import type { AutocompleteState } from '../components/PromptTriggerAutocomplete';

interface UseUploadAndAutocompleteOptions {
  fileInputRef: RefObject<HTMLInputElement>;
  inputRef: RefObject<HTMLTextAreaElement>;
  prompt: string;
  assets: Asset[];
  onPromptChange: GenerationControlsPanelProps['onPromptChange'];
  isOptimizing: boolean;
  showResults: boolean;
  isEditing: boolean;
  onInsertTrigger: GenerationControlsPanelProps['onInsertTrigger'];
  onImageUpload: GenerationControlsPanelProps['onImageUpload'];
  isKeyframeLimitReached: boolean;
}

interface UseUploadAndAutocompleteResult {
  isUploading: boolean;
  isUploadDisabled: boolean;
  handleFile: (file: File) => Promise<void>;
  handleUploadRequest: () => void;
  handleAutocompleteKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => boolean;
  autocomplete: AutocompleteState;
}

export function useUploadAndAutocomplete({
  fileInputRef,
  inputRef,
  prompt,
  assets,
  onPromptChange,
  isOptimizing,
  showResults,
  isEditing,
  onInsertTrigger,
  onImageUpload,
  isKeyframeLimitReached,
}: UseUploadAndAutocompleteOptions): UseUploadAndAutocompleteResult {
  const [isUploading, setIsUploading] = useState(false);
  const isUploadDisabled =
    !onImageUpload || isUploading || isKeyframeLimitReached;

  const {
    isOpen: autocompleteOpen,
    suggestions: autocompleteSuggestions,
    selectedIndex: autocompleteSelectedIndex,
    position: autocompletePosition,
    query: autocompleteQuery,
    handleKeyDown: handleAutocompleteKeyDown,
    selectSuggestion: selectAutocompleteSuggestion,
    setSelectedIndex: setAutocompleteSelectedIndex,
    close: closeAutocomplete,
    updateFromCursor: updateAutocompletePosition,
  } = useTriggerAutocomplete({
    inputRef,
    prompt,
    assets,
    isEnabled:
      Boolean(onPromptChange) && !isOptimizing && (!showResults || isEditing),
    onSelect: (asset, range) => {
      onInsertTrigger?.(asset.trigger, range);
    },
  });

  const handleFile = useCallback(
    async (file: File) => {
      if (isUploadDisabled || !onImageUpload) return;
      const result = onImageUpload(file);
      if (result && typeof (result as Promise<void>).then === 'function') {
        setIsUploading(true);
        try {
          await result;
        } finally {
          setIsUploading(false);
        }
      }
    },
    [isUploadDisabled, onImageUpload]
  );

  const handleUploadRequest = useCallback(() => {
    if (isUploadDisabled) return;
    fileInputRef.current?.click();
  }, [fileInputRef, isUploadDisabled]);

  return {
    isUploading,
    isUploadDisabled,
    handleFile,
    handleUploadRequest,
    handleAutocompleteKeyDown,
    autocomplete: {
      autocompleteOpen,
      autocompleteSuggestions,
      autocompleteSelectedIndex,
      autocompletePosition,
      autocompleteQuery,
      selectAutocompleteSuggestion,
      setAutocompleteSelectedIndex,
      closeAutocomplete,
      updateAutocompletePosition,
    },
  };
}
