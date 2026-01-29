import React, { useMemo } from 'react';
import { cn } from '@/utils/cn';

export interface ModelSelectorOption {
  id: string;
  label: string;
}

interface ModelSelectorProps {
  options: ModelSelectorOption[];
  selectedModel?: string;
  recommendedId?: string | undefined;
  efficientId?: string | undefined;
  disabled?: boolean;
  onChange: (modelId: string) => void;
  className?: string;
  label?: string | null;
  labelClassName?: string;
  selectClassName?: string;
  ariaLabel?: string;
}

const buildLabel = (
  option: ModelSelectorOption,
  recommendedId?: string,
  efficientId?: string
): string => {
  if (option.id === recommendedId) return `${option.label} · Best Match`;
  if (option.id === efficientId) return `${option.label} · Efficient`;
  return option.label;
};

export function ModelSelector({
  options,
  selectedModel,
  recommendedId,
  efficientId,
  disabled = false,
  onChange,
  className,
  label = 'Model',
  labelClassName,
  selectClassName,
  ariaLabel,
}: ModelSelectorProps): React.ReactElement {
  const items = useMemo(
    () => options.map((option) => ({ ...option, displayLabel: buildLabel(option, recommendedId, efficientId) })),
    [efficientId, options, recommendedId]
  );
  const showLabel = label !== null && label !== undefined;

  return (
    <div className={cn('space-y-1', className)}>
      {showLabel && (
        <label className={cn('text-xs text-[#A1AFC5]', labelClassName)}>
          {label || 'Model'}
        </label>
      )}
      <select
        value={selectedModel ?? ''}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-label={ariaLabel ?? (showLabel ? undefined : 'Model')}
        className={cn(
          'w-full rounded-md border border-[#2A2B31] bg-[#1E1F25] px-2 py-1.5 text-sm text-white',
          selectClassName
        )}
      >
        {items.map((option) => (
          <option key={option.id} value={option.id}>
            {option.displayLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
