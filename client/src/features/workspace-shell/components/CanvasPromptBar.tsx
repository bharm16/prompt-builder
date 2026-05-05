import React from "react";
import type { SidebarUploadedImage } from "@features/generation-controls";
import type { AssetSuggestion } from "@/features/assets/hooks/useTriggerAutocomplete";
import type {
  InlineSuggestion,
  SuggestionItem,
} from "@/features/prompt-optimizer/PromptCanvas/types";
import { cn } from "@/utils/cn";
import { CanvasSettingsRow } from "./CanvasSettingsRow";
import { PromptEditorSurface } from "./PromptEditorSurface";

interface CanvasPromptBarProps {
  layoutMode?: "empty" | "active";
  editorRef: React.RefObject<HTMLDivElement>;
  prompt: string;
  onTextSelection: (event: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseEnter: (event: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseLeave: (event: React.MouseEvent<HTMLDivElement>) => void;
  onCopyEvent: (event: React.ClipboardEvent<HTMLDivElement>) => void;
  onInput: (event: React.FormEvent<HTMLDivElement>) => void;
  onEditorKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onEditorBlur: (event: React.FocusEvent<HTMLDivElement>) => void;
  autocompleteOpen: boolean;
  autocompleteSuggestions: AssetSuggestion[];
  autocompleteSelectedIndex: number;
  autocompletePosition: { top: number; left: number };
  autocompleteLoading: boolean;
  onAutocompleteSelect: (asset: AssetSuggestion) => void;
  onAutocompleteClose: () => void;
  onAutocompleteIndexChange: (index: number) => void;
  selectedSpanId: string | null;
  suggestionCount: number;
  suggestionsListRef: React.RefObject<HTMLDivElement>;
  inlineSuggestions: InlineSuggestion[];
  activeSuggestionIndex: number;
  onActiveSuggestionChange: (index: number) => void;
  interactionSourceRef: React.MutableRefObject<"keyboard" | "mouse" | "auto">;
  onSuggestionClick: (suggestion: SuggestionItem | string) => void;
  onCloseInlinePopover: () => void;
  selectionLabel: string;
  onApplyActiveSuggestion: () => void;
  isInlineLoading: boolean;
  isInlineError: boolean;
  inlineErrorMessage: string;
  isInlineEmpty: boolean;
  customRequest: string;
  onCustomRequestChange: (value: string) => void;
  customRequestError: string;
  onCustomRequestErrorChange: (value: string) => void;
  onCustomRequestSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isCustomRequestDisabled: boolean;
  isCustomLoading: boolean;
  responseMetadata?: Record<string, unknown> | null;
  onCopyAllDebug?: (() => void) | undefined;
  isBulkCopyLoading?: boolean | undefined;
  showI2VLockIndicator: boolean;
  resolvedI2VReason: string | null;
  i2vMotionAlternatives: SuggestionItem[];
  onLockedAlternativeClick: (suggestion: SuggestionItem) => void;
  /* Settings row props */
  renderModelId: string;
  recommendedModelId?: string;
  recommendationPromptId?: string;
  recommendationMode?: "t2v" | "i2v";
  recommendationAgeMs?: number | null;
  onOpenMotion: () => void;
  onStartFrameUpload?: (file: File) => void | Promise<void>;
  onUploadSidebarImage?:
    | ((file: File) => Promise<SidebarUploadedImage | null>)
    | undefined;
  onEnhance?: () => void;
  isEnhancing?: boolean;
}

export function CanvasPromptBar({
  layoutMode = "active",
  editorRef,
  prompt,
  onTextSelection,
  onHighlightClick,
  onHighlightMouseDown,
  onHighlightMouseEnter,
  onHighlightMouseLeave,
  onCopyEvent,
  onInput,
  onEditorKeyDown,
  onEditorBlur,
  autocompleteOpen,
  autocompleteSuggestions,
  autocompleteSelectedIndex,
  autocompletePosition,
  autocompleteLoading,
  onAutocompleteSelect,
  onAutocompleteClose,
  onAutocompleteIndexChange,
  selectedSpanId,
  suggestionCount,
  suggestionsListRef,
  inlineSuggestions,
  activeSuggestionIndex,
  onActiveSuggestionChange,
  interactionSourceRef,
  onSuggestionClick,
  onCloseInlinePopover,
  selectionLabel,
  onApplyActiveSuggestion,
  isInlineLoading,
  isInlineError,
  inlineErrorMessage,
  isInlineEmpty,
  customRequest,
  onCustomRequestChange,
  customRequestError,
  onCustomRequestErrorChange,
  onCustomRequestSubmit,
  isCustomRequestDisabled,
  isCustomLoading,
  responseMetadata = null,
  onCopyAllDebug,
  isBulkCopyLoading = false,
  showI2VLockIndicator,
  resolvedI2VReason,
  i2vMotionAlternatives,
  onLockedAlternativeClick,
  renderModelId,
  recommendedModelId,
  recommendationPromptId,
  recommendationMode,
  recommendationAgeMs,
  onOpenMotion,
  onStartFrameUpload,
  onUploadSidebarImage,
  onEnhance,
  isEnhancing = false,
}: CanvasPromptBarProps): React.ReactElement {
  const isEmptyLayout = layoutMode === "empty";

  return (
    <div
      className={cn(
        "relative transition-[width,max-width,padding,transform] duration-[240ms] [transition-timing-function:var(--motion-ease-emphasized)]",
        isEmptyLayout
          ? "w-full max-w-[640px]"
          : "mx-auto w-full max-w-[780px] flex-shrink-0 pb-4",
      )}
    >
      <div
        className={cn(
          "motion-safe-transition transition-[transform]",
          isEmptyLayout ? "px-5 pb-3 pt-5" : "px-4 py-3",
        )}
        onClick={() => {
          editorRef.current?.focus();
        }}
      >
        <PromptEditorSurface
          editorRef={editorRef}
          prompt={prompt}
          variant={isEmptyLayout ? "empty" : "active"}
          onTextSelection={onTextSelection}
          onHighlightClick={onHighlightClick}
          onHighlightMouseDown={onHighlightMouseDown}
          onHighlightMouseEnter={onHighlightMouseEnter}
          onHighlightMouseLeave={onHighlightMouseLeave}
          onCopyEvent={onCopyEvent}
          onInput={onInput}
          onEditorKeyDown={onEditorKeyDown}
          onEditorBlur={onEditorBlur}
          autocompleteOpen={autocompleteOpen}
          autocompleteSuggestions={autocompleteSuggestions}
          autocompleteSelectedIndex={autocompleteSelectedIndex}
          autocompletePosition={autocompletePosition}
          autocompleteLoading={autocompleteLoading}
          onAutocompleteSelect={onAutocompleteSelect}
          onAutocompleteClose={onAutocompleteClose}
          onAutocompleteIndexChange={onAutocompleteIndexChange}
          selectedSpanId={selectedSpanId}
          suggestionCount={suggestionCount}
          suggestionsListRef={suggestionsListRef}
          inlineSuggestions={inlineSuggestions}
          activeSuggestionIndex={activeSuggestionIndex}
          onActiveSuggestionChange={onActiveSuggestionChange}
          interactionSourceRef={interactionSourceRef}
          onSuggestionClick={onSuggestionClick}
          onCloseInlinePopover={onCloseInlinePopover}
          selectionLabel={selectionLabel}
          onApplyActiveSuggestion={onApplyActiveSuggestion}
          isInlineLoading={isInlineLoading}
          isInlineError={isInlineError}
          inlineErrorMessage={inlineErrorMessage}
          isInlineEmpty={isInlineEmpty}
          customRequest={customRequest}
          onCustomRequestChange={onCustomRequestChange}
          customRequestError={customRequestError}
          onCustomRequestErrorChange={onCustomRequestErrorChange}
          onCustomRequestSubmit={onCustomRequestSubmit}
          isCustomRequestDisabled={isCustomRequestDisabled}
          isCustomLoading={isCustomLoading}
          responseMetadata={responseMetadata}
          onCopyAllDebug={onCopyAllDebug}
          isBulkCopyLoading={isBulkCopyLoading}
          showI2VLockIndicator={showI2VLockIndicator}
          resolvedI2VReason={resolvedI2VReason}
          i2vMotionAlternatives={i2vMotionAlternatives}
          onLockedAlternativeClick={onLockedAlternativeClick}
        />
        <CanvasSettingsRow
          prompt={prompt}
          renderModelId={renderModelId}
          {...(recommendedModelId ? { recommendedModelId } : {})}
          {...(recommendationPromptId ? { recommendationPromptId } : {})}
          {...(recommendationMode ? { recommendationMode } : {})}
          {...(typeof recommendationAgeMs === "number"
            ? { recommendationAgeMs }
            : {})}
          onOpenMotion={onOpenMotion}
          {...(onStartFrameUpload ? { onStartFrameUpload } : {})}
          {...(onUploadSidebarImage ? { onUploadSidebarImage } : {})}
          {...(onEnhance ? { onEnhance } : {})}
          isEnhancing={isEnhancing}
        />
      </div>
    </div>
  );
}
