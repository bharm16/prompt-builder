import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

type PromptInsertHandler = (text: string) => boolean;

interface PromptInsertionBusContextValue {
  registerInsertHandler: (handler: PromptInsertHandler | null) => void;
  insertAtCaret: (text: string) => boolean;
}

interface PromptInsertionBusProviderProps {
  children: ReactNode;
  inputPrompt: string;
  setInputPrompt: (prompt: string) => void;
  clearResultsView?: () => void;
}

const PromptInsertionBusContext = createContext<PromptInsertionBusContextValue | null>(null);

const normalizeTriggerText = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
};

const appendTriggerWithDelimiter = (currentText: string, trigger: string): string => {
  const trimmedEnd = currentText.replace(/\s+$/, '');
  if (!trimmedEnd) return trigger;
  if (trimmedEnd.endsWith(',')) return `${trimmedEnd} ${trigger}`;
  return `${trimmedEnd}, ${trigger}`;
};

export function PromptInsertionBusProvider({
  children,
  inputPrompt,
  setInputPrompt,
  clearResultsView,
}: PromptInsertionBusProviderProps): React.ReactElement {
  const insertHandlerRef = useRef<PromptInsertHandler | null>(null);
  const inputPromptRef = useRef(inputPrompt);
  inputPromptRef.current = inputPrompt;
  const setInputPromptRef = useRef(setInputPrompt);
  setInputPromptRef.current = setInputPrompt;
  const clearResultsViewRef = useRef(clearResultsView);
  clearResultsViewRef.current = clearResultsView;

  const registerInsertHandler = useCallback((handler: PromptInsertHandler | null): void => {
    insertHandlerRef.current = handler;
  }, []);

  const insertAtCaret = useCallback(
    (rawText: string): boolean => {
      const normalizedTrigger = normalizeTriggerText(rawText);
      if (!normalizedTrigger) return false;

      const insertedAtCaret = insertHandlerRef.current?.(normalizedTrigger) ?? false;
      if (insertedAtCaret) {
        return true;
      }

      const nextPrompt = appendTriggerWithDelimiter(inputPromptRef.current, normalizedTrigger);
      setInputPromptRef.current(nextPrompt);
      clearResultsViewRef.current?.();
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- all values accessed via stable refs
    []
  );

  const value = useMemo<PromptInsertionBusContextValue>(
    () => ({
      registerInsertHandler,
      insertAtCaret,
    }),
    [insertAtCaret, registerInsertHandler]
  );

  return (
    <PromptInsertionBusContext.Provider value={value}>
      {children}
    </PromptInsertionBusContext.Provider>
  );
}

export function usePromptInsertionBus(): PromptInsertionBusContextValue {
  const context = useContext(PromptInsertionBusContext);
  if (!context) {
    throw new Error('usePromptInsertionBus must be used within PromptInsertionBusProvider');
  }
  return context;
}

