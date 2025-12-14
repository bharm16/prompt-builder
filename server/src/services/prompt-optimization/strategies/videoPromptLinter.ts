import type { VideoPromptSlots } from './videoPromptTypes.js';

export interface VideoPromptLintResult {
  ok: boolean;
  errors: string[];
}

const VIEWER_LANGUAGE = [
  /(?:the\s+)?viewer/i,
  /(?:the\s+)?audience/i,
  /\binviting\b/i,
  /\bawaits?\b/i,
  /\beager(?:ly)?\b/i,
];

const GENERIC_STYLE_LANGUAGE = [
  /\bcinematic\b/i,
  /\bhigh\s+quality\b/i,
  /\bstunning\b/i,
  /\bbeautiful\b/i,
];

const MULTI_ACTION_MARKERS = [
  /\bthen\b/i,
  /;/,
  /\.\s+\w/, // multiple sentences
];

function looksLikePresentParticipleAction(action: string): boolean {
  const firstToken = action.trim().split(/\s+/)[0] || '';
  return /ing$/i.test(firstToken);
}

function collectStringFields(slots: Partial<VideoPromptSlots>): Array<{ key: keyof VideoPromptSlots; value: string }> {
  const keys: Array<keyof VideoPromptSlots> = [
    'shot_framing',
    'camera_angle',
    'camera_move',
    'subject',
    'action',
    'setting',
    'time',
    'lighting',
    'style',
  ];

  return keys
    .map((key) => ({ key, value: slots[key] }))
    .filter((entry): entry is { key: keyof VideoPromptSlots; value: string } => typeof entry.value === 'string' && entry.value.trim().length > 0)
    .map(({ key, value }) => ({ key, value: value.trim() }));
}

export function lintVideoPromptSlots(slots: Partial<VideoPromptSlots>): VideoPromptLintResult {
  const errors: string[] = [];

  if (!slots.shot_framing || typeof slots.shot_framing !== 'string') {
    errors.push('Missing `shot_framing` (framing shot type like "Wide Shot", "Close-Up").');
  } else if (/(?:angle|view|pov)/i.test(slots.shot_framing)) {
    errors.push('`shot_framing` looks like an angle/view; framing must be separate from camera angle.');
  }

  if (!slots.camera_angle || typeof slots.camera_angle !== 'string') {
    errors.push('Missing `camera_angle` (angle/viewpoint like "Low-Angle Shot", "Bird\'s-Eye View").');
  }

  const subject = typeof slots.subject === 'string' ? slots.subject.trim() : null;
  const subjectDetails = Array.isArray(slots.subject_details) ? slots.subject_details.filter((d) => typeof d === 'string' && d.trim().length > 0) : null;

  if (subject) {
    if (!subjectDetails || subjectDetails.length < 2) {
      errors.push('`subject_details` must include 2-3 visible identifiers when `subject` is present.');
    }
  } else if (slots.subject_details !== null && typeof slots.subject_details !== 'undefined') {
    errors.push('If `subject` is null, `subject_details` must be null.');
  }

  if (typeof slots.action === 'string' && slots.action.trim().length > 0) {
    const action = slots.action.trim();
    if (!looksLikePresentParticipleAction(action)) {
      errors.push('`action` should start with a present-participle (-ing) verb phrase (e.g., "running...", "carrying...").');
    }
    if (action.includes(',')) {
      errors.push('`action` must be ONE continuous action (avoid comma-separated verb lists).');
    }
    if (/\band\b/i.test(action)) {
      errors.push('`action` must be ONE continuous action (avoid "and" sequences).');
    }
    if (MULTI_ACTION_MARKERS.some((re) => re.test(action))) {
      errors.push('`action` looks like multiple actions or a sequence; keep one continuous action only.');
    }
  }

  const style = typeof slots.style === 'string' ? slots.style.trim() : null;
  if (style && GENERIC_STYLE_LANGUAGE.some((re) => re.test(style))) {
    errors.push('`style` is too generic; avoid words like "cinematic", use film stock/genre/director references.');
  }

  for (const { key, value } of collectStringFields(slots)) {
    if (VIEWER_LANGUAGE.some((re) => re.test(value))) {
      errors.push(`Field \`${key}\` contains viewer/audience language; describe only camera-visible details.`);
    }
  }

  return { ok: errors.length === 0, errors };
}
