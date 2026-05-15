import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function calibrationSource(): Promise<string> {
  return readFile(join(__dirname, "..", "run-calibration.ts"), "utf8");
}

describe("run-calibration.ts regression", () => {
  // Bug 2026-05-15: run-calibration.ts silently failed locally with
  // 'Missing credentials' for OPENAI_API_KEY because it never loaded .env.
  // run-judge.ts loads dotenv at line 1; calibration was missing the same
  // import. CI was unaffected because GH Actions injects env vars directly.
  // The invariant: any quality-judge runtime script that instantiates an
  // LLM client must load .env first, so local execution mirrors CI semantics.
  it("imports dotenv/config so .env is loaded before any LLM client is constructed", async () => {
    const source = await calibrationSource();
    expect(source).toMatch(/import\s+["']dotenv\/config["'];?/);
  });

  // Bug 2026-05-15 (second): the per-entry loop used parallel awaiting which
  // pushed ~28k+ tokens at GPT-4o simultaneously, exceeding the 30k TPM rate
  // limit on standard accounts. A real run produced ~16 of 20 entries
  // skipped with 429s, dropping the surface below the 20-valid-entry
  // threshold and printing 'cannot judge.' The invariant: per-entry judge
  // calls inside runForSurface must be serial, not parallel, to stay under
  // TPM limits.
  it("judges calibration entries serially to stay under GPT-4o TPM limits", async () => {
    const source = await calibrationSource();
    expect(source).toContain("for (const entry of entries)");
  });
});
