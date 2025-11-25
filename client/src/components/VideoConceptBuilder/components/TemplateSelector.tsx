/**
 * Template Selector Component
 *
 * Displays available templates and allows users to load them.
 */

import { TEMPLATE_LIBRARY } from '../config/templates';

interface TemplateSelectorProps {
  onLoadTemplate: (key: string) => void;
}

export function TemplateSelector({
  onLoadTemplate,
}: TemplateSelectorProps): React.ReactElement {
  return (
    <div className="rounded-3xl border border-neutral-200/70 bg-white/90 px-5 py-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-900">Quick Start Templates</h3>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(TEMPLATE_LIBRARY).map(([key, template]) => (
          <button
            key={key}
            onClick={() => onLoadTemplate(key)}
            className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4 text-left transition-all duration-200 hover:border-neutral-300 hover:bg-white hover:shadow-sm"
          >
            <div className="text-sm font-medium text-neutral-900">{template.name}</div>
            <div className="mt-1 text-xs text-neutral-600 line-clamp-1">
              {Object.values(template.elements).slice(0, 2).join(' • ')}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

