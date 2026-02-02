import { useCallback } from 'react';
import { createHighlightSignature } from '@features/span-highlighting';
import type { NavigateFunction } from 'react-router-dom';
import type { HighlightSnapshot } from '@features/prompt-optimizer/context/types';
import type { PromptHistoryEntry, PromptVersionEntry } from '@hooks/types';
import type { PromptContext } from '@utils/PromptContext/PromptContext';
import type { OptimizationOptions } from '../../types';
import type { CapabilityValues } from '@shared/capabilities';
import { storageApi } from '@/api/storageApi';
import { applyOptimizationResult } from '../utils/persistOptimizationResult';
import {
  extractStorageObjectPath,
  hasGcsSignedUrlParams,
  parseGcsSignedUrlExpiryMs,
} from '@/utils/storageUrl';

const OPTIMIZATION_REFRESH_BUFFER_MS = 2 * 60 * 1000;

const parseExpiresAtMs = (value?: string | null): number | null => {
  if (!value || typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const shouldRefreshStartImage = (url: string | null, expiresAtMs: number | null): boolean => {
  if (!url || typeof url !== 'string') return true;
  if (expiresAtMs !== null) {
    return Date.now() >= expiresAtMs - OPTIMIZATION_REFRESH_BUFFER_MS;
  }
  return hasGcsSignedUrlParams(url);
};

const resolveOptimizationStartImageUrl = async (
  url: string | null | undefined,
  storagePath?: string | null,
  viewUrlExpiresAt?: string | null
): Promise<string | null> => {
  if (!url || typeof url !== 'string') return url ?? null;
  const resolvedStoragePath = storagePath || extractStorageObjectPath(url);
  if (!resolvedStoragePath) return url;
  const expiresAtMs = parseExpiresAtMs(viewUrlExpiresAt) ?? parseGcsSignedUrlExpiryMs(url);
  const needsRefresh = shouldRefreshStartImage(url, expiresAtMs);
  if (!needsRefresh) return url;
  try {
    const response = (await storageApi.getViewUrl(resolvedStoragePath)) as { viewUrl: string };
    return response?.viewUrl || url;
  } catch {
    return url;
  }
};

interface PromptOptimizer {
  inputPrompt: string;
  genericOptimizedPrompt?: string | null;
  improvementContext: Record<string, unknown> | null;
  optimize: (
    prompt: string,
    context: Record<string, unknown> | null,
    brainstormContext: Record<string, unknown> | null,
    targetModel?: string,
    options?: OptimizationOptions
  ) => Promise<{ optimized: string; score: number | null } | null>;
  compile: (
    prompt: string,
    targetModel?: string,
    context?: Record<string, unknown> | null
  ) => Promise<{ optimized: string; score: number | null } | null>;
}

interface PromptHistory {
  history: PromptHistoryEntry[];
  updateEntryVersions: (uuid: string, docId: string | null, versions: PromptVersionEntry[]) => void;
  saveToHistory: (
    input: string,
    output: string,
    score: number | null,
    mode: string,
    targetModel?: string | null,
    generationParams?: Record<string, unknown> | null,
    keyframes?: PromptHistoryEntry['keyframes'],
    brainstormContext?: Record<string, unknown> | null,
    highlightCache?: Record<string, unknown> | null,
    existingUuid?: string | null,
    title?: string | null
  ) => Promise<{ uuid: string; id?: string } | null>;
}

export interface UsePromptOptimizationParams {
  promptOptimizer: PromptOptimizer;
  promptHistory: PromptHistory;
  promptContext: PromptContext | null;
  selectedMode: string;
  selectedModel?: string; // New: optional selected model
  generationParams: CapabilityValues;
  keyframes?: PromptHistoryEntry['keyframes'];
  startImageUrl?: string | null;
  sourcePrompt?: string | null;
  constraintMode?: 'strict' | 'flexible' | 'transform';
  currentPromptUuid: string | null;
  setCurrentPromptUuid: (uuid: string) => void;
  setCurrentPromptDocId: (id: string | null) => void;
  setDisplayedPromptSilently: (prompt: string) => void;
  setShowResults: (show: boolean) => void;
  applyInitialHighlightSnapshot: (
    highlight: HighlightSnapshot | null,
    options: { bumpVersion: boolean; markPersisted: boolean }
  ) => void;
  resetEditStacks: () => void;
  persistedSignatureRef: React.MutableRefObject<string | null>;
  skipLoadFromUrlRef: React.MutableRefObject<boolean>;
  navigate: NavigateFunction;
}

export interface UsePromptOptimizationReturn {
  handleOptimize: (
    promptToOptimize?: string,
    // TODO: This parameter is typed as `unknown` because callers pass different shapes
    // (Record<string, unknown> | null from improvement flow, OptimizationOptions from reoptimize).
    // A future refactor should split this into separate methods.
    context?: unknown,
    options?: OptimizationOptions
  ) => Promise<void>;
}

/**
 * Custom hook for prompt optimization orchestration
 * Handles the optimization flow including saving to history and navigation
 */
export function usePromptOptimization({
  promptOptimizer,
  promptHistory,
  promptContext,
  selectedMode,
  selectedModel, // Extract new param
  generationParams,
  keyframes = null,
  startImageUrl,
  sourcePrompt,
  constraintMode,
  currentPromptUuid,
  setCurrentPromptUuid,
  setCurrentPromptDocId,
  setDisplayedPromptSilently,
  setShowResults,
  applyInitialHighlightSnapshot,
  resetEditStacks,
  persistedSignatureRef,
  skipLoadFromUrlRef,
  navigate,
}: UsePromptOptimizationParams): UsePromptOptimizationReturn {
  /**
   * Handle prompt optimization
   */
  const handleOptimize = useCallback(
    async (
      promptToOptimize?: string,
      context?: unknown,
      options?: OptimizationOptions
    ): Promise<void> => {
      const prompt = promptToOptimize || promptOptimizer.inputPrompt;
      const ctx = (context as Record<string, unknown> | null | undefined) || promptOptimizer.improvementContext;

      // Serialize prompt context
      const serializedContext = promptContext
        ? typeof promptContext.toJSON === 'function'
          ? promptContext.toJSON()
          : {
              elements: promptContext.elements,
              metadata: promptContext.metadata,
            }
        : null;

      const brainstormContextData = serializedContext
        ? {
            elements: serializedContext.elements,
            metadata: serializedContext.metadata,
          }
        : null;

      const isCompileOnly = options?.compileOnly === true;
      const compilePrompt =
        options?.compilePrompt ||
        (typeof promptOptimizer.genericOptimizedPrompt === 'string'
          ? promptOptimizer.genericOptimizedPrompt
          : null);

      const optimizationInput = isCompileOnly ? compilePrompt || prompt : prompt;
      if (typeof optimizationInput === 'string' && optimizationInput.trim()) {
        setShowResults(true);
        setDisplayedPromptSilently('');
      }

      const primaryKeyframe = Array.isArray(keyframes) ? keyframes[0] : null;
      const resolvedStartImageUrl = options?.startImage
        ? options.startImage
        : await resolveOptimizationStartImageUrl(
            startImageUrl ?? null,
            primaryKeyframe?.storagePath ?? null,
            primaryKeyframe?.viewUrlExpiresAt ?? null
          );

      const effectiveOptions: OptimizationOptions = {
        ...(options ?? {}),
        ...(options?.startImage ? {} : resolvedStartImageUrl ? { startImage: resolvedStartImageUrl } : {}),
        ...(options?.sourcePrompt ? {} : sourcePrompt ? { sourcePrompt } : {}),
        ...(options?.constraintMode ? {} : constraintMode ? { constraintMode } : {}),
      };

      const result = isCompileOnly
        ? await promptOptimizer.compile(
            compilePrompt || prompt,
            selectedMode === 'video' ? selectedModel : undefined,
            ctx
          )
        : await promptOptimizer.optimize(
            prompt,
            ctx,
            brainstormContextData,
            selectedMode === 'video' ? selectedModel : undefined,
            {
              ...effectiveOptions,
              ...(generationParams ? { generationParams } : {}),
            }
          );

      if (result) {
        // Save to history
        const saveResult = await promptHistory.saveToHistory(
          prompt,
          result.optimized,
          result.score,
          selectedMode,
          selectedMode === 'video' ? selectedModel ?? null : null,
          (generationParams as unknown as Record<string, unknown>) ?? null,
          keyframes ?? null,
          serializedContext as unknown as Record<string, unknown> | null,
          null,
          currentPromptUuid
        );

        if (saveResult?.uuid) {
          applyOptimizationResult({
            optimizedPrompt: result.optimized,
            saveResult,
            setCurrentPromptUuid,
            setCurrentPromptDocId,
            setDisplayedPromptSilently,
            setShowResults,
            applyInitialHighlightSnapshot,
            resetEditStacks,
            persistedSignatureRef,
            skipLoadFromUrlRef,
            navigate,
          });
        }

        if (saveResult?.uuid && options?.createVersion) {
          const promptText = result.optimized.trim();
          if (promptText) {
            const uuidForVersions = saveResult.uuid;
            const history = Array.isArray(promptHistory.history) ? promptHistory.history : [];
            const existingEntry =
              history.find((entry) => entry.uuid === uuidForVersions) ?? null;
            const currentVersions = Array.isArray(existingEntry?.versions)
              ? existingEntry.versions
              : [];

            const signature = createHighlightSignature(promptText);
            const last = currentVersions[currentVersions.length - 1] ?? null;

            if (!last || last.signature !== signature) {
              const nextVersion: PromptVersionEntry = {
                versionId: `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                label: `v${currentVersions.length + 1}`,
                signature,
                prompt: promptText,
                timestamp: new Date().toISOString(),
              };

              promptHistory.updateEntryVersions(
                uuidForVersions,
                saveResult.id ?? null,
                [...currentVersions, nextVersion]
              );
            }
          }
        }
      }
    },
    [
      promptOptimizer,
      promptHistory,
      promptContext,
      selectedMode,
      selectedModel, // Added dependency
      generationParams,
      keyframes,
      startImageUrl,
      sourcePrompt,
      constraintMode,
      currentPromptUuid,
      setCurrentPromptUuid,
      setCurrentPromptDocId,
      setDisplayedPromptSilently,
      setShowResults,
      applyInitialHighlightSnapshot,
      resetEditStacks,
      persistedSignatureRef,
      skipLoadFromUrlRef,
      navigate,
    ]
  );

  return { handleOptimize };
}
