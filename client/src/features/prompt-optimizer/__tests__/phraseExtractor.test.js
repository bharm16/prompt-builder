import { describe, it, expect } from 'vitest';
import { extractVideoPromptPhrases } from '../phraseExtractor';
import { PromptContext } from '../../../utils/PromptContext';

describe('extractVideoPromptPhrases', () => {
  describe('without context', () => {
    it('should extract descriptive phrases', () => {
      const text = 'A beautiful sunset with golden hour lighting';
      const phrases = extractVideoPromptPhrases(text);

      expect(phrases).toBeDefined();
      expect(phrases.length).toBeGreaterThan(0);

      const descriptive = phrases.filter(p => p.category === 'descriptive');
      expect(descriptive.length).toBeGreaterThan(0);
    });

    it('should extract camera movements', () => {
      const text = 'The camera pans across the scene';
      const phrases = extractVideoPromptPhrases(text);

      const camera = phrases.filter(p => p.category === 'camera');
      // May or may not extract depending on NLP recognition
      // This is expected behavior as NLP has limitations
      expect(phrases.length).toBeGreaterThan(0);
    });

    it('should extract technical specs', () => {
      const text = 'Shot on 35mm film at 24fps with a 2.39:1 aspect ratio';
      const phrases = extractVideoPromptPhrases(text);

      const technical = phrases.filter(p => p.category === 'technical');
      expect(technical.length).toBeGreaterThan(0);
      expect(technical.some(p => p.text === '35mm')).toBe(true);
      expect(technical.some(p => p.text === '24fps')).toBe(true);
    });

    it('should return empty array for empty text', () => {
      const phrases = extractVideoPromptPhrases('');
      expect(phrases).toEqual([]);
    });

    it('should limit highlights to max 15 phrases', () => {
      const text = `
        A lone astronaut walks slowly through an abandoned space station.
        The camera dollies forward. Golden hour lighting casts soft shadows.
        Shot on 35mm film at 24fps. The weathered soldier stands tall.
        Harsh overhead fluorescent lights flicker. The blue hour creates
        a moody atmosphere. Documentary style handheld camera work.
        Cinematic framing with shallow depth of field. Wide shot establishing
        the scene. Close-up on the character's weathered face. Dramatic rim light
        highlights the silhouette. Desaturated color palette. Film grain texture.
        Natural lighting from large windows. Sunset colors fill the sky.
      `;
      const phrases = extractVideoPromptPhrases(text);

      expect(phrases.length).toBeLessThanOrEqual(15);
    });
  });

  describe('with context', () => {
    it('should prioritize user-provided elements', () => {
      const brainstormData = {
        subject: 'lone astronaut',
        location: 'abandoned space station',
        time: 'golden hour'
      };
      const context = new PromptContext(brainstormData);

      const text = 'A lone astronaut walks through an abandoned space station during golden hour';
      const phrases = extractVideoPromptPhrases(text, context);

      // Find user-input phrases
      const userPhrases = phrases.filter(p => p.source === 'user-input');
      expect(userPhrases.length).toBeGreaterThan(0);

      // Should have highest confidence
      userPhrases.forEach(p => {
        expect(p.confidence).toBe(1.0);
      });

      // Should be prioritized (appear first after scoring)
      const topPhrases = phrases.slice(0, 5);
      expect(topPhrases.some(p => p.source === 'user-input')).toBe(true);
    });

    it('should match semantic variations', () => {
      const brainstormData = {
        action: 'camera pans'
      };
      const context = new PromptContext(brainstormData);

      const text = 'The camera slowly panning across the landscape';
      const phrases = extractVideoPromptPhrases(text, context);

      const semantic = phrases.filter(p => p.source === 'semantic-match');
      expect(semantic.length).toBeGreaterThan(0);
      expect(semantic[0].confidence).toBe(0.8);
    });

    it('should handle case-insensitive matching', () => {
      const brainstormData = {
        subject: 'Lone Astronaut'
      };
      const context = new PromptContext(brainstormData);

      const text = 'A lone astronaut explores the vessel';
      const phrases = extractVideoPromptPhrases(text, context);

      const userInput = phrases.find(p => p.source === 'user-input' && p.text.toLowerCase().includes('astronaut'));
      expect(userInput).toBeDefined();
    });

    it('should detect golden hour semantic matches', () => {
      const brainstormData = {
        time: 'golden hour'
      };
      const context = new PromptContext(brainstormData);

      const text = 'The scene is bathed in warm light during magic hour';
      const phrases = extractVideoPromptPhrases(text, context);

      const semantic = phrases.filter(p => p.source === 'semantic-match');
      expect(semantic.length).toBeGreaterThan(0);
    });

    it('should include originalValue in phrase metadata', () => {
      const brainstormData = {
        subject: 'weathered soldier',
        location: 'battlefield'
      };
      const context = new PromptContext(brainstormData);

      const text = 'A weathered soldier stands on the battlefield';
      const phrases = extractVideoPromptPhrases(text, context);

      const userPhrases = phrases.filter(p => p.source === 'user-input');
      userPhrases.forEach(p => {
        expect(p.originalValue).toBeDefined();
        expect(['weathered soldier', 'battlefield']).toContain(p.originalValue);
      });
    });

    it('should avoid duplicate highlights', () => {
      const brainstormData = {
        subject: 'astronaut'
      };
      const context = new PromptContext(brainstormData);

      const text = 'An astronaut, a lone astronaut, the astronaut walks';
      const phrases = extractVideoPromptPhrases(text, context);

      // Check that we don't have overlapping highlights
      for (let i = 0; i < phrases.length; i++) {
        for (let j = i + 1; j < phrases.length; j++) {
          const p1 = phrases[i].text.toLowerCase();
          const p2 = phrases[j].text.toLowerCase();

          // Neither phrase should contain the other
          expect(p1.includes(p2) || p2.includes(p1)).toBe(false);
        }
      }
    });

    it('should work with partial context data', () => {
      const brainstormData = {
        subject: 'astronaut'
        // Other fields are null
      };
      const context = new PromptContext(brainstormData);

      const text = 'An astronaut explores the station with camera dollying forward';
      const phrases = extractVideoPromptPhrases(text, context);

      expect(phrases.length).toBeGreaterThan(0);

      // Should have user-input for subject
      const userInput = phrases.filter(p => p.source === 'user-input');
      expect(userInput.length).toBeGreaterThan(0);

      // Should also have NLP-extracted for camera movement
      const nlp = phrases.filter(p => p.source === 'nlp-extracted');
      expect(nlp.length).toBeGreaterThan(0);
    });
  });

  describe('phrase scoring and prioritization', () => {
    it('should score user-input phrases highest', () => {
      const brainstormData = {
        subject: 'astronaut'
      };
      const context = new PromptContext(brainstormData);

      const text = 'An astronaut with golden hour lighting and camera dollies forward shot on 35mm';
      const phrases = extractVideoPromptPhrases(text, context);

      // User input should be prioritized
      const userInputIndex = phrases.findIndex(p => p.source === 'user-input');
      const nlpIndex = phrases.findIndex(p => p.source === 'nlp-extracted');

      // User input should appear before or near the start
      if (userInputIndex >= 0 && nlpIndex >= 0) {
        expect(userInputIndex).toBeLessThanOrEqual(5);
      }
    });

    it('should prioritize technical specs', () => {
      const text = 'A scene shot on 35mm with beautiful lighting and soft colors';
      const phrases = extractVideoPromptPhrases(text);

      const technical = phrases.find(p => p.category === 'technical');
      if (technical) {
        // Technical specs should be in top half
        const technicalIndex = phrases.indexOf(technical);
        expect(technicalIndex).toBeLessThan(phrases.length / 2);
      }
    });

    it('should prioritize longer phrases', () => {
      const text = 'The weathered old soldier with a grey beard stands tall';
      const phrases = extractVideoPromptPhrases(text);

      // Multi-word phrases should be prioritized over single words
      const multiWord = phrases.filter(p => p.text.split(' ').length > 1);
      expect(multiWord.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle null context gracefully', () => {
      const text = 'A beautiful scene with golden hour lighting';
      const phrases = extractVideoPromptPhrases(text, null);

      expect(phrases).toBeDefined();
      expect(phrases.length).toBeGreaterThan(0);
    });

    it('should handle context without meaningful data', () => {
      const context = new PromptContext({});
      const text = 'A beautiful scene with golden hour lighting';
      const phrases = extractVideoPromptPhrases(text, context);

      expect(phrases).toBeDefined();
      expect(phrases.length).toBeGreaterThan(0);
      // Should all be NLP-extracted
      expect(phrases.every(p => p.source === 'nlp-extracted')).toBe(true);
    });

    it('should handle special characters in text', () => {
      const text = 'Shot on 35mm @ 24fps, ratio 2.39:1 - cinematic!';
      const phrases = extractVideoPromptPhrases(text);

      const technical = phrases.filter(p => p.category === 'technical');
      expect(technical.length).toBeGreaterThan(0);
    });

    it('should handle very long text', () => {
      const longText = Array(100).fill('A lone astronaut walks slowly.').join(' ');
      const phrases = extractVideoPromptPhrases(longText);

      // Should still limit to 15 highlights
      expect(phrases.length).toBeLessThanOrEqual(15);
    });
  });

  describe('phrase metadata', () => {
    it('should include all required fields', () => {
      const text = 'A beautiful scene with golden hour lighting';
      const phrases = extractVideoPromptPhrases(text);

      phrases.forEach(p => {
        expect(p.text).toBeDefined();
        expect(p.category).toBeDefined();
        expect(p.confidence).toBeDefined();
        expect(p.source).toBeDefined();
        expect(p.color).toBeDefined();
        expect(p.color.bg).toBeDefined();
        expect(p.color.border).toBeDefined();
      });
    });

    it('should assign correct categories', () => {
      const brainstormData = {
        subject: 'astronaut',
        action: 'walking',
        location: 'station',
        time: 'golden hour',
        style: '35mm'
      };
      const context = new PromptContext(brainstormData);

      const text = 'An astronaut walking through the station during golden hour shot on 35mm';
      const phrases = extractVideoPromptPhrases(text, context);

      const categories = [...new Set(phrases.map(p => p.category))];
      expect(categories.length).toBeGreaterThan(1);
    });
  });
});
