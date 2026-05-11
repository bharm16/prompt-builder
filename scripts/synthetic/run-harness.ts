import { loadPrompts } from "./utils/request-helper.js";
import { driveOptimize } from "./drivers/optimize.driver.js";
import { driveSuggestions } from "./drivers/suggestions.driver.js";
import { driveSpanLabels } from "./drivers/span-labeling.driver.js";

interface CliConfig {
  baseUrl: string;
  surfaces: Set<"optimize" | "suggestions" | "span-labels">;
}

function parseArgs(argv: string[]): CliConfig {
  const surfaces = new Set<"optimize" | "suggestions" | "span-labels">();
  let only: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--only") {
      only = argv[++i];
    }
  }
  if (only) {
    for (const name of only.split(",")) {
      const trimmed = name.trim();
      if (
        trimmed === "optimize" ||
        trimmed === "suggestions" ||
        trimmed === "span-labels"
      ) {
        surfaces.add(trimmed);
      } else {
        console.error(`Unknown surface: ${trimmed}`);
        process.exit(2);
      }
    }
  } else {
    surfaces.add("optimize");
    surfaces.add("suggestions");
    surfaces.add("span-labels");
  }
  const baseUrl = process.env.VIDRA_API_URL ?? "http://localhost:3001";
  if (!process.env.VIDRA_API_URL) {
    console.warn(
      "VIDRA_API_URL not set — defaulting to http://localhost:3001 (local dev server).",
    );
  }
  return { baseUrl, surfaces };
}

async function main(): Promise<void> {
  const config = parseArgs(process.argv.slice(2));
  const prompts = await loadPrompts();
  console.log(
    `Running synthetic harness against ${config.baseUrl} with ${prompts.length} prompts.`,
  );
  console.log(`Surfaces: ${[...config.surfaces].join(", ")}`);

  const summaries = await Promise.all([
    config.surfaces.has("optimize")
      ? driveOptimize(config.baseUrl, prompts)
      : Promise.resolve(null),
    config.surfaces.has("suggestions")
      ? driveSuggestions(config.baseUrl, prompts)
      : Promise.resolve(null),
    config.surfaces.has("span-labels")
      ? driveSpanLabels(config.baseUrl, prompts)
      : Promise.resolve(null),
  ]);

  let anyErrors = false;
  console.log("\n=== Summary ===");
  for (const s of summaries) {
    if (!s) continue;
    console.log(
      `${s.surface}: ${s.successCount}/${s.totalCalls} ok, avg ${s.avgDurationMs}ms${s.errorCount > 0 ? `, ${s.errorCount} errors` : ""}`,
    );
    if (s.errorCount > 0) {
      anyErrors = true;
      for (const e of s.errors.slice(0, 5)) {
        console.log(`  - ${e.promptId}: ${e.message}`);
      }
      if (s.errors.length > 5) {
        console.log(`  ... and ${s.errors.length - 5} more`);
      }
    }
  }

  if (anyErrors) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Harness failed:", err);
  process.exit(1);
});
