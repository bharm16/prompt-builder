import { describe, expect, it } from 'vitest';
import { renderAlternativeApproaches, renderMainVideoPrompt } from '../videoPromptRenderer.js';

describe('videoPromptRenderer', () => {
  it('renders a paragraph starting with framing and including angle phrase', () => {
    const text = renderMainVideoPrompt({
      shot_framing: 'Wide Shot',
      camera_angle: 'Low-Angle Shot',
      camera_move: 'tracking shot',
      subject: 'a delivery man',
      subject_details: ['navy jacket', 'red baseball cap'],
      action: 'carrying a pizza box',
      setting: 'a bustling city street with bright storefronts',
      time: 'golden hour',
      lighting: 'soft sunlight from the left, warm and diffused',
      style: 'shot on Kodak Ektachrome 100D 7294',
    });

    expect(text).toMatch(/^Wide Shot\b/);
    expect(text).toMatch(/from a low angle/i);
    expect(text).toMatch(/tracking/i);
    expect(text).toMatch(/carrying a pizza box/i);
    expect(text).toMatch(/golden hour/i);
  });

  it('generates two alternative approaches', () => {
    const variations = renderAlternativeApproaches({
      shot_framing: 'Medium Shot',
      camera_angle: 'Eye-Level Shot',
      camera_move: 'handheld',
      subject: 'a dog',
      subject_details: ['golden fur', 'blue bandana'],
      action: 'running through grass',
      setting: 'a park with trees',
      time: 'late afternoon',
      lighting: 'natural sunlight through tree branches',
      style: 'shot on 35mm film',
    });

    expect(variations).toHaveLength(2);
    expect(variations[0]?.label).toMatch(/Different Camera/i);
    expect(variations[1]?.label).toMatch(/Different Lighting/i);
    expect(variations[0]?.prompt).toMatch(/^Medium Shot\b/);
    expect(variations[1]?.prompt).toMatch(/^Medium Shot\b/);
  });

  it('avoids ungrammatical "with wearing" subject phrasing', () => {
    const text = renderMainVideoPrompt({
      shot_framing: 'Medium Close-Up',
      camera_angle: 'Eye-Level Shot',
      camera_move: 'static tripod',
      subject: 'man',
      subject_details: ['wearing a sweater', 'short hair'],
      action: null,
      setting: null,
      time: null,
      lighting: 'natural light from the window, soft and warm',
      style: 'shot on Kodak Portra 400',
    });

    expect(text).toMatch(/of a man\b/i);
    expect(text).toMatch(/\bwearing a sweater\b/i);
    expect(text).not.toMatch(/\bwith wearing\b/i);
  });
});
