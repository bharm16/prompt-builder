import type { Question } from './api/schemas';

export type { Question };

export interface FormData {
  specificAspects: string;
  backgroundLevel: string;
  intendedUse: string;
}

export interface PromptImprovementFormProps {
  onComplete: (enhancedPrompt: string, formData: FormData) => void;
  initialPrompt?: string;
}
