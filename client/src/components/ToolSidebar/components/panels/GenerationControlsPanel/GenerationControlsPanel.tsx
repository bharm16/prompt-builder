import React, { type ReactElement, useCallback } from 'react';
import { CameraMotionModal } from '@/components/modals/CameraMotionModal';
import { FaceSwapPreviewModal } from '@/components/modals/FaceSwapPreviewModal';
import { trackModelRecommendationEvent } from '@/features/model-intelligence/api';
import { VIDEO_DRAFT_MODEL, VIDEO_RENDER_MODELS } from '@components/ToolSidebar/config/modelConfig';
import { GenerationFooter } from './components/GenerationFooter';
import { PanelHeader } from './components/PanelHeader';
import { VideoSettingsRow } from './components/VideoSettingsRow';
import { ImageTabContent } from './components/ImageTabContent';
import { VideoTabContent } from './components/VideoTabContent';
import { useGenerationControlsPanel } from './hooks/useGenerationControlsPanel';
import type { GenerationControlsPanelProps } from './types';
import type { GenerationOverrides } from '@components/ToolSidebar/types';
import { StyleReferenceControls } from '@/features/prompt-optimizer/components/StyleReferenceControls';
import { useWorkspaceSession } from '@/features/prompt-optimizer/context/WorkspaceSessionContext';

export function GenerationControlsPanel(props: GenerationControlsPanelProps): ReactElement {
  const {
    prompt,
    onPromptChange,
    onDraft,
    onRender,
    onBack,
    onCreateFromTrigger,
  } = props;

  const {
    refs,
    state,
    store,
    faceSwap,
    derived,
    recommendation,
    capabilities,
    autocomplete,
    actions,
  } = useGenerationControlsPanel(props);
  const {
    isSequenceMode,
    shots,
    currentShot,
    currentShotIndex,
    updateShotStyleReference,
    updateShot,
  } = useWorkspaceSession();
  const {
    aspectRatio,
    duration,
    selectedModel,
    tier,
    keyframes,
    cameraMotion,
  } = store;
  const showMotionControls = true;
  const isFaceSwapMode = faceSwap.mode === 'face-swap';
  const isFaceSwapFlow = isFaceSwapMode && state.activeTab === 'video';
  const promptLabel =
    isSequenceMode && currentShotIndex >= 0 ? `Shot ${currentShotIndex + 1} Prompt` : 'Prompt';

  const handleStyleReferenceChange = useCallback(
    (sourceShotId: string) => {
      if (!currentShot) return;
      void updateShotStyleReference(currentShot.id, sourceShotId);
    },
    [currentShot, updateShotStyleReference]
  );

  const handleStrengthChange = useCallback(
    (strength: number) => {
      if (!currentShot) return;
      void updateShot(currentShot.id, { styleStrength: strength });
    },
    [currentShot, updateShot]
  );

  const handleModeChange = useCallback(
    (mode: 'frame-bridge' | 'style-match') => {
      if (!currentShot) return;
      void updateShot(currentShot.id, { continuityMode: mode });
    },
    [currentShot, updateShot]
  );

  const styleReferenceControls =
    isSequenceMode && currentShot ? (
      <StyleReferenceControls
        shots={shots}
        currentShot={currentShot}
        onStyleReferenceChange={handleStyleReferenceChange}
        onStrengthChange={handleStrengthChange}
        onModeChange={handleModeChange}
      />
    ) : null;

  const handleGenerate = useCallback(
    (overrides?: GenerationOverrides) => {
      const fallbackRenderModelId = VIDEO_RENDER_MODELS[0]?.id ?? selectedModel ?? '';
      void trackModelRecommendationEvent({
        event: 'generation_started',
        recommendationId: recommendation.modelRecommendation?.promptId,
        promptId: recommendation.modelRecommendation?.promptId,
        recommendedModelId: recommendation.modelRecommendation?.recommended?.modelId,
        selectedModelId: tier === 'draft' ? VIDEO_DRAFT_MODEL.id : recommendation.renderModelId,
        mode: recommendation.recommendationMode,
        durationSeconds: duration,
        ...(typeof recommendation.recommendationAgeMs === 'number'
          ? { timeSinceRecommendationMs: Math.max(0, Math.round(recommendation.recommendationAgeMs)) }
          : {}),
      });
      if (tier === 'draft') {
        onDraft(VIDEO_DRAFT_MODEL.id, overrides);
        return;
      }
      onRender(recommendation.renderModelId || selectedModel || fallbackRenderModelId, overrides);
    },
    [
      duration,
      onDraft,
      onRender,
      recommendation.modelRecommendation?.promptId,
      recommendation.modelRecommendation?.recommended?.modelId,
      recommendation.recommendationAgeMs,
      recommendation.recommendationMode,
      recommendation.renderModelId,
      selectedModel,
      tier,
    ]
  );

  const generationFooter = (
    <GenerationFooter
      renderModelOptions={recommendation.renderModelOptions}
      renderModelId={recommendation.renderModelId}
      onModelChange={actions.handleModelChange}
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
            ? 'Proceed to Video'
            : 'Preview Face Swap'
          : 'Generate'
      }
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
          event.target.value = '';
        }}
        disabled={derived.isUploadDisabled}
      />

      {state.activeTab === 'video' ? (
        <VideoTabContent
          keyframes={keyframes}
          isUploadDisabled={derived.isUploadDisabled}
          onRequestUpload={actions.handleUploadRequest}
          onUploadFile={actions.handleFile}
          onRemoveKeyframe={actions.handleRemoveKeyframe}
          prompt={prompt}
          onPromptChange={onPromptChange}
          promptLabel={promptLabel}
          isInputLocked={derived.isInputLocked}
          isOptimizing={derived.isOptimizing}
          promptInputRef={refs.resolvedPromptInputRef}
          onPromptInputChange={actions.handleInputPromptChange}
          onPromptKeyDown={actions.handlePromptKeyDown}
          onCreateFromTrigger={onCreateFromTrigger}
          autocomplete={autocomplete}
          afterPrompt={styleReferenceControls}
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
          canCopy={Boolean(prompt.trim())}
          canClear={Boolean(onPromptChange && prompt.trim())}
          onCopy={() => void actions.handleCopy()}
          onClear={() => onPromptChange?.('')}
        />
      ) : (
        <ImageTabContent
          keyframes={keyframes}
          isUploadDisabled={derived.isUploadDisabled}
          onRequestUpload={actions.handleUploadRequest}
          onRemoveKeyframe={actions.handleRemoveKeyframe}
          prompt={prompt}
          onPromptChange={onPromptChange}
          promptLabel={promptLabel}
          isInputLocked={derived.isInputLocked}
          isOptimizing={derived.isOptimizing}
          promptInputRef={refs.resolvedPromptInputRef}
          onPromptInputChange={actions.handleInputPromptChange}
          onPromptKeyDown={actions.handlePromptKeyDown}
          onCreateFromTrigger={onCreateFromTrigger}
          autocomplete={autocomplete}
          imageSubTab={state.imageSubTab}
          onImageSubTabChange={actions.setImageSubTab}
          onBack={onBack}
          onCopy={() => void actions.handleCopy()}
          onClear={() => onPromptChange?.('')}
          canCopy={Boolean(prompt.trim())}
          canClear={Boolean(onPromptChange && prompt.trim())}
          footer={generationFooter}
        />
      )}

      {state.activeTab === 'video' && (
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
            isMotionDisabled={!showMotionControls || !derived.hasPrimaryKeyframe}
          />

          {generationFooter}
        </>
      )}

      {showMotionControls && keyframes[0] && (
        <CameraMotionModal
          isOpen={state.showCameraMotionModal}
          onClose={actions.handleCloseCameraMotionModal}
          imageUrl={keyframes[0].url}
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
              source: 'face-swap',
            },
            characterAssetId: faceSwap.selectedCharacterId || null,
            faceSwapAlreadyApplied: true,
            faceSwapUrl: faceSwap.previewUrl,
          });
        }}
      />
    </div>
  );
}
