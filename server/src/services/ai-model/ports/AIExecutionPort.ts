import type {
  ExecuteParams,
  StreamParams,
} from "@services/ai-model/AIModelService";
import type { AIResponse } from "@interfaces/IAIClient";
import type { ModelConfigEntry } from "@services/ai-model/types";

export interface AIExecutionPort {
  execute(operation: string, options: ExecuteParams): Promise<AIResponse>;
  stream?(operation: string, options: StreamParams): Promise<string>;
  supportsStreaming?(operation: string): boolean;
  getAvailableClients?(): string[];
  getOperationConfig?(operation: string): ModelConfigEntry;
}
