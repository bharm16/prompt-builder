import { escapeRegex } from "@shared/utils/escapeRegex";

export function applySceneChangeUpdates(
  prompt: string,
  suggestedUpdates: Record<string, string>,
  affectedFields: Record<string, string>,
): string {
  let finalPrompt = prompt;

  Object.entries(suggestedUpdates).forEach(([fieldName, newFieldValue]) => {
    const oldFieldValue = affectedFields[fieldName];

    if (!oldFieldValue || !newFieldValue) {
      return;
    }

    const pattern = new RegExp(
      `(- ${escapeRegex(fieldName)}: \\[)${escapeRegex(oldFieldValue)}(\\])`,
      "g",
    );

    finalPrompt = finalPrompt.replace(pattern, `$1${newFieldValue}$2`);
  });

  return finalPrompt;
}
