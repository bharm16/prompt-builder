/**
 * Element Card Component
 *
 * Displays an individual element card with input, examples, and AI suggestions button.
 * For the 'subject' element, also displays subject descriptor cards.
 */

import { Star as Sparkles, CheckCircle, AlertCircle, Tag } from '@geist-ui/icons';
import { Button } from '@components/Button';
import { SUBJECT_DESCRIPTOR_KEYS } from '../config/constants';
import type { ElementKey, Elements } from '../hooks/types';
import type { ElementConfig, CategoryDetection } from './types';

interface SubjectDescriptorCardProps {
  descriptorKey: ElementKey;
  descriptorConfig: ElementConfig;
  value: string;
  compatibility?: number;
  categoryDetection?: CategoryDetection;
  onValueChange: (key: ElementKey, value: string) => void;
  onFetchSuggestions: (key: ElementKey) => void;
  descriptorIndex: number;
}

function SubjectDescriptorCard({
  descriptorKey,
  descriptorConfig,
  value,
  compatibility,
  categoryDetection,
  onValueChange,
  onFetchSuggestions,
  descriptorIndex,
}: SubjectDescriptorCardProps): React.ReactElement {
  const descriptorFilled = Boolean(value);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/80 p-3 relative">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Tag size={14} color="#737373" />
        <span className="text-label-12 text-geist-accents-7">
          Descriptor {descriptorIndex + 1}
        </span>
        <span className="text-label-12 text-geist-accents-4">Optional</span>
        {categoryDetection && (
          <span
            className="inline-flex items-center gap-geist-1 rounded-full px-geist-2 py-geist-1 text-label-12 uppercase tracking-wide"
            style={{
              backgroundColor: categoryDetection.colors.bg,
              color: categoryDetection.colors.text,
              border: `1px solid ${categoryDetection.colors.border}20`,
            }}
            title={`${categoryDetection.label} category (${Math.round(categoryDetection.confidence * 100)}% confidence)`}
          >
            {categoryDetection.label}
          </span>
        )}
        {descriptorFilled && compatibility !== undefined && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-neutral-500">
            {compatibility >= 0.8 ? (
              <>
                <CheckCircle size={12} color="#10b981" />
                <span>Strong</span>
              </>
            ) : compatibility < 0.6 ? (
              <>
                <AlertCircle size={12} color="#f59e0b" />
                <span>Rework</span>
              </>
            ) : null}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onValueChange(descriptorKey, e.target.value)}
          onFocus={() => onFetchSuggestions(descriptorKey)}
          placeholder={descriptorConfig.placeholder}
          className="input text-copy-14 focus:border-geist-accents-5 focus:ring-geist-accents-5/30"
        />
        <Button
          onClick={() => onFetchSuggestions(descriptorKey)}
          variant="primary"
          size="small"
          prefix={<Sparkles size={12} />}
          className="shadow-geist-small active:scale-95"
          title="Get AI descriptor ideas"
        >
          AI fill
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {descriptorConfig.examples.map((example, exampleIdx) => (
          <button
            key={`${descriptorKey}-example-${exampleIdx}`}
            onClick={() => onValueChange(descriptorKey, example)}
            className="rounded-full border border-geist-accents-2 bg-geist-background px-geist-3 py-geist-2 text-button-12 text-geist-accents-7 transition-all duration-150 hover:border-geist-accents-3 hover:bg-geist-accents-1 active:scale-95"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ElementCardProps {
  elementKey: ElementKey;
  config: ElementConfig;
  value: string;
  isActive: boolean;
  compatibility?: number | undefined;
  elements: Elements;
  compatibilityScores: Record<string, number>;
  descriptorCategories: Record<string, CategoryDetection>;
  elementConfig: Record<string, ElementConfig>;
  onValueChange: (key: ElementKey, value: string) => void;
  onFetchSuggestions: (key: ElementKey) => Promise<void>;
}

export function ElementCard({
  elementKey,
  config,
  value,
  isActive,
  compatibility,
  elements,
  compatibilityScores,
  descriptorCategories,
  elementConfig,
  onValueChange,
  onFetchSuggestions,
}: ElementCardProps): React.ReactElement {
  const Icon = config.icon;
  const isFilled = Boolean(value);

  return (
    <div
      className={`group relative flex h-full flex-col rounded-2xl border p-5 transition-all duration-200 ${
        isActive
          ? 'border-neutral-900 bg-white shadow-lg ring-1 ring-neutral-900/10'
          : isFilled
            ? 'border-neutral-200 bg-white/95 shadow-sm hover:border-neutral-300 hover:shadow-md'
            : 'border-neutral-200/70 bg-white/90 hover:border-neutral-300/80 hover:shadow'
      }`}
    >
      {/* Card Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-neutral-100 rounded-lg">
          <Icon size={16} color="#404040" />
        </div>
        <div className="flex-1">
          <h3 className="text-label-14 text-geist-foreground">{config.label}</h3>
        </div>
        {/* AI Button */}
        <button
          onClick={() => onFetchSuggestions(elementKey)}
          className="group relative overflow-hidden px-2.5 py-1 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
          title="Get AI suggestions"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          <div className="relative flex items-center gap-1.5">
            <Sparkles size={12} />
            <span>AI</span>
          </div>
        </button>
        {isFilled && compatibility !== undefined && (
          <div className="flex items-center gap-1">
            {compatibility >= 0.8 ? (
              <CheckCircle size={16} color="#16a34a" />
            ) : compatibility < 0.6 ? (
              <AlertCircle size={16} color="#dc2626" />
            ) : null}
          </div>
        )}
      </div>

      {/* Input Field */}
      <input
        type="text"
        value={value}
        onChange={(e) => onValueChange(elementKey, e.target.value)}
        onFocus={() => onFetchSuggestions(elementKey)}
        placeholder={config.placeholder}
        className="input text-sm transition-shadow focus:border-neutral-500 focus:ring-neutral-500/30"
      />

      {/* Quick Examples */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {config.examples.map((example, idx) => (
          <button
            key={idx}
            onClick={() => onValueChange(elementKey, example)}
            className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm active:scale-95"
          >
            {example}
          </button>
        ))}
      </div>

      {/* Subject Descriptors (only for subject element) */}
      {elementKey === 'subject' && (
        <div className="mt-5 space-y-3 rounded-lg bg-neutral-50 border border-dashed border-neutral-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-neutral-800 uppercase tracking-wide">
                Optional Subject Descriptors
              </span>
              <span className="text-[11px] text-neutral-500">
                Add up to three visual anchors to keep AI suggestions precise.
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-neutral-500">
              <Sparkles size={12} />
              <span>Use AI to fill any slot</span>
            </div>
          </div>

          {SUBJECT_DESCRIPTOR_KEYS.map((descriptorKey, idx) => {
            const elementKey = descriptorKey as ElementKey;
            const descriptorConfig = elementConfig[elementKey];
            if (!descriptorConfig) return null;
            
            const descriptorValue = elements[elementKey] || '';
            const descriptorCompatibility = compatibilityScores[elementKey];
            const categoryDetection = descriptorCategories[elementKey];

            return (
              <SubjectDescriptorCard
                key={elementKey}
                descriptorKey={elementKey}
                descriptorConfig={descriptorConfig}
                value={descriptorValue}
                onValueChange={onValueChange}
                onFetchSuggestions={onFetchSuggestions}
                descriptorIndex={idx}
                {...(typeof descriptorCompatibility === 'number' ? { compatibility: descriptorCompatibility } : {})}
                {...(categoryDetection ? { categoryDetection } : {})}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
