import type { VideoPromptSlots } from './videoPromptTypes.js';

function clean(text: string | null | undefined): string | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length > 0 ? trimmed : null;
}

function ensurePeriod(sentence: string): string {
  const trimmed = sentence.trim();
  if (!trimmed) return trimmed;
  if (/[.!?]$/.test(trimmed)) return trimmed;
  return `${trimmed}.`;
}

function formatList(items: string[]): string {
  const cleaned = items.map((d) => d.trim()).filter(Boolean);
  if (cleaned.length === 0) return '';
  if (cleaned.length === 1) return cleaned[0]!;
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(', ')}, and ${cleaned[cleaned.length - 1]}`;
}

function angleToPhrase(cameraAngle: string | null): string | null {
  const angle = clean(cameraAngle);
  if (!angle) return null;

  switch (angle) {
    case 'Low-Angle Shot':
      return 'from a low angle';
    case 'High-Angle Shot':
      return 'from a high angle';
    case 'Eye-Level Shot':
      return 'at eye level';
    case "Bird's-Eye View":
      return "from a bird's-eye view";
    case "Worm's-Eye View":
      return "from a worm's-eye view";
    case 'Dutch Angle':
      return 'at a Dutch angle';
    case 'POV Shot':
      return 'in a POV shot';
    case 'Over-the-Shoulder':
      return 'over-the-shoulder';
    default:
      return angle.toLowerCase();
  }
}

function focusFromFraming(shotFraming: string | null): string | null {
  const framing = clean(shotFraming);
  if (!framing) return null;
  if (/(?:wide|establishing)/i.test(framing)) return 'deep focus';
  if (/(?:close-up|macro)/i.test(framing)) return 'shallow depth of field';
  return 'selective focus';
}

function actionIsPresentParticiple(action: string): boolean {
  const first = action.trim().split(/\s+/)[0] || '';
  return /ing$/i.test(first);
}

function formatSubject(subject: string | null, details: string[] | null): string | null {
  const s = clean(subject);
  if (!s) return null;
  const cleanedDetails = (details || []).map((d) => d.trim()).filter(Boolean);
  if (cleanedDetails.length === 0) return s;
  return `${s} with ${formatList(cleanedDetails)}`;
}

function formatSettingTime(setting: string | null, time: string | null): string | null {
  const s = clean(setting);
  const t = clean(time);
  if (s && t) return `${s} at ${t}`;
  return s || t;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function renderMainVideoPrompt(slots: VideoPromptSlots): string {
  const shotFraming = clean(slots.shot_framing) ?? 'Wide Shot';
  const anglePhrase = angleToPhrase(slots.camera_angle);
  const cameraMove = clean(slots.camera_move);
  const subjectPhrase = formatSubject(slots.subject, slots.subject_details);
  const action = clean(slots.action);
  const settingTime = formatSettingTime(slots.setting, slots.time);

  const focus = focusFromFraming(shotFraming);
  const lighting = clean(slots.lighting);
  const style = clean(slots.style);

  const firstSentenceParts: string[] = [];
  firstSentenceParts.push(`${shotFraming}`);
  firstSentenceParts.push(`of ${subjectPhrase || 'the scene'}`);
  if (action) {
    if (actionIsPresentParticiple(action) || /\bas it\b/i.test(action) || /\bwhile\b/i.test(action)) {
      firstSentenceParts.push(action);
    } else {
      firstSentenceParts.push(`as it ${action}`);
    }
  }
  if (settingTime) firstSentenceParts.push(`in ${settingTime}`);
  const sentence1 = ensurePeriod(firstSentenceParts.join(' '));

  const sentence2Parts: string[] = [];
  if (cameraMove) {
    sentence2Parts.push(`The camera uses ${cameraMove}${anglePhrase ? ` ${anglePhrase}` : ''}`);
  } else if (anglePhrase) {
    sentence2Parts.push(`The camera holds ${anglePhrase}`);
  }

  if (focus) {
    if (focus === 'deep focus') {
      sentence2Parts.push('with deep focus (f/11-f/16) to keep background detail readable');
    } else if (focus === 'shallow depth of field') {
      sentence2Parts.push('with shallow depth of field (f/1.8-f/2.8) to isolate the main subject');
    } else {
      sentence2Parts.push('with selective focus (f/4-f/5.6) to guide attention to the main action');
    }
  }
  const sentence2 = ensurePeriod(sentence2Parts.join(' ').trim().replace(/\s+/g, ' '));

  const sentence3 = lighting ? ensurePeriod(`Lit by ${lighting}`) : '';
  const sentence4 = style ? ensurePeriod(`Style reference: ${style}`) : '';

  const paragraph = [sentence1, sentence2, sentence3, sentence4].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  // Ensure a reasonable density; if extremely short, add one concrete technical sentence without abstract narration.
  if (countWords(paragraph) < 85) {
    return `${paragraph} Keep motion blur minimal and maintain stable background continuity across the clip.`;
  }

  return paragraph;
}

function pickAlternativeAngle(current: string): string {
  const angle = clean(current) ?? 'Eye-Level Shot';
  const options = [
    "Bird's-Eye View",
    "Worm's-Eye View",
    'Dutch Angle',
    'Eye-Level Shot',
    'Low-Angle Shot',
    'High-Angle Shot',
    'POV Shot',
  ].filter((a) => a !== angle);
  return options[0] || 'Eye-Level Shot';
}

export function renderAlternativeApproaches(slots: VideoPromptSlots): Array<{ label: string; prompt: string }> {
  const altAngleSlots: VideoPromptSlots = { ...slots, camera_angle: pickAlternativeAngle(slots.camera_angle) };
  const altAngle = renderMainVideoPrompt(altAngleSlots);

  const altLightingSlots: VideoPromptSlots = {
    ...slots,
    lighting:
      slots.lighting && /low-key/i.test(slots.lighting)
        ? 'bright, high-key daylight from a large window as the key light, soft fill to reduce harsh shadows'
        : 'low-key lighting with a single warm key light from the side, minimal fill, and deep shadows',
  };
  const altLighting = renderMainVideoPrompt(altLightingSlots);

  // Keep variations compact for A/B testing; trim to ~50 words if needed.
  const compact = (text: string): string => {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= 50) return text;
    return `${words.slice(0, 50).join(' ')}.`;
  };

  return [
    { label: 'Different Camera', prompt: compact(altAngle) },
    { label: 'Different Lighting', prompt: compact(altLighting) },
  ];
}
