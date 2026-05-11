import {
  sendSyntheticRequest,
  summarizeDriverResults,
  type DriverSummary,
  type HarnessPrompt,
  type HarnessRequestResult,
} from "../utils/request-helper.js";

export async function driveSuggestions(
  baseUrl: string,
  prompts: HarnessPrompt[],
): Promise<DriverSummary> {
  const results: { prompt: HarnessPrompt; res: HarnessRequestResult }[] = [];

  for (const prompt of prompts) {
    // suggestionSchema requires `highlightedText` (the selected span text) and
    // `fullPrompt` (the complete prompt). We use the first word as a minimal
    // highlighted span — enough to satisfy min(1) on both fields.
    const highlightedText = prompt.text.split(" ")[0] ?? prompt.text;
    const category = prompt.tags[0] ?? "subject";

    const res = await sendSyntheticRequest(
      `${baseUrl}/api/get-enhancement-suggestions`,
      {
        highlightedText,
        fullPrompt: prompt.text,
        highlightedCategory: category,
      },
    );
    results.push({ prompt, res });
    console.log(
      `[suggestions] ${prompt.id} ${res.ok ? "OK" : "ERR"} ${res.durationMs}ms${res.errorMessage ? " — " + res.errorMessage : ""}`,
    );
  }

  return summarizeDriverResults("suggestions", results);
}
