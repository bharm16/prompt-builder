import React, { type ReactElement } from 'react';
import { CameraMotionModal } from '@/components/modals/CameraMotionModal';
import { trackModelRecommendationEvent } from '@/features/model-intelligence/api';
import { VIDEO_DRAFT_MODEL, VIDEO_RENDER_MODELS } from '@components/ToolSidebar/config/modelConfig';
import { GenerationFooter } from './components/GenerationFooter';
import { PanelHeader } from './components/PanelHeader';
import { VideoPromptToolbar } from './components/VideoPromptToolbar';
import { VideoSettingsRow } from './components/VideoSettingsRow';
import { VideoFooterSection } from './components/VideoFooterSection';
import { ImageTabContent } from './components/ImageTabContent';
import { VideoTabContent } from './components/VideoTabContent';
import { useGenerationControlsPanel } from './hooks/useGenerationControlsPanel';
import type { GenerationControlsPanelProps } from './types';

export function GenerationControlsPanel(props: GenerationControlsPanelProps): ReactElement {
  const {
    prompt,
    onPromptChange,
    onOptimize,
    showResults = false,
    onDraft,
    onRender,
    onBack,
    onStoryboard,
    onCreateFromTrigger,
  } = props;

  const {
    refs,
    state,
    store,
    derived,
    recommendation,
    capabilities,
    autocomplete,
    actions,
  } = useGenerationControlsPanel(props);
  const {
    aspectRatio,
    duration,
    selectedModel,
    tier,
    keyframes,
    cameraMotion,
  } = store;
  const showMotionControls = true;

  const renderOptimizationActions = (): ReactElement | null => {
    if (!derived.canOptimize) return null;
    if (!showResults) {
      return (
        <button
          type="button"
          className="h-8 px-3 rounded-lg bg-white text-[#1A1A1A] text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => {
            if (!onOptimize) return;
            if (!derived.isOptimizeDisabled) {
              void onOptimize(prompt);
            }
          }}
          disabled={derived.isOptimizeDisabled}
        >
          Optimize
        </button>
      );
    }

    if (!state.isEditing) {
      return (
        <button
          type="button"
          className="h-8 px-3 rounded-lg border border-[#29292D] text-[#A1AFC5] text-sm font-semibold hover:bg-[#1B1E23] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={actions.handleEditClick}
          disabled={derived.isOptimizing}
        >
          Edit
        </button>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="h-8 px-3 rounded-lg border border-[#29292D] text-[#A1AFC5] text-sm font-semibold hover:bg-[#1B1E23] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={actions.handleCancelEdit}
          disabled={derived.isOptimizing}
        >
          Cancel
        </button>
        <button
          type="button"
          className="h-8 px-3 rounded-lg bg-white text-[#1A1A1A] text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={actions.handleUpdate}
          disabled={derived.isOptimizeDisabled}
        >
          Update
        </button>
      </div>
    );
  };

  const generationFooter = (
    <GenerationFooter
      tier={tier}
      renderModelOptions={recommendation.renderModelOptions}
      renderModelId={recommendation.renderModelId}
      recommendedModelId={recommendation.recommendedModelId}
      efficientModelId={recommendation.efficientModelId}
      onModelChange={actions.handleModelChange}
      optimizationActions={renderOptimizationActions()}
      onStoryboard={onStoryboard}
      isStoryboardDisabled={derived.isStoryboardDisabled}
      onGenerate={() => {
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
          onDraft(VIDEO_DRAFT_MODEL.id);
          return;
        }
        onRender(recommendation.renderModelId || selectedModel || fallbackRenderModelId);
      }}
      isGenerateDisabled={derived.isGenerateDisabled}
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
          tier={tier}
          onTierChange={actions.handleTierChange}
          keyframes={keyframes}
          isUploadDisabled={derived.isUploadDisabled}
          onRequestUpload={actions.handleUploadRequest}
          onUploadFile={actions.handleFile}
          onRemoveKeyframe={actions.handleRemoveKeyframe}
          showMotionControls={showMotionControls}
          hasPrimaryKeyframe={derived.hasPrimaryKeyframe}
          cameraMotion={cameraMotion}
          onOpenCameraMotion={actions.handleCameraMotionButtonClick}
          prompt={prompt}
          onPromptChange={onPromptChange}
          isInputLocked={derived.isInputLocked}
          isOptimizing={derived.isOptimizing}
          promptInputRef={refs.resolvedPromptInputRef}
          onPromptInputChange={actions.handleInputPromptChange}
          onPromptKeyDown={actions.handlePromptKeyDown}
          onCreateFromTrigger={onCreateFromTrigger}
          autocomplete={autocomplete}
          imageSubTab={state.imageSubTab}
          onImageSubTabChange={actions.setImageSubTab}
        />
      ) : (
        <ImageTabContent
          keyframes={keyframes}
          isUploadDisabled={derived.isUploadDisabled}
          onRequestUpload={actions.handleUploadRequest}
          onRemoveKeyframe={actions.handleRemoveKeyframe}
          prompt={prompt}
          onPromptChange={onPromptChange}
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
          <VideoPromptToolbar
            canCopy={Boolean(prompt.trim())}
            canClear={Boolean(onPromptChange && prompt.trim())}
            onCopy={() => void actions.handleCopy()}
            onClear={() => onPromptChange?.('')}
          />

          <VideoSettingsRow
            aspectRatio={aspectRatio}
            duration={duration}
            aspectRatioOptions={capabilities.aspectRatioOptions}
            durationOptions={capabilities.durationOptions}
            onAspectRatioChange={actions.handleAspectRatioChange}
            onDurationChange={actions.handleDurationChange}
            isAspectRatioDisabled={capabilities.aspectRatioInfo?.state.disabled}
            isDurationDisabled={capabilities.durationInfo?.state.disabled}
          />

          <VideoFooterSection
            prompt={prompt}
            duration={duration}
            recommendationMode={recommendation.recommendationMode}
            recommendation={recommendation.modelRecommendation}
            isLoading={recommendation.isRecommendationLoading}
            error={recommendation.recommendationError}
            onSelectModel={actions.handleModelChange}
            footer={generationFooter}
          />
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
    </div>
  );
}
