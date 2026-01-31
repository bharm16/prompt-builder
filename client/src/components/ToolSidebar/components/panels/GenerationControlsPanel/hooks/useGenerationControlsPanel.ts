import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { CapabilityValues } from '@shared/capabilities';
import { useCapabilities } from '@features/prompt-optimizer/hooks/useCapabilities';
import { useTriggerAutocomplete } from '@/features/prompt-optimizer/components/TriggerAutocomplete';
import { sanitizeText } from '@/features/span-highlighting';
import { logger } from '@/services/LoggingService';
import { safeUrlHost } from '@/utils/url';
import { useModelRecommendation } from '@/features/model-intelligence';
import { MIN_PROMPT_LENGTH_FOR_RECOMMENDATION } from '@/features/model-intelligence/constants';
import { normalizeModelIdForSelection } from '@/features/model-intelligence/utils/modelLabels';
import { VIDEO_DRAFT_MODEL, VIDEO_RENDER_MODELS } from '@components/ToolSidebar/config/modelConfig';
import { DEFAULT_ASPECT_RATIOS, DEFAULT_DURATIONS } from '../constants';
import type { AutocompleteState } from '../components/PromptTriggerAutocomplete';
import type { GenerationControlsPanelProps, GenerationControlsTab, ImageSubTab } from '../types';
import { getFieldInfo, resolveNumberOptions, resolveStringOptions, type FieldInfo } from '../utils/capabilities';
import type { CameraPath } from '@/features/convergence/types';
import { useOptionalPromptHighlights } from '@/features/prompt-optimizer/context/PromptStateContext';
import type { HighlightSnapshot } from '@/features/prompt-optimizer/context/types';
import type { ModelRecommendation, ModelRecommendationSpan } from '@/features/model-intelligence/types';

const log = logger.child('GenerationControlsPanel');

type HighlightSpan = HighlightSnapshot['spans'][number];

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
  };
  recommendation: {
    recommendationMode: 'i2v' | 't2v';
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
    setActiveTab: Dispatch<SetStateAction<GenerationControlsTab>>;
    setImageSubTab: Dispatch<SetStateAction<ImageSubTab>>;
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
  };
}

const buildRecommendationSpans = (
  prompt: string,
  spans: HighlightSpan[] | undefined
): ModelRecommendationSpan[] | undefined => {
  if (!spans?.length) return undefined;
  if (!prompt.trim()) return undefined;

  const maxIndex = prompt.length;
  const normalizedSpans = spans
    .map((span) => {
      const start = Math.max(0, Math.min(maxIndex, Math.floor(span.start)));
      const end = Math.max(0, Math.min(maxIndex, Math.floor(span.end)));
      if (start >= end) return null;
      const text = prompt.slice(start, end).trim();
      if (!text) return null;
      return {
        text,
        start,
        end,
        category: span.category,
        confidence: span.confidence,
      };
    })
    .filter((span): span is ModelRecommendationSpan => Boolean(span));

  return normalizedSpans.length ? normalizedSpans : undefined;
};

export const useGenerationControlsPanel = (
  props: GenerationControlsPanelProps
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
    aspectRatio,
    duration,
    selectedModel,
    onModelChange,
    isDraftDisabled,
    isRenderDisabled,
    onImageUpload,
    keyframes,
    tier,
    showMotionControls = false,
    cameraMotion = null,
    onCameraMotionChange,
  } = props;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const localPromptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const resolvedPromptInputRef = promptInputRef ?? localPromptInputRef;
  const promptHighlights = useOptionalPromptHighlights();

  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<GenerationControlsTab>('video');
  const [imageSubTab, setImageSubTab] = useState<ImageSubTab>('references');
  const [showCameraMotionModal, setShowCameraMotionModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [originalInputPrompt, setOriginalInputPrompt] = useState('');
  const [originalSelectedModel, setOriginalSelectedModel] = useState<string | undefined>(undefined);

  const hasPrimaryKeyframe = Boolean(keyframes[0]);
  const isKeyframeLimitReached = keyframes.length >= 3;
  const isUploadDisabled = !onImageUpload || isUploading || isKeyframeLimitReached;
  const primaryKeyframeUrlHost = safeUrlHost(keyframes[0]?.url);
  const trimmedPrompt = prompt.trim();
  const trimmedPromptLength = trimmedPrompt.length;

  const recommendationSpans = useMemo(
    () => buildRecommendationSpans(prompt, promptHighlights?.initialHighlights?.spans),
    [prompt, promptHighlights?.initialHighlights?.spans]
  );

  const recommendationMode = useMemo(
    () => (keyframes.length > 0 ? 'i2v' : 't2v'),
    [keyframes.length]
  );

  const shouldLoadRecommendations = useMemo(
    () => activeTab === 'video' && trimmedPromptLength >= MIN_PROMPT_LENGTH_FOR_RECOMMENDATION,
    [activeTab, trimmedPromptLength]
  );

  const {
    recommendation: modelRecommendation,
    isLoading: isRecommendationLoading,
    error: recommendationError,
  } = useModelRecommendation(prompt, {
    mode: recommendationMode,
    durationSeconds: duration,
    spans: recommendationSpans,
    enabled: shouldLoadRecommendations,
  });

  const recommendedModelId = useMemo(() => {
    const modelId = modelRecommendation?.recommended?.modelId;
    return modelId ? normalizeModelIdForSelection(modelId) : undefined;
  }, [modelRecommendation?.recommended?.modelId]);

  const efficientModelId = useMemo(() => {
    const modelId = modelRecommendation?.alsoConsider?.modelId;
    return modelId ? normalizeModelIdForSelection(modelId) : undefined;
  }, [modelRecommendation?.alsoConsider?.modelId]);

  const renderModelOptions = useMemo(
    () => VIDEO_RENDER_MODELS.map((model) => ({ id: model.id, label: model.label })),
    []
  );

  const renderModelId = useMemo(() => {
    if (selectedModel && VIDEO_RENDER_MODELS.some((model) => model.id === selectedModel)) {
      return selectedModel;
    }
    return VIDEO_RENDER_MODELS[0]?.id ?? '';
  }, [selectedModel]);

  const recommendationAgeMs = useMemo(() => {
    const computedAt = modelRecommendation?.computedAt;
    if (!computedAt || typeof computedAt !== 'string') return null;
    const timestamp = Date.parse(computedAt);
    if (!Number.isFinite(timestamp)) return null;
    return Date.now() - timestamp;
  }, [modelRecommendation?.computedAt]);

  const capabilitiesModelId = useMemo(() => {
    if (activeTab === 'video') {
      return tier === 'draft' ? VIDEO_DRAFT_MODEL.id : renderModelId;
    }
    return renderModelId;
  }, [activeTab, renderModelId, tier]);

  const { schema } = useCapabilities(capabilitiesModelId);
  const canOptimize = typeof onOptimize === 'function';
  const isOptimizing = Boolean(isProcessing || isRefining);

  const currentParams = useMemo<CapabilityValues>(
    () => ({
      aspect_ratio: aspectRatio,
      duration_s: duration,
    }),
    [aspectRatio, duration]
  );

  const aspectRatioInfo = useMemo(
    () => getFieldInfo(schema, currentParams, 'aspect_ratio'),
    [schema, currentParams]
  );

  const durationInfo = useMemo(
    () => getFieldInfo(schema, currentParams, 'duration_s'),
    [schema, currentParams]
  );

  const aspectRatioOptions = useMemo(
    () => resolveStringOptions(aspectRatioInfo?.allowedValues, DEFAULT_ASPECT_RATIOS),
    [aspectRatioInfo?.allowedValues]
  );

  const durationOptions = useMemo(
    () => resolveNumberOptions(durationInfo?.allowedValues, DEFAULT_DURATIONS),
    [durationInfo?.allowedValues]
  );

  useEffect(() => {
    if (!showMotionControls) return;
    if (activeTab === 'video') return;
    log.debug('Forcing video tab because motion controls are enabled', {
      previousTab: activeTab,
      primaryKeyframeUrlHost,
    });
    setActiveTab('video');
  }, [showMotionControls, activeTab, primaryKeyframeUrlHost]);

  useEffect(() => {
    if (keyframes[0]) return;
    if (!showCameraMotionModal) return;
    log.info('Closing camera motion modal because primary keyframe is missing', {
      keyframesCount: keyframes.length,
    });
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
    isEnabled: Boolean(onPromptChange) && !isOptimizing && (!showResults || isEditing),
    onSelect: (asset, range) => {
      onInsertTrigger?.(asset.trigger, range);
    },
  });

  const handleFile = useCallback(
    async (file: File) => {
      if (isUploadDisabled || !onImageUpload) return;
      const result = onImageUpload(file);
      if (result && typeof (result as Promise<void>).then === 'function') {
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

  const handleCameraMotionButtonClick = useCallback(() => {
    if (!hasPrimaryKeyframe) {
      log.warn('Camera motion modal requested without a primary keyframe', {
        showMotionControls,
        keyframesCount: keyframes.length,
      });
      return;
    }

    log.info('Opening camera motion modal from generation controls panel', {
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
    log.info('Camera motion modal closed from generation controls panel', {
      primaryKeyframeUrlHost,
      currentCameraMotionId: cameraMotion?.id ?? null,
    });
    setShowCameraMotionModal(false);
  }, [cameraMotion?.id, primaryKeyframeUrlHost]);

  const handleSelectCameraMotion = useCallback(
    (path: CameraPath) => {
      log.info('Camera motion selected from modal in generation controls panel', {
        cameraMotionId: path.id,
        cameraMotionLabel: path.label,
        primaryKeyframeUrlHost,
      });
      onCameraMotionChange?.(path);
      setShowCameraMotionModal(false);
    },
    [onCameraMotionChange, primaryKeyframeUrlHost]
  );

  const handleInputPromptChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>): void => {
      if (!onPromptChange) return;
      const updatedPrompt = sanitizeText(event.target.value);
      onPromptChange(updatedPrompt);
    },
    [onPromptChange]
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
  }, [canOptimize, isOptimizing, prompt, resolvedPromptInputRef, selectedModel]);

  const handleCancelEdit = useCallback((): void => {
    if (!canOptimize) return;
    onPromptChange?.(originalInputPrompt);
    if (originalSelectedModel !== undefined) {
      onModelChange(originalSelectedModel);
    }
    setIsEditing(false);
    setOriginalInputPrompt('');
    setOriginalSelectedModel(undefined);
  }, [canOptimize, onModelChange, onPromptChange, originalInputPrompt, originalSelectedModel]);

  const handleUpdate = useCallback((): void => {
    if (!canOptimize || isOptimizing || !onOptimize) {
      return;
    }
    const promptChanged = prompt !== originalInputPrompt;
    const modelChanged =
      typeof originalSelectedModel === 'string' &&
      originalSelectedModel !== selectedModel;
    const genericPrompt =
      typeof genericOptimizedPrompt === 'string' &&
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

    setIsEditing(false);
    setOriginalInputPrompt('');
    setOriginalSelectedModel(undefined);
  }, [
    canOptimize,
    genericOptimizedPrompt,
    isOptimizing,
    onOptimize,
    originalInputPrompt,
    originalSelectedModel,
    prompt,
    selectedModel,
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
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
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
    ]
  );

  const handleCopy = useCallback(async () => {
    if (!prompt.trim()) return;
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // ignore
    }
  }, [prompt]);

  const hasPrompt = Boolean(trimmedPrompt);
  const isImageGenerateDisabled = activeTab === 'image' && keyframes.length === 0;
  const isVideoGenerateDisabled = activeTab === 'video' && !hasPrompt && keyframes.length === 0;
  const isStoryboardDisabled = !hasPrompt && keyframes.length === 0;
  const isInputLocked = (canOptimize && showResults && !isEditing) || isOptimizing;
  const isOptimizeDisabled = !hasPrompt || isOptimizing;
  const isGenerateDisabled =
    (tier === 'draft' ? isDraftDisabled : isRenderDisabled) ||
    isImageGenerateDisabled ||
    isVideoGenerateDisabled;

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
    },
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
    },
  };
};
