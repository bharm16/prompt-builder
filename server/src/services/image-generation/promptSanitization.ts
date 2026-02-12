const PREVIEW_SECTION_MARKERS: RegExp[] = [
  /\r?\n\s*\*\*\s*technical specs\s*\*\*/i,
  /\r?\n\s*\*\*\s*technical parameters\s*\*\*/i,
  /\r?\n\s*\*\*\s*alternative approaches\s*\*\*/i,
  /\r?\n\s*technical specs\s*[:\n]/i,
  /\r?\n\s*alternative approaches\s*[:\n]/i,
  /\r?\n\s*variation\s+\d+/i,
];

const MIN_STRIPPED_PROMPT_LENGTH = 10;

export const stripPreviewSections = (prompt: string): string => {
  if (!prompt) {
    return prompt;
  }

  let cutIndex = -1;
  for (const marker of PREVIEW_SECTION_MARKERS) {
    const match = marker.exec(prompt);
    if (match && (cutIndex === -1 || match.index < cutIndex)) {
      cutIndex = match.index;
    }
  }

  const stripped = (cutIndex >= 0 ? prompt.slice(0, cutIndex) : prompt).trim();
  return stripped.length >= MIN_STRIPPED_PROMPT_LENGTH ? stripped : prompt.trim();
};
