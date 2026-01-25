import { useCallback, useEffect, useState } from 'react';
import type { Asset } from '@shared/types/asset';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import type { GenerationParams } from '../types';

interface AssetReferenceImage {
  assetId: string;
  assetType: string;
  assetName?: string;
  imageUrl: string;
}

interface SelectedKeyframe {
  url: string;
  generationId: string;
  frameIndex: number;
  source: 'generation';
}

interface KeyframeStepState {
  isActive: boolean;
  character: Asset | null;
  pendingModel: string | null;
}

interface UseKeyframeWorkflowOptions {
  prompt: string;
  keyframes: KeyframeTile[];
  assetReferenceImages: AssetReferenceImage[];
  detectedCharacter: Asset | null;
  onCreateVersionIfNeeded: () => string;
  generateRender: (model: string, prompt: string, params: GenerationParams) => void;
}

export function useKeyframeWorkflow({
  prompt,
  keyframes,
  assetReferenceImages,
  detectedCharacter,
  onCreateVersionIfNeeded,
  generateRender,
}: UseKeyframeWorkflowOptions) {
  const [selectedKeyframe, setSelectedKeyframe] = useState<SelectedKeyframe | null>(null);
  const [keyframeStep, setKeyframeStep] = useState<KeyframeStepState>({
    isActive: false,
    character: null,
    pendingModel: null,
  });

  useEffect(() => {
    setKeyframeStep({
      isActive: false,
      character: null,
      pendingModel: null,
    });
  }, [prompt]);

  const runRender = useCallback(
    (model: string, startImageOverride?: GenerationParams['startImage'] | null) => {
      if (!prompt.trim()) return;
      const versionId = onCreateVersionIfNeeded();
      let startImage = null;
      if (startImageOverride) {
        startImage = {
          url: startImageOverride.url,
          source: startImageOverride.source,
          ...(startImageOverride.assetId ? { assetId: startImageOverride.assetId } : {}),
        };
      } else if (selectedKeyframe) {
        startImage = {
          url: selectedKeyframe.url,
          source: selectedKeyframe.source,
        };
      } else if (assetReferenceImages.length > 0) {
        const characterReference = assetReferenceImages.find(
          (reference) => reference.assetType === 'character'
        );
        if (characterReference) {
          startImage = {
            url: characterReference.imageUrl,
            assetId: characterReference.assetId,
            source: 'asset' as const,
          };
        }
      }

      generateRender(model, prompt, {
        promptVersionId: versionId,
        startImage,
      });
      setSelectedKeyframe(null);
      setKeyframeStep({
        isActive: false,
        character: null,
        pendingModel: null,
      });
    },
    [assetReferenceImages, generateRender, onCreateVersionIfNeeded, prompt, selectedKeyframe]
  );

  const handleRender = useCallback(
    (model: string) => {
      if (!prompt.trim()) return;
      const primaryKeyframe = keyframes[0];
      if (primaryKeyframe) {
        runRender(model, {
          url: primaryKeyframe.url,
          source: primaryKeyframe.source,
          ...(primaryKeyframe.assetId ? { assetId: primaryKeyframe.assetId } : {}),
        });
        return;
      }
      if (keyframeStep.isActive) {
        setKeyframeStep((prev) => ({ ...prev, pendingModel: model }));
        return;
      }
      if (detectedCharacter) {
        setKeyframeStep({
          isActive: true,
          character: detectedCharacter,
          pendingModel: model,
        });
        return;
      }

      runRender(model, null);
    },
    [detectedCharacter, keyframeStep.isActive, keyframes, prompt, runRender]
  );

  const handleApproveKeyframe = useCallback(
    (keyframeUrl: string) => {
      const modelToUse = keyframeStep.pendingModel ?? 'sora-2';
      runRender(modelToUse, { url: keyframeUrl, source: 'keyframe' });
    },
    [keyframeStep.pendingModel, runRender]
  );

  const handleSkipKeyframe = useCallback(() => {
    const modelToUse = keyframeStep.pendingModel ?? 'sora-2';
    runRender(modelToUse, null);
  }, [keyframeStep.pendingModel, runRender]);

  const handleSelectFrame = useCallback(
    (url: string, frameIndex: number, generationId: string) => {
      setSelectedKeyframe({ url, generationId, frameIndex, source: 'generation' });
    },
    []
  );

  const handleClearSelectedFrame = useCallback(() => {
    setSelectedKeyframe(null);
  }, []);

  return {
    keyframeStep,
    selectedKeyframe,
    handleRender,
    handleApproveKeyframe,
    handleSkipKeyframe,
    handleSelectFrame,
    handleClearSelectedFrame,
  };
}
