import type { PromptSpan } from "../types";

export interface PromptSpanProvider {
  label(prompt: string): Promise<PromptSpan[]>;
}
