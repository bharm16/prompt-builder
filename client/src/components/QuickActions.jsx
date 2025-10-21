import React from 'react';

/**
 * QuickActions Component - Visual cards for quick action templates
 *
 * Transforms small pills into larger, more visual cards grouped by category
 */

const categories = {
  research: {
    title: 'Research',
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
  },
  writing: {
    title: 'Writing',
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
  },
  learning: {
    title: 'Learning',
    color: 'from-green-500 to-emerald-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
  },
  creative: {
    title: 'Creative',
    color: 'from-orange-500 to-red-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
  },
};

export default function QuickActions({ actions, onActionClick }) {
  // Group actions by category
  const groupedActions = actions.reduce((acc, action) => {
    const category = action.category || 'creative';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(action);
    return acc;
  }, {});

  return (
    <div className="w-full">
      <h3 className="text-sm font-semibold text-neutral-600 uppercase tracking-wider mb-4">
        Quick Start Templates
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(groupedActions).map(([categoryKey, categoryActions]) => {
          const category = categories[categoryKey] || categories.creative;

          return categoryActions.map((action, idx) => {
            const Icon = action.icon;

            return (
              <button
                key={`${categoryKey}-${idx}`}
                onClick={() => onActionClick(action)}
                className={`
                  group relative p-4 rounded-xl border-2 transition-all duration-200
                  hover:scale-105 hover:shadow-lg active:scale-100
                  ${category.bgColor} ${category.borderColor}
                  focus-ring
                `}
                aria-label={`Use ${action.label} template`}
              >
                {/* Gradient overlay on hover */}
                <div
                  className={`
                    absolute inset-0 rounded-xl opacity-0 group-hover:opacity-10 transition-opacity duration-200
                    bg-gradient-to-br ${category.color}
                  `}
                  aria-hidden="true"
                />

                {/* Content */}
                <div className="relative flex flex-col items-start gap-2">
                  {/* Icon */}
                  <div className={`
                    flex items-center justify-center w-10 h-10 rounded-lg
                    bg-white shadow-sm
                    ${category.textColor}
                    group-hover:scale-110 transition-transform duration-200
                  `}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>

                  {/* Title */}
                  <div className="text-left">
                    <h4 className="text-sm font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors duration-200">
                      {action.label}
                    </h4>
                    {action.description && (
                      <p className="text-xs text-neutral-600 mt-0.5 line-clamp-2">
                        {action.description}
                      </p>
                    )}
                  </div>

                  {/* Category badge */}
                  <span className={`
                    inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                    ${category.textColor} ${category.bgColor}
                    opacity-0 group-hover:opacity-100 transition-opacity duration-200
                  `}>
                    {category.title}
                  </span>
                </div>

                {/* Hover arrow indicator */}
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            );
          });
        })}
      </div>
    </div>
  );
}
