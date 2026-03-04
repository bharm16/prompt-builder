import { describe, expect, it } from 'vitest';
import { VideoStrategy } from '../VideoStrategy';

describe('VideoStrategy regression', () => {
  it('reassembles plain prose without technical/variation markdown blocks', () => {
    const strategy = new VideoStrategy(
      {
        execute: async () => ({ text: '', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } }),
      } as never,
      {} as never
    );

    const parsed = {
      _creative_strategy: 'test',
      shot_framing: 'Close-Up',
      camera_angle: 'Eye-Level Shot',
      camera_move: 'slow pull back',
      subject: 'baby',
      subject_details: ['wide eyes', 'infectious smile'],
      action: 'driving a colorful toy car',
      setting: 'sunny park',
      time: 'golden hour',
      lighting: 'warm golden light',
      style: "whimsical children's storybook",
      technical_specs: {
        duration: '8s',
        aspect_ratio: '16:9',
        frame_rate: '24fps',
      },
      variations: [
        { label: 'Different Angle', prompt: 'alt angle' },
      ],
    };

    type ReassembleFn = (
      parsed: Record<string, unknown>,
      onMetadata?: (metadata: Record<string, unknown>) => void,
      generationParams?: Record<string, unknown> | null
    ) => string;

    const output = (strategy as unknown as {
      _reassembleOutput: (
        parsed: Record<string, unknown>,
        onMetadata?: (metadata: Record<string, unknown>) => void,
        generationParams?: Record<string, unknown> | null
      ) => string;
    })._reassembleOutput(parsed as unknown as Parameters<ReassembleFn>[0], undefined, null);

    expect(output).not.toContain('**TECHNICAL SPECS**');
    expect(output).not.toContain('**ALTERNATIVE APPROACHES**');
    expect(output.toLowerCase()).toContain('close-up');
    expect(output.toLowerCase()).toContain('baby');
  });
});
