/**
 * ConceptInputSection Component
 *
 * Presentational component for concept mode input section.
 */

import React from 'react';
import { Zap as Brain } from '@geist-ui/icons';
import { Button } from '@components/Button';
import type { ElementKey } from '../hooks/types';

interface ConceptInputSectionProps {
  concept: string;
  onConceptChange: (value: string) => void;
  onParseConcept: () => void;
}

export function ConceptInputSection({
  concept,
  onConceptChange,
  onParseConcept,
}: ConceptInputSectionProps): React.ReactElement {
  return (
    <div className="rounded-3xl border border-neutral-200/70 bg-white/90 px-6 py-6 shadow-sm">
      <label className="mb-geist-3 block text-label-14 text-geist-foreground">
        Describe your video concept
      </label>
      <textarea
        value={concept}
        onChange={(e) => onConceptChange(e.target.value)}
        placeholder="Example: A sleek sports car drifting through a neon-lit Tokyo street at night, dramatic lighting, shot on anamorphic lenses..."
        className="textarea min-h-[140px] rounded-geist-lg border-geist-accents-2 bg-geist-accents-1 text-copy-14"
      />
      <div className="mt-4 flex justify-end">
        <Button
          onClick={onParseConcept}
          disabled={!concept}
          variant="primary"
          size="small"
          prefix={<Brain size={16} />}
        >
          Parse into elements
        </Button>
      </div>
    </div>
  );
}

