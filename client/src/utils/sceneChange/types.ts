export interface SceneChangeParams {
  originalPrompt: string | null | undefined;
  updatedPrompt: string | null | undefined;
  oldValue: string | null | undefined;
  newValue: string | null | undefined;
  fetchImpl?: typeof fetch;
  confirmSceneChange?: (message: string) => boolean;
}

export interface SceneChangeRequest {
  changedField: string;
  oldValue: string;
  newValue: string;
  fullPrompt: string;
  affectedFields: Record<string, string>;
  sectionHeading?: string;
  sectionContext?: string;
}

export interface SceneChangeResponse {
  isSceneChange?: boolean;
  confidence?: 'low' | 'medium' | 'high';
  reasoning?: string;
  suggestedUpdates?: Record<string, string>;
}
