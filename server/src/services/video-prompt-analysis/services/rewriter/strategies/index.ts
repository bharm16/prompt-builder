import type { ModelPromptStrategy } from './types';
import { defaultPromptStrategy } from './DefaultPromptStrategy';
import { kling26PromptStrategy } from './Kling26PromptStrategy';
import { lumaRay3PromptStrategy } from './LumaRay3PromptStrategy';
import { runwayGen45PromptStrategy } from './RunwayGen45PromptStrategy';
import { sora2PromptStrategy } from './Sora2PromptStrategy';
import { veo4PromptStrategy } from './Veo4PromptStrategy';
import { wan22PromptStrategy } from './Wan22PromptStrategy';

const STRATEGIES: ModelPromptStrategy[] = [
  runwayGen45PromptStrategy,
  lumaRay3PromptStrategy,
  kling26PromptStrategy,
  sora2PromptStrategy,
  veo4PromptStrategy,
  wan22PromptStrategy,
];

const STRATEGY_MAP = new Map(STRATEGIES.map((strategy) => [strategy.modelId, strategy]));

export const resolveModelPromptStrategy = (modelId: string): ModelPromptStrategy =>
  STRATEGY_MAP.get(modelId) ?? defaultPromptStrategy;
