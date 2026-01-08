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
        maxTokens: 1024
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
INSTRUCTIONS for Runway Gen-4.5:
1. Use the CSAE Protocol: Camera -> Subject -> Action -> Environment.
2. Synthesize the 'camera' and 'environment' fields from the IR into high-fidelity cinematographic triggers.
3. Prepend camera movement (e.g., "Dolly in of...").
4. Extract the core 'subjects' and 'actions' from the IR. Remove all emotional, abstract, or vague adjectives.
5. Incorporate any 'technical' specs (like aspect ratio or duration) if they influence the visual description.
6. Inject high-fidelity technical triggers (e.g., "bokeh", "anamorphic lens flare", "film grain", "shallow depth of field").
7. The result must be a single, fluid, highly technical paragraph.
8. Do NOT use word lists joined by 'and'. Use natural but structured language.
9. Avoid multi-shot language ("cut to", "then it switches", "montage"), and avoid morphing/warping/blur terms unless explicitly required by the IR.

Output ONLY the optimized prompt.`;

      case 'luma-ray3':
        return `${baseHeader}
INSTRUCTIONS for Luma Ray-3:
1. Focus on physical consistency and high-motion stability using the 'actions' and 'camera' data from the IR.
2. Use causal chains ("A does X, which causes Y") to describe motion.
3. Include detailed material properties and light interactions based on 'environment.lighting' and 'meta.style' (e.g., "subsurface scattering on skin", "ray-traced reflections on chrome").
4. Ignore resolution/quality boosters unless they are mandatory constraints (e.g., avoid "4k", "8k", "ultra hd", "masterpiece").
5. Ensure all technical specifications from the IR are reflected in the scene's detail.
6. Avoid crowded multi-subject interactions and avoid non-physical abstractions.

Output ONLY the optimized prompt.`;

      case 'kling-26':
        return `${baseHeader}
INSTRUCTIONS for Kling 2.6:
1. Use SCREENPLAY FORMAT for all character interactions.
2. Use 'subjects' from the IR to define characters and 'audio.dialogue' for their lines.
3. Pattern: "[CHARACTER NAME] (Emotion/Tone): 'Dialogue line'".
4. Use separate blocks for audio triggers from the IR 'audio' and 'technical' fields: "Audio (SFX): ...", "Audio (Ambience): ...", "Audio (Music): ...".
5. Ensure the visual description is clear and separate from the dialogue blocks, incorporating 'environment' and 'camera' details.
6. Avoid markdown bullets, numbered lists, or JSON. Keep strict screenplay formatting only.

Output the optimized prompt in valid Kling screenplay structure.`;

      case 'sora-2':
        return `${baseHeader}
INSTRUCTIONS for Sora:
1. Use a descriptive "World-building" style, drawing heavily from the 'environment' and 'meta' fields in the IR.
2. Create long, rich, multi-sentence descriptions.
3. Detail background layers, atmospheric effects, and complex interactions between multiple subjects as defined in the IR.
4. Describe the "feel" through rich, evocative adjectives, mapping 'meta.mood' and 'meta.style' to descriptive prose.
5. Use 'technical' specs to ground the scene's scale and duration.
6. Avoid bullet lists and avoid terse camera-command syntax ("pan to", "cut to", "zoom to").

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
9. Avoid placing camera or motion terms into lighting/weather fields. Do not add extra keys outside the schema.

Output ONLY the valid JSON object.`;

      case 'wan-2.2':
        return `${baseHeader}
INSTRUCTIONS for Wan 2.2 (MoE):
1. Use a highly descriptive, cinematic narrative style.
2. For maximum adherence to Alibaba's Wan 2.2 MoE architecture, use DUAL-TEXT (Bilingual) prompting for key visual elements.
3. Structure: "Description in English (中文描述)".
4. Map 'subjects', 'actions', and 'environment' from the IR into this bilingual structure.
5. Emphasize complex interactions and lighting consistency.
6. Target 1080p 30fps quality triggers (e.g., "ultra-high definition", "masterpiece").
7. Ensure all 'technical' specifications from the IR are reflected.
8. Avoid mixing scripts inside a single phrase; keep English and Chinese paired.

Output ONLY the optimized bilingual prompt.`;

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
