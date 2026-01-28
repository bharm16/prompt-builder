import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PromptContext } from '@utils/PromptContext/PromptContext';
import type { SuggestionsData } from '../../PromptCanvas/types';

export function usePromptSessionState(): {
  suggestionsData: SuggestionsData | null;
  setSuggestionsData: Dispatch<SetStateAction<SuggestionsData | null>>;
  conceptElements: unknown | null;
  setConceptElements: (elements: unknown | null) => void;
  promptContext: PromptContext | null;
  setPromptContext: (context: PromptContext | null) => void;
  currentPromptUuid: string | null;
  setCurrentPromptUuid: (uuid: string | null) => void;
  currentPromptDocId: string | null;
  setCurrentPromptDocId: (docId: string | null) => void;
  activeVersionId: string | null;
  setActiveVersionId: (id: string | null) => void;
} {
  const [suggestionsData, setSuggestionsData] = useState<SuggestionsData | null>(null);
  const [conceptElements, setConceptElements] = useState<unknown | null>(null);
  const [promptContext, setPromptContext] = useState<PromptContext | null>(null);
  const [currentPromptUuid, setCurrentPromptUuid] = useState<string | null>(null);
  const [currentPromptDocId, setCurrentPromptDocId] = useState<string | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

  return {
    suggestionsData,
    setSuggestionsData,
    conceptElements,
    setConceptElements,
    promptContext,
    setPromptContext,
    currentPromptUuid,
    setCurrentPromptUuid,
    currentPromptDocId,
    setCurrentPromptDocId,
    activeVersionId,
    setActiveVersionId,
  };
}
