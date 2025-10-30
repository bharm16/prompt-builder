/**
 * Element Card Component
 *
 * Displays an individual element card with input, examples, and AI suggestions button.
 * For the 'subject' element, also displays subject descriptor cards.
 */

import { Sparkles, CheckCircle, AlertCircle, Tag } from 'lucide-react';
import { SUBJECT_DESCRIPTOR_KEYS } from '../config/constants';

function SubjectDescriptorCard({
  descriptorKey,
  descriptorConfig,
  value,
  compatibility,
  categoryDetection,
  onValueChange,
  onFetchSuggestions,
  descriptorIndex,
}) {
  const descriptorFilled = Boolean(value);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white/80 p-3 relative">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Tag className="h-3.5 w-3.5 text-neutral-500" />
        <span className="text-xs font-semibold text-neutral-700">
          Descriptor {descriptorIndex + 1}
        </span>
        <span className="text-[10px] text-neutral-400">Optional</span>
        {categoryDetection && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
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
                <CheckCircle className="h-3 w-3 text-emerald-500" />
                <span>Strong</span>
              </>
            ) : compatibility < 0.6 ? (
              <>
                <AlertCircle className="h-3 w-3 text-amber-500" />
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
          className="input text-sm focus:border-neutral-500 focus:ring-neutral-500/30"
        />
        <button
          onClick={() => onFetchSuggestions(descriptorKey)}
          className="btn-primary btn-sm px-3 py-1 text-[11px] font-semibold shadow-sm active:scale-95"
          title="Get AI descriptor ideas"
        >
          <Sparkles className="h-3 w-3" />
          AI fill
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {descriptorConfig.examples.map((example, exampleIdx) => (
          <button
            key={`${descriptorKey}-example-${exampleIdx}`}
            onClick={() => onValueChange(descriptorKey, example)}
            className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-700 transition-all duration-150 hover:border-neutral-300 hover:bg-neutral-50 active:scale-95"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
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
}) {
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
          <Icon className="h-4 w-4 text-neutral-700" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-neutral-900">{config.label}</h3>
        </div>
        {/* AI Button */}
        <button
          onClick={() => onFetchSuggestions(elementKey)}
          className="group relative overflow-hidden px-2.5 py-1 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 active:scale-95"
          title="Get AI suggestions"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          <div className="relative flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            <span>AI</span>
          </div>
        </button>
        {isFilled && compatibility !== undefined && (
          <div className="flex items-center gap-1">
            {compatibility >= 0.8 ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : compatibility < 0.6 ? (
              <AlertCircle className="h-4 w-4 text-red-600" />
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
              <Sparkles className="h-3 w-3" />
              <span>Use AI to fill any slot</span>
            </div>
          </div>

          {SUBJECT_DESCRIPTOR_KEYS.map((descriptorKey, idx) => {
            const descriptorConfig = elementConfig[descriptorKey];
            const descriptorValue = elements[descriptorKey] || '';
            const descriptorCompatibility = compatibilityScores[descriptorKey];
            const categoryDetection = descriptorCategories[descriptorKey];

            return (
              <SubjectDescriptorCard
                key={descriptorKey}
                descriptorKey={descriptorKey}
                descriptorConfig={descriptorConfig}
                value={descriptorValue}
                compatibility={descriptorCompatibility}
                categoryDetection={categoryDetection}
                onValueChange={onValueChange}
                onFetchSuggestions={onFetchSuggestions}
                descriptorIndex={idx}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
