import type { PromptHistoryEntry } from '@hooks/types';

export function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function resolveEntryTitle(entry: PromptHistoryEntry): string {
  const storedTitle = typeof entry.title === 'string' ? normalizeTitle(entry.title) : '';
  if (storedTitle) return storedTitle;
  return deriveBaseTitle(entry.input);
}

export function extractDisambiguator(input: string): string | null {
  const lower = input.toLowerCase();
  const priorities = [
    { key: 'night', label: 'night' },
    { key: 'day', label: 'day' },
    { key: 'handheld', label: 'handheld' },
    { key: 'wide', label: 'wide' },
    { key: 'close-up', label: 'close-up' },
    { key: 'closeup', label: 'close-up' },
    { key: 'aerial', label: 'aerial' },
    { key: 'cinematic', label: 'cinematic' },
    { key: 'noir', label: 'noir' },
  ] as const;

  for (const p of priorities) {
    if (lower.includes(p.key)) return p.label;
  }
  return null;
}

const toTitleToken = (token: string): string => {
  if (!token) return token;
  if (token.toLowerCase() === 'tv') return 'TV';
  if (token.toUpperCase() === token && token.length <= 4) return token;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
};

const deriveBaseTitle = (input: string): string => {
  const normalized = input.trim().replace(/\s+/g, ' ');
  if (!normalized) return 'Untitled';

  const rawTokens = normalized.split(' ');
  const stop = new Set([
    'a',
    'an',
    'the',
    'this',
    'that',
    'these',
    'those',
    'some',
    'my',
    'your',
    'our',
    'their',
  ]);

  let start = 0;
  while (start < rawTokens.length && stop.has(rawTokens[start]?.toLowerCase() ?? '')) {
    start += 1;
  }

  const tokens = rawTokens.slice(start);
  if (tokens.length === 0) return 'Untitled';

  const first = tokens[0] ?? '';
  const second = tokens[1] ?? '';
  const third = tokens[2] ?? '';
  const secondLower = second.toLowerCase();

  const nounFollowers = new Set([
    'chase',
    'battle',
    'portrait',
    'scene',
    'shot',
    'sequence',
    'close-up',
    'closeup',
  ]);
  const takeThird = secondLower.endsWith('ing') && third;
  const takeTwo = nounFollowers.has(secondLower) || Boolean(second);

  const chosen: string[] = [];
  chosen.push(first);
  if (takeTwo) chosen.push(second);
  if (takeThird) chosen.push(third);

  return chosen
    .filter(Boolean)
    .map((t) => toTitleToken(t))
    .join(' ')
    .trim();
};
