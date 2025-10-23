import { describe, it, expect } from 'vitest';
import { PromptContext } from '../PromptContext';

describe('PromptContext', () => {
  describe('constructor and initialization', () => {
    it('should create an instance with empty data', () => {
      const context = new PromptContext();
      expect(context).toBeDefined();
      expect(context.version).toBe('1.0.0');
      expect(context.hasContext()).toBe(false);
    });

    it('should create an instance with brainstorm data', () => {
      const brainstormData = {
        subject: 'a lone astronaut',
        action: 'walking slowly',
        location: 'abandoned space station',
        time: 'golden hour',
        mood: 'melancholic',
        style: '35mm film',
        event: 'discovering a message'
      };

      const context = new PromptContext(brainstormData);
      expect(context.elements.subject).toBe('a lone astronaut');
      expect(context.elements.action).toBe('walking slowly');
      expect(context.hasContext()).toBe(true);
    });

    it('should handle partial data', () => {
      const partialData = {
        subject: 'a soldier',
        style: 'documentary'
      };

      const context = new PromptContext(partialData);
      expect(context.elements.subject).toBe('a soldier');
      expect(context.elements.style).toBe('documentary');
      expect(context.elements.action).toBeNull();
      expect(context.hasContext()).toBe(true);
    });
  });

  describe('keyword map building', () => {
    it('should build keyword maps from elements', () => {
      const brainstormData = {
        subject: 'weathered astronaut',
        action: 'camera dollies forward'
      };

      const context = new PromptContext(brainstormData);

      // Should extract full value and significant words
      expect(context.keywordMaps.subject).toContain('weathered astronaut');
      expect(context.keywordMaps.subject).toContain('weathered');
      expect(context.keywordMaps.subject).toContain('astronaut');

      expect(context.keywordMaps.action).toContain('camera dollies forward');
      expect(context.keywordMaps.action).toContain('camera');
      expect(context.keywordMaps.action).toContain('dollies');
    });

    it('should extract two-word phrases', () => {
      const brainstormData = {
        time: 'golden hour lighting'
      };

      const context = new PromptContext(brainstormData);
      expect(context.keywordMaps.time).toContain('golden hour');
      // Should also extract other 2-word combinations from the input
      const twoWordPhrases = context.keywordMaps.time.filter(k => k.split(' ').length === 2);
      expect(twoWordPhrases.length).toBeGreaterThan(0);
    });

    it('should filter out short words (less than 4 chars)', () => {
      const brainstormData = {
        subject: 'a man in a hat'
      };

      const context = new PromptContext(brainstormData);

      // Should not include 'a', 'in', 'a'
      expect(context.keywordMaps.subject.some(k => k === 'a')).toBe(false);
      expect(context.keywordMaps.subject.some(k => k === 'in')).toBe(false);
    });
  });

  describe('semantic group building', () => {
    it('should expand camera movements', () => {
      const brainstormData = {
        action: 'camera pans across scene'
      };

      const context = new PromptContext(brainstormData);
      expect(context.semanticGroups.cameraMovements).toContain('pan');
      expect(context.semanticGroups.cameraMovements).toContain('pans');
      expect(context.semanticGroups.cameraMovements).toContain('panning');
    });

    it('should expand lighting quality terms', () => {
      const brainstormData = {
        time: 'golden hour'
      };

      const context = new PromptContext(brainstormData);
      expect(context.semanticGroups.lightingQuality).toContain('golden hour');
      expect(context.semanticGroups.lightingQuality).toContain('magic hour');
      expect(context.semanticGroups.lightingQuality).toContain('warm light');
    });

    it('should expand style/aesthetic terms', () => {
      const brainstormData = {
        style: '35mm film grain'
      };

      const context = new PromptContext(brainstormData);
      expect(context.semanticGroups.aesthetics).toContain('35mm');
      expect(context.semanticGroups.aesthetics).toContain('film');
      expect(context.semanticGroups.aesthetics).toContain('analog');
    });
  });

  describe('findCategoryForPhrase', () => {
    it('should find exact matches from user input', () => {
      const brainstormData = {
        subject: 'lone astronaut',
        location: 'space station'
      };

      const context = new PromptContext(brainstormData);

      const result = context.findCategoryForPhrase('lone astronaut');
      expect(result).toBeDefined();
      expect(result.category).toBe('subject');
      expect(result.confidence).toBe(1.0);
      expect(result.source).toBe('user-input');
    });

    it('should find partial matches', () => {
      const brainstormData = {
        subject: 'weathered soldier'
      };

      const context = new PromptContext(brainstormData);

      const result = context.findCategoryForPhrase('soldier');
      expect(result).toBeDefined();
      expect(result.category).toBe('subject');
      expect(result.confidence).toBe(1.0);
    });

    it('should find semantic matches', () => {
      const brainstormData = {
        action: 'camera pans'
      };

      const context = new PromptContext(brainstormData);

      const result = context.findCategoryForPhrase('panning shot');
      expect(result).toBeDefined();
      expect(result.category).toBe('action');
      expect(result.confidence).toBe(0.8);
      expect(result.source).toBe('semantic-match');
    });

    it('should return null for no matches', () => {
      const brainstormData = {
        subject: 'astronaut'
      };

      const context = new PromptContext(brainstormData);

      const result = context.findCategoryForPhrase('completely unrelated phrase');
      expect(result).toBeNull();
    });

    it('should handle case-insensitive matching', () => {
      const brainstormData = {
        subject: 'Lone Astronaut'
      };

      const context = new PromptContext(brainstormData);

      const result = context.findCategoryForPhrase('lone astronaut');
      expect(result).toBeDefined();
      expect(result.category).toBe('subject');
    });
  });

  describe('generateVariations', () => {
    it('should generate plural variations', () => {
      const context = new PromptContext();
      const variations = context.generateVariations('astronaut');

      expect(variations).toContain('astronaut');
      expect(variations).toContain('astronauts');
    });

    it('should generate singular from plural', () => {
      const context = new PromptContext();
      const variations = context.generateVariations('soldiers');

      expect(variations).toContain('soldiers');
      expect(variations).toContain('soldier');
    });

    it('should handle present participle', () => {
      const context = new PromptContext();
      const variations = context.generateVariations('walk');

      expect(variations).toContain('walk');
      expect(variations).toContain('walking');
    });

    it('should remove articles', () => {
      const context = new PromptContext();
      const variations = context.generateVariations('the lone soldier');

      expect(variations.some(v => v === 'lone soldier')).toBe(true);
    });
  });

  describe('getCategoryColor', () => {
    it('should return colors for known categories', () => {
      const color = PromptContext.getCategoryColor('subject');
      expect(color).toBeDefined();
      expect(color.bg).toBeDefined();
      expect(color.border).toBeDefined();
    });

    it('should return default color for unknown categories', () => {
      const color = PromptContext.getCategoryColor('unknown');
      expect(color).toBeDefined();
      expect(color.bg).toContain('rgba(156, 163, 175');
    });
  });

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      const brainstormData = {
        subject: 'astronaut',
        action: 'walking'
      };

      const context = new PromptContext(brainstormData);
      const json = context.toJSON();

      expect(json.version).toBe('1.0.0');
      expect(json.elements.subject).toBe('astronaut');
      expect(json.elements.action).toBe('walking');
      expect(json.createdAt).toBeDefined();
    });

    it('should deserialize from JSON', () => {
      const json = {
        version: '1.0.0',
        createdAt: Date.now(),
        elements: {
          subject: 'astronaut',
          action: 'walking'
        },
        metadata: {}
      };

      const context = PromptContext.fromJSON(json);
      expect(context).toBeDefined();
      expect(context.elements.subject).toBe('astronaut');
      expect(context.elements.action).toBe('walking');
    });

    it('should handle null JSON', () => {
      const context = PromptContext.fromJSON(null);
      expect(context).toBeNull();
    });
  });

  describe('mapGroupToCategory', () => {
    it('should map cameraMovements to action', () => {
      const context = new PromptContext();
      expect(context.mapGroupToCategory('cameraMovements')).toBe('action');
    });

    it('should map lightingQuality to time', () => {
      const context = new PromptContext();
      expect(context.mapGroupToCategory('lightingQuality')).toBe('time');
    });

    it('should map aesthetics to style', () => {
      const context = new PromptContext();
      expect(context.mapGroupToCategory('aesthetics')).toBe('style');
    });

    it('should return null for unknown groups', () => {
      const context = new PromptContext();
      expect(context.mapGroupToCategory('unknownGroup')).toBeNull();
    });
  });
});
