import React from 'react';
import type { Asset } from '@shared/types/asset';
import { TriggerAutocomplete } from '@/features/prompt-optimizer/components/TriggerAutocomplete';

export interface AutocompleteState {
  autocompleteOpen: boolean;
  autocompleteSuggestions: Asset[];
  autocompleteSelectedIndex: number;
  autocompletePosition: { top: number; left: number };
  autocompleteQuery: string;
  selectAutocompleteSuggestion: (index: number) => void;
  setAutocompleteSelectedIndex: (index: number) => void;
  closeAutocomplete: () => void;
  updateAutocompletePosition: () => void;
}

interface PromptTriggerAutocompleteProps {
  autocomplete: AutocompleteState;
  onCreateFromTrigger?: (trigger: string) => void;
}

export function PromptTriggerAutocomplete({
  autocomplete,
  onCreateFromTrigger,
}: PromptTriggerAutocompleteProps): React.ReactElement {
  return (
    <TriggerAutocomplete
      isOpen={autocomplete.autocompleteOpen}
      suggestions={autocomplete.autocompleteSuggestions}
      selectedIndex={autocomplete.autocompleteSelectedIndex}
      position={autocomplete.autocompletePosition}
      query={autocomplete.autocompleteQuery}
      onSelect={(asset) => {
        const index = autocomplete.autocompleteSuggestions.findIndex((item) => item.id === asset.id);
        if (index >= 0) {
          autocomplete.selectAutocompleteSuggestion(index);
        }
      }}
      onCreateNew={(trigger) => {
        onCreateFromTrigger?.(trigger);
        autocomplete.closeAutocomplete();
      }}
      onClose={autocomplete.closeAutocomplete}
      onHoverIndex={autocomplete.setAutocompleteSelectedIndex}
    />
  );
}
