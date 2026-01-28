export interface PromptData {
  input: string;
  output: string;
  mode?: string;
  score?: number;
  timestamp: string;
  brainstormContext?: unknown;
}

export type PromptMode = 'optimize' | 'reasoning' | 'research' | 'socratic' | 'video';

export interface SharedPromptState {
  prompt: PromptData | null;
  loading: boolean;
  error: string | null;
  copied: boolean;
}
