import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useClipboard } from '@features/prompt-optimizer/hooks/useClipboard';
import { useShareLink } from '@features/prompt-optimizer/hooks/useShareLink';
import { AI_MODEL_IDS, AI_MODEL_LABELS } from '@features/prompt-optimizer/components/constants';

type ReoptimizeOptions = {
  forceGenericTarget?: boolean;
  compileOnly?: boolean;
  compilePrompt?: string;
  createVersion?: boolean;
  targetModel?: string;
};

interface CanvasEditorStateParams {
  showResults: boolean;
  displayedPrompt: string;
  inputPrompt: string;
  promptUuid?: string | null;
  isOptimizing: boolean;
  genericOptimizedPrompt?: string | null;
  onReoptimize: (prompt: string, options?: ReoptimizeOptions) => Promise<unknown> | unknown;
  logAction: (name: string, data?: Record<string, unknown>) => void;
}

export interface CanvasEditorState {
  editorRef: React.RefObject<HTMLDivElement>;
  editorWrapperRef: React.RefObject<HTMLDivElement>;
  editorColumnRef: React.RefObject<HTMLDivElement>;
  outputLocklineRef: React.RefObject<HTMLDivElement>;
  lockButtonRef: React.RefObject<HTMLButtonElement>;
  exportMenuRef: React.RefObject<HTMLDivElement>;
  generationsSheetOpen: boolean;
  setGenerationsSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showDiff: boolean;
  setShowDiff: React.Dispatch<React.SetStateAction<boolean>>;
  copied: boolean;
  handleCopy: () => void;
  handleCopyEvent: (event: React.ClipboardEvent) => void;
  handleShare: () => void;
  showExportMenu: boolean;
  setShowExportMenu: (value: boolean) => void;
  modelFormatOptions: Array<{ id: string; label: string }>;
  modelFormatValue: string;
  modelFormatLabel: string;
  handleModelFormatChange: (nextValue: string) => void;
}

export function useCanvasEditorState({
  showResults,
  displayedPrompt,
  inputPrompt,
  promptUuid,
  isOptimizing,
  genericOptimizedPrompt,
  onReoptimize,
  logAction,
}: CanvasEditorStateParams): CanvasEditorState {
  const editorRef = useRef<HTMLDivElement>(null!);
  const editorWrapperRef = useRef<HTMLDivElement>(null!);
  const editorColumnRef = useRef<HTMLDivElement>(null!);
  const outputLocklineRef = useRef<HTMLDivElement>(null!);
  const lockButtonRef = useRef<HTMLButtonElement>(null!);
  const exportMenuRef = useRef<HTMLDivElement>(null!);

  const [generationsSheetOpen, setGenerationsSheetOpen] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showExportMenu, setShowExportMenuState] = useState(false);

  const modelFormatOptions = useMemo(
    () =>
      [...AI_MODEL_IDS]
        .map((id) => ({ id, label: AI_MODEL_LABELS[id] }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    []
  );

  const [modelFormatValue, setModelFormatValue] = useState<string>('auto');
  const modelFormatLabel = useMemo(() => {
    if (modelFormatValue === 'auto') {
      return 'Auto';
    }
    return (
      modelFormatOptions.find((option) => option.id === modelFormatValue)?.label ??
      modelFormatValue
    );
  }, [modelFormatOptions, modelFormatValue]);

  const { copied, copy } = useClipboard();
  const { share } = useShareLink();

  const setShowExportMenu = useCallback((value: boolean): void => {
    setShowExportMenuState(value);
  }, []);

  useEffect(() => {
    if (!showExportMenu) return;
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setShowExportMenuState(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  useEffect(() => {
    if (!showDiff) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setShowDiff(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showDiff]);

  useEffect(() => {
    if (showResults) {
      return;
    }
    setShowDiff(false);
  }, [showResults]);

  const handleCopy = useCallback((): void => {
    logAction('copy', {
      promptLength: displayedPrompt.length,
    });
    copy(displayedPrompt);
  }, [copy, displayedPrompt, logAction]);

  const handleShare = useCallback((): void => {
    if (promptUuid) {
      logAction('share', { promptUuid });
      share(promptUuid);
    }
  }, [share, promptUuid, logAction]);

  const handleCopyEvent = useCallback(
    (e: React.ClipboardEvent): void => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim() ?? '';

      if (selectedText) {
        return;
      }

      e.clipboardData.setData('text/plain', displayedPrompt);
      e.preventDefault();
    },
    [displayedPrompt]
  );

  const handleModelFormatChange = useCallback(
    (nextValue: string): void => {
      if (isOptimizing) {
        return;
      }

      const nextModel = nextValue === 'auto' ? '' : nextValue.trim();
      const previousModel = modelFormatValue === 'auto' ? '' : modelFormatValue.trim();
      if (nextModel === previousModel) {
        return;
      }

      setModelFormatValue(nextValue === 'auto' ? 'auto' : nextModel);

      const genericPrompt =
        typeof genericOptimizedPrompt === 'string' && genericOptimizedPrompt.trim()
          ? genericOptimizedPrompt
          : null;
      const hasGenericPrompt = Boolean(genericPrompt && genericPrompt.trim());

      logAction('compileForModel', {
        targetModel: nextModel || 'generic-auto',
        source: nextValue === 'auto' ? 'auto' : 'manual',
        genericPromptAvailable: hasGenericPrompt,
      });

      if (!nextModel) {
        if (!hasGenericPrompt) {
          void onReoptimize(inputPrompt, { forceGenericTarget: true });
          return;
        }

        void onReoptimize(inputPrompt, {
          compileOnly: true,
          ...(genericPrompt ? { compilePrompt: genericPrompt } : {}),
          createVersion: true,
        });
        return;
      }

      if (hasGenericPrompt && genericPrompt) {
        void onReoptimize(inputPrompt, {
          compileOnly: true,
          compilePrompt: genericPrompt,
          createVersion: true,
          targetModel: nextModel,
        });
        return;
      }

      void onReoptimize(inputPrompt, {
        createVersion: true,
        targetModel: nextModel,
      });
    },
    [
      genericOptimizedPrompt,
      inputPrompt,
      isOptimizing,
      logAction,
      modelFormatValue,
      onReoptimize,
    ]
  );

  return {
    editorRef,
    editorWrapperRef,
    editorColumnRef,
    outputLocklineRef,
    lockButtonRef,
    exportMenuRef,
    generationsSheetOpen,
    setGenerationsSheetOpen,
    showDiff,
    setShowDiff,
    copied,
    handleCopy,
    handleCopyEvent,
    handleShare,
    showExportMenu,
    setShowExportMenu,
    modelFormatOptions,
    modelFormatValue,
    modelFormatLabel,
    handleModelFormatChange,
  };
}
