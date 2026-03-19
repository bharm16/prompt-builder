import { useEffect, useMemo, useState } from 'react';

import type { Generation } from '../types';
import { getGenerationProgressPercent } from '../utils/generationProgress';

const PROGRESS_TICK_MS = 400;

export function useGenerationProgress(generation: Generation) {
  const isGenerating =
    generation.status === 'pending' || generation.status === 'generating';
  const isCompleted = generation.status === 'completed';
  const isFailed = generation.status === 'failed';
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!isGenerating) return;
    const id = window.setInterval(() => setNow(Date.now()), PROGRESS_TICK_MS);
    return () => window.clearInterval(id);
  }, [isGenerating]);

  const progressPercent = useMemo(
    () => getGenerationProgressPercent(generation, now),
    [generation, now]
  );

  return { progressPercent, isGenerating, isCompleted, isFailed };
}
