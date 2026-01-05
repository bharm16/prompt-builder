import { getParentCategory } from '@shared/taxonomy';

const CATEGORY_GUIDANCE: Record<string, string> = {
  subject: 'This describes the subject in the scene. Suggest different subjects that fill the same role.',
  'subject.identity': 'This describes who or what the subject is. Suggest different identities that still fit the scene.',
  'subject.appearance': 'This describes how the subject LOOKS. Suggest different appearances (breed, size, coloring, condition, age).',
  'subject.wardrobe': 'This describes what the subject WEARS. Suggest different clothing or accessories.',
  'subject.emotion': "This describes the subject's emotional state. Suggest different emotions or expressions.",
  action: 'This describes the action. Suggest different actions that are visible on camera.',
  'action.movement': 'This describes the main movement. Suggest different physical actions the subject could do.',
  'action.state': 'This describes a static pose or state. Suggest different poses or states.',
  'action.gesture': 'This describes a gesture or micro-action. Suggest different gestures or small actions.',
  environment: 'This describes the environment. Suggest different settings that fit the scene.',
  'environment.location': 'This describes the location. Suggest different locations that fit the scene.',
  'environment.weather': 'This describes the weather. Suggest different weather conditions.',
  'environment.context': 'This describes the environmental context. Suggest different crowding or atmosphere states.',
  lighting: 'This describes lighting. Suggest different lighting setups or moods.',
  'lighting.source': 'This describes the LIGHT SOURCE. Suggest different sources (sun, neon, candles, etc).',
  'lighting.quality': 'This describes light quality. Suggest different qualities (soft, hard, diffused, dappled).',
  'lighting.timeOfDay': 'This describes time of day. Suggest different times of day.',
  'lighting.colorTemp': 'This describes color temperature. Suggest different temperatures or lighting colors.',
  shot: 'This describes shot type. Suggest different framing options.',
  'shot.type': 'This describes shot framing. Suggest different shot types or framing.',
  camera: 'This describes camera choices. Suggest different camera approaches.',
  'camera.movement': 'This describes camera movement. Suggest different movements (dolly, pan, handheld).',
  'camera.lens': 'This describes lens choice. Suggest different lenses or focal lengths.',
  'camera.angle': 'This describes camera angle. Suggest different angles (low, high, overhead).',
  'camera.focus': 'This describes focus or depth of field. Suggest different focus styles.',
  style: 'This describes overall style. Suggest different aesthetics or mediums.',
  'style.aesthetic': 'This describes the aesthetic style. Suggest different visual styles or genres.',
  'style.filmStock': 'This describes film stock or medium. Suggest different film stocks or capture mediums.',
  'style.colorGrade': 'This describes color grading. Suggest different grading styles or tones.',
  technical: 'This describes technical specs. Suggest different specs.',
  'technical.aspectRatio': 'This describes aspect ratio. Suggest different ratios (16:9, 9:16, etc).',
  'technical.frameRate': 'This describes frame rate. Suggest different frame rates (24fps, 60fps, etc).',
  'technical.resolution': 'This describes resolution. Suggest different resolutions (1080p, 4K, etc).',
  'technical.duration': 'This describes duration. Suggest different durations.',
  audio: 'This describes audio. Suggest different sound elements.',
  'audio.score': 'This describes the music or score. Suggest different musical styles or instruments.',
  'audio.soundEffect': 'This describes sound effects. Suggest different sound effects.',
  'audio.ambient': 'This describes ambient sound. Suggest different ambient environments.',
};

export function getCategoryGuidance(highlightedCategory: string | null): string {
  if (!highlightedCategory) return '';
  const directGuidance = CATEGORY_GUIDANCE[highlightedCategory];
  if (directGuidance) return directGuidance;

  const parent = getParentCategory(highlightedCategory);
  if (parent && parent !== highlightedCategory) {
    return CATEGORY_GUIDANCE[parent] || '';
  }

  return '';
}
