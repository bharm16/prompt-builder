import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Image, Upload, Video } from 'lucide-react';
import { cn } from '@utils/cn';
import { ModelSelectorDropdown } from '@features/prompt-optimizer/components/ModelSelectorDropdown';
import { SplitActionButton } from '@features/prompt-optimizer/GenerationsPanel/components/SplitActionButton';
import { DRAFT_MODELS, RENDER_MODELS } from '@features/prompt-optimizer/GenerationsPanel/config/generationConfig';
import { resolveFieldState } from '@shared/capabilities';
import { useCapabilities } from '@features/prompt-optimizer/hooks/useCapabilities';
import type { DraftModel, StartImage } from '../../types';

const I2V_SUPPORTED_MODELS = new Set([
  'sora-2',
  'sora-2-pro',
  'luma-ray3',
  'kling-v2-1-master',
  'wan-2.2',
]);

const DEFAULT_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:5'];
const DEFAULT_DURATIONS = [5, 10, 15];

interface GenerationControlsPanelProps {
  prompt: string;
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
  onImageUpload?: (file: File) => void | Promise<void>;
  startImage?: StartImage | null;
  onClearStartImage?: () => void;
  activeDraftModel?: string | null;
}

export function GenerationControlsPanel({
  prompt,
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
  onImageUpload,
  startImage,
  onClearStartImage,
  activeDraftModel,
}: GenerationControlsPanelProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [draftModel, setDraftModel] = useState<string>(activeDraftModel ?? 'flux-kontext');
  const [renderModel, setRenderModel] = useState<string>('sora');
  const isUploadDisabled = !onImageUpload || isUploading;

  const { schema } = useCapabilities(selectedModel);

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
    if (activeDraftModel) {
      setDraftModel(activeDraftModel);
    }
  }, [activeDraftModel]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!onImageUpload) return;
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
    [onImageUpload]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
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

  return (
    <div className="flex flex-col h-full">
      <div className="h-12 px-4 flex items-center gap-2">
        <button
          type="button"
          className="h-7 px-2 pl-1 bg-[#2F3237] rounded-md text-white text-sm font-medium flex items-center gap-1"
        >
          <Video className="w-4 h-4" />
          Video
        </button>
        <button
          type="button"
          className="h-7 px-2 pl-1 rounded-md text-[#A0AEC0] text-sm font-medium flex items-center gap-1"
          disabled
        >
          <Image className="w-4 h-4" />
          Image
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-4">
        <div
          className={cn(
            'w-full aspect-video rounded-md',
            'bg-black border border-dashed border-[#2F3237]',
            'flex flex-col items-center justify-center',
            isDragging && 'border-[#B3AFFD] bg-[#1B1E23]'
          )}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!isUploadDisabled) {
              setIsDragging(true);
            }
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={handleDrop}
          onClick={() => {
            if (isUploadDisabled) return;
            inputRef.current?.click();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              if (!isUploadDisabled) {
                inputRef.current?.click();
              }
            }
          }}
          aria-disabled={isUploadDisabled}
        >
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

          {startImage ? (
            <div className="relative w-full h-full">
              <img
                src={startImage.url}
                alt="Start frame"
                className="w-full h-full object-cover rounded-md"
              />
              {onClearStartImage && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onClearStartImage();
                  }}
                  className="absolute right-2 top-2 rounded-md bg-[#1B1E23] px-2 py-1 text-xs text-[#A1AFC5]"
                >
                  Clear
                </button>
              )}
            </div>
          ) : (
            <>
              <Upload className="w-8 h-8 text-[#B3AFFD]" />
              <p className="mt-3 text-white">
                {isUploading ? 'Uploading image...' : 'Drop an image or click to upload'}
              </p>
              <button
                type="button"
                className="mt-3 h-8 px-3 border border-[#2C3037] rounded-md text-[#A1AFC5] text-sm"
                disabled={isUploadDisabled}
              >
                Select
              </button>
            </>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A1AFC5]">
            Model
          </div>
          <ModelSelectorDropdown
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            variant="pillDark"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A1AFC5]">
              Aspect Ratio
            </div>
            <select
              className="h-9 px-3 rounded-md bg-[#1E1F25] border border-[#29292D] text-white text-sm"
              value={aspectRatio}
              onChange={(event) => onAspectRatioChange(event.target.value)}
              disabled={aspectRatioInfo?.state.disabled}
            >
              {aspectRatioOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A1AFC5]">
              Duration
            </div>
            <select
              className="h-9 px-3 rounded-md bg-[#1E1F25] border border-[#29292D] text-white text-sm"
              value={duration}
              onChange={(event) => onDurationChange(Number(event.target.value))}
              disabled={durationInfo?.state.disabled}
            >
              {durationOptions.map((value) => (
                <option key={value} value={value}>
                  {value}s
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-2 border-t border-[#29292D]">
        <SplitActionButton
          label="Draft"
          selectedModel={draftModel}
          models={DRAFT_MODELS}
          onRun={() => onDraft(draftModel as DraftModel)}
          onModelChange={setDraftModel}
          disabled={isDraftDisabled || !prompt.trim()}
          variant="default"
        />
        <SplitActionButton
          label="Render"
          selectedModel={renderModel}
          models={RENDER_MODELS}
          onRun={() => onRender(renderModel)}
          onModelChange={setRenderModel}
          disabled={isRenderDisabled || !prompt.trim()}
          variant="accent"
          renderItemSuffix={(id) =>
            I2V_SUPPORTED_MODELS.has(id) ? (
              <span className="ml-auto rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">
                i2v
              </span>
            ) : null
          }
        />
      </div>
    </div>
  );
}
