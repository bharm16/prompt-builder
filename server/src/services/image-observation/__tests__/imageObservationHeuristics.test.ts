import { describe, expect, it } from 'vitest';
import {
  deriveMotionCompatibility,
  detectAngle,
  detectLightingQuality,
  detectShotType,
  detectSubjectType,
  detectTimeOfDay,
} from '../imageObservationHeuristics';

describe('imageObservationHeuristics', () => {
  it.each([
    ['a woman walking in frame', 'person'],
    ['a dog running through a field', 'animal'],
    ['a mountain landscape at dawn', 'scene'],
    ['a red bicycle against a wall', 'object'],
  ])('detectSubjectType(%s) -> %s', (text, expected) => {
    expect(detectSubjectType(text)).toBe(expected);
  });

  it.each([
    ['an extreme close-up of an eye', 'extreme-close-up'],
    ['tight close-up portrait', 'close-up'],
    ['medium close interview framing', 'medium-close-up'],
    ['establishing wide city shot', 'wide'],
    ['a neutral medium shot', 'medium'],
  ])('detectShotType(%s) -> %s', (text, expected) => {
    expect(detectShotType(text)).toBe(expected);
  });

  it.each([
    ['low angle hero pose', 'low-angle'],
    ['high angle surveillance look', 'high-angle'],
    ['dutch tilted composition', 'dutch'],
    ['over shoulder dialogue', 'over-shoulder'],
    ['head-on portrait', 'eye-level'],
  ])('detectAngle(%s) -> %s', (text, expected) => {
    expect(detectAngle(text)).toBe(expected);
  });

  it.each([
    ['dramatic chiaroscuro portrait', 'dramatic'],
    ['soft diffuse studio look', 'flat'],
    ['neon fluorescent alley', 'artificial'],
    ['natural sunlight outdoors', 'natural'],
    ['plain lighting', 'natural'],
  ])('detectLightingQuality(%s) -> %s', (text, expected) => {
    expect(detectLightingQuality(text)).toBe(expected);
  });

  it.each([
    ['sunset at the beach', 'golden-hour'],
    ['dusk city skyline', 'blue-hour'],
    ['nighttime moonlit street', 'night'],
    ['indoor room lighting', 'indoor'],
    ['bright sunny midday', 'day'],
    ['undefined ambient scene', 'unknown'],
  ])('detectTimeOfDay(%s) -> %s', (text, expected) => {
    expect(detectTimeOfDay(text)).toBe(expected);
  });

  it('deriveMotionCompatibility separates recommended and risky movement sets', () => {
    const compatibility = deriveMotionCompatibility(
      {
        shotType: 'medium',
        angle: 'eye-level',
        confidence: 0.9,
      },
      'left'
    );

    expect(compatibility.risky).toEqual(['pan-right', 'truck-left']);
    expect(compatibility.recommended).toEqual([
      'static',
      'dolly-in',
      'dolly-out',
      'pan-left',
      'truck-right',
    ]);
    expect(compatibility.risks).toEqual([
      {
        movement: 'pan-right',
        reason: 'Subject is positioned left, pan-right may cut off subject',
      },
      {
        movement: 'truck-left',
        reason: 'Subject is positioned left, truck-left may cut off subject',
      },
    ]);
  });
});
