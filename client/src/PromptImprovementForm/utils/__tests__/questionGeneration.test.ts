import { describe, expect, it } from 'vitest';
import { buildEnhancedPrompt, generateFallbackQuestions } from '../questionGeneration';

describe('questionGeneration utils', () => {
  it('detects compare prompt type and generates targeted fallback question titles', () => {
    const questions = generateFallbackQuestions('Compare Sora vs Veo for product ads');

    expect(questions).toHaveLength(3);
    expect(questions[0]).toMatchObject({
      field: 'specificAspects',
      title: 'What comparison criteria matter most?',
    });
    expect(questions[1]).toMatchObject({
      field: 'backgroundLevel',
      title: 'How familiar are you with these options?',
    });
    expect(questions[2]).toMatchObject({
      field: 'intendedUse',
      title: 'What decision are you making?',
    });
  });

  it('generates structured fallback questions for debug prompts', () => {
    const questions = generateFallbackQuestions('Debug why this API request is failing intermittently');
    const q1 = questions[0]!;
    const q2 = questions[1]!;
    const q3 = questions[2]!;

    expect(questions).toHaveLength(3);
    expect(q1.title).toBe('What context helps solve this?');
    expect(q1.examples.length).toBeGreaterThan(0);
    expect(q2.title).toBe("What's your technical background?");
    expect(q3.title).toBe("What's your goal with the fix?");

    const ids = questions.map((q) => q.id);
    expect(ids).toEqual([1, 2, 3]);
  });

  it('falls back to general question set for unmatched prompts', () => {
    const questions = generateFallbackQuestions('Tell me something useful about this topic');
    const q1 = questions[0]!;
    const q2 = questions[1]!;
    const q3 = questions[2]!;

    expect(q1.title).toBe('What specific aspects matter most?');
    expect(q2.field).toBe('backgroundLevel');
    expect(q3.field).toBe('intendedUse');
  });

  it('buildEnhancedPrompt appends sections only for populated form values', () => {
    const enhanced = buildEnhancedPrompt('Original prompt', {
      specificAspects: 'Focus on realistic camera motion',
      backgroundLevel: '',
      intendedUse: 'For a stakeholder presentation',
    });

    expect(enhanced).toContain('Original prompt');
    expect(enhanced).toContain('Specific Focus: Focus on realistic camera motion');
    expect(enhanced).not.toContain('Audience Level:');
    expect(enhanced).toContain('Intended Use: For a stakeholder presentation');
  });
});
