/**
 * I2V Types for frontend usage
 */

export interface ImageObservation {
  imageHash?: string;
  subject: {
    type: string;
    description: string;
    position: string;
    confidence?: number;
  };
  framing: {
    shotType: string;
    angle: string;
    confidence?: number;
  };
  lighting: {
    quality: string;
    timeOfDay: string;
    confidence?: number;
  };
  motion: {
    recommended: string[];
    risky: string[];
    risks?: Array<{ movement: string; reason: string }>;
  };
  confidence?: number;
}

export interface I2VContext {
  isI2VMode: boolean;
  startImageUrl: string | null;
  startImageSourcePrompt: string | null;
  observation: ImageObservation | null;
  isAnalyzing: boolean;
  error: string | null;
  refreshObservation: () => Promise<void>;
}
