import {
  sendSyntheticRequest,
  summarizeDriverResults,
  type DriverSummary,
  type HarnessPrompt,
  type HarnessRequestResult,
} from "../utils/request-helper.js";

export async function driveSpanLabels(
  baseUrl: string,
  prompts: HarnessPrompt[],
): Promise<DriverSummary> {
  const results: { prompt: HarnessPrompt; res: HarnessRequestResult }[] = [];

  for (const prompt of prompts) {
    // LabelSpansRequestSchema requires `text` (string, min 1).
    const res = await sendSyntheticRequest(`${baseUrl}/llm/label-spans`, {
      text: prompt.text,
    });
    results.push({ prompt, res });
    console.log(
      `[span-labels] ${prompt.id} ${res.ok ? "OK" : "ERR"} ${res.durationMs}ms${res.errorMessage ? " — " + res.errorMessage : ""}`,
    );
  }

  return summarizeDriverResults("span-labels", results);
}
