import type { VideoPromptSlots } from '@services/prompt-optimization/strategies/videoPromptTypes';

export function scoreSlots(slots: VideoPromptSlots): number {
  const wordCount = (value: string | null): number =>
    value ? value.trim().split(/\s+/).filter(Boolean).length : 0;

  let score = 0;
  const details = slots.subject_details || [];
  for (const detail of details) {
    score += Math.max(0, wordCount(detail) - 3);
  }

  score += Math.max(0, wordCount(slots.action) - 8);
  score += Math.max(0, wordCount(slots.setting) - 10);
  score += Math.max(0, wordCount(slots.lighting) - 18);
  score += Math.max(0, wordCount(slots.style) - 10);

  const anchors = ['window', 'door', 'street', 'park', 'alley', 'beach'];
  const fields = [slots.action, slots.setting, slots.lighting].map((v) => (v || '').toLowerCase());
  for (const anchor of anchors) {
    const mentions = fields.reduce((count, f) => count + (f.includes(anchor) ? 1 : 0), 0);
    if (mentions > 1) score += (mentions - 1);
  }

  return score;
}
