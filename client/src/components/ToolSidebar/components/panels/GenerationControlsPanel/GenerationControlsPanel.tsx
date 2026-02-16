import React, { type ReactElement, useCallback, useEffect } from "react";
import { CameraMotionModal } from "@/components/modals/CameraMotionModal";
import { FaceSwapPreviewModal } from "@/components/modals/FaceSwapPreviewModal";
import { InsufficientCreditsModal } from "@/components/modals/InsufficientCreditsModal";
import { trackModelRecommendationEvent } from "@/features/model-intelligence/api";
import {
  STORYBOARD_COST,
  VIDEO_DRAFT_MODEL,
  VIDEO_RENDER_MODELS,
} from "@components/ToolSidebar/config/modelConfig";
import { GenerationFooter } from "./components/GenerationFooter";
import { PanelHeader } from "./components/PanelHeader";
import { VideoSettingsRow } from "./components/VideoSettingsRow";
import { ImageTabContent } from "./components/ImageTabContent";
import { VideoTabContent } from "./components/VideoTabContent";
import { useGenerationControlsPanel } from "./hooks/useGenerationControlsPanel";
import type { GenerationControlsPanelInputProps, GenerationControlsPanelProps } from "./types";
import type { DraftModel, GenerationOverrides } from "@components/ToolSidebar/types";
import {
  useSidebarAssetsDomain,
  useSidebarGenerationDomain,
  useSidebarPromptInteractionDomain,
} from "@/components/ToolSidebar/context";
import { useLowBalanceWarning } from "@/features/billing/hooks/useLowBalanceWarning";
import { useCreditGate } from "@/hooks/useCreditGate";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useGenerationControlsContext } from "@/features/prompt-optimizer/context/GenerationControlsContext";

const noopDraft = (_model: DraftModel, _overrides?: GenerationOverrides): void => {};
const noopRender = (_model: string, _overrides?: GenerationOverrides): void => {};
const noopStoryboard = (): void => {};

export function GenerationControlsPanel(
  props: GenerationControlsPanelInputProps,
): ReactElement {
  const promptInteractionDomain = useSidebarPromptInteractionDomain();
  const generationDomain = useSidebarGenerationDomain();
  const assetsDomain = useSidebarAssetsDomain();
  const { setOnInsufficientCredits } = useGenerationControlsContext();
  const {
    checkCredits,
    openInsufficientCredits,
    insufficientCreditsModal,
    dismissModal,
    balance,
  } = useCreditGate();
  const authUser = useAuthUser();
  const {
    onDraft: onDraftFromProps,
    onRender: onRenderFromProps,
    onStoryboard: onStoryboardFromProps,
    onBack,
    isProcessing: isProcessingFromProps,
    isRefining: isRefiningFromProps,
    assets: assetsFromProps,
    onImageUpload: onImageUploadFromProps,
    onStartFrameUpload: onStartFrameUploadFromProps,
  } = props;
  const onDraft = onDraftFromProps ?? generationDomain?.onDraft ?? noopDraft;
  const onRender = onRenderFromProps ?? generationDomain?.onRender ?? noopRender;
  const onStoryboard = onStoryboardFromProps ?? generationDomain?.onStoryboard ?? noopStoryboard;
  const isProcessing = isProcessingFromProps ?? promptInteractionDomain?.isProcessing;
  const isRefining = isRefiningFromProps ?? promptInteractionDomain?.isRefining;
  const assets = assetsFromProps ?? assetsDomain?.assets ?? [];
  const onImageUpload = onImageUploadFromProps ?? generationDomain?.onImageUpload;
  const onStartFrameUpload =
    onStartFrameUploadFromProps ?? generationDomain?.onStartFrameUpload;

  const mergedProps: GenerationControlsPanelProps = {
    onDraft,
    onRender,
    onStoryboard,
    ...(typeof isProcessing === "boolean" ? { isProcessing } : {}),
    ...(typeof isRefining === "boolean" ? { isRefining } : {}),
    assets,
    ...(onBack ? { onBack } : {}),
    ...(onImageUpload ? { onImageUpload } : {}),
    ...(onStartFrameUpload ? { onStartFrameUpload } : {}),
  };

  const {
    refs,
    state,
    store,
    faceSwap,
    derived,
    recommendation,
    capabilities,
    actions,
  } = useGenerationControlsPanel(mergedProps);
  const {
    aspectRatio,
    duration,
    selectedModel,
    tier,
    keyframes,
    startFrame,
    cameraMotion,
  } = store;
  const showMotionControls = true;
  const isFaceSwapMode = faceSwap.mode === "face-swap";
  const isFaceSwapFlow = isFaceSwapMode && state.activeTab === "video";
  const fallbackRenderModelId = VIDEO_RENDER_MODELS[0]?.id ?? selectedModel ?? "";
  const selectedModelIdForGeneration =
    tier === "draft"
      ? VIDEO_DRAFT_MODEL.id
      : recommendation.renderModelId || selectedModel || fallbackRenderModelId;
  const selectedRenderModel =
    VIDEO_RENDER_MODELS.find((model) => model.id === selectedModelIdForGeneration) ??
    VIDEO_RENDER_MODELS[0];
  const selectedOperationCost =
    tier === "draft" ? VIDEO_DRAFT_MODEL.cost : selectedRenderModel?.cost ?? 0;
  const selectedOperationLabel =
    tier === "draft"
      ? `${VIDEO_DRAFT_MODEL.label} preview`
      : `${selectedRenderModel?.label ?? "Video"} render`;

  useLowBalanceWarning({
    userId: authUser?.uid ?? null,
    balance,
    requiredCredits: selectedOperationCost,
    operation: selectedOperationLabel,
    enabled: state.activeTab === "video",
  });

  useEffect(() => {
    setOnInsufficientCredits(() => openInsufficientCredits);
    return () => setOnInsufficientCredits(null);
  }, [openInsufficientCredits, setOnInsufficientCredits]);

  const handleGenerate = useCallback(
    (overrides?: GenerationOverrides) => {
      if (!checkCredits(selectedOperationCost, selectedOperationLabel)) {
        return;
      }

      void trackModelRecommendationEvent({
        event: "generation_started",
        recommendationId: recommendation.modelRecommendation?.promptId,
        promptId: recommendation.modelRecommendation?.promptId,
        recommendedModelId: recommendation.recommendedModelId,
        selectedModelId: selectedModelIdForGeneration,
        mode: recommendation.recommendationMode,
        durationSeconds: duration,
        ...(typeof recommendation.recommendationAgeMs === "number"
          ? {
              timeSinceRecommendationMs: Math.max(
                0,
                Math.round(recommendation.recommendationAgeMs),
              ),
            }
          : {}),
      });
      if (tier === "draft") {
        onDraft(VIDEO_DRAFT_MODEL.id, overrides);
        return;
      }
      onRender(selectedModelIdForGeneration, overrides);
    },
    [
      duration,
      onDraft,
      onRender,
      recommendation.modelRecommendation?.promptId,
      recommendation.recommendationAgeMs,
      recommendation.recommendationMode,
      recommendation.recommendedModelId,
      recommendation.renderModelId,
      selectedOperationCost,
      selectedOperationLabel,
      selectedModelIdForGeneration,
      checkCredits,
      tier,
    ],
  );

  const handleModelChange = useCallback(
    (modelId: string) => {
      if (modelId === selectedModel) return;

      void trackModelRecommendationEvent({
        event: "model_selected",
        recommendationId: recommendation.modelRecommendation?.promptId,
        promptId: recommendation.modelRecommendation?.promptId,
        recommendedModelId: recommendation.recommendedModelId,
        selectedModelId: modelId,
        mode: recommendation.recommendationMode,
        durationSeconds: duration,
        ...(typeof recommendation.recommendationAgeMs === "number"
          ? {
              timeSinceRecommendationMs: Math.max(
                0,
                Math.round(recommendation.recommendationAgeMs),
              ),
            }
          : {}),
      });

      actions.handleModelChange(modelId);
    },
    [
      actions,
      duration,
      recommendation.modelRecommendation?.promptId,
      recommendation.recommendationAgeMs,
      recommendation.recommendationMode,
      recommendation.recommendedModelId,
      selectedModel,
    ],
  );

  const generationFooter = (
    <GenerationFooter
      renderModelOptions={recommendation.renderModelOptions}
      renderModelId={recommendation.renderModelId}
      onModelChange={handleModelChange}
      modelRecommendation={recommendation.modelRecommendation}
      recommendedModelId={recommendation.recommendedModelId}
      efficientModelId={recommendation.efficientModelId}
      onGenerate={() => {
        if (!isFaceSwapFlow) {
          handleGenerate();
          return;
        }
        if (!faceSwap.previewUrl) {
          void actions.handleFaceSwapPreview();
          return;
        }
        actions.handleOpenFaceSwapModal();
      }}
      isGenerateDisabled={
        isFaceSwapFlow
          ? derived.isGenerateDisabled || derived.isFaceSwapPreviewDisabled
          : derived.isGenerateDisabled
      }
      generateLabel={
        isFaceSwapFlow
          ? faceSwap.previewUrl
            ? "Proceed to Video"
            : "Preview Face Swap"
          : "Generate"
      }
      creditBalance={balance}
    />
  );

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        activeTab={state.activeTab}
        onBack={onBack}
        onSelectTab={actions.setActiveTab}
      />

      <input
        ref={refs.fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void actions.handleFile(file);
          }
          event.target.value = "";
        }}
        disabled={derived.isUploadDisabled}
      />

      <input
        ref={refs.startFrameFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void actions.handleStartFrameFile(file);
          }
          event.target.value = "";
        }}
        disabled={derived.isStartFrameUploadDisabled}
      />

      {state.activeTab === "video" ? (
        <VideoTabContent
          startFrame={startFrame}
          isUploadDisabled={derived.isStartFrameUploadDisabled}
          onRequestUpload={actions.handleStartFrameUploadRequest}
          onUploadFile={actions.handleStartFrameFile}
          onClearStartFrame={actions.handleClearStartFrame}
          faceSwapMode={faceSwap.mode}
          faceSwapCharacterOptions={faceSwap.characterOptions}
          selectedCharacterId={faceSwap.selectedCharacterId}
          onFaceSwapCharacterChange={actions.setFaceSwapCharacterId}
          onFaceSwapPreview={() => {
            if (faceSwap.isPreviewReady) {
              actions.handleOpenFaceSwapModal();
              return;
            }
            void actions.handleFaceSwapPreview();
          }}
          isFaceSwapPreviewDisabled={derived.isFaceSwapPreviewDisabled}
          faceSwapPreviewReady={faceSwap.isPreviewReady}
          faceSwapPreviewLoading={faceSwap.isLoading}
          faceSwapError={faceSwap.error}
          faceSwapCredits={faceSwap.faceSwapCredits}
          videoCredits={faceSwap.videoCredits}
          totalCredits={faceSwap.totalCredits}
          canCopy={derived.hasPrompt}
          canClear={derived.hasPrompt}
          onCopy={() => void actions.handleCopy()}
          onClear={actions.handleClearPrompt}
          promptLength={derived.promptLength}
          canGeneratePreviews={!derived.isStoryboardDisabled}
          onGenerateSinglePreview={() => {
            if (!checkCredits(STORYBOARD_COST, "Storyboard")) return;
            onStoryboard();
          }}
          onGenerateFourPreviews={() => {
            if (!checkCredits(STORYBOARD_COST, "Storyboard")) return;
            onStoryboard();
          }}
        />
      ) : (
        <ImageTabContent
          keyframes={keyframes}
          isUploadDisabled={derived.isUploadDisabled}
          onRequestUpload={actions.handleUploadRequest}
          onRemoveKeyframe={actions.handleRemoveKeyframe}
          imageSubTab={state.imageSubTab}
          onImageSubTabChange={actions.setImageSubTab}
          onBack={onBack}
          footer={generationFooter}
        />
      )}

      {state.activeTab === "video" && (
        <>
          <VideoSettingsRow
            aspectRatio={aspectRatio}
            duration={duration}
            aspectRatioOptions={capabilities.aspectRatioOptions}
            durationOptions={capabilities.durationOptions}
            onAspectRatioChange={actions.handleAspectRatioChange}
            onDurationChange={actions.handleDurationChange}
            isAspectRatioDisabled={capabilities.aspectRatioInfo?.state.disabled}
            isDurationDisabled={capabilities.durationInfo?.state.disabled}
            onOpenMotion={actions.handleCameraMotionButtonClick}
            isMotionDisabled={
              !showMotionControls || !derived.hasStartFrame
            }
          />

          {generationFooter}
        </>
      )}

      {showMotionControls && startFrame && (
        <CameraMotionModal
          isOpen={state.showCameraMotionModal}
          onClose={actions.handleCloseCameraMotionModal}
          imageUrl={startFrame.url}
          imageStoragePath={startFrame.storagePath ?? null}
          imageAssetId={startFrame.assetId ?? null}
          onSelect={actions.handleSelectCameraMotion}
          initialSelection={cameraMotion}
        />
      )}

      <FaceSwapPreviewModal
        isOpen={faceSwap.isModalOpen}
        isLoading={faceSwap.isLoading}
        imageUrl={faceSwap.previewUrl}
        error={faceSwap.error}
        faceSwapCredits={faceSwap.faceSwapCredits}
        videoCredits={faceSwap.videoCredits}
        totalCredits={faceSwap.totalCredits}
        onClose={actions.handleCloseFaceSwapModal}
        onTryDifferent={actions.handleFaceSwapTryDifferent}
        onProceed={() => {
          if (!faceSwap.previewUrl) return;
          actions.handleCloseFaceSwapModal();
          handleGenerate({
            startImage: {
              url: faceSwap.previewUrl,
              source: "face-swap",
            },
            characterAssetId: faceSwap.selectedCharacterId || null,
            faceSwapAlreadyApplied: true,
            faceSwapUrl: faceSwap.previewUrl,
          });
        }}
      />
      <InsufficientCreditsModal
        open={insufficientCreditsModal !== null}
        onClose={dismissModal}
        required={insufficientCreditsModal?.required ?? 0}
        available={insufficientCreditsModal?.available ?? 0}
        operation={insufficientCreditsModal?.operation ?? ""}
      />
    </div>
  );
}
