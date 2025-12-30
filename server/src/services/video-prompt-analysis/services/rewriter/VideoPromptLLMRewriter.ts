import { GeminiAdapter } from '../../../../clients/adapters/GeminiAdapter';
import type { VideoPromptIR } from '../../types';

/**
 * Service that uses an LLM to rewrite and reoptimize prompts for specific video models.
 */
export class VideoPromptLLMRewriter {
  private adapter: GeminiAdapter | null = null;

  private getAdapter(): GeminiAdapter {
    if (!this.adapter) {
        this.adapter = new GeminiAdapter({
            apiKey: process.env.GEMINI_API_KEY || '',
            defaultModel: 'gemini-2.5-flash'
        });
    }
    return this.adapter;
  }

  /**
   * Rewrite the prompt for a specific model using an LLM.
   */
  async rewrite(ir: VideoPromptIR, modelId: string): Promise<string | Record<string, unknown>> {
    const prompt = this.getSystemPromptForModel(modelId, ir);
    const adapter = this.getAdapter();
    
    // For Veo, we want structured JSON output
    if (modelId === 'veo-4') {
      const response = await adapter.generateStructuredOutput(prompt, this.getVeoSchema());
      return response;
    }

    // For others, we want optimized text
    const response = await adapter.generateText(prompt, {
        temperature: 0.4, // Keep it relatively deterministic but creative
        maxTokens: 1024
    });

    return response.trim();
  }

  private getSystemPromptForModel(modelId: string, ir: VideoPromptIR): string {
    const irJson = JSON.stringify(ir, null, 2);
    const baseHeader = `You are a professional video prompt engineer. Your goal is to rewrite the original user intent into an optimized prompt for the ${modelId} video generation model.

Below is the structured Intermediate Representation (IR) of the user's request, which includes the narrative description, subjects, actions, camera movements, environment, audio, and technical specifications. Use this structured data to generate a high-fidelity prompt.

Video Prompt IR:
\`\`\`json
${irJson}
\`\`\`

`;

    switch (modelId) {
      case 'runway-gen45':
        return `${baseHeader}
INSTRUCTIONS for Runway Gen-4.5:
1. Use the CSAE Protocol: Camera -> Subject -> Action -> Environment.
2. Synthesize the 'camera' and 'environment' fields from the IR into high-fidelity cinematographic triggers.
3. Prepend camera movement (e.g., "Dolly in of...").
4. Extract the core 'subjects' and 'actions' from the IR. Remove all emotional, abstract, or vague adjectives.
5. Incorporate any 'technical' specs (like aspect ratio or duration) if they influence the visual description.
6. Inject high-fidelity technical triggers (e.g., "bokeh", "anamorphic lens flare", "film grain", "shallow depth of field").
7. The result must be a single, fluid, highly technical paragraph.
8. Do NOT use word lists joined by 'and'. Use natural but structured language.

Output ONLY the optimized prompt.`;

      case 'luma-ray3':
        return `${baseHeader}
INSTRUCTIONS for Luma Ray-3:
1. Focus on physical consistency and high-motion stability using the 'actions' and 'camera' data from the IR.
2. Use causal chains ("A does X, which causes Y") to describe motion.
3. Include detailed material properties and light interactions based on 'environment.lighting' and 'meta.style' (e.g., "subsurface scattering on skin", "ray-traced reflections on chrome").
4. Add cinematic stability keywords like "highly detailed", "4k", "masterpiece".
5. Ensure all technical specifications from the IR are reflected in the scene's detail.

Output ONLY the optimized prompt.`;

      case 'kling-26':
        return `${baseHeader}
INSTRUCTIONS for Kling 2.6:
1. Use SCREENPLAY FORMAT for all character interactions.
2. Use 'subjects' from the IR to define characters and 'audio.dialogue' for their lines.
3. Pattern: "[CHARACTER NAME] (Emotion/Tone): 'Dialogue line'".
4. Use separate blocks for audio triggers from the IR 'audio' and 'technical' fields: "Audio (SFX): ...", "Audio (Ambience): ...", "Audio (Music): ...".
5. Ensure the visual description is clear and separate from the dialogue blocks, incorporating 'environment' and 'camera' details.

Output the optimized prompt in valid Kling screenplay structure.`;

      case 'sora-2':
        return `${baseHeader}
INSTRUCTIONS for Sora:
1. Use a descriptive "World-building" style, drawing heavily from the 'environment' and 'meta' fields in the IR.
2. Create long, rich, multi-sentence descriptions.
3. Detail background layers, atmospheric effects, and complex interactions between multiple subjects as defined in the IR.
4. Describe the "feel" through rich, evocative adjectives, mapping 'meta.mood' and 'meta.style' to descriptive prose.
5. Use 'technical' specs to ground the scene's scale and duration.

Output ONLY the optimized prompt.`;

      case 'veo-4':
        return `${baseHeader}
INSTRUCTIONS for Google Veo 4:
1. Analyze the Video Prompt IR and map it into the provided JSON schema.
2. Map 'subjects.text' and 'meta.style' into 'subject.description'.
3. Map 'actions' into 'subject.action'.
4. Identify 'camera.shotType' or 'camera.angle' for the 'camera.type' field.
5. Map 'camera.movements' to 'camera.movement'.
6. Map 'environment.lighting', 'environment.weather', and 'environment.setting' to their respective fields.
7. Select an appropriate 'style_preset' based on 'meta.style'.
8. If 'audio' data is present in the IR, include it in the output if the schema permits (though not required by schema).

Output ONLY the valid JSON object.`;

      default:
        return `${baseHeader} Optimize this prompt for high-quality video generation.`;
    }
  }

  private getVeoSchema() {
    return {
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
  }
}
