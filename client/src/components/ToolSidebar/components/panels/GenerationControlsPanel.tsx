import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  Copy,
  Folder,
  GraduationCap,
  Highlighter,
  Image,
  Images,
  Info,
  Palette,
  Plus,
  ScanEye,
  Settings2,
  Trash2,
  Upload,
  Video,
  Wand2,
} from 'lucide-react';
import { cn } from '@utils/cn';
import { resolveFieldState } from '@shared/capabilities';
import { useCapabilities } from '@features/prompt-optimizer/hooks/useCapabilities';
import { CameraMotionModal } from '@/components/modals/CameraMotionModal';
import type { CameraPath } from '@/features/convergence/types';
import { logger } from '@/services/LoggingService';
import { VIDEO_DRAFT_MODEL, VIDEO_RENDER_MODELS } from '../../config/modelConfig';
import type { DraftModel, KeyframeTile, VideoTier } from '../../types';

const DEFAULT_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:5'];
const DEFAULT_DURATIONS = [5, 10, 15];
const log = logger.child('GenerationControlsPanel');

const safeUrlHost = (url: unknown): string | null => {
  if (typeof url !== 'string' || url.trim().length === 0) {
    return null;
  }
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

interface GenerationControlsPanelProps {
  prompt: string;
  onPromptChange?: (prompt: string) => void;
  aspectRatio: string;
  duration: number;
  selectedModel: string;
  onModelChange: (model: string) => void;
  onAspectRatioChange: (ratio: string) => void;
  onDurationChange: (duration: number) => void;
  onDraft: (model: DraftModel) => void;
  onRender: (model: string) => void;
  isDraftDisabled: boolean;
  isRenderDisabled: boolean;
  onBack?: () => void;
  onImageUpload?: (file: File) => void | Promise<void>;
  keyframes: KeyframeTile[];
  onAddKeyframe: (tile: Omit<KeyframeTile, 'id'>) => void;
  onRemoveKeyframe: (id: string) => void;
  onClearKeyframes?: () => void;
  tier: VideoTier;
  onTierChange: (tier: VideoTier) => void;
  onStoryboard: () => void;
  activeDraftModel?: string | null;
  showMotionControls?: boolean;
  cameraMotion?: CameraPath | null;
  onCameraMotionChange?: (cameraPath: CameraPath | null) => void;
  subjectMotion?: string;
  onSubjectMotionChange?: (motion: string) => void;
}

export function GenerationControlsPanel({
  prompt,
  onPromptChange,
  aspectRatio,
  duration,
  selectedModel,
  onModelChange,
  onAspectRatioChange,
  onDurationChange,
  onDraft,
  onRender,
  isDraftDisabled,
  isRenderDisabled,
  onBack,
  onImageUpload,
  keyframes,
  onAddKeyframe: _onAddKeyframe,
  onRemoveKeyframe,
  onClearKeyframes: _onClearKeyframes,
  tier,
  onTierChange,
  onStoryboard,
  activeDraftModel: _activeDraftModel,
  showMotionControls = false,
  cameraMotion = null,
  onCameraMotionChange,
  subjectMotion = '',
  onSubjectMotionChange,
}: GenerationControlsPanelProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const promptEditorRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'video' | 'image'>('video');
  const [imageSubTab, setImageSubTab] = useState<'references' | 'styles'>('references');
  const [showCameraMotionModal, setShowCameraMotionModal] = useState(false);
  const subjectMotionLogBucketRef = useRef(0);
  const keyframeSlots = useMemo(
    () => Array.from({ length: 3 }, (_, index) => keyframes[index] ?? null),
    [keyframes]
  );
  const isKeyframeLimitReached = keyframes.length >= 3;
  const isUploadDisabled = !onImageUpload || isUploading || isKeyframeLimitReached;
  const hasPrimaryKeyframe = Boolean(keyframes[0]);
  const primaryKeyframeUrlHost = safeUrlHost(keyframes[0]?.url);

  const renderModelId = useMemo(() => {
    if (selectedModel && VIDEO_RENDER_MODELS.some((model) => model.id === selectedModel)) {
      return selectedModel;
    }
    return VIDEO_RENDER_MODELS[0]?.id ?? '';
  }, [selectedModel]);

  const capabilitiesModelId = useMemo(() => {
    if (activeTab === 'video') {
      return tier === 'draft' ? VIDEO_DRAFT_MODEL.id : renderModelId;
    }
    return renderModelId;
  }, [activeTab, renderModelId, tier]);

  const { schema } = useCapabilities(capabilitiesModelId);

  const currentParams = useMemo(
    () => ({
      aspect_ratio: aspectRatio,
      duration_s: duration,
    }),
    [aspectRatio, duration]
  );

  const getFieldInfo = useCallback(
    (fieldName: string) => {
      if (!schema?.fields?.[fieldName]) return null;
      const field = schema.fields[fieldName];
      if (!field) return null;
      const state = resolveFieldState(field, currentParams);
      if (!state.available) return null;
      const allowedValues =
        field.type === 'enum'
          ? (state.allowedValues ?? field.values ?? [])
          : [];
      return { field, state, allowedValues };
    },
    [schema, currentParams]
  );

  const aspectRatioInfo = useMemo(
    () => getFieldInfo('aspect_ratio'),
    [getFieldInfo]
  );
  const durationInfo = useMemo(
    () => getFieldInfo('duration_s'),
    [getFieldInfo]
  );

  const aspectRatioOptions = useMemo(() => {
    const values = aspectRatioInfo?.allowedValues ?? DEFAULT_ASPECT_RATIOS;
    return values.map((value) => String(value));
  }, [aspectRatioInfo?.allowedValues]);

  const durationOptions = useMemo(() => {
    const values = durationInfo?.allowedValues ?? DEFAULT_DURATIONS;
    return values.map((value) => Number(value));
  }, [durationInfo?.allowedValues]);

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
    const editor = promptEditorRef.current;
    if (!editor) return;
    const isFocused = typeof document !== 'undefined' && document.activeElement === editor;
    if (isFocused) return;
    if ((editor.textContent ?? '') !== prompt) {
      editor.textContent = prompt;
    }
  }, [prompt]);

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

  const handleSubjectMotionChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = event.target.value;
      const previousLength = subjectMotion.trim().length;
      const nextLength = nextValue.trim().length;
      const nextBucket = Math.floor(nextLength / 20);
      const bucketChanged = nextBucket !== subjectMotionLogBucketRef.current;
      const becameEmpty = previousLength > 0 && nextLength === 0;
      const becameNonEmpty = previousLength === 0 && nextLength > 0;

      if (bucketChanged || becameEmpty || becameNonEmpty) {
        subjectMotionLogBucketRef.current = nextBucket;
        log.debug('Subject motion input changed in generation controls panel', {
          previousLength,
          nextLength,
          keyframesCount: keyframes.length,
          primaryKeyframeUrlHost,
        });
      }

      onSubjectMotionChange?.(nextValue);
    },
    [subjectMotion, keyframes.length, primaryKeyframeUrlHost, onSubjectMotionChange]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      if (isUploadDisabled) return;

      const file = event.dataTransfer.files?.[0];
      if (file) {
        void handleFile(file);
      }
    },
    [handleFile, isUploadDisabled]
  );

  const handlePromptInput = useCallback(() => {
    if (!onPromptChange) return;
    const next = promptEditorRef.current?.textContent ?? '';
    onPromptChange(next);
  }, [onPromptChange]);

  const handleCopy = useCallback(async () => {
    if (!prompt.trim()) return;
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      // ignore
    }
  }, [prompt]);

  const isImageGenerateDisabled = activeTab === 'image' && keyframes.length === 0;
  const isVideoGenerateDisabled = activeTab === 'video' && !prompt.trim();
  const isStoryboardDisabled = !prompt.trim() && keyframes.length === 0;
  const isGenerateDisabled =
    (tier === 'draft' ? isDraftDisabled : isRenderDisabled) ||
    isImageGenerateDisabled ||
    isVideoGenerateDisabled;

  const generationFooter = (
    <footer className="h-[73px] px-4 py-3 flex items-center justify-between border-t border-[#29292D]">
      <div className="flex items-center gap-2">
        {tier === 'draft' ? (
          <div className="h-10 rounded-lg px-3 bg-[#1E1F25] border border-[#29292D] text-[#A1AFC5] text-sm font-semibold flex items-center gap-2">
            <span>{VIDEO_DRAFT_MODEL.label}</span>
          </div>
        ) : (
          <select
            className="h-10 px-3 rounded-lg bg-[#1E1F25] border border-[#29292D] text-[#A1AFC5] text-sm font-semibold"
            value={renderModelId}
            onChange={(event) => onModelChange(event.target.value)}
            aria-label="Render model"
          >
            {VIDEO_RENDER_MODELS.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="w-7 h-7 rounded-md flex items-center justify-center text-[#A1AFC5] hover:bg-[#1B1E23]"
          aria-label="Info"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="h-10 px-3 rounded-lg border border-[#29292D] text-[#A1AFC5] text-sm font-semibold hover:bg-[#1B1E23] disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => onStoryboard()}
          disabled={isStoryboardDisabled}
        >
          <span className="flex items-center gap-1">
            <Images className="w-4 h-4" />
            Storyboard
          </span>
        </button>
        <button
          type="button"
          className="h-8 px-[10px] py-[4px] bg-[#2C22FA] text-white rounded-[4px] font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => {
            if (tier === 'draft') {
              onDraft(VIDEO_DRAFT_MODEL.id as DraftModel);
              return;
            }
            onRender(renderModelId || selectedModel || 'sora-2');
          }}
          disabled={isGenerateDisabled}
        >
          Generate
        </button>
      </div>
    </footer>
  );

  return (
    <div className="flex h-full flex-col">
      <header className="h-12 px-4 flex items-center gap-2">
        <button
          type="button"
          className="w-7 h-7 -ml-1 rounded-md flex items-center justify-center text-[#A1AFC5] hover:bg-[#1B1E23]"
          onClick={onBack}
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('video')}
            className={cn(
              'h-8 px-[14px] py-[6px] rounded-2xl text-sm font-medium tracking-[0.14px] flex items-center gap-1.5',
              activeTab === 'video'
                ? 'bg-white text-[#1A1A1A] font-bold'
                : 'text-[#A1AFC5] hover:bg-[#1B1E23]'
            )}
          >
            <Video className="w-4 h-4" />
            Video
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('image')}
            className={cn(
              'h-8 px-[14px] py-[6px] rounded-2xl text-sm font-medium tracking-[0.14px] flex items-center gap-1.5',
              activeTab === 'image'
                ? 'bg-white text-[#1A1A1A] font-bold'
                : 'text-[#A1AFC5] hover:bg-[#1B1E23]'
            )}
          >
            <Image className="w-4 h-4" />
            Image
          </button>
        </div>
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleFile(file);
          }
          event.target.value = '';
        }}
        disabled={isUploadDisabled}
      />

      {activeTab === 'video' ? (
        <>
          <div className="px-3 pt-3 flex gap-1">
            <button
              type="button"
              onClick={() => onTierChange('draft')}
              className={cn(
                'h-8 px-[14px] py-[6px] rounded-2xl text-sm font-medium tracking-[0.14px] flex items-center gap-1.5',
                tier === 'draft'
                  ? 'bg-white text-[#1A1A1A] font-bold'
                  : 'text-[#A1AFC5] hover:bg-[#1B1E23]'
              )}
            >
              Draft
            </button>
            <button
              type="button"
              onClick={() => onTierChange('render')}
              className={cn(
                'h-8 px-[14px] py-[6px] rounded-2xl text-sm font-medium tracking-[0.14px] flex items-center gap-1.5',
                tier === 'render'
                  ? 'bg-white text-[#1A1A1A] font-bold'
                  : 'text-[#A1AFC5] hover:bg-[#1B1E23]'
              )}
            >
              Render
            </button>
          </div>

          <div className="h-[74px] px-3 pt-3 flex gap-1.5">
            {keyframeSlots.map((tile, index) => {
              const isEmpty = !tile;
              const canUpload = isEmpty && !isUploadDisabled;
              return (
                <div
                  key={tile?.id ?? `keyframe-slot-${index}`}
                  className="relative w-[110px] h-[62px]"
                >
                  <button
                    type="button"
                    className={cn(
                      'w-full h-full rounded-lg bg-[#1B1E23] shadow-[inset_0_0_0_1px_#2C3037]',
                      'flex items-center justify-center overflow-hidden',
                      isEmpty && 'cursor-pointer',
                      isEmpty && !canUpload && 'opacity-60 cursor-not-allowed',
                      isDragging && canUpload && 'shadow-[inset_0_0_0_1px_#B3AFFD]'
                    )}
                    onClick={() => {
                      if (!canUpload) return;
                      inputRef.current?.click();
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (canUpload) {
                        setIsDragging(true);
                      }
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setIsDragging(false);
                    }}
                    onDrop={handleDrop}
                    aria-disabled={!canUpload}
                  >
                    {tile ? (
                      <img
                        src={tile.url}
                        alt={`Keyframe ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <Plus className="w-4 h-4 text-white" />
                    )}
                  </button>

                  {tile && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveKeyframe?.(tile.id);
                      }}
                      className="absolute right-1 top-1 rounded-md bg-[#1B1E23] px-2 py-1 text-[11px] text-[#A1AFC5] shadow-[inset_0_0_0_1px_#2C3037]"
                    >
                      Clear
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {showMotionControls && (
            <div className="px-3 pt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#7C839C] mb-1.5">
                  Camera Motion
                </label>
                <button
                  type="button"
                  onClick={handleCameraMotionButtonClick}
                  disabled={!hasPrimaryKeyframe}
                  aria-disabled={!hasPrimaryKeyframe}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm text-left transition-colors',
                    'border',
                    hasPrimaryKeyframe
                      ? 'bg-[#1B1E23] hover:bg-[#1E1F25] cursor-pointer'
                      : 'bg-[#16171B] text-[#5B6070] cursor-not-allowed opacity-80',
                    hasPrimaryKeyframe && (cameraMotion ? 'border-[#2C22FA]/50' : 'border-[#29292D]'),
                    !hasPrimaryKeyframe && 'border-[#29292D]'
                  )}
                >
                  {cameraMotion ? (
                    <span className="flex items-center gap-2">
                      <span className="text-[#2C22FA]">✓</span>
                      <span className="text-white">{cameraMotion.label}</span>
                    </span>
                  ) : (
                    <span className="text-[#7C839C]">Set camera motion...</span>
                  )}
                </button>
                {!hasPrimaryKeyframe && (
                  <p className="mt-1 text-xs text-[#7C839C]/80">
                    Upload a keyframe to enable camera motion.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#7C839C] mb-1.5">
                  Subject Motion <span className="text-[#7C839C]/60">(optional)</span>
                </label>
                <textarea
                  value={subjectMotion}
                  onChange={handleSubjectMotionChange}
                  placeholder="Describe how your subject moves..."
                  rows={2}
                  className={cn(
                    'w-full px-3 py-2 rounded-lg text-sm resize-none',
                    'bg-[#1B1E23] border border-[#29292D]',
                    'placeholder:text-[#7C839C]/60 text-white',
                    'focus:outline-none focus:ring-2 focus:ring-[#2C22FA]/50 focus:border-[#2C22FA]'
                  )}
                />
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto px-3">
            <div className="relative border border-[#29292D] rounded-lg">
              <div
                ref={promptEditorRef}
                className={cn(
                  'min-h-[180px] p-3',
                  'text-white text-sm leading-6 whitespace-pre-wrap',
                  'outline-none',
                  !onPromptChange && 'opacity-80'
                )}
                role="textbox"
                contentEditable={Boolean(onPromptChange)}
                suppressContentEditableWarning
                aria-label="Text Prompt Input"
                onInput={handlePromptInput}
                onPaste={(event) => {
                  if (!onPromptChange) return;
                  event.preventDefault();
                  const text = event.clipboardData.getData('text/plain');
                  document.execCommand('insertText', false, text);
                }}
              />

              {Boolean(onPromptChange) && !prompt.trim() && (
                <span
                  className="pointer-events-none absolute top-3 left-3 text-sm font-medium leading-6 text-[#7C839C]"
                  aria-hidden="true"
                >
                  Describe your shot...
                </span>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-2" role="tablist" aria-orientation="horizontal">
                <button
                  type="button"
                  onClick={() => setImageSubTab('references')}
                  className={cn(
                    'flex items-center justify-center gap-1.5 h-8 px-2 rounded-md',
                    'text-sm font-semibold leading-5 cursor-pointer',
                    imageSubTab === 'references'
                      ? 'bg-[#2C3037] border border-[#2C3037] text-white'
                      : 'bg-transparent border border-[#2C3037] text-[#A1AFC5]'
                  )}
                  role="tab"
                  aria-selected={imageSubTab === 'references'}
                >
                  <Images className="w-4 h-4" />
                  <span className="px-0.5">References</span>
                </button>

                <button
                  type="button"
                  onClick={() => setImageSubTab('styles')}
                  className={cn(
                    'flex items-center justify-center gap-1.5 h-8 px-2 rounded-md',
                    'text-sm font-semibold leading-5 cursor-pointer',
                    imageSubTab === 'styles'
                      ? 'bg-[#2C3037] border border-[#2C3037] text-white'
                      : 'bg-transparent border border-[#2C3037] text-[#A1AFC5]'
                  )}
                  role="tab"
                  aria-selected={imageSubTab === 'styles'}
                >
                  <Palette className="w-4 h-4" />
                  <span className="px-0.5">Styles</span>
                </button>
              </div>
            </div>

            <div className="mt-3 rounded-md" role="tabpanel">
              <div className="relative flex flex-col rounded-md overflow-hidden">
                <div className="flex flex-col items-center justify-center gap-6 px-4 pb-4 bg-[#1B1E23] rounded-md text-center min-h-[310px]">
                  <div className="relative w-[280px] h-[120px] flex items-center justify-center">
                    <img
                      className="absolute w-[160px] h-[90px] rounded-sm shadow-[0_4px_8px_rgba(0,0,0,0.3)] overflow-clip top-[15px] left-[60px] translate-y-2"
                      src="https://d3phaj0sisr2ct.cloudfront.net/app/gen4/ref-onboarding-center.jpeg"
                      width="160"
                      height="90"
                      alt=""
                    />
                    <img
                      className="absolute w-[71px] h-[40px] rounded-sm shadow-[0_4px_8px_rgba(0,0,0,0.3)] overflow-clip top-10 left-1/2 -translate-x-24 translate-y-5"
                      src="https://d3phaj0sisr2ct.cloudfront.net/app/gen4/ref-onboarding-left.jpeg"
                      width="71"
                      height="40"
                      alt=""
                    />
                    <img
                      className="absolute w-[71px] h-[40px] rounded-sm shadow-[0_4px_8px_rgba(0,0,0,0.3)] overflow-clip top-10 left-1/2 translate-x-[84px] -translate-y-7"
                      src="https://d3phaj0sisr2ct.cloudfront.net/app/gen4/ref-onboarding-right.jpeg"
                      width="71"
                      height="40"
                      alt=""
                    />
                  </div>

                  <div className="flex flex-col items-center w-[336px]">
                    <div>
                      <h2 className="text-base font-semibold text-white leading-6 text-center mb-0">
                        Create consistent scenes with References
                      </h2>
                      <p className="text-sm font-normal text-[#A0AEC0] leading-5 text-center mt-0">
                        Use 1-3 character or location images to build your scene. Place characters in new settings or generate new angles.
                        <br />
                        <a
                          className="font-medium underline cursor-pointer text-[#A0AEC0]"
                          href="https://help.runwayml.com/hc/en-us/articles/40042718905875"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Learn more
                        </a>
                        .
                      </p>
                    </div>

                    <div className="flex justify-center gap-2 pt-4">
                      <button
                        type="button"
                        className="flex items-center justify-center gap-2 h-8 px-3 bg-transparent border border-[#2C3037] rounded-md text-[#A1AFC5] text-sm font-semibold tracking-[0.14px] leading-5 cursor-pointer overflow-hidden hover:bg-[#1B1E23]"
                      >
                        <Folder className="w-3.5 h-3.5" />
                        Assets
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isUploadDisabled) {
                            inputRef.current?.click();
                          }
                        }}
                        disabled={isUploadDisabled}
                        className="flex items-center justify-center gap-2 h-8 px-3 bg-white rounded-md text-black text-sm font-semibold tracking-[0.14px] leading-5 cursor-pointer overflow-hidden hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden px-4 pt-3">
          {/* Text Editor Panel (Runway-style) */}
          <div className="flex flex-col overflow-hidden">
            <div className="flex flex-col flex-1 min-h-0 relative border border-[#29292D] rounded-lg overflow-auto">
              {/* Image Slot Row */}
              <div className="flex gap-1.5 pt-3 px-3" data-layout-mode="single-row">
                {keyframeSlots.map((tile, index) => {
                  const isEmpty = !tile;
                  const canUpload = isEmpty && !isUploadDisabled;
                  return (
                    <div
                      key={tile?.id ?? `reference-slot-${index}`}
                      className="relative block min-w-[62px] w-[110px] h-[62px] group"
                    >
                      <button
                        type="button"
                        className={cn(
                          'w-full h-full flex items-center justify-center',
                          'bg-[#1B1E23] rounded-lg shadow-[inset_0_0_0_1px_#2C3037]',
                          'overflow-hidden',
                          isEmpty && 'cursor-pointer',
                          isEmpty && !canUpload && 'opacity-60 cursor-not-allowed'
                        )}
                        onClick={() => {
                          if (!canUpload) return;
                          inputRef.current?.click();
                        }}
                        aria-label="Add an image reference"
                        aria-disabled={!canUpload}
                      >
                        {tile ? (
                          <img
                            src={tile.url}
                            alt={`Reference ${index + 1}`}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Plus className="w-4 h-4 text-white" />
                        )}
                      </button>

                      {tile ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemoveKeyframe?.(tile.id);
                          }}
                          className="absolute right-1 top-1 rounded-md bg-[#1B1E23] px-2 py-1 text-[11px] text-[#A1AFC5] shadow-[inset_0_0_0_1px_#2C3037]"
                        >
                          Clear
                        </button>
                      ) : (
                        <div className="absolute inset-0 hidden items-center justify-center gap-2 bg-[#1B1E23] rounded-lg shadow-[inset_0_0_0_1px_#2C3037] group-hover:flex">
                          <button
                            type="button"
                            className="w-6 h-6 flex items-center justify-center bg-transparent border border-[#2C3037] rounded text-[#A1AFC5] cursor-pointer hover:bg-[#12131A]"
                            aria-label="Sketch your scene"
                            onClick={() => {
                              // placeholder for future sketch flow
                            }}
                            disabled={!canUpload}
                          >
                            <Highlighter className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className="w-6 h-6 flex items-center justify-center bg-white rounded text-black cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Add an image reference"
                            onClick={() => {
                              if (!canUpload) return;
                              inputRef.current?.click();
                            }}
                            disabled={!canUpload}
                          >
                            <Upload className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Text Editor */}
              <div className="relative flex flex-col min-h-[128px] rounded-lg overflow-hidden">
                <div
                  ref={promptEditorRef}
                  className={cn(
                    'flex-1 p-3 bg-transparent text-white text-base leading-6',
                    'overflow-y-auto whitespace-pre-wrap break-words',
                    'outline-none',
                    !onPromptChange && 'opacity-80'
                  )}
                  contentEditable={Boolean(onPromptChange)}
                  suppressContentEditableWarning
                  role="textbox"
                  aria-label="Text Prompt Input"
                  spellCheck
                  onInput={handlePromptInput}
                  onPaste={(event) => {
                    if (!onPromptChange) return;
                    event.preventDefault();
                    const text = event.clipboardData.getData('text/plain');
                    document.execCommand('insertText', false, text);
                  }}
                />

                {/* Placeholder */}
                {Boolean(onPromptChange) && !prompt.trim() && (
                  <span className="absolute top-3 left-3 text-base leading-6 text-[#7C839C]">
                    Describe your shot,{' '}
                    <button
                      type="button"
                      className="text-[#A1AFC5] underline cursor-pointer bg-transparent border-0 p-0"
                      onClick={() => {
                        setImageSubTab('references');
                      }}
                    >
                      add image references
                    </button>
                    , or{' '}
                    <button
                      type="button"
                      className="text-[#A1AFC5] underline cursor-pointer bg-transparent border-0 p-0"
                      onClick={() => {
                        // placeholder for future sketch flow
                      }}
                    >
                      sketch a scene
                    </button>
                    .{' '}
                  </span>
                )}

                {/* Toolbar */}
                <div className="flex items-center justify-between gap-2 p-3 min-h-[40px]">
                  <div className="flex items-center gap-1 flex-1">
                    <button
                      type="button"
                      aria-label="Copy text"
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[#A0AEC0] hover:bg-[#1B1E23]"
                      onClick={() => void handleCopy()}
                      disabled={!prompt.trim()}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Clear text"
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[#A0AEC0] hover:bg-[#1B1E23]"
                      onClick={() => onPromptChange?.('')}
                      disabled={!onPromptChange || !prompt.trim()}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="View guide"
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[#A0AEC0] hover:bg-[#1B1E23]"
                      onClick={() => {
                        window.open('https://help.runwayml.com/hc/en-us/articles/40042718905875', '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <GraduationCap className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Generate prompt from image"
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[#A0AEC0] hover:bg-[#1B1E23]"
                      onClick={() => {
                        // placeholder for future "generate from image" flow
                      }}
                    >
                      <ScanEye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Header */}
          <div className="flex items-center justify-between">
            {/* Tab List */}
            <div className="flex gap-2" role="tablist" aria-orientation="horizontal">
              {/* References Tab */}
              <button
                type="button"
                onClick={() => setImageSubTab('references')}
                className={cn(
                  'flex items-center justify-center gap-1.5 h-8 px-2 rounded-md',
                  'text-sm font-semibold leading-5 cursor-pointer',
                  imageSubTab === 'references'
                    ? 'bg-[#2C3037] border border-[#2C3037] text-white'
                    : 'bg-transparent border border-[#2C3037] text-[#A1AFC5]'
                )}
                role="tab"
                aria-selected={imageSubTab === 'references'}
              >
                <Images className="w-4 h-4" />
                <span className="px-0.5">References</span>
              </button>

              {/* Styles Tab */}
              <button
                type="button"
                onClick={() => setImageSubTab('styles')}
                className={cn(
                  'flex items-center justify-center gap-1.5 h-8 px-2 rounded-md',
                  'text-sm font-semibold leading-5 cursor-pointer',
                  imageSubTab === 'styles'
                    ? 'bg-[#2C3037] border border-[#2C3037] text-white'
                    : 'bg-transparent border border-[#2C3037] text-[#A1AFC5]'
                )}
                role="tab"
                aria-selected={imageSubTab === 'styles'}
              >
                <Palette className="w-4 h-4" />
                <span className="px-0.5">Styles</span>
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              className="flex items-center justify-center w-7 h-7 bg-transparent border border-[#2C3037] rounded-md text-[#A1AFC5] cursor-pointer overflow-hidden hover:bg-[#1B1E23]"
              aria-label="Close Panel"
              onClick={onBack}
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Panel */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col" role="tabpanel">
            <div className="flex-1 min-h-0 overflow-hidden">
              <div className="rounded-md h-full">
                <div className="relative flex flex-col flex-1 min-h-0 rounded-md overflow-hidden h-full">
                  {/* Body */}
                  <div className="flex flex-col items-center justify-center flex-1 gap-6 px-4 pb-4 bg-[#1B1E23] rounded-md text-center min-h-[310px]">
                    {/* Image Stack */}
                    <div className="relative w-[280px] h-[120px] flex items-center justify-center">
                      {/* Center Image */}
                      <img
                        className="absolute w-[160px] h-[90px] rounded-sm shadow-[0_4px_8px_rgba(0,0,0,0.3)] overflow-clip top-[15px] left-[60px] translate-y-2"
                        src="https://d3phaj0sisr2ct.cloudfront.net/app/gen4/ref-onboarding-center.jpeg"
                        width="160"
                        height="90"
                        alt=""
                      />
                      {/* Left Image */}
                      <img
                        className="absolute w-[71px] h-[40px] rounded-sm shadow-[0_4px_8px_rgba(0,0,0,0.3)] overflow-clip top-10 left-1/2 -translate-x-24 translate-y-5"
                        src="https://d3phaj0sisr2ct.cloudfront.net/app/gen4/ref-onboarding-left.jpeg"
                        width="71"
                        height="40"
                        alt=""
                      />
                      {/* Right Image */}
                      <img
                        className="absolute w-[71px] h-[40px] rounded-sm shadow-[0_4px_8px_rgba(0,0,0,0.3)] overflow-clip top-10 left-1/2 translate-x-[84px] -translate-y-7"
                        src="https://d3phaj0sisr2ct.cloudfront.net/app/gen4/ref-onboarding-right.jpeg"
                        width="71"
                        height="40"
                        alt=""
                      />
                    </div>

                    {/* Text Content */}
                    <div className="flex flex-col items-center w-[336px]">
                      <div>
                        {/* Title */}
                        <h2 className="text-base font-semibold text-white leading-6 text-center mb-0">
                          Create consistent scenes with References
                        </h2>
                        {/* Description */}
                        <p className="text-sm font-normal text-[#A0AEC0] leading-5 text-center mt-0">
                          Use 1-3 character or location images to build your scene. Place characters in new settings or generate new angles.
                          <br />
                          <a
                            className="font-medium underline cursor-pointer text-[#A0AEC0]"
                            href="https://help.runwayml.com/hc/en-us/articles/40042718905875"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Learn more
                          </a>
                          .
                        </p>
                      </div>

                      {/* Button Group */}
                      <div className="flex justify-center gap-2 pt-4">
                        {/* Assets Button (Outline) */}
                        <button
                          type="button"
                          className="flex items-center justify-center gap-2 h-8 px-3 bg-transparent border border-[#2C3037] rounded-md text-[#A1AFC5] text-sm font-semibold tracking-[0.14px] leading-5 cursor-pointer overflow-hidden hover:bg-[#1B1E23]"
                        >
                          <Folder className="w-3.5 h-3.5" />
                          Assets
                        </button>
                        {/* Upload Button (Primary White) */}
                        <button
                          type="button"
                          onClick={() => {
                            if (!isUploadDisabled) {
                              inputRef.current?.click();
                            }
                          }}
                          disabled={isUploadDisabled}
                          className="flex items-center justify-center gap-2 h-8 px-3 bg-white rounded-md text-black text-sm font-semibold tracking-[0.14px] leading-5 cursor-pointer overflow-hidden hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Upload
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {generationFooter}
          </div>
        </div>
      )}

      {activeTab === 'video' && (
        <>
          <div className="h-12 flex items-center justify-between px-3 py-3 min-h-[40px] gap-2">
            <div className="flex items-center gap-1 flex-1">
              <button
                type="button"
                aria-label="Copy text"
                className="w-6 h-6 rounded-md flex items-center justify-center text-[#A0AEC0] hover:bg-[#1B1E23]"
                onClick={() => void handleCopy()}
                disabled={!prompt.trim()}
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Clear text"
                className="w-6 h-6 rounded-md flex items-center justify-center text-[#A0AEC0] hover:bg-[#1B1E23]"
                onClick={() => onPromptChange?.('')}
                disabled={!onPromptChange || !prompt.trim()}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="View guide"
                className="w-6 h-6 rounded-md flex items-center justify-center text-[#A0AEC0] hover:bg-[#1B1E23] opacity-60 cursor-not-allowed"
                disabled
              >
                <BookOpen className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Generate prompt"
                className="w-6 h-6 rounded-md flex items-center justify-center text-[#A0AEC0] hover:bg-[#1B1E23] opacity-60 cursor-not-allowed"
                disabled
              >
                <Wand2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="h-[52px] px-4 py-3 flex items-center justify-between">
            <div className="flex gap-1" />

            <div className="flex gap-1">
              <button
                type="button"
                className="w-[37px] h-7 px-2 rounded-md bg-[#1E1F25] border border-[#29292D] text-[#A1AFC5] text-sm"
                disabled
              >
                1
              </button>
              <select
                className="h-7 px-2 rounded-md bg-[#1E1F25] border border-[#29292D] text-[#A1AFC5] text-sm"
                value={aspectRatio}
                onChange={(event) => onAspectRatioChange(event.target.value)}
                disabled={aspectRatioInfo?.state.disabled}
                aria-label="Aspect ratio"
              >
                {aspectRatioOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <select
                className="h-7 px-2 rounded-md bg-[#1E1F25] border border-[#29292D] text-[#A1AFC5] text-sm"
                value={duration}
                onChange={(event) => onDurationChange(Number(event.target.value))}
                disabled={durationInfo?.state.disabled}
                aria-label="Duration"
              >
                {durationOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}s
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="w-7 h-7 rounded-md bg-[#1E1F25] border border-[#29292D] flex items-center justify-center text-[#A1AFC5]"
                aria-label="Advanced settings"
                disabled
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {generationFooter}
        </>
      )}

      {showMotionControls && keyframes[0] && (
        <CameraMotionModal
          isOpen={showCameraMotionModal}
          onClose={() => {
            log.info('Camera motion modal closed from generation controls panel', {
              primaryKeyframeUrlHost,
              currentCameraMotionId: cameraMotion?.id ?? null,
            });
            setShowCameraMotionModal(false);
          }}
          imageUrl={keyframes[0].url}
          onSelect={(path) => {
            log.info('Camera motion selected from modal in generation controls panel', {
              cameraMotionId: path.id,
              cameraMotionLabel: path.label,
              primaryKeyframeUrlHost,
            });
            onCameraMotionChange?.(path);
            setShowCameraMotionModal(false);
          }}
          initialSelection={cameraMotion}
        />
      )}
    </div>
  );
}
