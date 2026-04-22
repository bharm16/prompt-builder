import type { PromptHistoryEntry } from "@features/prompt-optimizer";

export function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function resolveEntryTitle(entry: PromptHistoryEntry): string {
  const storedTitle =
    typeof entry.title === "string" ? normalizeTitle(entry.title) : "";
  if (storedTitle) return storedTitle;
  return deriveBaseTitle(entry.input);
}

export function extractDisambiguator(
  input: string,
  excludeTokens?: string,
): string | null {
  const lower = input.toLowerCase();
  const excludedLower = (excludeTokens ?? "").toLowerCase();
  const priorities = [
    { key: "night", label: "night" },
    { key: "day", label: "day" },
    { key: "handheld", label: "handheld" },
    { key: "wide", label: "wide" },
    { key: "close-up", label: "close-up" },
    { key: "closeup", label: "close-up" },
    { key: "aerial", label: "aerial" },
    { key: "cinematic", label: "cinematic" },
    { key: "noir", label: "noir" },
  ] as const;

  // Skip candidates that are already present in the base title — otherwise
  // a disambiguator like "aerial" becomes a useless echo: "Cinematic Aerial
  // - aerial" instead of meaningfully distinguishing two similar sessions.
  for (const p of priorities) {
    if (lower.includes(p.key) && !excludedLower.includes(p.key)) {
      return p.label;
    }
  }
  return null;
}

const toTitleToken = (token: string): string => {
  if (!token) return token;
  if (token.toLowerCase() === "tv") return "TV";
  if (token.toUpperCase() === token && token.length <= 4) return token;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
};

const MAX_TITLE_CHARS = 40;
const MAX_TITLE_TOKENS = 6;

const deriveBaseTitle = (input: string): string => {
  const normalized = input.trim().replace(/\s+/g, " ");
  if (!normalized) return "Untitled";

  // Take the first sentence — sentence boundaries are natural title breaks
  // and avoid running into later prompt clauses like "..., dramatic golden
  // hour rim light" that dilute the scene.
  const firstSentence = normalized.split(/[.!?]\s+/)[0]?.trim() || normalized;

  const rawTokens = firstSentence.split(" ");
  const stop = new Set([
    "a",
    "an",
    "the",
    "this",
    "that",
    "these",
    "those",
    "some",
    "my",
    "your",
    "our",
    "their",
  ]);

  let start = 0;
  while (
    start < rawTokens.length &&
    stop.has(rawTokens[start]?.toLowerCase() ?? "")
  ) {
    start += 1;
  }

  const tokens = rawTokens.slice(start);
  if (tokens.length === 0) return "Untitled";

  // Accumulate tokens up to MAX_TITLE_TOKENS or MAX_TITLE_CHARS, whichever
  // comes first. The previous implementation forced exactly 2 tokens,
  // producing awkward cuts like "Astronaut On" from "astronaut on mars…".
  const chosen: string[] = [];
  let charCount = 0;
  for (const token of tokens) {
    if (chosen.length >= MAX_TITLE_TOKENS) break;
    const nextLen = charCount + (chosen.length > 0 ? 1 : 0) + token.length;
    if (chosen.length > 0 && nextLen > MAX_TITLE_CHARS) break;
    chosen.push(token);
    charCount = nextLen;
  }

  return chosen
    .filter(Boolean)
    .map((t) => toTitleToken(t))
    .join(" ")
    .trim();
};
