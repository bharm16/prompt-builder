import type { VideoPromptIR } from '../../types';

type SpanLike = Record<string, unknown>;

/**
 * Map semantic spans from GLiNER/Aho-Corasick to IR fields
 */
export function mapSpansToIR(spans: SpanLike[], ir: VideoPromptIR): void {
  for (const span of spans) {
    if (!span || typeof span !== 'object') continue;
    const category = typeof span.category === 'string' ? span.category : '';
    const text = typeof span.text === 'string' ? span.text.trim() : '';
    if (!text) continue;

    const lowerText = text.toLowerCase();

    // Subject Mapping
    if (category.startsWith('subject.')) {
      if (!ir.subjects.some((s) => s.text.toLowerCase() === lowerText)) {
        ir.subjects.push({ text, attributes: [] });
      }
    }
    // Action Mapping
    else if (category.startsWith('action.')) {
      if (!ir.actions.includes(lowerText)) {
        ir.actions.push(lowerText);
      }
    }
    // Camera Mapping
    else if (category.startsWith('camera.') || category.startsWith('shot.')) {
      if (category === 'camera.movement') {
        if (!ir.camera.movements.includes(lowerText)) {
          ir.camera.movements.push(lowerText);
        }
      } else if (category === 'camera.angle') {
        ir.camera.angle = lowerText;
      } else if (category === 'shot.type') {
        ir.camera.shotType = lowerText;
      }
    }
    // Environment Mapping
    else if (category.startsWith('environment.')) {
      if (category === 'environment.location') {
        ir.environment.setting = text;
      } else if (category === 'environment.weather') {
        ir.environment.weather = lowerText;
      }
    }
    // Lighting Mapping
    else if (category.startsWith('lighting.')) {
      if (!ir.environment.lighting.includes(lowerText)) {
        ir.environment.lighting.push(lowerText);
      }
    }
    // Style Mapping
    else if (category.startsWith('style.')) {
      if (!ir.meta.style.includes(lowerText)) {
        ir.meta.style.push(lowerText);
      }
    }
    // Audio Mapping
    else if (category.startsWith('audio.')) {
      if (category === 'audio.score') ir.audio.music = text;
      else if (category === 'audio.soundEffect') ir.audio.sfx = text;
    }
  }
}
