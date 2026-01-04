import React, { useEffect, useMemo, useState } from 'react';
import { capabilitiesApi } from '@/services';
import { AI_MODEL_LABELS, AI_MODEL_PROVIDERS, type AIModelId } from './constants';
import {
  getDefaultValue,
  resolveFieldState,
  type CapabilitiesSchema,
  type CapabilityField,
  type CapabilityValue,
  type CapabilityValues,
} from '@shared/capabilities';

interface CapabilitiesPanelProps {
  selectedModel?: string;
  generationParams: CapabilityValues;
  onChange: (params: CapabilityValues) => void;
}

interface FieldEntry {
  id: string;
  field: CapabilityField;
  state: ReturnType<typeof resolveFieldState>;
}

const resolveLabel = (selectedModel?: string, resolvedModel?: string): string => {
  if (!selectedModel) {
    return 'Auto-detect';
  }

  const resolvedLabel = resolvedModel
    ? AI_MODEL_LABELS[resolvedModel as AIModelId]
    : undefined;

  return resolvedLabel || AI_MODEL_LABELS[selectedModel as AIModelId] || selectedModel;
};

const resolveTarget = (selectedModel?: string): { provider: string; model: string; label: string } => {
  if (!selectedModel) {
    return { provider: 'generic', model: 'auto', label: resolveLabel() };
  }

  const provider = AI_MODEL_PROVIDERS[selectedModel as AIModelId] ?? 'generic';
  const label = resolveLabel(selectedModel);
  return { provider, model: selectedModel, label };
};

const areValuesEqual = (left: CapabilityValues, right: CapabilityValues): boolean => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => Object.is(left[key], right[key]));
};

const normalizeFieldValue = (
  field: CapabilityField,
  value: CapabilityValue | undefined
): CapabilityValue | undefined => {
  if (typeof value === 'undefined') {
    return getDefaultValue(field);
  }
  if (field.type === 'bool') {
    return typeof value === 'boolean' ? value : getDefaultValue(field);
  }
  if (field.type === 'int') {
    return typeof value === 'number' && Number.isFinite(value) ? value : getDefaultValue(field);
  }
  if (field.type === 'string') {
    return typeof value === 'string' ? value : getDefaultValue(field);
  }
  return value;
};

const sanitizeValues = (schema: CapabilitiesSchema, values: CapabilityValues): CapabilityValues => {
  const next: CapabilityValues = {};

  for (const [fieldId, field] of Object.entries(schema.fields)) {
    const normalized = normalizeFieldValue(field, values[fieldId]);
    if (typeof normalized !== 'undefined') {
      next[fieldId] = normalized;
    }
  }

  for (const [fieldId, field] of Object.entries(schema.fields)) {
    const state = resolveFieldState(field, next);
    if (!state.available || state.disabled) {
      delete next[fieldId];
      continue;
    }

    if (field.type === 'enum' && state.allowedValues && state.allowedValues.length > 0) {
      const current = next[fieldId];
      const isValid = state.allowedValues.some((value) => Object.is(value, current));
      if (!isValid) {
        next[fieldId] = state.allowedValues[0];
      }
    }
  }

  return next;
};

const getFieldLabel = (fieldId: string, field: CapabilityField): string =>
  field.ui?.label || fieldId.replace(/_/g, ' ');

const valueToLabel = (value: CapabilityValue): string => {
  if (typeof value === 'number') {
    return Number.isInteger(value) ? `${value}` : value.toString();
  }
  if (typeof value === 'boolean') {
    return value ? 'On' : 'Off';
  }
  return value;
};

export const CapabilitiesPanel = ({
  selectedModel,
  generationParams,
  onChange,
}: CapabilitiesPanelProps): React.ReactElement | null => {
  const [{ provider, model, label }, setTarget] = useState(() => resolveTarget(selectedModel));
  const [schema, setSchema] = useState<CapabilitiesSchema | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const target = resolveTarget(selectedModel);
    setTarget(target);
    let active = true;
    setIsLoading(true);
    setError(null);

    capabilitiesApi
      .getCapabilities(target.provider, target.model)
      .then((data) => {
        if (!active) return;
        setSchema(data);
        setTarget({
          provider: data.provider || target.provider,
          model: data.model || target.model,
          label: resolveLabel(selectedModel, data.model),
        });
      })
      .catch((err) => {
        if (!active) return;
        setSchema(null);
        setError(err instanceof Error ? err.message : 'Unable to load capabilities');
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedModel]);

  const normalizedValues = useMemo(() => {
    if (!schema) {
      return generationParams;
    }
    return sanitizeValues(schema, generationParams);
  }, [schema, generationParams]);

  useEffect(() => {
    if (!schema) {
      return;
    }
    if (!areValuesEqual(generationParams, normalizedValues)) {
      onChange(normalizedValues);
    }
  }, [schema, generationParams, normalizedValues, onChange]);

  const groupedFields = useMemo(() => {
    if (!schema) return [];

    const entries: FieldEntry[] = Object.entries(schema.fields).map(([id, field]) => ({
      id,
      field,
      state: resolveFieldState(field, normalizedValues),
    }));

    const visible = entries.filter((entry) => entry.state.available);
    const grouped = new Map<string, FieldEntry[]>();

    for (const entry of visible) {
      const group = entry.field.ui?.group || 'Options';
      const bucket = grouped.get(group) ?? [];
      bucket.push(entry);
      grouped.set(group, bucket);
    }

    const groupEntries = Array.from(grouped.entries()).map(([group, fields]) => {
      const ordered = fields.sort((a, b) => (a.field.ui?.order ?? 999) - (b.field.ui?.order ?? 999));
      const minOrder = ordered[0]?.field.ui?.order ?? 999;
      return { group, fields: ordered, order: minOrder };
    });

    return groupEntries.sort((a, b) => a.order - b.order);
  }, [schema, normalizedValues]);

  const handleValueChange = (fieldId: string, value: CapabilityValue): void => {
    onChange({ ...normalizedValues, [fieldId]: value });
  };

  if (!schema && isLoading) {
    return (
      <div className="text-xs text-geist-accents-6">Loading model settings...</div>
    );
  }

  if (!schema) {
    return (
      <div className="text-xs text-geist-accents-6">
        {error ? `Settings unavailable: ${error}` : 'Model settings unavailable.'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-geist-accents-6">
          Model settings
        </span>
        <span className="text-xs text-geist-accents-5">
          {label} - {provider}/{model}
        </span>
      </div>

      {groupedFields.map((group) => (
        <div key={group.group} className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-geist-accents-6">
            {group.group}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {group.fields.map(({ id, field, state }) => {
              const value = normalizedValues[id];
              const labelText = getFieldLabel(id, field);
              const description = field.ui?.description;
              const isDisabled = state.disabled;
              const allowedValues =
                field.type === 'enum' ? state.allowedValues ?? field.values ?? [] : [];

              return (
                <div
                  key={id}
                  className={`rounded-geist border border-geist-accents-2 bg-geist-background px-3 py-2.5 ${
                    isDisabled ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={`cap-${id}`}
                      className="text-xs font-medium text-geist-foreground"
                    >
                      {labelText}
                    </label>
                    {field.type === 'bool' && (
                      <button
                        id={`cap-${id}`}
                        type="button"
                        role="switch"
                        aria-checked={Boolean(value)}
                        onClick={() => handleValueChange(id, !value)}
                        disabled={isDisabled}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          value ? 'bg-geist-foreground' : 'bg-geist-accents-3'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-geist-background transition-transform ${
                            value ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    )}
                  </div>

                  {field.type === 'enum' && field.ui?.control === 'segmented' && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {allowedValues.map((option) => {
                        const isSelected = Object.is(option, value);
                        return (
                          <button
                            key={`${id}-${String(option)}`}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => handleValueChange(id, option)}
                            aria-pressed={isSelected}
                            className={`px-2.5 py-1 text-xs font-medium rounded-geist border transition-colors ${
                              isSelected
                                ? 'bg-geist-foreground text-geist-background border-geist-foreground'
                                : 'bg-geist-background text-geist-accents-6 border-geist-accents-2 hover:bg-geist-accents-1'
                            }`}
                          >
                            {valueToLabel(option)}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {field.type === 'enum' && field.ui?.control !== 'segmented' && (
                    <select
                      id={`cap-${id}`}
                      value={value !== undefined ? String(value) : ''}
                      onChange={(event) => {
                        const selected = allowedValues.find(
                          (option) => String(option) === event.target.value
                        );
                        if (typeof selected !== 'undefined') {
                          handleValueChange(id, selected);
                        }
                      }}
                      disabled={isDisabled}
                      className="mt-2 w-full rounded-geist border border-geist-accents-2 bg-geist-background px-2 py-1.5 text-xs text-geist-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-geist-accents-4"
                    >
                      {allowedValues.map((option) => (
                        <option key={`${id}-${String(option)}`} value={String(option)}>
                          {valueToLabel(option)}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.type === 'int' && (
                    <input
                      id={`cap-${id}`}
                      type="number"
                      value={typeof value === 'number' ? value : ''}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        if (nextValue === '') {
                          const fallback = getDefaultValue(field);
                          if (typeof fallback !== 'undefined') {
                            handleValueChange(id, fallback);
                          }
                          return;
                        }
                        const parsed = Number(nextValue);
                        if (!Number.isNaN(parsed)) {
                          handleValueChange(id, parsed);
                        }
                      }}
                      disabled={isDisabled}
                      min={field.constraints?.min}
                      max={field.constraints?.max}
                      step={field.constraints?.step}
                      className="mt-2 w-full rounded-geist border border-geist-accents-2 bg-geist-background px-2 py-1.5 text-xs text-geist-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-geist-accents-4"
                    />
                  )}

                  {field.type === 'string' && (
                    <input
                      id={`cap-${id}`}
                      type="text"
                      value={typeof value === 'string' ? value : ''}
                      onChange={(event) => handleValueChange(id, event.target.value)}
                      disabled={isDisabled}
                      placeholder={field.ui?.placeholder}
                      className="mt-2 w-full rounded-geist border border-geist-accents-2 bg-geist-background px-2 py-1.5 text-xs text-geist-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-geist-accents-4"
                    />
                  )}

                  {description && (
                    <p className="mt-2 text-[11px] text-geist-accents-6">{description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
