import { useEffect, useState } from 'react';

interface EditingPersistenceState {
  isEditing: boolean;
  setIsEditing: (value: boolean) => void;
  originalInputPrompt: string;
  setOriginalInputPrompt: (value: string) => void;
  originalSelectedModel: string | undefined;
  setOriginalSelectedModel: (value: string | undefined) => void;
  resetEditingState: () => void;
}

const EDITING_KEY = 'generation-controls:isEditing';
const ORIGINAL_PROMPT_KEY = 'generation-controls:originalInputPrompt';
const ORIGINAL_MODEL_KEY = 'generation-controls:originalSelectedModel';

export function useEditingPersistence(): EditingPersistenceState {
  const [isEditing, setIsEditing] = useState(() => {
    try {
      return window.sessionStorage.getItem(EDITING_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [originalInputPrompt, setOriginalInputPrompt] = useState(() => {
    try {
      return window.sessionStorage.getItem(ORIGINAL_PROMPT_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [originalSelectedModel, setOriginalSelectedModel] = useState<string | undefined>(() => {
    try {
      return window.sessionStorage.getItem(ORIGINAL_MODEL_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  });

  useEffect(() => {
    try {
      window.sessionStorage.setItem(EDITING_KEY, String(isEditing));
      if (isEditing) {
        window.sessionStorage.setItem(ORIGINAL_PROMPT_KEY, originalInputPrompt);
        if (originalSelectedModel !== undefined) {
          window.sessionStorage.setItem(ORIGINAL_MODEL_KEY, originalSelectedModel);
        }
      } else {
        window.sessionStorage.removeItem(ORIGINAL_PROMPT_KEY);
        window.sessionStorage.removeItem(ORIGINAL_MODEL_KEY);
      }
    } catch {
      // ignore
    }
  }, [isEditing, originalInputPrompt, originalSelectedModel]);

  const resetEditingState = (): void => {
    setIsEditing(false);
    setOriginalInputPrompt('');
    setOriginalSelectedModel(undefined);
  };

  return {
    isEditing,
    setIsEditing,
    originalInputPrompt,
    setOriginalInputPrompt,
    originalSelectedModel,
    setOriginalSelectedModel,
    resetEditingState,
  };
}
