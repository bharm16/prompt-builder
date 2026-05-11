import {
  sendSyntheticRequest,
  summarizeDriverResults,
  type DriverSummary,
  type HarnessPrompt,
  type HarnessRequestResult,
} from "../utils/request-helper.js";

export async function driveOptimize(
  baseUrl: string,
  prompts: HarnessPrompt[],
): Promise<DriverSummary> {
  const results: { prompt: HarnessPrompt; res: HarnessRequestResult }[] = [];

  for (const prompt of prompts) {
    const res = await sendSyntheticRequest(`${baseUrl}/api/optimize`, {
      prompt: prompt.text,
      mode: "video",
    });
    results.push({ prompt, res });
    console.log(
      `[optimize] ${prompt.id} ${res.ok ? "OK" : "ERR"} ${res.durationMs}ms${res.errorMessage ? " — " + res.errorMessage : ""}`,
    );
  }

  return summarizeDriverResults("optimize", results);
}
