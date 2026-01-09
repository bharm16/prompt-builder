import { GeminiAdapter } from '../../../../clients/adapters/GeminiAdapter';
import type { VideoPromptIR } from '../../types';
import type { RewriteConstraints } from '../../strategies/types';

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
  async rewrite(
    ir: VideoPromptIR,
    modelId: string,
    constraints: RewriteConstraints = {}
  ): Promise<string | Record<string, unknown>> {
    const prompt = this.getSystemPromptForModel(modelId, ir, constraints);
    const adapter = this.getAdapter();
    
    // For Veo, we want structured JSON output
    if (modelId === 'veo-4') {
      const response = await adapter.generateStructuredOutput(prompt, this.getVeoSchema());
      return response;
    }

    // For others, we want optimized text
    const response = await adapter.generateText(prompt, {
        temperature: 0.4, // Keep it relatively deterministic but creative
        maxTokens: 8192
    });

    return response.trim();
  }

  private getSystemPromptForModel(
    modelId: string,
    ir: VideoPromptIR,
    constraints: RewriteConstraints
  ): string {
    const irJson = JSON.stringify(ir, null, 2);
    const constraintBlock = this.formatConstraintBlock(constraints);
    const baseHeader = `You are a professional video prompt engineer. Your goal is to rewrite the original user intent into an optimized prompt for the ${modelId} video generation model.

Below is the structured Intermediate Representation (IR) of the user's request, which includes the narrative description, subjects, actions, camera movements, environment, audio, and technical specifications. Use this structured data to generate a high-fidelity prompt.

Video Prompt IR:
\`\`\`json
${irJson}
\`\`\`

${constraintBlock}`;

    switch (modelId) {
      case 'runway-gen45':
        return `${baseHeader}
INSTRUCTIONS for Runway Gen-4.5 (A2D):
1. Use the strict structure: [Camera Movement]: [Establishing Scene]. [Additional Details].
2. Start with the camera movement (e.g., "Zoom in:", "Truck left:", "Static:").
3. Follow with the Subject and Action in a clear, continuous narrative.
4. Synthesize 'environment' and 'lighting' into the scene description.
5. Incorporate technical specifications naturally into the description (e.g., "shot on 35mm film", "cinematic lighting").
6. Avoid using "morphing" or "blur" unless explicitly requested.
7. Integrate the MANDATORY CONSTRAINTS naturally into the flow of the description, do not just append them.

Output ONLY the optimized prompt.`;

      case 'luma-ray3':
        return `${baseHeader}
INSTRUCTIONS for Luma Ray-3:
1. Use the strict structure: [Camera Shot/Angle], [Subject Description], [Action], [Lighting], [Mood/Atmosphere].
2. Ensure "Lighting" is a distinct, descriptive element (e.g., "soft morning light", "volumetric fog").
3. Describe motion with causal chains ("A does X, causing Y").
4. Incorporate 'environment' details into the Mood/Atmosphere section.
5. Integrate MANDATORY CONSTRAINTS (like HDR triggers) naturally into the Lighting or Style sections.
6. Avoid "loop" or "seamless" unless requested.

Output ONLY the optimized prompt.`;

      case 'kling-26':
        return `${baseHeader}
INSTRUCTIONS for Kling 2.6:
1. Use the structure: [Subject], [Subject Description], [Movement/Action], [Scene/Context], [Camera/Lighting].
2. Use strong, active verbs for motion (e.g., "sprinting", "gliding").
3. detailed physical appearance for subjects.
4. Specify camera movement clearly (e.g., "Wide aerial shot", "Low-angle tracking shot").
5. Keep the description clear and precise; avoid ambiguous or abstract terms.
6. Do NOT use screenplay format. Use standard descriptive prose.

Output ONLY the optimized prompt.`;

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
8. Use cinematic language in all text fields (e.g., "wide shot", "dolly in").

Output ONLY the valid JSON object.`;

      case 'wan-2.2':
        return `${baseHeader}
INSTRUCTIONS for Wan 2.2:
1. Use the structure: Subject + Scene + Motion.
2. Be clear and sufficiently detailed (the "Golden Rule" for Wan).
3. Describe the subject's appearance and action precisely.
4. Define the environment and background elements.
5. Specify camera movement (e.g., "camera follows", "smooth pan") and lighting.
6. Target high-definition quality naturally (e.g., "captured in high definition").
7. Do NOT use bilingual output; use English only.

Output ONLY the optimized prompt.`;

      default:
        return `${baseHeader} Optimize this prompt for high-quality video generation.`;
    }
  }

  private formatConstraintBlock(constraints: RewriteConstraints): string {
    const sections: string[] = [];
    const { mandatory, suggested, avoid } = constraints;

    if (mandatory && mandatory.length > 0) {
      sections.push(`MANDATORY CONSTRAINTS (must appear, paraphrased if needed):\n- ${mandatory.join('\n- ')}`);
    }

    if (suggested && suggested.length > 0) {
      sections.push(`SUGGESTED CONSTRAINTS (include when natural):\n- ${suggested.join('\n- ')}`);
    }

    if (avoid && avoid.length > 0) {
      sections.push(`AVOID (do not include these words/phrases):\n- ${avoid.join('\n- ')}`);
    }

    if (sections.length === 0) {
      return '';
    }

    return `\nCONSTRAINTS:\n${sections.join('\n')}\n`;
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