import { describe, expect, it, vi } from 'vitest';
import { CleanPromptBuilder } from '../CleanPromptBuilder';

const { detectAndGetCapabilitiesMock } = vi.hoisted(() => ({
  detectAndGetCapabilitiesMock: vi.fn(() => ({
    provider: 'groq',
    capabilities: { strictJsonSchema: false },
  })),
}));

vi.mock('@utils/provider/index', () => ({
  getSecurityPrefix: vi.fn(() => ''),
  getFormatInstruction: vi.fn(() => ''),
  detectAndGetCapabilities: () => detectAndGetCapabilitiesMock(),
  wrapUserData: vi.fn(() => '<user_data/>'),
}));

describe('CleanPromptBuilder regression', () => {
  const builder = new CleanPromptBuilder();

  it('enforces alternative shot-size guidance for shot.type and filters generic micro guidance leakage', () => {
    const prompt = builder.buildRewritePrompt({
      highlightedText: 'medium close',
      contextBefore: 'A toddler sits in a toy car, ',
      contextAfter: ', smiling brightly.',
      fullPrompt: 'A toddler sits in a toy car, medium close, smiling brightly.',
      highlightedCategory: 'shot.type',
      phraseRole: 'shot type or framing',
      isVideoPrompt: true,
      videoConstraints: {
        mode: 'micro',
        minWords: 2,
        maxWords: 8,
        focusGuidance: ['Use precise visual modifiers (wardrobe, era, material)'],
      },
      focusGuidance: ['Use precise visual modifiers (wardrobe, era, material)'],
    });

    expect(prompt).toContain('GUIDANCE: This describes shot framing. Suggest DIFFERENT shot sizes');
    expect(prompt).toContain('FOCUS: Suggest a DIFFERENT shot size or framing');
    expect(prompt).not.toContain('wardrobe, era, material');
  });

  it('applies body-part-specific subject.appearance guidance and removes role-level species/occupation directives', () => {
    const prompt = builder.buildRewritePrompt({
      highlightedText: 'plump hands',
      contextBefore: 'A joyful toddler with ',
      contextAfter: ' grips the steering wheel.',
      fullPrompt: 'A joyful toddler with plump hands grips the steering wheel.',
      highlightedCategory: 'subject.appearance',
      phraseRole: 'subject appearance detail',
      isVideoPrompt: true,
      focusGuidance: [
        'ROLE-LEVEL DIVERSITY: suggest fundamentally DIFFERENT subjects that fill the same narrative role — different species, occupation, age group, or archetype. Never swap synonyms (child→kid→tot).',
      ],
    });

    expect(prompt).toContain('GUIDANCE: This describes a body part.');
    expect(prompt).toContain('FOCUS: Suggest a DIFFERENT body part');
    expect(prompt).not.toContain('different species');
    expect(prompt).not.toContain('different occupation');
  });
});
