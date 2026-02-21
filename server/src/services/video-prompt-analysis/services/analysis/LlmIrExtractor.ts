import type { VideoPromptIR } from '../../types';
import type { VideoPromptLlmGateway } from '../llm/VideoPromptLlmGateway';
import { createEmptyIR } from './IrFactory';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function asTrimmedStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

export class LlmIrExtractor {
  constructor(private readonly gateway: VideoPromptLlmGateway | null = null) {}

  async tryAnalyze(text: string): Promise<VideoPromptIR | null> {
    if (!this.gateway) {
      return null;
    }

    try {
      const response = await this.gateway.extractIr(this.buildLlmPrompt(text), this.getIrSchema());

      if (!isRecord(response)) {
        return null;
      }

      const narrative = typeof response.narrative === 'string' ? response.narrative : '';
      if (!narrative.trim()) {
        return null;
      }

      return this.buildIrFromLlm(response, text);
    } catch {
      return null;
    }
  }

  private buildIrFromLlm(parsed: UnknownRecord, raw: string): VideoPromptIR {
    const ir = createEmptyIR(raw);

    const narrative = typeof parsed.narrative === 'string' ? parsed.narrative.trim() : '';
    if (narrative) {
      ir.raw = narrative;
    }

    const subjects = asTrimmedStringArray(parsed.subjects);
    if (subjects.length > 0) {
      ir.subjects = subjects.map((text) => ({ text, attributes: [] }));
    }

    const actions = asTrimmedStringArray(parsed.actions);
    if (actions.length > 0) {
      ir.actions = actions.map((action) => action.toLowerCase());
    }

    const camera = isRecord(parsed.camera) ? parsed.camera : null;
    if (camera) {
      const movements = asTrimmedStringArray(camera.movements);
      if (movements.length > 0) {
        ir.camera.movements = movements.map((movement) => movement.toLowerCase());
      }
      if (typeof camera.shotType === 'string' && camera.shotType.trim()) {
        ir.camera.shotType = camera.shotType.trim().toLowerCase();
      }
      if (typeof camera.angle === 'string' && camera.angle.trim()) {
        ir.camera.angle = camera.angle.trim().toLowerCase();
      }
    }

    const environment = isRecord(parsed.environment) ? parsed.environment : null;
    if (environment) {
      if (typeof environment.setting === 'string' && environment.setting.trim()) {
        ir.environment.setting = environment.setting.trim();
      }
      const lighting = asTrimmedStringArray(environment.lighting);
      if (lighting.length > 0) {
        ir.environment.lighting = lighting.map((light) => light.toLowerCase());
      }
      if (typeof environment.weather === 'string' && environment.weather.trim()) {
        ir.environment.weather = environment.weather.trim().toLowerCase();
      }
    }

    const audio = isRecord(parsed.audio) ? parsed.audio : null;
    if (audio) {
      if (typeof audio.dialogue === 'string' && audio.dialogue.trim()) {
        ir.audio.dialogue = audio.dialogue.trim();
      }
      if (typeof audio.music === 'string' && audio.music.trim()) {
        ir.audio.music = audio.music.trim();
      }
      if (typeof audio.sfx === 'string' && audio.sfx.trim()) {
        ir.audio.sfx = audio.sfx.trim();
      }
    }

    const meta = isRecord(parsed.meta) ? parsed.meta : null;
    if (meta) {
      const mood = asTrimmedStringArray(meta.mood);
      if (mood.length > 0) {
        ir.meta.mood = mood.map((m) => m.toLowerCase());
      }
      const style = asTrimmedStringArray(meta.style);
      if (style.length > 0) {
        ir.meta.style = style.map((s) => s.toLowerCase());
      }
    }

    if (Array.isArray(parsed.technical)) {
      const technical: Record<string, string> = {};
      for (const entry of parsed.technical) {
        if (!isRecord(entry)) continue;
        const key = typeof entry.key === 'string' ? entry.key : '';
        const value = typeof entry.value === 'string' ? entry.value : '';
        if (key && value) {
          technical[key] = value;
        }
      }
      if (Object.keys(technical).length > 0) {
        ir.technical = technical;
      }
    }

    return ir;
  }

  private buildLlmPrompt(text: string): string {
    return `Extract a structured video prompt IR from the input text.

Rules:
- narrative: main visual description only (exclude section headers or bullet labels).
- subjects: primary subjects as noun phrases.
- actions: key verbs describing motion.
- camera.movements: list of movements (e.g., "dolly in", "pan left").
- camera.shotType: shot framing if stated (e.g., "wide shot").
- camera.angle: angle if stated (e.g., "low angle").
- environment.setting, lighting, weather: scene setting and lighting cues.
- meta.style and meta.mood: style/mood keywords if present.
- audio.dialogue/music/sfx: only if clearly specified.
- technical: list of specs as key-value pairs (e.g., key="duration", value="5s").

Input:
"""
${text}
"""

Return ONLY the JSON object.`;
  }

  private getIrSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        narrative: { type: 'string' },
        subjects: { type: 'array', items: { type: 'string' } },
        actions: { type: 'array', items: { type: 'string' } },
        camera: {
          type: 'object',
          properties: {
            shotType: { type: 'string' },
            angle: { type: 'string' },
            movements: { type: 'array', items: { type: 'string' } },
          },
        },
        environment: {
          type: 'object',
          properties: {
            setting: { type: 'string' },
            lighting: { type: 'array', items: { type: 'string' } },
            weather: { type: 'string' },
          },
        },
        audio: {
          type: 'object',
          properties: {
            dialogue: { type: 'string' },
            music: { type: 'string' },
            sfx: { type: 'string' },
            ambience: { type: 'string' },
          },
        },
        meta: {
          type: 'object',
          properties: {
            mood: { type: 'array', items: { type: 'string' } },
            style: { type: 'array', items: { type: 'string' } },
          },
        },
        technical: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              value: { type: 'string' },
            },
            required: ['key', 'value'],
          },
        },
      },
      required: ['narrative'],
    };
  }
}
