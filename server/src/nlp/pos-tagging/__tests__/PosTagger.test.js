/**
 * Tests for PosTagger
 * 
 * Tests Penn Treebank tag mapping and verb tense detection
 */

import { describe, it, expect } from 'vitest';
import { PosTagger } from '../PosTagger.js';

describe('PosTagger', () => {
  describe('Basic POS Tagging', () => {
    it('should tag simple sentence correctly', () => {
      const text = 'A soldier runs';
      const tokens = PosTagger.tagPOS(text);
      
      expect(tokens).toHaveLength(3);
      expect(tokens[0].tag).toBe('DT'); // A
      expect(tokens[1].tag).toMatch(/^NN/); // soldier
      expect(tokens[2].tag).toMatch(/^VB/); // runs
    });

    it('should handle empty input', () => {
      const tokens = PosTagger.tagPOS('');
      expect(tokens).toEqual([]);
    });

    it('should handle null input', () => {
      const tokens = PosTagger.tagPOS(null);
      expect(tokens).toEqual([]);
    });
  });

  describe('Noun Detection', () => {
    it('should extract singular nouns', () => {
      const text = 'The soldier stands';
      const nouns = PosTagger.extractNouns(text);
      
      expect(nouns.length).toBeGreaterThan(0);
      expect(nouns.some(n => n.word.toLowerCase() === 'soldier')).toBe(true);
    });

    it('should extract plural nouns', () => {
      const text = 'The soldiers march';
      const nouns = PosTagger.extractNouns(text);
      
      expect(nouns.length).toBeGreaterThan(0);
      const soldierNoun = nouns.find(n => n.word.toLowerCase() === 'soldiers');
      expect(soldierNoun).toBeDefined();
      expect(soldierNoun.tag).toBe('NNS');
    });

    it('should extract proper nouns', () => {
      const text = 'Batman walks in Gotham';
      const nouns = PosTagger.extractNouns(text);
      
      expect(nouns.some(n => n.word === 'Batman')).toBe(true);
      expect(nouns.some(n => n.word === 'Gotham')).toBe(true);
    });
  });

  describe('Verb Detection', () => {
    it('should extract base form verbs', () => {
      const text = 'Let the soldier run';
      const verbs = PosTagger.extractVerbs(text);
      
      expect(verbs.some(v => v.word.toLowerCase() === 'run')).toBe(true);
    });

    it('should detect gerunds (VBG)', () => {
      const text = 'A soldier is running through the forest';
      const verbs = PosTagger.extractVerbs(text);
      
      const running = verbs.find(v => v.word.toLowerCase() === 'running');
      expect(running).toBeDefined();
      expect(running.tag).toBe('VBG');
    });

    it('should detect past tense verbs (VBD)', () => {
      const text = 'The soldier ran quickly';
      const verbs = PosTagger.extractVerbs(text);
      
      const ran = verbs.find(v => v.word.toLowerCase() === 'ran');
      expect(ran).toBeDefined();
      expect(ran.tag).toBe('VBD');
    });

    it('should detect present tense third person (VBZ)', () => {
      const text = 'He runs fast';
      const verbs = PosTagger.extractVerbs(text);
      
      const runs = verbs.find(v => v.word.toLowerCase() === 'runs');
      expect(runs).toBeDefined();
      expect(runs.tag).toMatch(/^VB/);
    });
  });

  describe('Adjective Detection', () => {
    it('should extract adjectives', () => {
      const text = 'A dark weathered robotic soldier';
      const adjectives = PosTagger.extractAdjectives(text);
      
      expect(adjectives.length).toBeGreaterThanOrEqual(2);
      expect(adjectives.some(a => a.word.toLowerCase() === 'dark')).toBe(true);
      expect(adjectives.some(a => a.word.toLowerCase() === 'weathered')).toBe(true);
    });

    it('should handle comparative adjectives', () => {
      const text = 'A darker forest';
      const adjectives = PosTagger.extractAdjectives(text);
      
      const darker = adjectives.find(a => a.word.toLowerCase() === 'darker');
      expect(darker).toBeDefined();
    });
  });

  describe('Adverb Detection', () => {
    it('should extract adverbs', () => {
      const text = 'The soldier runs quickly';
      const adverbs = PosTagger.extractAdverbs(text);
      
      expect(adverbs.some(a => a.word.toLowerCase() === 'quickly')).toBe(true);
    });

    it('should detect manner adverbs', () => {
      const text = 'He moves slowly and carefully';
      const adverbs = PosTagger.extractAdverbs(text);
      
      expect(adverbs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Complex Sentences', () => {
    it('should handle complex video prompt', () => {
      const text = 'A weathered robotic soldier runs through a dark forest at night';
      const analysis = PosTagger.analyzeText(text);
      
      expect(analysis.tokens.length).toBeGreaterThan(0);
      expect(analysis.stats.nouns).toBeGreaterThan(0);
      expect(analysis.stats.verbs).toBeGreaterThan(0);
      expect(analysis.stats.adjectives).toBeGreaterThan(0);
    });

    it('should handle camera movement prompts', () => {
      const text = 'Camera pans left across the cityscape';
      const tokens = PosTagger.tagPOS(text);
      
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.some(t => t.word.toLowerCase() === 'camera')).toBe(true);
      expect(tokens.some(t => t.word.toLowerCase() === 'pans')).toBe(true);
    });
  });

  describe('Verb Tense Analysis', () => {
    it('should detect continuous action (VBG)', () => {
      const text = 'A soldier is running';
      const analysis = PosTagger.analyzeVerbTenses(text);
      
      expect(analysis.hasContinuousAction).toBe(true);
      expect(analysis.tenseDistribution.VBG).toBeGreaterThan(0);
    });

    it('should detect past action (VBD)', () => {
      const text = 'The soldier ran';
      const analysis = PosTagger.analyzeVerbTenses(text);
      
      expect(analysis.hasPastAction).toBe(true);
      expect(analysis.tenseDistribution.VBD).toBeGreaterThan(0);
    });

    it('should detect base form (VB)', () => {
      const text = 'Let the soldier run';
      const analysis = PosTagger.analyzeVerbTenses(text);
      
      expect(analysis.hasBaseForm).toBe(true);
    });
  });

  describe('Character Positions', () => {
    it('should track character positions', () => {
      const text = 'A soldier runs';
      const tokens = PosTagger.tagPOS(text);
      
      expect(tokens[0].charStart).toBeDefined();
      expect(tokens[0].charEnd).toBeDefined();
      expect(tokens[0].charEnd).toBeGreaterThan(tokens[0].charStart);
    });

    it('should have sequential positions', () => {
      const text = 'The quick brown fox';
      const tokens = PosTagger.tagPOS(text);
      
      for (let i = 1; i < tokens.length; i++) {
        expect(tokens[i].charStart).toBeGreaterThanOrEqual(tokens[i - 1].charEnd);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle single word', () => {
      const tokens = PosTagger.tagPOS('Run');
      expect(tokens).toHaveLength(1);
    });

    it('should handle punctuation', () => {
      const text = 'The soldier runs.';
      const tokens = PosTagger.tagPOS(text);
      
      expect(tokens.length).toBeGreaterThan(0);
      const lastToken = tokens[tokens.length - 1];
      expect(lastToken.word).toBe('.');
    });

    it('should handle numbers', () => {
      const text = 'Shot at 24fps in 16:9';
      const tokens = PosTagger.tagPOS(text);
      
      expect(tokens.some(t => t.word === '24fps')).toBe(true);
    });
  });
});

