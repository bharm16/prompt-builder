import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("run-calibration.ts regression", () => {
  // Bug 2026-05-15: run-calibration.ts silently failed locally with
  // 'Missing credentials' for OPENAI_API_KEY because it never loaded .env.
  // run-judge.ts loads dotenv at line 1; calibration was missing the same
  // import. CI was unaffected because GH Actions injects env vars directly.
  // The invariant: any quality-judge runtime script that instantiates an
  // LLM client must load .env first, so local execution mirrors CI semantics.
  it("imports dotenv/config so .env is loaded before any LLM client is constructed", async () => {
    const source = await readFile(
      join(__dirname, "..", "run-calibration.ts"),
      "utf8",
    );
    expect(source).toMatch(/import\s+["']dotenv\/config["'];?/);
  });
});
