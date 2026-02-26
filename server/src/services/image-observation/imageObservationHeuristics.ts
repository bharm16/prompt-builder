import { POSITION_MOVEMENT_RISKS, SHOT_MOVEMENT_COMPATIBILITY } from '@shared/cinematography';
import type {
  FramingObservation,
  LightingObservation,
  MotionCompatibility,
  SubjectObservation,
} from './types';

export const deriveMotionCompatibility = (
  framing: FramingObservation,
  position: SubjectObservation['position']
): MotionCompatibility => {
  const compatible = SHOT_MOVEMENT_COMPATIBILITY[framing.shotType] || [];
  const positionRisks = POSITION_MOVEMENT_RISKS[position] || [];

  const recommended = compatible.filter((m) => !positionRisks.includes(m));
  const risky = positionRisks.filter((m) => compatible.includes(m));

  const risks = risky.map((movement) => ({
    movement,
    reason: `Subject is positioned ${position}, ${movement} may cut off subject`,
  }));

  return { recommended, risky, risks };
};

export const detectSubjectType = (text: string): SubjectObservation['type'] => {
  if (/\b(man|woman|person|boy|girl|child|people)\b/.test(text)) return 'person';
  if (/\b(dog|cat|bird|animal|horse)\b/.test(text)) return 'animal';
  if (/\b(landscape|mountain|ocean|forest|city)\b/.test(text)) return 'scene';
  return 'object';
};

export const extractSubjectDescription = (text: string): string => {
  const match = text.match(/^[^,\.]+/);
  return match ? match[0].slice(0, 50) : 'subject';
};

export const detectShotType = (text: string): FramingObservation['shotType'] => {
  if (/extreme close[- ]?up|ecu\b/.test(text)) return 'extreme-close-up';
  if (/close[- ]?up|cu\b/.test(text)) return 'close-up';
  if (/medium close/.test(text)) return 'medium-close-up';
  if (/medium wide|mws/.test(text)) return 'medium-wide';
  if (/\bwide\b|ws\b|establishing/.test(text)) return 'wide';
  if (/extreme wide|ews/.test(text)) return 'extreme-wide';
  if (/\bmedium\b|ms\b/.test(text)) return 'medium';
  return 'medium';
};

export const detectAngle = (text: string): FramingObservation['angle'] => {
  if (/low angle|worm/.test(text)) return 'low-angle';
  if (/high angle|bird/.test(text)) return 'high-angle';
  if (/dutch|tilted/.test(text)) return 'dutch';
  if (/over.?shoulder|ots/.test(text)) return 'over-shoulder';
  return 'eye-level';
};

export const detectLightingQuality = (text: string): LightingObservation['quality'] => {
  if (/dramatic|chiaroscuro|contrast/.test(text)) return 'dramatic';
  if (/flat|soft|diffuse/.test(text)) return 'flat';
  if (/artificial|neon|fluorescent/.test(text)) return 'artificial';
  if (/natural|sun/.test(text)) return 'natural';
  return 'natural';
};

export const detectTimeOfDay = (text: string): LightingObservation['timeOfDay'] => {
  if (/golden hour|sunset|sunrise/.test(text)) return 'golden-hour';
  if (/blue hour|dusk|dawn/.test(text)) return 'blue-hour';
  if (/night|dark|moon/.test(text)) return 'night';
  if (/indoor|interior|room/.test(text)) return 'indoor';
  if (/day|bright|sunny|midday/.test(text)) return 'day';
  return 'unknown';
};
