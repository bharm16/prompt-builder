import { describe, expect, it } from 'vitest';
import { lintVideoPromptSlots } from '../videoPromptLinter.js';

describe('lintVideoPromptSlots', () => {
  it('accepts valid slots', () => {
    const result = lintVideoPromptSlots({
      shot_framing: 'Wide Shot',
      camera_angle: 'Low-Angle Shot',
      camera_move: 'tracking shot',
      subject: 'a delivery man',
      subject_details: ['navy jacket', 'red baseball cap'],
      action: 'carrying a pizza box',
      setting: 'a busy city street with storefronts',
      time: 'golden hour',
      lighting: 'soft natural sunlight from the right, warm and diffused',
      style: 'shot on Kodak Ektachrome 100D 7294',
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('requires 2-3 subject details when subject is present', () => {
    const result = lintVideoPromptSlots({
      shot_framing: 'Wide Shot',
      camera_angle: 'Eye-Level Shot',
      camera_move: 'static tripod',
      subject: 'a dog',
      subject_details: ['golden fur'],
      action: 'running through grass',
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/subject_details/i);
  });

  it('requires present-participle action and rejects action sequences', () => {
    const result = lintVideoPromptSlots({
      shot_framing: 'Medium Shot',
      camera_angle: 'Eye-Level Shot',
      camera_move: 'handheld',
      subject: 'a cat',
      subject_details: ['tabby coat', 'green collar'],
      action: 'pounces, swats, and tumbles',
    });

    expect(result.ok).toBe(false);
    const joined = result.errors.join('\n');
    expect(joined).toMatch(/present-participle/i);
    expect(joined).toMatch(/ONE continuous action/i);
  });

  it('rejects viewer/audience language in any string field', () => {
    const result = lintVideoPromptSlots({
      shot_framing: 'Close-Up',
      camera_angle: 'Eye-Level Shot',
      camera_move: null,
      subject: 'a cat',
      subject_details: ['white whiskers', 'blue eyes'],
      action: 'batting a toy',
      lighting: 'inviting the audience to feel the joy',
      style: 'shot on 35mm',
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/audience|viewer/i);
  });

  it('rejects generic style words like "cinematic"', () => {
    const result = lintVideoPromptSlots({
      shot_framing: 'Wide Shot',
      camera_angle: 'High-Angle Shot',
      camera_move: 'slow pan',
      subject: 'a runner',
      subject_details: ['black hoodie', 'white shoes'],
      action: 'sprinting forward',
      style: 'cinematic, high quality',
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/style.*generic/i);
  });

  it('requires subject_details to be null when subject is null', () => {
    const result = lintVideoPromptSlots({
      shot_framing: 'Establishing Shot',
      camera_angle: "Bird's-Eye View",
      camera_move: 'slow drone push',
      subject: null,
      subject_details: ['red scarf', 'blue hat'],
      action: null,
      setting: 'a snow-covered plaza',
      time: 'dawn',
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/subject_details.*must be null/i);
  });
});

