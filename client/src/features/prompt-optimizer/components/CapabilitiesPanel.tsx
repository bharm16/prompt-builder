import React, { useMemo } from 'react';
import {
  getDefaultValue,
  resolveFieldState,
  type CapabilitiesSchema,
  type CapabilityField,
  type CapabilityValue,
  type CapabilityValues,
} from '@shared/capabilities';
import { useCapabilities } from '../hooks/useCapabilities';
import { useNormalizedCapabilityValues } from '../hooks/useNormalizedCapabilityValues';

interface CapabilitiesPanelProps {
  selectedModel?: string;
  generationParams: CapabilityValues;
  onChange: (params: CapabilityValues) => void;
  // If provided, uses this schema/state instead of internal fetching
  schema?: CapabilitiesSchema | null;
  isLoading?: boolean;
  error?: string | null;
  targetLabel?: string;
  // Fields to hide (e.g. if moved elsewhere in UI)
  excludeFields?: string[];
}

interface FieldEntry {
  id: string;
  field: CapabilityField;
  state: ReturnType<typeof resolveFieldState>;
}

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
  schema: propSchema,
  isLoading: propIsLoading,
  error: propError,
  targetLabel,
  excludeFields = [],
}: CapabilitiesPanelProps): React.ReactElement | null => {
  const capabilities = useCapabilities(selectedModel, { enabled: propSchema === undefined });

  // Use props if provided, otherwise internal state
  const schema = propSchema !== undefined ? propSchema : capabilities.schema;
  const isLoading = propIsLoading !== undefined ? propIsLoading : capabilities.isLoading;
  const error = propError !== undefined ? propError : capabilities.error;
  const label = targetLabel !== undefined ? targetLabel : capabilities.target.label;
  const { provider, model } = capabilities.target;

  const normalizedValues = useNormalizedCapabilityValues({
    schema,
    generationParams,
    onChange,
  });

  const groupedFields = useMemo(() => {
    if (!schema) return [];

    // Filter out excluded fields
    const visibleFields = Object.entries(schema.fields).filter(
      ([id]) => !excludeFields.includes(id)
    );

    const entries: FieldEntry[] = visibleFields.map(([id, field]) => ({
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
  }, [schema, normalizedValues, excludeFields]);

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
