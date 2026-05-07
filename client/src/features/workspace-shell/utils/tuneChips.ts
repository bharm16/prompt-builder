export interface TuneChip {
  id: string;
  section: "motion" | "mood" | "style";
  label: string;
  /** Suffix appended to the prompt when this chip is selected. */
  suffix: string;
}

export type TuneChipId = TuneChip["id"];

export const TUNE_CHIPS: ReadonlyArray<TuneChip> = [
  {
    id: "m-handheld",
    section: "motion",
    label: "Handheld",
    suffix: "handheld camera",
  },
  { id: "m-dolly", section: "motion", label: "Dolly in", suffix: "dolly-in" },
  {
    id: "m-static",
    section: "motion",
    label: "Static",
    suffix: "locked-off camera",
  },
  {
    id: "mood-soft",
    section: "mood",
    label: "Soft",
    suffix: "soft warm light",
  },
  {
    id: "mood-noir",
    section: "mood",
    label: "Noir",
    suffix: "high-contrast noir lighting",
  },
  {
    id: "mood-dreamy",
    section: "mood",
    label: "Dreamy",
    suffix: "dreamy bloom",
  },
  {
    id: "style-film",
    section: "style",
    label: "Film",
    suffix: "35mm film grain",
  },
  {
    id: "style-anime",
    section: "style",
    label: "Anime",
    suffix: "anime cel shading",
  },
  {
    id: "style-concept",
    section: "style",
    label: "Concept",
    suffix: "concept-art rendering",
  },
];

export function applyTuneChips(
  prompt: string,
  chipIds: ReadonlyArray<TuneChipId>,
): string {
  if (chipIds.length === 0) return prompt;
  const suffixes = TUNE_CHIPS.filter((c) => chipIds.includes(c.id)).map(
    (c) => c.suffix,
  );
  if (suffixes.length === 0) return prompt;
  const trimmed = prompt.trimEnd();
  const sep = trimmed.endsWith(",") ? " " : ", ";
  return `${trimmed}${sep}${suffixes.join(", ")}`;
}
