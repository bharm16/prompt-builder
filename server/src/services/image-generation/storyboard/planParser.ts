import { z } from 'zod';
import { extractAndParse } from '@utils/JsonExtractor';

type DeltaSource = 'plan' | 'array' | 'lines';

const STORYBOARD_DELTAS_SCHEMA = z.array(z.string());
const STORYBOARD_PLAN_SCHEMA = z.object({
  deltas: STORYBOARD_DELTAS_SCHEMA,
});

type DeltaCandidate = {
  source: DeltaSource;
  deltas: string[];
};

export type StoryboardDeltasParseResult =
  | {
      ok: true;
      deltas: string[];
      truncated: boolean;
      actualCount: number;
      source: DeltaSource;
    }
  | { ok: false; error: string };

const normalizeDeltas = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((delta): delta is string => typeof delta === 'string')
    .map((delta) => delta.trim())
    .filter((delta) => delta.length > 0);
};

const tryParsePlanObject = (responseText: string): string[] | null => {
  try {
    const parsed = extractAndParse<unknown>(responseText, false);
    const validated = STORYBOARD_PLAN_SCHEMA.safeParse(parsed);
    if (validated.success) {
      return normalizeDeltas(validated.data.deltas);
    }
    if (parsed && typeof parsed === 'object' && 'deltas' in parsed) {
      return normalizeDeltas((parsed as { deltas?: unknown }).deltas);
    }
  } catch {
    return null;
  }
  return null;
};

const tryParseDeltasArray = (responseText: string): string[] | null => {
  try {
    const parsed = extractAndParse<unknown>(responseText, true);
    const validated = STORYBOARD_DELTAS_SCHEMA.safeParse(parsed);
    if (validated.success) {
      return normalizeDeltas(validated.data);
    }
    if (Array.isArray(parsed)) {
      return normalizeDeltas(parsed);
    }
  } catch {
    return null;
  }
  return null;
};

const tryParseLines = (responseText: string): string[] | null => {
  const lines = responseText
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:-|\*|\d+\.)\s*/g, '').trim())
    .filter((line) => line.length > 0);
  const deltas = normalizeDeltas(lines);
  return deltas.length > 0 ? deltas : null;
};

const collectCandidates = (responseText: string): DeltaCandidate[] => {
  const candidates: DeltaCandidate[] = [];

  const planObject = tryParsePlanObject(responseText);
  if (planObject) {
    candidates.push({ source: 'plan', deltas: planObject });
  }

  const arrayDeltas = tryParseDeltasArray(responseText);
  if (arrayDeltas) {
    candidates.push({ source: 'array', deltas: arrayDeltas });
  }

  const lineDeltas = tryParseLines(responseText);
  if (lineDeltas) {
    candidates.push({ source: 'lines', deltas: lineDeltas });
  }

  return candidates;
};

export const parseStoryboardDeltas = (
  responseText: string,
  expectedCount: number
): StoryboardDeltasParseResult => {
  const candidates = collectCandidates(responseText);
  const match = candidates.find((candidate) => candidate.deltas.length >= expectedCount);
  if (!match) {
    return {
      ok: false,
      error: `Storyboard planner returned insufficient deltas, expected ${expectedCount}`,
    };
  }

  const truncated = match.deltas.length > expectedCount;
  return {
    ok: true,
    deltas: match.deltas.slice(0, expectedCount),
    truncated,
    actualCount: match.deltas.length,
    source: match.source,
  };
};
