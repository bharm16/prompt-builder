/**
 * Technical Blueprint Component
 *
 * Displays technical parameters generated from creative elements.
 */

import { Wand2, Loader2 } from 'lucide-react';
import { formatLabel, describeNestedValue } from '../utils/formatting';
import { TECHNICAL_SECTION_ORDER } from '../config/constants';

function renderTechnicalValue(value: unknown): React.ReactElement {
  if (Array.isArray(value)) {
    return (
      <ul className="mt-2 space-y-1 text-xs text-neutral-600 leading-relaxed list-disc list-inside">
        {value.map((item, idx) => (
          <li key={idx}>{String(item)}</li>
        ))}
      </ul>
    );
  }

  if (value && typeof value === 'object' && value !== null) {
    return (
      <ul className="mt-2 space-y-1 text-xs text-neutral-600 leading-relaxed">
        {Object.entries(value as Record<string, unknown>).map(([subKey, subValue]) => (
          <li key={subKey}>
            <span className="font-semibold text-neutral-700">{formatLabel(subKey)}:</span>{' '}
            {describeNestedValue(subValue)}
          </li>
        ))}
      </ul>
    );
  }

  if (!value) {
    return (
      <p className="mt-2 text-xs text-neutral-500">No recommendation provided.</p>
    );
  }

  return (
    <p className="mt-2 text-xs text-neutral-600 leading-relaxed">{String(value)}</p>
  );
}

function getTechnicalSections(
  technicalParams: Record<string, unknown> | null | undefined
): string[] {
  if (!technicalParams || typeof technicalParams !== 'object') {
    return [];
  }

  const keys = Object.keys(technicalParams);
  const ordered = TECHNICAL_SECTION_ORDER.filter((key) => keys.includes(key));
  const additional = keys.filter((key) => !(TECHNICAL_SECTION_ORDER as readonly string[]).includes(key));
  const combined = [...ordered, ...additional];

  return combined.filter((key) => {
    const value = technicalParams[key];
    if (!value) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object' && value !== null) {
      return Object.values(value as Record<string, unknown>).some((nested) => {
        if (Array.isArray(nested)) return nested.length > 0;
        if (nested && typeof nested === 'object' && nested !== null) {
          return Object.values(nested as Record<string, unknown>).some(Boolean);
        }
        return Boolean(nested);
      });
    }
    return Boolean(value);
  });
}

interface TechnicalBlueprintProps {
  technicalParams: Record<string, unknown> | null;
  isLoading: boolean;
}

export function TechnicalBlueprint({
  technicalParams,
  isLoading,
}: TechnicalBlueprintProps): React.ReactElement | null {
  const technicalSections = getTechnicalSections(technicalParams);
  const hasTechnicalParams =
    technicalParams && Object.keys(technicalParams).length > 0;

  if (!isLoading && !hasTechnicalParams) return null;

  return (
    <div className="rounded-3xl border border-neutral-200/70 bg-white/90 px-6 py-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-neutral-900">
            Technical Blueprint
          </h3>
        </div>
        {isLoading && (
          <Loader2 className="h-4 w-4 text-neutral-400 animate-spin" />
        )}
      </div>

      {hasTechnicalParams && technicalSections.length > 0 ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {technicalSections.map((sectionKey) => (
            <div
              key={sectionKey}
              className="p-4 rounded-lg border border-neutral-200 bg-neutral-50"
            >
              <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                {formatLabel(sectionKey)}
              </div>
              {renderTechnicalValue(technicalParams[sectionKey])}
            </div>
          ))}
        </div>
      ) : (
        !isLoading && (
          <p className="mt-3 text-sm text-neutral-600">
            Add at least three detailed elements to unlock technical recommendations.
          </p>
        )
      )}
    </div>
  );
}
