import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import type { CapabilityValues } from "@shared/capabilities";
import { useCapabilities } from "@features/prompt-optimizer/hooks/useCapabilities";
import { useTriggerAutocomplete } from "@/features/prompt-optimizer/components/TriggerAutocomplete";
import { sanitizeText } from "@/features/span-highlighting";
import { logger } from "@/services/LoggingService";
import { safeUrlHost } from "@/utils/url";
import { VIDEO_DRAFT_MODEL } from "@components/ToolSidebar/config/modelConfig";
import { DEFAULT_ASPECT_RATIOS, DEFAULT_DURATIONS } from "../constants";
import type { AutocompleteState } from "../components/PromptTriggerAutocomplete";
import type {
  GenerationControlsPanelProps,
  GenerationControlsTab,
  ImageSubTab,
} from "../types";
import {
  getFieldInfo,
  resolveNumberOptions,
  resolveStringOptions,
  type FieldInfo,
} from "../utils/capabilities";
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
import { useEditingPersistence } from "./useEditingPersistence";
import { useModelSelectionRecommendation } from "./useModelSelectionRecommendation";
import { useFaceSwapState, type FaceSwapMode } from "./useFaceSwapState";

const log = logger.child("GenerationControlsPanel");

export interface UseGenerationControlsPanelResult {
  refs: {
    fileInputRef: RefObject<HTMLInputElement>;
    resolvedPromptInputRef: RefObject<HTMLTextAreaElement | null>;
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
    recommendedModelId?: string;
    efficientModelId?: string;
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const localPromptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const resolvedPromptInputRef = promptInputRef ?? localPromptInputRef;
  const promptHighlights = useOptionalPromptHighlights();

  const [isUploading, setIsUploading] = useState(false);
  const {
    controls,
    faceSwapPreview: faceSwapPreviewState,
    setFaceSwapPreview,
  } = useGenerationControlsContext();
  const { isSequenceMode, currentShot, updateShot } = useWorkspaceSession();
  const previousShotIdRef = useRef<string | null>(null);
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

  const [showCameraMotionModal, setShowCameraMotionModal] = useState(false);
  const {
    isEditing,
    setIsEditing,
    originalInputPrompt,
    setOriginalInputPrompt,
    originalSelectedModel,
    setOriginalSelectedModel,
    resetEditingState,
  } = useEditingPersistence();

  // Editing persistence handled in hook.

  const hasPrimaryKeyframe = Boolean(keyframes[0]);
  const isKeyframeLimitReached = keyframes.length >= 3;
  const isUploadDisabled =
    !onImageUpload || isUploading || isKeyframeLimitReached;
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

  useEffect(() => {
    if (!selectedModel.trim()) return;
    const expectedTier: VideoTier =
      selectedModel === VIDEO_DRAFT_MODEL.id ? "draft" : "render";
    if (tier === expectedTier) return;
    storeActions.setVideoTier(expectedTier);
  }, [selectedModel, storeActions, tier]);

  const capabilitiesModelId = useMemo(() => {
    if (activeTab === "video") {
      return tier === "draft" ? VIDEO_DRAFT_MODEL.id : renderModelId;
    }
    return renderModelId;
  }, [activeTab, renderModelId, tier]);

  const { schema } = useCapabilities(capabilitiesModelId);
  const canOptimize = typeof onOptimize === "function";
  const isOptimizing = Boolean(isProcessing || isRefining);
  const isGenerating = controls?.isGenerating ?? false;
  const isGenerationReady = Boolean(controls);

  const currentParams = useMemo<CapabilityValues>(
    () => ({
      aspect_ratio: aspectRatio,
      duration_s: duration,
    }),
    [aspectRatio, duration],
  );

  const aspectRatioInfo = useMemo(
    () => getFieldInfo(schema, currentParams, "aspect_ratio"),
    [schema, currentParams],
  );

  const durationInfo = useMemo(
    () => getFieldInfo(schema, currentParams, "duration_s"),
    [schema, currentParams],
  );

  const aspectRatioOptions = useMemo(
    () =>
      resolveStringOptions(
        aspectRatioInfo?.allowedValues,
        DEFAULT_ASPECT_RATIOS,
      ),
    [aspectRatioInfo?.allowedValues],
  );

  const durationOptions = useMemo(
    () => resolveNumberOptions(durationInfo?.allowedValues, DEFAULT_DURATIONS),
    [durationInfo?.allowedValues],
  );

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
    if (!aspectRatioOptions.length) return;
    if (aspectRatioOptions.includes(aspectRatio)) return;
    const nextRatio = aspectRatioOptions[0];
    log.info("Clamping aspect ratio to supported option", {
      previousAspectRatio: aspectRatio,
      nextAspectRatio: nextRatio,
      allowedAspectRatios: aspectRatioOptions,
    });
    handleAspectRatioChange(nextRatio);
  }, [aspectRatioOptions, aspectRatio, handleAspectRatioChange]);

  useEffect(() => {
    if (!durationOptions.length) return;
    if (durationOptions.includes(duration)) return;
    const closest = durationOptions.reduce((best, value) =>
      Math.abs(value - duration) < Math.abs(best - duration) ? value : best,
    );
    log.info("Clamping duration to supported option", {
      previousDuration: duration,
      nextDuration: closest,
      allowedDurations: durationOptions,
    });
    handleDurationChange(closest);
  }, [durationOptions, duration, handleDurationChange]);

  useEffect(() => {
    if (!showMotionControls) return;
    if (activeTab === "video") return;
    log.debug("Forcing video tab because motion controls are enabled", {
      previousTab: activeTab,
      primaryKeyframeUrlHost,
    });
    setActiveTab("video");
  }, [showMotionControls, activeTab, primaryKeyframeUrlHost]);

  useEffect(() => {
    if (keyframes[0]) return;
    if (!showCameraMotionModal) return;
    log.info(
      "Closing camera motion modal because primary keyframe is missing",
      {
        keyframesCount: keyframes.length,
      },
    );
    setShowCameraMotionModal(false);
  }, [keyframes, showCameraMotionModal]);

  useEffect(() => {
    if (!canOptimize) return;
    if (!showResults && resolvedPromptInputRef.current) {
      resolvedPromptInputRef.current.focus();
    }
  }, [canOptimize, showResults, resolvedPromptInputRef]);

  const {
    isOpen: autocompleteOpen,
    suggestions: autocompleteSuggestions,
    selectedIndex: autocompleteSelectedIndex,
    position: autocompletePosition,
    query: autocompleteQuery,
    handleKeyDown: handleAutocompleteKeyDown,
    selectSuggestion: selectAutocompleteSuggestion,
    setSelectedIndex: setAutocompleteSelectedIndex,
    close: closeAutocomplete,
    updateFromCursor: updateAutocompletePosition,
  } = useTriggerAutocomplete({
    inputRef: resolvedPromptInputRef,
    prompt,
    assets,
    isEnabled:
      Boolean(onPromptChange) && !isOptimizing && (!showResults || isEditing),
    onSelect: (asset, range) => {
      onInsertTrigger?.(asset.trigger, range);
    },
  });

  const handleFile = useCallback(
    async (file: File) => {
      if (isUploadDisabled || !onImageUpload) return;
      const result = onImageUpload(file);
      if (result && typeof (result as Promise<void>).then === "function") {
        setIsUploading(true);
        try {
          await result;
        } finally {
          setIsUploading(false);
        }
      }
    },
    [isUploadDisabled, onImageUpload],
  );

  const handleUploadRequest = useCallback(() => {
    if (isUploadDisabled) return;
    fileInputRef.current?.click();
  }, [isUploadDisabled]);

  const handleCameraMotionButtonClick = useCallback(() => {
    if (!hasPrimaryKeyframe) {
      log.warn("Camera motion modal requested without a primary keyframe", {
        showMotionControls,
        keyframesCount: keyframes.length,
      });
      return;
    }

    log.info("Opening camera motion modal from generation controls panel", {
      keyframesCount: keyframes.length,
      primaryKeyframeUrlHost,
      currentCameraMotionId: cameraMotion?.id ?? null,
    });
    setShowCameraMotionModal(true);
  }, [
    hasPrimaryKeyframe,
    showMotionControls,
    keyframes.length,
    primaryKeyframeUrlHost,
    cameraMotion?.id,
  ]);

  const handleCloseCameraMotionModal = useCallback(() => {
    log.info("Camera motion modal closed from generation controls panel", {
      primaryKeyframeUrlHost,
      currentCameraMotionId: cameraMotion?.id ?? null,
    });
    setShowCameraMotionModal(false);
  }, [cameraMotion?.id, primaryKeyframeUrlHost]);

  const handleSelectCameraMotion = useCallback(
    (path: CameraPath) => {
      log.info(
        "Camera motion selected from modal in generation controls panel",
        {
          cameraMotionId: path.id,
          cameraMotionLabel: path.label,
          primaryKeyframeUrlHost,
        },
      );
      storeActions.setCameraMotion(path);
      setShowCameraMotionModal(false);
    },
    [primaryKeyframeUrlHost, storeActions],
  );

  const handleInputPromptChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>): void => {
      if (!onPromptChange) return;
      const updatedPrompt = sanitizeText(event.target.value);
      onPromptChange(updatedPrompt);
    },
    [onPromptChange],
  );

  const handleEditClick = useCallback((): void => {
    if (!canOptimize || isOptimizing) {
      return;
    }
    setOriginalInputPrompt(prompt);
    setOriginalSelectedModel(selectedModel);
    setIsEditing(true);
    setTimeout(() => {
      resolvedPromptInputRef.current?.focus();
    }, 0);
  }, [
    canOptimize,
    isOptimizing,
    prompt,
    resolvedPromptInputRef,
    selectedModel,
  ]);

  const handleCancelEdit = useCallback((): void => {
    if (!canOptimize) return;
    onPromptChange?.(originalInputPrompt);
    if (originalSelectedModel !== undefined) {
      handleModelChange(originalSelectedModel);
    }
    resetEditingState();
  }, [
    canOptimize,
    handleModelChange,
    onPromptChange,
    originalInputPrompt,
    originalSelectedModel,
    resetEditingState,
  ]);

  const handleUpdate = useCallback((): void => {
    if (!canOptimize || isOptimizing || !onOptimize) {
      return;
    }
    const promptChanged = prompt !== originalInputPrompt;
    const modelChanged =
      typeof originalSelectedModel === "string" &&
      originalSelectedModel !== selectedModel;
    const genericPrompt =
      typeof genericOptimizedPrompt === "string" &&
      genericOptimizedPrompt.trim()
        ? genericOptimizedPrompt
        : null;

    if (modelChanged && !promptChanged && genericPrompt) {
      void onOptimize(prompt, {
        compileOnly: true,
        compilePrompt: genericPrompt,
        createVersion: true,
      });
    } else {
      void onOptimize(prompt);
    }

    resetEditingState();
  }, [
    canOptimize,
    genericOptimizedPrompt,
    isOptimizing,
    onOptimize,
    originalInputPrompt,
    originalSelectedModel,
    prompt,
    selectedModel,
    resetEditingState,
  ]);

  const handleReoptimize = useCallback((): void => {
    if (!canOptimize || isOptimizing || !onOptimize) {
      return;
    }
    void onOptimize(prompt);
  }, [canOptimize, isOptimizing, onOptimize, prompt]);

  const handlePromptKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>): void => {
      if (handleAutocompleteKeyDown(event)) {
        return;
      }
      if (!canOptimize || isOptimizing || !onOptimize) {
        return;
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (!showResults) {
          if (prompt.trim()) {
            void onOptimize(prompt);
          }
        } else if (isEditing) {
          handleUpdate();
        } else {
          handleReoptimize();
        }
      }
    },
    [
      canOptimize,
      handleAutocompleteKeyDown,
      handleReoptimize,
      handleUpdate,
      isEditing,
      isOptimizing,
      onOptimize,
      prompt,
      showResults,
    ],
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
    autocomplete: {
      autocompleteOpen,
      autocompleteSuggestions,
      autocompleteSelectedIndex,
      autocompletePosition,
      autocompleteQuery,
      selectAutocompleteSuggestion,
      setAutocompleteSelectedIndex,
      closeAutocomplete,
      updateAutocompletePosition,
    },
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
