import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Generation, GenerationTier } from '../types';

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

const serializeGeneration = (gen: Generation): string =>
  JSON.stringify({
    id: gen.id,
    status: gen.status,
    tier: gen.tier,
    model: gen.model,
    promptVersionId: gen.promptVersionId ?? null,
    createdAt: gen.createdAt,
    completedAt: gen.completedAt ?? null,
    estimatedCost: gen.estimatedCost ?? null,
    actualCost: gen.actualCost ?? null,
    aspectRatio: gen.aspectRatio ?? null,
    duration: gen.duration ?? null,
    fps: gen.fps ?? null,
    thumbnailUrl: gen.thumbnailUrl ?? null,
    error: gen.error ?? null,
    mediaType: gen.mediaType,
    mediaUrls: gen.mediaUrls ?? [],
  });

const areGenerationsEqual = (
  left?: Generation[] | null,
  right?: Generation[] | null
): boolean => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (serializeGeneration(left[i]) !== serializeGeneration(right[i])) {
      return false;
    }
  }
  return true;
};

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
      return {
        generations,
        activeGenerationId: next.id,
        isGenerating: deriveIsGenerating(generations),
      };
    }
    case 'UPDATE_GENERATION': {
      const generations = state.generations.map((gen) =>
        gen.id === action.payload.id ? { ...gen, ...action.payload.updates } : gen
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
      const preservedActiveId =
        state.activeGenerationId && generations.some((g) => g.id === state.activeGenerationId)
          ? state.activeGenerationId
          : (generations.length ? generations[generations.length - 1].id : null);
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
