import { useCallback, useEffect, useRef, useState } from "react";
import { useGenerationControlsStoreState } from "@features/generation-controls";
import { observeImage } from "../api/i2vApi";
import { type I2VContext, type ImageObservation } from "../types/i2v";
import { resolveMediaUrl } from "@/services/media/MediaUrlResolver";
import {
  extractStorageObjectPath,
  hasGcsSignedUrlParams,
  parseGcsSignedUrlExpiryMs,
} from "@/utils/storageUrl";

const OBSERVATION_REFRESH_BUFFER_MS = 2 * 60 * 1000;

const parseExpiresAtMs = (value?: string | null): number | null => {
  if (!value || typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const shouldRefreshObservationUrl = (
  url: string | null,
  expiresAtMs: number | null,
): boolean => {
  if (!url || typeof url !== "string") return true;
  if (expiresAtMs !== null) {
    return Date.now() >= expiresAtMs - OBSERVATION_REFRESH_BUFFER_MS;
  }
  return hasGcsSignedUrlParams(url);
};

export function useI2VContext(): I2VContext {
  const { domain } = useGenerationControlsStoreState();
  const startFrame = domain.startFrame;
  const startImageUrl = startFrame?.url ?? null;
  const startImageSourcePrompt = startFrame?.sourcePrompt ?? null;
  const startImageViewUrlExpiresAt = startFrame?.viewUrlExpiresAt ?? null;
  const [observation, setObservation] = useState<ImageObservation | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastImageRef = useRef<string | null>(null);

  const isI2VMode = Boolean(startImageUrl);

  const resolveObservationUrl = useCallback(
    async (url: string | null): Promise<string | null> => {
      if (!url || typeof url !== "string") return url;
      const storagePath = extractStorageObjectPath(url);
      const expiresAtMs =
        parseExpiresAtMs(startImageViewUrlExpiresAt) ??
        parseGcsSignedUrlExpiryMs(url);
      const needsRefresh = shouldRefreshObservationUrl(url, expiresAtMs);
      if (!needsRefresh) return url;

      const resolved = await resolveMediaUrl({
        kind: "image",
        url,
        storagePath: storagePath ?? null,
        preferFresh: true,
      });
      return resolved.url ?? url;
    },
    [startImageViewUrlExpiresAt],
  );

  const refreshObservation = useCallback(async () => {
    if (!startImageUrl) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsAnalyzing(true);
    setError(null);

    try {
      const resolvedUrl = await resolveObservationUrl(startImageUrl);
      const result = await observeImage(
        {
          image: resolvedUrl || startImageUrl,
          ...(startImageSourcePrompt
            ? { sourcePrompt: startImageSourcePrompt }
            : {}),
        },
        { signal: controller.signal },
      );

      if (!result.success || !result.observation) {
        setObservation(null);
        setError(result.error || "Image analysis failed");
        return;
      }

      setObservation(result.observation);
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }
      const message =
        err instanceof Error ? err.message : "Image analysis failed";
      setObservation(null);
      setError(message);
    } finally {
      if (!controller.signal.aborted) {
        setIsAnalyzing(false);
      }
    }
  }, [resolveObservationUrl, startImageSourcePrompt, startImageUrl]);

  useEffect(() => {
    if (!startImageUrl) {
      abortRef.current?.abort();
      lastImageRef.current = null;
      setObservation(null);
      setError(null);
      setIsAnalyzing(false);
      return;
    }

    const imageKey = `${startImageUrl}|${startImageSourcePrompt ?? ""}`;

    if (lastImageRef.current === imageKey) {
      return;
    }

    lastImageRef.current = imageKey;
    setObservation(null);
    setError(null);
    void refreshObservation();

    return () => {
      abortRef.current?.abort();
    };
  }, [refreshObservation, startImageSourcePrompt, startImageUrl]);

  return {
    isI2VMode,
    startImageUrl,
    startImageSourcePrompt,
    observation,
    isAnalyzing,
    error,
    refreshObservation,
  };
}
