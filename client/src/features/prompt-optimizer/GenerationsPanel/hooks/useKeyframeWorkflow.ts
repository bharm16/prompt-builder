import { useCallback, useEffect, useState } from 'react';
import type { Asset } from '@shared/types/asset';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import type { GenerationParams } from '../types';
import type { GenerationOverrides } from '@components/ToolSidebar/types';

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
  storagePath?: string;
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

  useEffect(() => {
    if (!selectedKeyframe) return;
    if (keyframes.length === 0) return;
    const matches = keyframes.some((frame) => {
      if (frame.url === selectedKeyframe.url) return true;
      if (selectedKeyframe.storagePath && frame.storagePath === selectedKeyframe.storagePath) {
        return true;
      }
      return false;
    });
    if (!matches) {
      setSelectedKeyframe(null);
    }
  }, [keyframes, selectedKeyframe]);

  const runRender = useCallback(
    (model: string, overrides?: GenerationOverrides) => {
      if (!prompt.trim()) return;
      const versionId = onCreateVersionIfNeeded();
      let startImage = null;
      if (overrides?.startImage) {
        startImage = {
          url: overrides.startImage.url,
          source: overrides.startImage.source,
          ...(overrides.startImage.assetId ? { assetId: overrides.startImage.assetId } : {}),
          ...(overrides.startImage.storagePath ? { storagePath: overrides.startImage.storagePath } : {}),
          ...(overrides.startImage.viewUrlExpiresAt ? { viewUrlExpiresAt: overrides.startImage.viewUrlExpiresAt } : {}),
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
      const resolvedCharacterAssetId =
        overrides?.characterAssetId ??
        (startImage?.source === 'asset' ? startImage.assetId : detectedCharacter?.id);

      generateRender(model, prompt, {
        promptVersionId: versionId,
        startImage,
        ...(resolvedCharacterAssetId ? { characterAssetId: resolvedCharacterAssetId } : {}),
        ...(overrides?.faceSwapAlreadyApplied ? { faceSwapAlreadyApplied: true } : {}),
        ...(overrides?.faceSwapUrl ? { faceSwapUrl: overrides.faceSwapUrl } : {}),
        ...(overrides?.generationParams ? { generationParams: overrides.generationParams } : {}),
      });
      setSelectedKeyframe(null);
      setKeyframeStep({
        isActive: false,
        character: null,
        pendingModel: null,
      });
    },
    [
      assetReferenceImages,
      detectedCharacter?.id,
      generateRender,
      onCreateVersionIfNeeded,
      prompt,
      selectedKeyframe,
    ]
  );

  const handleRender = useCallback(
    (model: string, overrides?: GenerationOverrides) => {
      if (!prompt.trim()) return;
      if (overrides?.startImage || overrides?.characterAssetId || overrides?.faceSwapAlreadyApplied) {
        runRender(model, overrides);
        return;
      }
      const primaryKeyframe = keyframes[0];
      if (primaryKeyframe) {
        runRender(model, {
          startImage: {
            url: primaryKeyframe.url,
            source: primaryKeyframe.source,
            ...(primaryKeyframe.assetId ? { assetId: primaryKeyframe.assetId } : {}),
            ...(primaryKeyframe.storagePath ? { storagePath: primaryKeyframe.storagePath } : {}),
            ...(primaryKeyframe.viewUrlExpiresAt ? { viewUrlExpiresAt: primaryKeyframe.viewUrlExpiresAt } : {}),
          },
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

      runRender(model, undefined);
    },
    [detectedCharacter, keyframeStep.isActive, keyframes, prompt, runRender]
  );

  const handleApproveKeyframe = useCallback(
    (keyframeUrl: string) => {
      const modelToUse = keyframeStep.pendingModel ?? 'sora-2';
      runRender(modelToUse, { startImage: { url: keyframeUrl, source: 'keyframe' } });
    },
    [keyframeStep.pendingModel, runRender]
  );

  const handleSkipKeyframe = useCallback(() => {
    const modelToUse = keyframeStep.pendingModel ?? 'sora-2';
    runRender(modelToUse, undefined);
  }, [keyframeStep.pendingModel, runRender]);

  const handleSelectFrame = useCallback(
    (url: string, frameIndex: number, generationId: string, storagePath?: string) => {
      setSelectedKeyframe({
        url,
        generationId,
        frameIndex,
        source: 'generation',
        ...(storagePath ? { storagePath } : {}),
      });
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
