import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { safeUrlHost } from "@/utils/url";
import { VIDEO_DRAFT_MODEL } from "@components/ToolSidebar/config/modelConfig";
import type {
  GenerationControlsPanelProps,
  GenerationControlsTab,
  ImageSubTab,
} from "../types";
import type { FieldInfo } from "../utils/capabilities";
import type { CameraPath } from "@/features/convergence/types";
import type { KeyframeTile, VideoTier } from "@components/ToolSidebar/types";
import type { ModelRecommendation } from "@/features/model-intelligence/types";
import type {
  ExtendVideoSource,
  VideoReferenceImage,
} from "@/features/prompt-optimizer/context/generationControlsStoreTypes";
import { useGenerationControlsContext } from "@/features/prompt-optimizer/context/GenerationControlsContext";
import {
  useGenerationControlsStoreActions,
  useGenerationControlsStoreState,
} from "@/features/prompt-optimizer/context/GenerationControlsStore";
import { useWorkspaceSession } from "@/features/prompt-optimizer/context/WorkspaceSessionContext";
import {
  useOptionalPromptHighlights,
  usePromptServices,
} from "@/features/prompt-optimizer/context/PromptStateContext";
import { useModelSelectionRecommendation } from "./useModelSelectionRecommendation";
import { useFaceSwapState, type FaceSwapMode } from "./useFaceSwapState";
import { useCapabilitiesClamping } from "./useCapabilitiesClamping";
import { useCameraMotionModalFlow } from "./useCameraMotionModalFlow";
import {
  useVideoInputCapabilities,
  type VideoInputCapabilities,
} from "./useVideoInputCapabilities";

export interface UseGenerationControlsPanelResult {
  refs: {
    fileInputRef: RefObject<HTMLInputElement>;
    startFrameFileInputRef: RefObject<HTMLInputElement>;
    endFrameFileInputRef: RefObject<HTMLInputElement>;
    videoReferenceFileInputRef: RefObject<HTMLInputElement>;
  };
  state: {
    activeTab: GenerationControlsTab;
    imageSubTab: ImageSubTab;
    showCameraMotionModal: boolean;
  };
  store: {
    aspectRatio: string;
    duration: number;
    selectedModel: string;
    tier: VideoTier;
    keyframes: KeyframeTile[];
    startFrame: KeyframeTile | null;
    endFrame: KeyframeTile | null;
    videoReferenceImages: VideoReferenceImage[];
    extendVideo: ExtendVideoSource | null;
    cameraMotion: CameraPath | null;
  };
  derived: {
    isOptimizing: boolean;
    hasStartFrame: boolean;
    hasEndFrame: boolean;
    isExtendMode: boolean;
    videoReferenceCount: number;
    isKeyframeLimitReached: boolean;
    isVideoReferenceLimitReached: boolean;
    isUploadDisabled: boolean;
    isStartFrameUploadDisabled: boolean;
    isEndFrameUploadDisabled: boolean;
    isVideoReferenceUploadDisabled: boolean;
    startFrameUrlHost: string | null;
    hasPrompt: boolean;
    promptLength: number;
    isImageGenerateDisabled: boolean;
    isVideoGenerateDisabled: boolean;
    isStoryboardDisabled: boolean;
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
    videoInputCapabilities: VideoInputCapabilities;
  };
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
    handleStartFrameFile: (file: File) => Promise<void>;
    handleStartFrameUploadRequest: () => void;
    handleClearStartFrame: () => void;
    handleEndFrameFile: (file: File) => Promise<void>;
    handleEndFrameUploadRequest: () => void;
    handleClearEndFrame: () => void;
    handleVideoReferenceFile: (file: File) => Promise<void>;
    handleVideoReferenceUploadRequest: () => void;
    handleRemoveVideoReference: (id: string) => void;
    handleUpdateVideoReferenceType: (id: string, type: "asset" | "style") => void;
    handleClearExtendVideo: () => void;
    handleCameraMotionButtonClick: () => void;
    handleCloseCameraMotionModal: () => void;
    handleSelectCameraMotion: (path: CameraPath) => void;
    handleCopy: () => Promise<void>;
    handleClearPrompt: () => void;
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
    isProcessing = false,
    isRefining = false,
    assets = [],
    onImageUpload,
    onStartFrameUpload,
    onUploadSidebarImage,
  } = props;

  const fileInputRef = useRef<HTMLInputElement>(null!);
  const startFrameFileInputRef = useRef<HTMLInputElement>(null!);
  const endFrameFileInputRef = useRef<HTMLInputElement>(null!);
  const videoReferenceFileInputRef = useRef<HTMLInputElement>(null!);
  const previousShotIdRef = useRef<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isStartFrameUploading, setIsStartFrameUploading] = useState(false);
  const [isEndFrameUploading, setIsEndFrameUploading] = useState(false);
  const [isVideoRefUploading, setIsVideoRefUploading] = useState(false);

  const promptHighlights = useOptionalPromptHighlights();
  const { promptOptimizer } = usePromptServices();
  const { setInputPrompt } = promptOptimizer;
  const prompt = promptOptimizer.inputPrompt;
  const {
    controls,
    faceSwapPreview: faceSwapPreviewState,
    setFaceSwapPreview,
  } = useGenerationControlsContext();
  const { hasActiveContinuityShot, currentShot, updateShot } = useWorkspaceSession();
  const { domain, ui } = useGenerationControlsStoreState();
  const storeActions = useGenerationControlsStoreActions();

  const activeTab = ui.activeTab;
  const imageSubTab = ui.imageSubTab;
  const selectedModel = domain.selectedModel;
  const generationParams = domain.generationParams;
  const tier = domain.videoTier;
  const keyframes = domain.keyframes;
  const startFrame = domain.startFrame;
  const endFrame = domain.endFrame;
  const videoReferenceImages = domain.videoReferenceImages;
  const extendVideo = domain.extendVideo;
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

      if (hasActiveContinuityShot && currentShot && currentShot.modelId !== model) {
        void updateShot(currentShot.id, { modelId: model });
      }
    },
    [currentShot, hasActiveContinuityShot, storeActions, tier, updateShot],
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

  const hasStartFrame = Boolean(startFrame);
  const hasEndFrame = Boolean(endFrame);
  const isExtendMode = Boolean(extendVideo);
  const isKeyframeLimitReached = keyframes.length >= 3;
  const startFrameUrl = startFrame?.url ?? null;
  const startFrameUrlHost = safeUrlHost(startFrameUrl);

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
    keyframesCount: hasStartFrame ? 1 : 0,
    durationSeconds: duration,
    selectedModel,
    videoTier: tier,
    promptHighlights: promptHighlights?.initialHighlights ?? null,
  });

  const isOptimizing = Boolean(isProcessing || isRefining);
  const isGenerating = controls?.isGenerating ?? false;
  const isGenerationReady = Boolean(controls);

  const {
    schema,
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

  const videoInputCapabilities = useVideoInputCapabilities(schema);
  const videoReferenceCount = videoReferenceImages.length;
  const isVideoReferenceLimitReached =
    videoInputCapabilities.maxReferenceImages === 0 ||
    videoReferenceCount >= videoInputCapabilities.maxReferenceImages;

  const isUploadDisabled =
    !onImageUpload || isUploading || isKeyframeLimitReached;

  const handleFile = useCallback(
    async (file: File): Promise<void> => {
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
    [isUploadDisabled, onImageUpload]
  );

  const handleUploadRequest = useCallback(() => {
    if (isUploadDisabled) return;
    fileInputRef.current?.click();
  }, [isUploadDisabled]);

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
    startFrameUrl,
    startFrameUrlHost,
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
    hasStartFrame,
    keyframesCount: keyframes.length,
    startFrame,
    startFrameUrlHost,
    cameraMotion,
    onSelectCameraMotion: storeActions.setCameraMotion,
  });

  useEffect(() => {
    const nextShotId = hasActiveContinuityShot ? (currentShot?.id ?? null) : null;
    if (previousShotIdRef.current === nextShotId) return;
    previousShotIdRef.current = nextShotId;
    setFaceSwapMode("direct");
    setFaceSwapCharacterId("");
    handleFaceSwapTryDifferent();
  }, [
    currentShot?.id,
    hasActiveContinuityShot,
    setFaceSwapMode,
    setFaceSwapCharacterId,
    handleFaceSwapTryDifferent,
  ]);

  const handleCopy = useCallback(async () => {
    if (!prompt.trim()) return;
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // ignore
    }
  }, [prompt]);

  const handleClearPrompt = useCallback(() => {
    setInputPrompt("");
  }, [setInputPrompt]);

  const isStartFrameUploadDisabled =
    (!onStartFrameUpload && !onUploadSidebarImage) || isStartFrameUploading;

  const handleStartFrameFile = useCallback(
    async (file: File): Promise<void> => {
      if (isStartFrameUploadDisabled) return;
      if (onStartFrameUpload) {
        const result = onStartFrameUpload(file);
        if (result && typeof (result as Promise<void>).then === "function") {
          setIsStartFrameUploading(true);
          try {
            await result;
          } finally {
            setIsStartFrameUploading(false);
          }
        }
        return;
      }

      if (!onUploadSidebarImage) return;
      setIsStartFrameUploading(true);
      try {
        const uploaded = await onUploadSidebarImage(file);
        if (!uploaded) return;
        storeActions.setStartFrame({
          id: `start-frame-upload-${Date.now()}`,
          url: uploaded.url,
          source: "upload",
          ...(uploaded.storagePath ? { storagePath: uploaded.storagePath } : {}),
          ...(uploaded.viewUrlExpiresAt
            ? { viewUrlExpiresAt: uploaded.viewUrlExpiresAt }
            : {}),
        });
      } finally {
        setIsStartFrameUploading(false);
      }
    },
    [
      isStartFrameUploadDisabled,
      onStartFrameUpload,
      onUploadSidebarImage,
      storeActions,
    ]
  );

  const handleStartFrameUploadRequest = useCallback(() => {
    if (isStartFrameUploadDisabled) return;
    startFrameFileInputRef.current?.click();
  }, [isStartFrameUploadDisabled]);

  const handleClearStartFrame = useCallback(() => {
    storeActions.clearStartFrame();
  }, [storeActions]);

  const isEndFrameUploadDisabled =
    !onUploadSidebarImage || isEndFrameUploading;

  const handleEndFrameFile = useCallback(
    async (file: File): Promise<void> => {
      if (isEndFrameUploadDisabled || !onUploadSidebarImage) return;
      setIsEndFrameUploading(true);
      try {
        const uploaded = await onUploadSidebarImage(file);
        if (!uploaded) return;
        storeActions.setEndFrame({
          id: `end-frame-upload-${Date.now()}`,
          url: uploaded.url,
          source: "upload",
          ...(uploaded.storagePath ? { storagePath: uploaded.storagePath } : {}),
          ...(uploaded.viewUrlExpiresAt
            ? { viewUrlExpiresAt: uploaded.viewUrlExpiresAt }
            : {}),
        });
      } finally {
        setIsEndFrameUploading(false);
      }
    },
    [isEndFrameUploadDisabled, onUploadSidebarImage, storeActions]
  );

  const handleEndFrameUploadRequest = useCallback(() => {
    if (isEndFrameUploadDisabled) return;
    endFrameFileInputRef.current?.click();
  }, [isEndFrameUploadDisabled]);

  const handleClearEndFrame = useCallback(() => {
    storeActions.clearEndFrame();
  }, [storeActions]);

  const isVideoReferenceUploadDisabled =
    !onUploadSidebarImage || isVideoRefUploading || isVideoReferenceLimitReached;

  const handleVideoReferenceFile = useCallback(
    async (file: File): Promise<void> => {
      if (isVideoReferenceUploadDisabled || !onUploadSidebarImage) return;
      setIsVideoRefUploading(true);
      try {
        const uploaded = await onUploadSidebarImage(file);
        if (!uploaded) return;
        storeActions.addVideoReference({
          url: uploaded.url,
          referenceType: "asset",
          source: "upload",
          ...(uploaded.storagePath ? { storagePath: uploaded.storagePath } : {}),
          ...(uploaded.viewUrlExpiresAt
            ? { viewUrlExpiresAt: uploaded.viewUrlExpiresAt }
            : {}),
        });
      } finally {
        setIsVideoRefUploading(false);
      }
    },
    [isVideoReferenceUploadDisabled, onUploadSidebarImage, storeActions]
  );

  const handleVideoReferenceUploadRequest = useCallback(() => {
    if (isVideoReferenceUploadDisabled) return;
    videoReferenceFileInputRef.current?.click();
  }, [isVideoReferenceUploadDisabled]);

  const handleRemoveVideoReference = useCallback(
    (id: string): void => {
      storeActions.removeVideoReference(id);
    },
    [storeActions]
  );

  const handleUpdateVideoReferenceType = useCallback(
    (id: string, type: "asset" | "style"): void => {
      storeActions.updateVideoReferenceType(id, type);
    },
    [storeActions]
  );

  const handleClearExtendVideo = useCallback(() => {
    storeActions.clearExtendVideo();
  }, [storeActions]);

  const trimmedPrompt = prompt.trim();
  const hasPrompt = Boolean(trimmedPrompt);
  const isImageGenerateDisabled =
    activeTab === "image" && keyframes.length === 0;
  const isVideoGenerateDisabled =
    activeTab === "video" && !hasPrompt && !startFrame;
  const isStoryboardDisabled = !hasPrompt && !startFrame;
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
      startFrameFileInputRef,
      endFrameFileInputRef,
      videoReferenceFileInputRef,
    },
    state: {
      activeTab,
      imageSubTab,
      showCameraMotionModal,
    },
    store: {
      aspectRatio,
      duration,
      selectedModel,
      tier,
      keyframes,
      startFrame,
      endFrame,
      videoReferenceImages,
      extendVideo,
      cameraMotion,
    },
    derived: {
      isOptimizing,
      hasStartFrame,
      hasEndFrame,
      isExtendMode,
      videoReferenceCount,
      isKeyframeLimitReached,
      isVideoReferenceLimitReached,
      isUploadDisabled,
      isStartFrameUploadDisabled,
      isEndFrameUploadDisabled,
      isVideoReferenceUploadDisabled,
      startFrameUrlHost,
      hasPrompt,
      promptLength: trimmedPrompt.length,
      isImageGenerateDisabled,
      isVideoGenerateDisabled,
      isStoryboardDisabled,
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
      videoInputCapabilities,
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
      handleStartFrameFile,
      handleStartFrameUploadRequest,
      handleClearStartFrame,
      handleEndFrameFile,
      handleEndFrameUploadRequest,
      handleClearEndFrame,
      handleVideoReferenceFile,
      handleVideoReferenceUploadRequest,
      handleRemoveVideoReference,
      handleUpdateVideoReferenceType,
      handleClearExtendVideo,
      handleCameraMotionButtonClick,
      handleCloseCameraMotionModal,
      handleSelectCameraMotion,
      handleCopy,
      handleClearPrompt,
      setFaceSwapMode,
      setFaceSwapCharacterId,
      handleFaceSwapPreview,
      handleOpenFaceSwapModal,
      handleCloseFaceSwapModal,
      handleFaceSwapTryDifferent,
    },
  };
};
