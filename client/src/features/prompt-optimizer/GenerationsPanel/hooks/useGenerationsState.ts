import { useCallback, useEffect, useReducer, useRef } from 'react';
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

const buildInitialState = (initial?: Generation[]): GenerationsState => {
  const generations = initial ?? [];
  const activeGenerationId = generations.length ? generations[generations.length - 1].id : null;
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
      console.debug('[PERSIST-DEBUG][generationsReducer] ADD_GENERATION', {
        id: next.id,
        tier: next.tier,
        model: next.model,
        mediaType: next.mediaType,
        status: next.status,
        totalGenerations: generations.length,
      });
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
      console.debug('[PERSIST-DEBUG][generationsReducer] UPDATE_GENERATION', {
        id: action.payload.id,
        updatedFields: Object.keys(updates),
        newStatus: updates.status ?? '(unchanged)',
        mediaUrlCount: updates.mediaUrls?.length ?? '(unchanged)',
        mediaAssetIdCount: updates.mediaAssetIds?.length ?? '(unchanged)',
        hasThumbnail: updates.thumbnailUrl !== undefined ? Boolean(updates.thumbnailUrl) : '(unchanged)',
      });
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
      const preservedActiveId =
        state.activeGenerationId && generations.some((g) => g.id === state.activeGenerationId)
          ? state.activeGenerationId
          : (generations.length ? generations[generations.length - 1].id : null);
      console.debug('[PERSIST-DEBUG][generationsReducer] SET_GENERATIONS (from initialGenerations)', {
        incomingCount: generations.length,
        previousCount: state.generations.length,
        generationSummary: generations.map((g) => ({
          id: g.id.slice(-6),
          status: g.status,
          mediaType: g.mediaType,
          mediaUrlCount: g.mediaUrls?.length ?? 0,
          mediaAssetIdCount: g.mediaAssetIds?.length ?? 0,
          hasThumbnail: Boolean(g.thumbnailUrl),
          firstUrl: g.mediaUrls?.[0]?.slice(0, 60) ?? null,
        })),
      });
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
  initialGenerations?: Generation[];
  onGenerationsChange?: (generations: Generation[]) => void;
  promptVersionId?: string | null;
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
    const sameContent = areGenerationsEqual(initialGenerations, generationsRef.current);
    const hasLocalForVersion = Boolean(
      promptVersionId &&
        Array.isArray(initialGenerations) &&
        initialGenerations.length === 0 &&
        generationsRef.current.some((gen) => gen.promptVersionId === promptVersionId)
    );

    console.debug('[PERSIST-DEBUG][useGenerationsState] sync check', {
      hasInitial,
      sameRef,
      sameContent,
      hasLocalForVersion,
      initialCount: initialGenerations?.length ?? 0,
      localCount: generationsRef.current.length,
      promptVersionId,
      willSkip: !hasInitial || sameRef || sameContent || hasLocalForVersion,
      initialSummary: initialGenerations?.map((g) => ({
        id: g.id.slice(-6),
        status: g.status,
        mediaType: g.mediaType,
        mediaUrlCount: g.mediaUrls?.length ?? 0,
        mediaAssetIdCount: g.mediaAssetIds?.length ?? 0,
      })),
    });

    if (!hasInitial || sameRef || sameContent || hasLocalForVersion) return;

    initialRef.current = initialGenerations;
    suppressOnChangeRef.current = true;
    dispatch({ type: 'SET_GENERATIONS', payload: initialGenerations });
  }, [initialGenerations, promptVersionId]);

  // Emit changes to parent
  // Bug 8 fix: skip when only callback reference changed but generations didn't
  const prevGenerationsRef = useRef(state.generations);
  useEffect(() => {
    if (suppressOnChangeRef.current) {
      console.debug('[PERSIST-DEBUG][useGenerationsState] emit SUPPRESSED (initial sync)', {
        generationCount: state.generations.length,
      });
      suppressOnChangeRef.current = false;
      prevGenerationsRef.current = state.generations;
      return;
    }
    if (prevGenerationsRef.current === state.generations) return;
    console.debug('[PERSIST-DEBUG][useGenerationsState] emitting generations to parent', {
      count: state.generations.length,
      hasCallback: Boolean(onGenerationsChange),
      generationSummary: state.generations.map((g) => ({
        id: g.id.slice(-6),
        status: g.status,
        mediaType: g.mediaType,
        mediaUrlCount: g.mediaUrls?.length ?? 0,
        mediaAssetIdCount: g.mediaAssetIds?.length ?? 0,
        hasThumbnail: Boolean(g.thumbnailUrl),
      })),
    });
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
