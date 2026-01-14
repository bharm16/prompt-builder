import type { ModelPromptStrategy } from './types';
import { buildBaseHeader } from './promptStrategyUtils';

const VEO_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["generate", "edit"] },
    subject: {
      type: "object",
      properties: {
        description: { type: "string" },
        action: { type: "string" }
      },
      required: ["description", "action"]
    },
    camera: {
      type: "object",
      properties: {
        type: { type: "string" },
        movement: { type: "string" }
      },
      required: ["type", "movement"]
    },
    environment: {
      type: "object",
      properties: {
        lighting: { type: "string" },
        weather: { type: "string" },
        setting: { type: "string" }
      },
      required: ["lighting"]
    },
    style_preset: { type: "string" }
  },
  required: ["mode", "subject", "camera", "environment"]
};

export const veo4PromptStrategy: ModelPromptStrategy = {
  modelId: 'veo-4',
  output: { format: 'structured', schema: VEO_SCHEMA },
  buildPrompt: (context) => `${buildBaseHeader(context)}
INSTRUCTIONS for Google Veo 4:
1. Analyze the Video Prompt IR and map it into the provided JSON schema.
2. Map 'subjects.text' and 'meta.style' into 'subject.description'.
3. Map 'actions' into 'subject.action'.
4. Identify 'camera.shotType' or 'camera.angle' for the 'camera.type' field.
5. Map 'camera.movements' to 'camera.movement'.
6. Map 'environment.lighting', 'environment.weather', and 'environment.setting' to their respective fields.
7. Select an appropriate 'style_preset' based on 'meta.style'.
8. Use cinematic language in all text fields (e.g., "wide shot", "dolly in").

Output ONLY the valid JSON object.`,
};
