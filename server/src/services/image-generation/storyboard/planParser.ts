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

type PartialDeltas = {
  deltas: string[];
  actualCount: number;
  source: DeltaSource;
};

export type StoryboardDeltasParseResult =
  | {
      ok: true;
      deltas: string[];
      truncated: boolean;
      actualCount: number;
      source: DeltaSource;
    }
  | { ok: false; error: string; partial?: PartialDeltas };

const splitDeltaLines = (text: string): string[] =>
  text
    .replace(/\\n/g, '\n')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:-|\*|\d+\.)\s*/g, '').trim())
    .filter((line) => line.length > 0);

const normalizeDeltas = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw
      .map((delta) => (typeof delta === 'string' ? delta : ''))
      .map((delta) => delta.trim())
      .filter((delta) => delta.length > 0);
  }

  if (typeof raw === 'string') {
    return splitDeltaLines(raw);
  }

  return [];
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

const tryParseLines = (responseText: string, allowSingleLine: boolean): string[] | null => {
  const rawLines = responseText.split(/\r?\n/);
  const hasListMarkers = rawLines.some((line) => /^\s*(?:-|\*|\d+\.)\s+/.test(line));
  const lines = splitDeltaLines(responseText);
  if (lines.length === 0) {
    return null;
  }
  if (!allowSingleLine && lines.length === 1 && !hasListMarkers) {
    return null;
  }
  const deltas = normalizeDeltas(lines);
  return deltas.length > 0 ? deltas : null;
};

const collectCandidates = (responseText: string, allowSingleLine: boolean): DeltaCandidate[] => {
  const candidates: DeltaCandidate[] = [];

  const planObject = tryParsePlanObject(responseText);
  if (planObject) {
    candidates.push({ source: 'plan', deltas: planObject });
  }

  const arrayDeltas = tryParseDeltasArray(responseText);
  if (arrayDeltas) {
    candidates.push({ source: 'array', deltas: arrayDeltas });
  }

  const lineDeltas = tryParseLines(responseText, allowSingleLine);
  if (lineDeltas) {
    candidates.push({ source: 'lines', deltas: lineDeltas });
  }

  return candidates;
};

const pickBestCandidate = (candidates: DeltaCandidate[]): DeltaCandidate | null => {
  if (candidates.length === 0) {
    return null;
  }
  return candidates.reduce((best, candidate) => {
    if (candidate.deltas.length > best.deltas.length) {
      return candidate;
    }
    return best;
  }, candidates[0]);
};

export const parseStoryboardDeltas = (
  responseText: string,
  expectedCount: number
): StoryboardDeltasParseResult => {
  const candidates = collectCandidates(responseText, expectedCount <= 1);
  const match = candidates.find((candidate) => candidate.deltas.length >= expectedCount);
  if (!match) {
    const best = pickBestCandidate(candidates);
    return {
      ok: false,
      error: `Storyboard planner returned insufficient deltas, expected ${expectedCount}`,
      ...(best && best.deltas.length > 0
        ? {
            partial: {
              deltas: best.deltas,
              actualCount: best.deltas.length,
              source: best.source,
            },
          }
        : {}),
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
