import { useCallback, useEffect, useRef, useState } from "react";
import { getMotionIdeas } from "../api/i2vApi";

export interface UseMotionIdeasParams {
  isI2VMode: boolean;
  startImageUrl: string | null;
  startImageSourcePrompt?: string | null;
}

export interface UseMotionIdeasResult {
  ideas: string[];
  isLoading: boolean;
  error: string | null;
  reroll: () => Promise<void>;
}

const FALLBACK_IDEAS: readonly string[] = Object.freeze([
  "subtle natural movement",
  "gentle ambient motion",
  "slow camera push",
]);

export function useMotionIdeas({
  isI2VMode,
  startImageUrl,
  startImageSourcePrompt,
}: UseMotionIdeasParams): UseMotionIdeasResult {
  const [ideas, setIdeas] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastImageRef = useRef<string | null>(null);

  const fetchIdeas = useCallback(
    async (rerollTemperature?: number): Promise<void> => {
      if (!isI2VMode || !startImageUrl) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const response = await getMotionIdeas(
          {
            image: startImageUrl,
            ...(startImageSourcePrompt
              ? { sourcePrompt: startImageSourcePrompt }
              : {}),
            ...(typeof rerollTemperature === "number"
              ? { temperature: rerollTemperature }
              : {}),
          },
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) {
          setIdeas(response.ideas);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : "Failed to load motion ideas";
        setError(message);
        setIdeas([...FALLBACK_IDEAS]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [isI2VMode, startImageUrl, startImageSourcePrompt],
  );

  useEffect(() => {
    if (!isI2VMode || !startImageUrl) {
      abortRef.current?.abort();
      lastImageRef.current = null;
      setIdeas([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    const key = `${startImageUrl}|${startImageSourcePrompt ?? ""}`;
    if (lastImageRef.current === key) return;
    lastImageRef.current = key;
    void fetchIdeas();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchIdeas, isI2VMode, startImageUrl, startImageSourcePrompt]);

  const reroll = useCallback(async () => {
    await fetchIdeas(0.9);
  }, [fetchIdeas]);

  return { ideas, isLoading, error, reroll };
}
