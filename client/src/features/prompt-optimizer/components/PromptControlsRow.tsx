import React, { useCallback, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@promptstudio/system/components/ui/select';
import { FilmSlate, Icon, Robot, Ruler, VideoCamera } from '@promptstudio/system/components/ui';
import { usePromptState } from '../context/PromptStateContext';
import { useCapabilities } from '../hooks/useCapabilities';
import { useModelRegistry } from '../hooks/useModelRegistry';
import { AI_MODEL_IDS, AI_MODEL_LABELS, AI_MODEL_PROVIDERS } from './constants';
import { resolveFieldState, type CapabilityValue } from '@shared/capabilities';
import { cn } from '@/utils/cn';

type PromptControlsRowProps = {
  className?: string;
  onModelChange?: (nextModel: string, previousModel: string | undefined) => void;
};

export function PromptControlsRow({
  className,
  onModelChange,
}: PromptControlsRowProps): React.ReactElement | null {
  const {
    selectedMode,
    selectedModel,
    setSelectedModel,
    generationParams,
    setGenerationParams,
    promptOptimizer,
  } = usePromptState();
  const showVideoPreview = selectedMode === 'video';
  const isOptimizing = Boolean(promptOptimizer.isProcessing || promptOptimizer.isRefining);
  const { schema } = useCapabilities(selectedModel);
  const { models: registryModels } = useModelRegistry();

  const modelOptions = useMemo(() => {
    if (registryModels.length) return registryModels;
    return [...AI_MODEL_IDS]
      .map((id) => ({
        id,
        label: AI_MODEL_LABELS[id],
        provider: AI_MODEL_PROVIDERS[id],
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [registryModels]);

  const getFieldInfo = useCallback(
    (fieldName: string) => {
      if (!schema?.fields?.[fieldName]) return null;

      const field = schema.fields[fieldName];
      const state = resolveFieldState(field, generationParams);

      if (!state.available || state.disabled) return null;

      const allowedValues = field.type === 'enum'
        ? state.allowedValues ?? field.values ?? []
        : [];

      return { field, allowedValues };
    },
    [schema, generationParams]
  );

  const aspectRatioInfo = useMemo(() => getFieldInfo('aspect_ratio'), [getFieldInfo]);
  const durationInfo = useMemo(() => getFieldInfo('duration_s'), [getFieldInfo]);
  const fpsInfo = useMemo(() => getFieldInfo('fps'), [getFieldInfo]);

  const handleParamChange = useCallback(
    (key: string, value: CapabilityValue) => {
      if (Object.is(generationParams?.[key], value)) {
        return;
      }
      setGenerationParams({
        ...(generationParams ?? {}),
        [key]: value,
      });
    },
    [generationParams, setGenerationParams]
  );

  const renderDropdown = useCallback(
    (
      info: ReturnType<typeof getFieldInfo>,
      key: string,
      ariaLabel: string,
      icon: React.ComponentProps<typeof Icon>['icon'],
      disabled: boolean
    ) => {
      if (!info) return null;

      const formatDisplay = (val: unknown) => {
        if (key === 'duration_s') return `${val}s`;
        if (key === 'fps') return `${val} fps`;
        return String(val);
      };

      const currentRaw = generationParams?.[key] ?? info.field.default ?? '';
      const currentDisplay = formatDisplay(currentRaw);

      return (
        <Select
          value={String(currentRaw)}
          onValueChange={(value) => {
            const val = info.field.type === 'int' ? Number(value) : value;
            handleParamChange(key, val);
          }}
          disabled={disabled}
        >
          <SelectTrigger
            size="xs"
            variant="ghost"
            className="h-auto w-auto justify-center rounded-lg px-ps-3 py-ps-3 transition-colors hover:bg-white/5 [&>svg:last-child]:hidden"
            aria-label={`${ariaLabel}: ${currentDisplay}`}
            title={`${ariaLabel}: ${currentDisplay}`}
          >
            <Icon icon={icon} size="sm" aria-hidden="true" />
          </SelectTrigger>
          <SelectContent>
            {info.allowedValues.map((value) => (
              <SelectItem key={String(value)} value={String(value)}>
                {formatDisplay(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    },
    [generationParams, handleParamChange]
  );

  const handleModelSelect = useCallback(
    (nextModel: string) => {
      if (isOptimizing) {
        return;
      }
      if (nextModel === selectedModel) {
        return;
      }
      const previousModel = selectedModel;
      setSelectedModel(nextModel);
      onModelChange?.(nextModel, previousModel);
    },
    [isOptimizing, onModelChange, selectedModel, setSelectedModel]
  );

  if (!showVideoPreview) {
    return null;
  }

  const modelValue = selectedModel && selectedModel.trim() ? selectedModel : 'auto';
  const modelLabel =
    modelValue === 'auto'
      ? 'Auto'
      : modelOptions.find((opt) => opt.id === modelValue)?.label ?? modelValue;

  return (
    <div className={cn('flex flex-nowrap items-center gap-[2px]', className)} aria-label="Prompt controls">
      <Select
        value={modelValue}
        onValueChange={(value) => handleModelSelect(value === 'auto' ? '' : value)}
        disabled={isOptimizing}
      >
        <SelectTrigger
          size="xs"
          variant="ghost"
          className="h-auto w-auto justify-center rounded-lg px-ps-3 py-ps-3 transition-colors hover:bg-white/5 [&>svg:last-child]:hidden"
          aria-label={`Model: ${modelLabel}`}
          title={`Model: ${modelLabel}`}
        >
          <Icon icon={Robot} size="sm" aria-hidden="true" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">Auto</SelectItem>
          {modelOptions.map((opt) => (
            <SelectItem key={opt.id} value={opt.id}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {aspectRatioInfo &&
        renderDropdown(aspectRatioInfo, 'aspect_ratio', 'Aspect ratio', Ruler, isOptimizing)}

      {durationInfo && renderDropdown(durationInfo, 'duration_s', 'Duration', FilmSlate, isOptimizing)}

      {fpsInfo && renderDropdown(fpsInfo, 'fps', 'Frame rate', VideoCamera, isOptimizing)}
    </div>
  );
}
