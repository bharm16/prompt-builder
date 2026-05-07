import type { VideoPromptLlmGateway } from "../services/llm/VideoPromptLlmGateway";
import { LlmIrExtractor } from "../services/analysis/LlmIrExtractor";
import { VideoPromptAnalyzer } from "../services/analysis/VideoPromptAnalyzer";
import { VideoPromptLLMRewriter } from "../services/rewriter/VideoPromptLLMRewriter";
import { KlingStrategy } from "./KlingStrategy";
import { LumaStrategy } from "./LumaStrategy";
import { RunwayStrategy } from "./RunwayStrategy";
import { SoraStrategy } from "./SoraStrategy";
import { StrategyRegistry } from "./StrategyRegistry";
import { VeoStrategy } from "./VeoStrategy";
import { WanStrategy } from "./WanStrategy";

interface CreateDefaultStrategyRegistryOptions {
  videoPromptLlmGateway?: VideoPromptLlmGateway | null;
}

export function createDefaultStrategyRegistry(
  options: CreateDefaultStrategyRegistryOptions = {},
): StrategyRegistry {
  const createAnalyzer = (): VideoPromptAnalyzer =>
    new VideoPromptAnalyzer({
      llmExtractor: new LlmIrExtractor(options.videoPromptLlmGateway ?? null),
    });
  const createRewriter = (): VideoPromptLLMRewriter =>
    new VideoPromptLLMRewriter(options.videoPromptLlmGateway ?? null);

  const registry = new StrategyRegistry();
  registry.register(
    "runway-gen45",
    () =>
      new RunwayStrategy({
        analyzer: createAnalyzer(),
        llmRewriter: createRewriter(),
      }),
  );
  registry.register(
    "luma-ray3",
    () =>
      new LumaStrategy({
        analyzer: createAnalyzer(),
        llmRewriter: createRewriter(),
      }),
  );
  registry.register(
    "kling-2.1",
    () =>
      new KlingStrategy({
        analyzer: createAnalyzer(),
        llmRewriter: createRewriter(),
      }),
  );
  registry.register(
    "sora-2",
    () =>
      new SoraStrategy({
        analyzer: createAnalyzer(),
        llmRewriter: createRewriter(),
      }),
  );
  registry.register(
    "veo-3",
    () =>
      new VeoStrategy({
        analyzer: createAnalyzer(),
        llmRewriter: createRewriter(),
      }),
  );
  registry.register(
    "wan-2.2",
    () =>
      new WanStrategy({
        analyzer: createAnalyzer(),
        llmRewriter: createRewriter(),
      }),
  );

  return registry;
}
