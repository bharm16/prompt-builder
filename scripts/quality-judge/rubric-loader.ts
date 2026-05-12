import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import type { QualityScoredSurface } from "./judge-event-types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function rubricPath(surface: QualityScoredSurface): string {
  return join(__dirname, "rubrics", `${surface}.md`);
}

function normalize(s: string): string {
  // Collapse arbitrary whitespace so trivial whitespace edits don't bump the version.
  return s.replace(/\s+/g, " ").trim();
}

export function __testHashRubricContent(content: string): string {
  return createHash("sha256")
    .update(normalize(content))
    .digest("hex")
    .slice(0, 8);
}

export async function loadRubric(
  surface: QualityScoredSurface,
): Promise<string> {
  return readFile(rubricPath(surface), "utf8");
}

export async function rubricVersionFor(
  surface: QualityScoredSurface,
): Promise<string> {
  const content = await loadRubric(surface);
  return __testHashRubricContent(content);
}
