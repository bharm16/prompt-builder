import { AIService, OptimizationMode, ShotPlan } from '../types';
import OptimizationConfig from '@config/OptimizationConfig';
import { logger } from '@infrastructure/Logger';

export class DraftGenerationService {
  private readonly ai: AIService;
  private readonly log = logger.child({ service: 'DraftGenerationService' });

  constructor(aiService: AIService) {
    this.ai = aiService;
  }

  supportsStreaming(): boolean {
    return !!this.ai.supportsStreaming?.('optimize_draft');
  }

  async generateDraft(
    prompt: string,
    mode: OptimizationMode,
    shotPlan: ShotPlan | null,
    generationParams: Record<string, any> | null,
    signal?: AbortSignal,
    onChunk?: (delta: string) => void
  ): Promise<string> {
    const operation = 'generateDraft';
    const draftSystemPrompt = this.getDraftSystemPrompt(mode, shotPlan, generationParams);
    
    this.log.debug('Generating draft', {
      operation,
      mode,
      hasShotPlan: !!shotPlan,
    });

    let draft = '';
    if (
      onChunk &&
      this.ai.stream &&
      (this.ai.supportsStreaming?.('optimize_draft') ?? true)
    ) {
      draft = await this.ai.stream('optimize_draft', {
        systemPrompt: draftSystemPrompt,
        userMessage: prompt,
        maxTokens: OptimizationConfig.tokens.draft[mode] || OptimizationConfig.tokens.draft.default,
        temperature: OptimizationConfig.temperatures.draft,
        timeout: OptimizationConfig.timeouts.draft,
        onChunk,
        ...(signal ? { signal } : {}),
      });
    } else {
      const draftResponse = await this.ai.execute('optimize_draft', {
        systemPrompt: draftSystemPrompt,
        userMessage: prompt,
        maxTokens: OptimizationConfig.tokens.draft[mode] || OptimizationConfig.tokens.draft.default,
        temperature: OptimizationConfig.temperatures.draft,
        timeout: OptimizationConfig.timeouts.draft,
        ...(signal ? { signal } : {}),
      });

      draft = draftResponse.text || draftResponse.content?.[0]?.text || '';
    }
    
    this.log.info('Draft generated', {
      operation,
      draftLength: draft.length,
    });

    return draft;
  }

  private getDraftSystemPrompt(
    mode: OptimizationMode,
    shotPlan: ShotPlan | null = null,
    generationParams: Record<string, any> | null = null
  ): string {
    let constraints = '';
    if (generationParams) {
      const overrides = [];
      if (generationParams.aspect_ratio) overrides.push(`Aspect Ratio: ${generationParams.aspect_ratio}`);
      if (generationParams.duration_s) overrides.push(`Duration: ${generationParams.duration_s}s`);
      if (generationParams.fps) overrides.push(`Frame Rate: ${generationParams.fps}fps`);
      if (typeof generationParams.audio === 'boolean') overrides.push(`Audio: ${generationParams.audio ? 'Enabled' : 'Muted'}`);
      
      if (overrides.length > 0) {
        constraints = `
Respect these user constraints: ${overrides.join(', ')}.`;
      }
    }

    const planSummary = shotPlan
      ? `Respect this interpreted shot plan (do not force missing fields):
- shot_type: ${shotPlan.shot_type || 'unknown'}
- core_intent: ${shotPlan.core_intent || 'n/a'}
- subject: ${shotPlan.subject || 'null'}
- action: ${shotPlan.action || 'null'}
- visual_focus: ${shotPlan.visual_focus || 'null'}
- setting: ${shotPlan.setting || 'null'}
- camera_move: ${shotPlan.camera_move || 'null'}
- camera_angle: ${shotPlan.camera_angle || 'null'}
- lighting: ${shotPlan.lighting || 'null'}
- style: ${shotPlan.style || 'null'}
Keep ONE action and 75-125 words.${constraints}`
      : `Honor ONE action, camera-visible details, 75-125 words. Do not invent subjects or actions if absent.${constraints}`;

    const draftInstructions: Record<string, string> = {
      video: `You are a video prompt draft generator. Create a concise video prompt (75-125 words).

Focus on:
- Clear subject and primary action when present (otherwise lean on camera move + visual focus)
- Preserve explicit user-provided intent (including temporal changes like seasons shifting)
- Essential visual details (lighting, camera angle)
- Specific cinematographic style
- Avoid negative phrasing; describe what to show

${planSummary}

Output ONLY the draft prompt, no explanations or meta-commentary.`
    };

    return draftInstructions[mode] ?? draftInstructions.video ?? '';
  }
}
