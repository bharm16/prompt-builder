import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { sanitizeText } from "@/features/span-highlighting";
import { safeUrlHost } from "@/utils/url";
import { VIDEO_DRAFT_MODEL } from "@components/ToolSidebar/config/modelConfig";
import type { AutocompleteState } from "../components/PromptTriggerAutocomplete";
import type {
  GenerationControlsPanelProps,
  GenerationControlsTab,
  ImageSubTab,
} from "../types";
import type { FieldInfo } from "../utils/capabilities";
import type { CameraPath } from "@/features/convergence/types";
import type { KeyframeTile, VideoTier } from "@components/ToolSidebar/types";
import type { ModelRecommendation } from "@/features/model-intelligence/types";
import { useGenerationControlsContext } from "@/features/prompt-optimizer/context/GenerationControlsContext";
import {
  useGenerationControlsStoreActions,
  useGenerationControlsStoreState,
} from "@/features/prompt-optimizer/context/GenerationControlsStore";
import { useWorkspaceSession } from "@/features/prompt-optimizer/context/WorkspaceSessionContext";
import { useOptionalPromptHighlights } from "@/features/prompt-optimizer/context/PromptStateContext";
import { useModelSelectionRecommendation } from "./useModelSelectionRecommendation";
import { useFaceSwapState, type FaceSwapMode } from "./useFaceSwapState";
import { useCapabilitiesClamping } from "./useCapabilitiesClamping";
import { useCameraMotionModalFlow } from "./useCameraMotionModalFlow";
import { usePromptEditingLifecycle } from "./usePromptEditingLifecycle";
import { useUploadAndAutocomplete } from "./useUploadAndAutocomplete";

export interface UseGenerationControlsPanelResult {
  refs: {
    fileInputRef: RefObject<HTMLInputElement>;
    resolvedPromptInputRef: RefObject<HTMLTextAreaElement>;
  };
  state: {
    activeTab: GenerationControlsTab;
    imageSubTab: ImageSubTab;
    showCameraMotionModal: boolean;
    isEditing: boolean;
  };
  store: {
    aspectRatio: string;
    duration: number;
    selectedModel: string;
    tier: VideoTier;
    keyframes: KeyframeTile[];
    cameraMotion: CameraPath | null;
  };
  derived: {
    canOptimize: boolean;
    isOptimizing: boolean;
    hasPrimaryKeyframe: boolean;
    isKeyframeLimitReached: boolean;
    isUploadDisabled: boolean;
    primaryKeyframeUrlHost: string | null;
    hasPrompt: boolean;
    isImageGenerateDisabled: boolean;
    isVideoGenerateDisabled: boolean;
    isStoryboardDisabled: boolean;
    isInputLocked: boolean;
    isOptimizeDisabled: boolean;
    isGenerateDisabled: boolean;
    canPreviewFaceSwap: boolean;
    isFaceSwapPreviewDisabled: boolean;
  };
  faceSwap: {
    mode: FaceSwapMode;
    selectedCharacterId: string;
    characterOptions: Array<{ id: string; label: string }>;
    previewUrl: string | null;
    isPreviewReady: boolean;
    isLoading: boolean;
    error: string | null;
    isModalOpen: boolean;
    faceSwapCredits: number;
    videoCredits: number | null;
    totalCredits: number | null;
  };
  recommendation: {
    recommendationMode: "i2v" | "t2v";
    modelRecommendation: ModelRecommendation | null;
    isRecommendationLoading: boolean;
    recommendationError: string | null;
    recommendedModelId: string | undefined;
    efficientModelId: string | undefined;
    renderModelOptions: Array<{ id: string; label: string }>;
    renderModelId: string;
    recommendationAgeMs: number | null;
  };
  capabilities: {
    aspectRatioInfo: FieldInfo | null;
    durationInfo: FieldInfo | null;
    aspectRatioOptions: string[];
    durationOptions: number[];
  };
  autocomplete: AutocompleteState;
  actions: {
    setActiveTab: (tab: GenerationControlsTab) => void;
    setImageSubTab: (tab: ImageSubTab) => void;
    handleModelChange: (model: string) => void;
    handleAspectRatioChange: (ratio: string) => void;
    handleDurationChange: (duration: number) => void;
    handleTierChange: (tier: VideoTier) => void;
    handleRemoveKeyframe: (id: string) => void;
    handleFile: (file: File) => Promise<void>;
    handleUploadRequest: () => void;
    handleCameraMotionButtonClick: () => void;
    handleCloseCameraMotionModal: () => void;
    handleSelectCameraMotion: (path: CameraPath) => void;
    handleInputPromptChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
    handleEditClick: () => void;
    handleCancelEdit: () => void;
    handleUpdate: () => void;
    handleReoptimize: () => void;
    handlePromptKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
    handleCopy: () => Promise<void>;
    setFaceSwapMode: (mode: FaceSwapMode) => void;
    setFaceSwapCharacterId: (assetId: string) => void;
    handleFaceSwapPreview: () => Promise<void>;
    handleOpenFaceSwapModal: () => void;
    handleCloseFaceSwapModal: () => void;
    handleFaceSwapTryDifferent: () => void;
  };
}

export const useGenerationControlsPanel = (
  props: GenerationControlsPanelProps,
): UseGenerationControlsPanelResult => {
  const {
    prompt,
    onPromptChange,
    onOptimize,
    showResults = false,
    isProcessing = false,
    isRefining = false,
    genericOptimizedPrompt = null,
    promptInputRef,
    assets = [],
    onInsertTrigger,
    onImageUpload,
  } = props;

  const fileInputRef = useRef<HTMLInputElement>(null!);
  const localPromptInputRef = useRef<HTMLTextAreaElement>(null!);
  const resolvedPromptInputRef = promptInputRef ?? localPromptInputRef;
  const previousShotIdRef = useRef<string | null>(null);
  const autocompleteKeyDownRef = useRef<(
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) => boolean>(() => false);

  const promptHighlights = useOptionalPromptHighlights();
  const {
    controls,
    faceSwapPreview: faceSwapPreviewState,
    setFaceSwapPreview,
  } = useGenerationControlsContext();
  const { isSequenceMode, currentShot, updateShot } = useWorkspaceSession();
  const { domain, ui } = useGenerationControlsStoreState();
  const storeActions = useGenerationControlsStoreActions();

  const activeTab = ui.activeTab;
  const imageSubTab = ui.imageSubTab;
  const selectedModel = domain.selectedModel;
  const generationParams = domain.generationParams;
  const tier = domain.videoTier;
  const keyframes = domain.keyframes;
  const cameraMotion = domain.cameraMotion;
  const showMotionControls = true;

  const aspectRatio = useMemo(() => {
    const fromParams = generationParams?.aspect_ratio;
    if (typeof fromParams === "string" && fromParams.trim()) {
      return fromParams.trim();
    }
    return "16:9";
  }, [generationParams?.aspect_ratio]);

  const duration = useMemo(() => {
    const durationValue = generationParams?.duration_s;
    if (typeof durationValue === "number") {
      return Number.isFinite(durationValue) ? durationValue : 5;
    }
    if (typeof durationValue === "string") {
      const parsed = Number.parseFloat(durationValue);
      return Number.isFinite(parsed) ? parsed : 5;
    }
    return 5;
  }, [generationParams?.duration_s]);

  const handleModelChange = useCallback(
    (model: string): void => {
      const nextTier: VideoTier =
        model === VIDEO_DRAFT_MODEL.id ? "draft" : "render";

      storeActions.setSelectedModel(model);
      if (tier !== nextTier) {
        storeActions.setVideoTier(nextTier);
      }

      if (isSequenceMode && currentShot && currentShot.modelId !== model) {
        void updateShot(currentShot.id, { modelId: model });
      }
    },
    [currentShot, isSequenceMode, storeActions, tier, updateShot],
  );

  const handleAspectRatioChange = useCallback(
    (ratio: string): void => {
      if (generationParams?.aspect_ratio === ratio) return;
      storeActions.mergeGenerationParams({ aspect_ratio: ratio });
    },
    [generationParams?.aspect_ratio, storeActions],
  );

  const handleDurationChange = useCallback(
    (nextDuration: number): void => {
      if (generationParams?.duration_s === nextDuration) return;
      storeActions.mergeGenerationParams({ duration_s: nextDuration });
    },
    [generationParams?.duration_s, storeActions],
  );

  const handleTierChange = useCallback(
    (nextTier: VideoTier): void => {
      storeActions.setVideoTier(nextTier);
    },
    [storeActions],
  );

  const handleRemoveKeyframe = useCallback(
    (id: string): void => {
      storeActions.removeKeyframe(id);
    },
    [storeActions],
  );

  const setActiveTab = useCallback(
    (tab: GenerationControlsTab) => {
      storeActions.setActiveTab(tab);
    },
    [storeActions],
  );

  const setImageSubTab = useCallback(
    (tab: ImageSubTab) => {
      storeActions.setImageSubTab(tab);
    },
    [storeActions],
  );

  const hasPrimaryKeyframe = Boolean(keyframes[0]);
  const isKeyframeLimitReached = keyframes.length >= 3;
  const primaryKeyframeUrl = keyframes[0]?.url ?? null;
  const primaryKeyframeUrlHost = safeUrlHost(primaryKeyframeUrl);

  const {
    recommendationMode,
    modelRecommendation,
    isRecommendationLoading,
    recommendationError,
    recommendedModelId,
    efficientModelId,
    renderModelOptions,
    renderModelId,
    recommendationAgeMs,
  } = useModelSelectionRecommendation({
    prompt,
    activeTab,
    keyframesCount: keyframes.length,
    durationSeconds: duration,
    selectedModel,
    videoTier: tier,
    promptHighlights: promptHighlights?.initialHighlights ?? null,
  });

  const canOptimize = typeof onOptimize === "function";
  const isOptimizing = Boolean(isProcessing || isRefining);
  const isGenerating = controls?.isGenerating ?? false;
  const isGenerationReady = Boolean(controls);

  const {
    aspectRatioInfo,
    durationInfo,
    aspectRatioOptions,
    durationOptions,
  } = useCapabilitiesClamping({
    activeTab,
    selectedModel,
    videoTier: tier,
    renderModelId,
    aspectRatio,
    duration,
    setVideoTier: storeActions.setVideoTier,
    onAspectRatioChange: handleAspectRatioChange,
    onDurationChange: handleDurationChange,
  });

  const {
    isEditing,
    resetEditingState,
    handleEditClick,
    handleCancelEdit,
    handleUpdate,
    handleReoptimize,
    handlePromptKeyDown,
  } = usePromptEditingLifecycle({
    prompt,
    selectedModel,
    canOptimize,
    isOptimizing,
    showResults,
    genericOptimizedPrompt,
    onOptimize,
    onPromptChange,
    resolvedPromptInputRef,
    handleModelChange,
    handleAutocompleteKeyDown: (event) => autocompleteKeyDownRef.current(event),
  });

  const {
    isUploadDisabled,
    handleFile,
    handleUploadRequest,
    handleAutocompleteKeyDown,
    autocomplete,
  } = useUploadAndAutocomplete({
    fileInputRef,
    inputRef: resolvedPromptInputRef,
    prompt,
    assets,
    onPromptChange,
    isOptimizing,
    showResults,
    isEditing,
    onInsertTrigger,
    onImageUpload,
    isKeyframeLimitReached,
  });

  autocompleteKeyDownRef.current = handleAutocompleteKeyDown;

  const {
    faceSwap,
    derived: faceSwapDerived,
    actions: {
      setFaceSwapMode,
      setFaceSwapCharacterId,
      handleFaceSwapPreview,
      handleOpenFaceSwapModal,
      handleCloseFaceSwapModal,
      handleFaceSwapTryDifferent,
    },
  } = useFaceSwapState({
    assets,
    primaryKeyframeUrl,
    primaryKeyframeUrlHost,
    aspectRatio,
    draftModelId: VIDEO_DRAFT_MODEL.id,
    renderModelId,
    tier,
    faceSwapPreviewState,
    setFaceSwapPreview,
  });

  const {
    showCameraMotionModal,
    handleCameraMotionButtonClick,
    handleCloseCameraMotionModal,
    handleSelectCameraMotion,
  } = useCameraMotionModalFlow({
    showMotionControls,
    hasPrimaryKeyframe,
    keyframes,
    primaryKeyframeUrlHost,
    cameraMotion,
    onSelectCameraMotion: storeActions.setCameraMotion,
  });

  useEffect(() => {
    const nextShotId = isSequenceMode ? (currentShot?.id ?? null) : null;
    if (previousShotIdRef.current === nextShotId) return;
    previousShotIdRef.current = nextShotId;

    resetEditingState();
    setFaceSwapMode("direct");
    setFaceSwapCharacterId("");
    handleFaceSwapTryDifferent();
  }, [
    currentShot?.id,
    isSequenceMode,
    resetEditingState,
    setFaceSwapMode,
    setFaceSwapCharacterId,
    handleFaceSwapTryDifferent,
  ]);

  useEffect(() => {
    if (!canOptimize) return;
    if (!showResults && resolvedPromptInputRef.current) {
      resolvedPromptInputRef.current.focus();
    }
  }, [canOptimize, showResults, resolvedPromptInputRef]);

  const handleInputPromptChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>): void => {
      if (!onPromptChange) return;
      const updatedPrompt = sanitizeText(event.target.value);
      onPromptChange(updatedPrompt);
    },
    [onPromptChange],
  );

  const handleCopy = useCallback(async () => {
    if (!prompt.trim()) return;
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // ignore
    }
  }, [prompt]);

  const trimmedPrompt = prompt.trim();
  const hasPrompt = Boolean(trimmedPrompt);
  const isImageGenerateDisabled =
    activeTab === "image" && keyframes.length === 0;
  const isVideoGenerateDisabled =
    activeTab === "video" && !hasPrompt && keyframes.length === 0;
  const isStoryboardDisabled = !hasPrompt && keyframes.length === 0;
  const isInputLocked =
    (canOptimize && showResults && !isEditing) || isOptimizing;
  const isOptimizeDisabled = !hasPrompt || isOptimizing;
  const isDraftDisabled = !hasPrompt || !isGenerationReady || isGenerating;
  const isRenderDisabled = !hasPrompt || !isGenerationReady || isGenerating;
  const isGenerateDisabled =
    (tier === "draft" ? isDraftDisabled : isRenderDisabled) ||
    isImageGenerateDisabled ||
    isVideoGenerateDisabled;
  const { canPreviewFaceSwap, isFaceSwapPreviewDisabled } = faceSwapDerived;

  return {
    refs: {
      fileInputRef,
      resolvedPromptInputRef,
    },
    state: {
      activeTab,
      imageSubTab,
      showCameraMotionModal,
      isEditing,
    },
    store: {
      aspectRatio,
      duration,
      selectedModel,
      tier,
      keyframes,
      cameraMotion,
    },
    derived: {
      canOptimize,
      isOptimizing,
      hasPrimaryKeyframe,
      isKeyframeLimitReached,
      isUploadDisabled,
      primaryKeyframeUrlHost,
      hasPrompt,
      isImageGenerateDisabled,
      isVideoGenerateDisabled,
      isStoryboardDisabled,
      isInputLocked,
      isOptimizeDisabled,
      isGenerateDisabled,
      canPreviewFaceSwap,
      isFaceSwapPreviewDisabled,
    },
    faceSwap,
    recommendation: {
      recommendationMode,
      modelRecommendation,
      isRecommendationLoading,
      recommendationError,
      recommendedModelId,
      efficientModelId,
      renderModelOptions,
      renderModelId,
      recommendationAgeMs,
    },
    capabilities: {
      aspectRatioInfo,
      durationInfo,
      aspectRatioOptions,
      durationOptions,
    },
    autocomplete,
    actions: {
      setActiveTab,
      setImageSubTab,
      handleModelChange,
      handleAspectRatioChange,
      handleDurationChange,
      handleTierChange,
      handleRemoveKeyframe,
      handleFile,
      handleUploadRequest,
      handleCameraMotionButtonClick,
      handleCloseCameraMotionModal,
      handleSelectCameraMotion,
      handleInputPromptChange,
      handleEditClick,
      handleCancelEdit,
      handleUpdate,
      handleReoptimize,
      handlePromptKeyDown,
      handleCopy,
      setFaceSwapMode,
      setFaceSwapCharacterId,
      handleFaceSwapPreview,
      handleOpenFaceSwapModal,
      handleCloseFaceSwapModal,
      handleFaceSwapTryDifferent,
    },
  };
};
