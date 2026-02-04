import { useCallback, useEffect, useReducer, useRef } from 'react';
import { hasGcsSignedUrlParams, parseGcsSignedUrlExpiryMs } from '@/utils/storageUrl';
import type { Generation, GenerationTier } from '../types';
import { areGenerationsEqual } from '../utils/generationComparison';

export type GenerationsState = {
  generations: Generation[];
  activeGenerationId: string | null;
  isGenerating: boolean;
};

export type GenerationsAction =
  | { type: 'ADD_GENERATION'; payload: Generation }
  | { type: 'UPDATE_GENERATION'; payload: { id: string; updates: Partial<Generation> } }
  | { type: 'REMOVE_GENERATION'; payload: { id: string } }
  | { type: 'SET_ACTIVE'; payload: string | null }
  | { type: 'SET_GENERATIONS'; payload: Generation[] };

const deriveIsGenerating = (generations: Generation[]): boolean =>
  generations.some((gen) => gen.status === 'pending' || gen.status === 'generating');

const SIGNED_URL_PREFERENCE_BUFFER_MS = 2 * 60 * 1000;

const isV4SignedUrl = (url: string): boolean =>
  url.includes('X-Goog-Algorithm=') || url.includes('X-Goog-Signature=') || url.includes('X-Goog-Credential=');

const pickPreferredUrl = (
  incoming?: string | null,
  local?: string | null,
  nowMs: number = Date.now()
): string | null | undefined => {
  if (!incoming) return local ?? incoming;
  if (!local) return incoming;
  if (incoming === local) return incoming;

  const incomingSigned = hasGcsSignedUrlParams(incoming);
  const localSigned = hasGcsSignedUrlParams(local);

  if (!incomingSigned && localSigned) {
    return incoming;
  }
  if (incomingSigned && !localSigned) {
    return local;
  }
  if (!incomingSigned && !localSigned) {
    return incoming;
  }

  const incomingExpiry = parseGcsSignedUrlExpiryMs(incoming);
  const localExpiry = parseGcsSignedUrlExpiryMs(local);
  const incomingExpired =
    incomingExpiry !== null && nowMs >= incomingExpiry - SIGNED_URL_PREFERENCE_BUFFER_MS;
  const localExpired =
    localExpiry !== null && nowMs >= localExpiry - SIGNED_URL_PREFERENCE_BUFFER_MS;

  if (incomingExpired && !localExpired) return local;
  if (!incomingExpired && localExpired) return incoming;

  if (incomingExpiry && localExpiry && incomingExpiry !== localExpiry) {
    return incomingExpiry >= localExpiry ? incoming : local;
  }

  const incomingV4 = isV4SignedUrl(incoming);
  const localV4 = isV4SignedUrl(local);
  if (incomingV4 !== localV4) {
    return incomingV4 ? incoming : local;
  }

  return incoming;
};

const mergeMediaUrls = (
  incoming: string[] | undefined,
  local: string[] | undefined,
  nowMs: number
): string[] => {
  if (!incoming || incoming.length === 0) {
    return local ? [...local] : [];
  }

  return incoming.map((url, index) =>
    (pickPreferredUrl(url, local?.[index], nowMs) ?? url)
  );
};

const mergeGenerations = (
  incoming: Generation[] | undefined,
  local: Generation[]
): Generation[] | undefined => {
  if (!incoming) return incoming;
  if (!local.length) return incoming;

  const nowMs = Date.now();
  const localById = new Map(local.map((gen) => [gen.id, gen]));

  return incoming.map((gen) => {
    const existing = localById.get(gen.id);
    if (!existing) return gen;

    const mergedMediaUrls = mergeMediaUrls(gen.mediaUrls, existing.mediaUrls, nowMs);
    const mergedThumbnail =
      pickPreferredUrl(gen.thumbnailUrl ?? null, existing.thumbnailUrl ?? null, nowMs) ??
      gen.thumbnailUrl ??
      existing.thumbnailUrl ??
      null;

    const mediaUrlsChanged =
      mergedMediaUrls.length !== gen.mediaUrls.length ||
      mergedMediaUrls.some((url, index) => url !== gen.mediaUrls[index]);
    const thumbnailChanged = mergedThumbnail !== (gen.thumbnailUrl ?? null);

    if (!mediaUrlsChanged && !thumbnailChanged) {
      return gen;
    }

    return {
      ...gen,
      mediaUrls: mergedMediaUrls,
      thumbnailUrl: mergedThumbnail,
    };
  });
};

const buildInitialState = (initial?: Generation[]): GenerationsState => {
  const generations = initial ?? [];
  const lastGeneration = generations.length > 0 ? generations[generations.length - 1]! : null;
  const activeGenerationId = lastGeneration?.id ?? null;
  return { generations, activeGenerationId, isGenerating: deriveIsGenerating(generations) };
};

function generationsReducer(
  state: GenerationsState,
  action: GenerationsAction
): GenerationsState {
  switch (action.type) {
    case 'ADD_GENERATION': {
      const next = { ...action.payload };
      const generations = [...state.generations, next];
      return {
        generations,
        activeGenerationId: next.id,
        isGenerating: deriveIsGenerating(generations),
      };
    }
    case 'UPDATE_GENERATION': {
      const updates = action.payload.updates;
      const generations = state.generations.map((gen) =>
        gen.id === action.payload.id ? { ...gen, ...updates } : gen
      );
      return { ...state, generations, isGenerating: deriveIsGenerating(generations) };
    }
    case 'REMOVE_GENERATION': {
      const generations = state.generations.filter((gen) => gen.id !== action.payload.id);
      const activeGenerationId =
        state.activeGenerationId === action.payload.id
          ? generations[generations.length - 1]?.id ?? null
          : state.activeGenerationId;
      return { generations, activeGenerationId, isGenerating: deriveIsGenerating(generations) };
    }
    case 'SET_ACTIVE':
      return { ...state, activeGenerationId: action.payload };
    case 'SET_GENERATIONS': {
      const generations = action.payload ?? [];
      // Bug 15 fix: preserve activeGenerationId if it still exists in the new set
      const lastGeneration = generations.length > 0 ? generations[generations.length - 1]! : null;
      const preservedActiveId =
        state.activeGenerationId && generations.some((g) => g.id === state.activeGenerationId)
          ? state.activeGenerationId
          : (lastGeneration?.id ?? null);
      return {
        generations,
        activeGenerationId: preservedActiveId,
        isGenerating: deriveIsGenerating(generations),
      };
    }
    default:
      return state;
  }
}

interface UseGenerationsStateOptions {
  initialGenerations?: Generation[] | undefined;
  onGenerationsChange?: ((generations: Generation[]) => void) | undefined;
  promptVersionId?: string | null | undefined;
}

export function useGenerationsState({
  initialGenerations,
  onGenerationsChange,
  promptVersionId,
}: UseGenerationsStateOptions = {}) {
  const [state, dispatch] = useReducer(
    generationsReducer,
    initialGenerations,
    buildInitialState
  );
  const initialRef = useRef<Generation[] | undefined>(initialGenerations);
  const suppressOnChangeRef = useRef(false);
  const generationsRef = useRef(state.generations);
  generationsRef.current = state.generations;

  // Sync initialGenerations into local state
  // Bug 7 fix: read state.generations via ref to avoid re-triggering on local changes
  useEffect(() => {
    const hasInitial = Boolean(initialGenerations);
    const sameRef = initialRef.current === initialGenerations;
    const mergedGenerations = mergeGenerations(initialGenerations, generationsRef.current);
    const sameContent = areGenerationsEqual(mergedGenerations, generationsRef.current);
    const hasLocalForVersion = Boolean(
      promptVersionId &&
        Array.isArray(initialGenerations) &&
        initialGenerations.length === 0 &&
        generationsRef.current.some((gen) => gen.promptVersionId === promptVersionId)
    );

    if (!hasInitial || sameRef || sameContent || hasLocalForVersion) return;

    initialRef.current = initialGenerations;
    suppressOnChangeRef.current = true;
    dispatch({ type: 'SET_GENERATIONS', payload: mergedGenerations ?? [] });
  }, [initialGenerations, promptVersionId]);

  // Emit changes to parent
  // Bug 8 fix: skip when only callback reference changed but generations didn't
  const prevGenerationsRef = useRef(state.generations);
  useEffect(() => {
    if (suppressOnChangeRef.current) {
      suppressOnChangeRef.current = false;
      prevGenerationsRef.current = state.generations;
      return;
    }
    if (prevGenerationsRef.current === state.generations) return;
    prevGenerationsRef.current = state.generations;
    onGenerationsChange?.(state.generations);
  }, [onGenerationsChange, state.generations]);

  const addGeneration = useCallback(
    (generation: Generation) => dispatch({ type: 'ADD_GENERATION', payload: generation }),
    []
  );

  const updateGeneration = useCallback(
    (id: string, updates: Partial<Generation>) =>
      dispatch({ type: 'UPDATE_GENERATION', payload: { id, updates } }),
    []
  );

  const removeGeneration = useCallback(
    (id: string) => dispatch({ type: 'REMOVE_GENERATION', payload: { id } }),
    []
  );

  const setActiveGeneration = useCallback(
    (id: string | null) => dispatch({ type: 'SET_ACTIVE', payload: id }),
    []
  );

  const getDraftGenerations = useCallback(
    () => state.generations.filter((gen) => gen.tier === 'draft'),
    [state.generations]
  );

  const getRenderGenerations = useCallback(
    () => state.generations.filter((gen) => gen.tier === 'render'),
    [state.generations]
  );

  const getActiveGeneration = useCallback(() => {
    if (!state.activeGenerationId) return null;
    return state.generations.find((gen) => gen.id === state.activeGenerationId) ?? null;
  }, [state.activeGenerationId, state.generations]);

  const getLatestByTier = useCallback(
    (tier: GenerationTier) => {
      const items = state.generations.filter((gen) => gen.tier === tier);
      return items.length ? items[items.length - 1] : null;
    },
    [state.generations]
  );

  return {
    generations: state.generations,
    activeGenerationId: state.activeGenerationId,
    isGenerating: state.isGenerating,
    dispatch,
    addGeneration,
    updateGeneration,
    removeGeneration,
    setActiveGeneration,
    getDraftGenerations,
    getRenderGenerations,
    getActiveGeneration,
    getLatestByTier,
  };
}
