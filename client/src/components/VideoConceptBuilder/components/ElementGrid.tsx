/**
 * ElementGrid Component
 *
 * Presentational component for element mode grid layout.
 */

import React from 'react';
import { ELEMENT_CARD_ORDER, ELEMENT_CONFIG } from '../config/constants';
import { ElementCard } from './ElementCard';
import type { ElementKey, Elements } from '../hooks/types';
import type { ElementConfig, CategoryDetection } from './types';

interface ElementGridProps {
  elements: Elements;
  activeElement: ElementKey | null;
  compatibilityScores: Record<string, number>;
  descriptorCategories: Record<string, CategoryDetection>;
  onValueChange: (key: ElementKey, value: string) => void;
  onFetchSuggestions: (elementType: string, currentValue?: string) => void;
}

export function ElementGrid({
  elements,
  activeElement,
  compatibilityScores,
  descriptorCategories,
  onValueChange,
  onFetchSuggestions,
}: ElementGridProps): React.ReactElement {
  return (
    <div className="rounded-3xl border border-neutral-200/70 bg-white/90 px-5 py-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ELEMENT_CARD_ORDER.map((key) => {
          const elementKey = key as ElementKey;
          return (
            <ElementCard
              key={elementKey}
              elementKey={elementKey}
              config={ELEMENT_CONFIG[elementKey] as ElementConfig}
              value={elements[elementKey]}
              isActive={activeElement === elementKey}
              compatibility={compatibilityScores[elementKey]}
              elements={elements}
              compatibilityScores={compatibilityScores}
              descriptorCategories={descriptorCategories}
              elementConfig={ELEMENT_CONFIG as unknown as Record<string, ElementConfig>}
              onValueChange={onValueChange}
              onFetchSuggestions={onFetchSuggestions}
            />
          );
        })}
      </div>
    </div>
  );
}

