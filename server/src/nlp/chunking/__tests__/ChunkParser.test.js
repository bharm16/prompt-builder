/**
 * Tests for ChunkParser
 * 
 * Tests NP/VP/PP extraction with IOB tagging
 */

import { describe, it, expect } from 'vitest';
import { ChunkParser, CHUNK_TYPES, IOB_TAGS } from '../ChunkParser.js';
import { PosTagger } from '../../pos-tagging/PosTagger.js';

describe('ChunkParser', () => {
  describe('Noun Phrase Extraction', () => {
    it('should extract simple NP', () => {
      const text = 'The soldier runs';
      const tokens = PosTagger.tagPOS(text);
      const nps = ChunkParser.extractNounPhrases(tokens);
      
      expect(nps.length).toBeGreaterThan(0);
      const firstNP = nps[0];
      expect(firstNP.text.toLowerCase()).toContain('soldier');
      expect(firstNP.type).toBe(CHUNK_TYPES.NP);
    });

    it('should extract NP with adjectives', () => {
      const text = 'A dark weathered forest';
      const tokens = PosTagger.tagPOS(text);
      const nps = ChunkParser.extractNounPhrases(tokens);
      
      expect(nps.length).toBeGreaterThan(0);
      const np = nps[0];
      expect(np.text.toLowerCase()).toContain('dark');
      expect(np.text.toLowerCase()).toContain('weathered');
      expect(np.text.toLowerCase()).toContain('forest');
    });

    it('should extract multiple NPs', () => {
      const text = 'A soldier in a forest';
      const tokens = PosTagger.tagPOS(text);
      const nps = ChunkParser.extractNounPhrases(tokens);
      
      expect(nps.length).toBeGreaterThanOrEqual(2);
    });

    it('should identify head noun', () => {
      const text = 'A weathered robotic soldier';
      const tokens = PosTagger.tagPOS(text);
      const nps = ChunkParser.extractNounPhrases(tokens);
      
      expect(nps.length).toBeGreaterThan(0);
      const headNoun = nps[0].getHeadNoun();
      expect(headNoun).toBeDefined();
      expect(headNoun.word.toLowerCase()).toBe('soldier');
    });

    it('should extract modifiers', () => {
      const text = 'A dark weathered forest';
      const tokens = PosTagger.tagPOS(text);
      const nps = ChunkParser.extractNounPhrases(tokens);
      
      const modifiers = nps[0].getModifiers();
      expect(modifiers.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Verb Phrase Extraction', () => {
    it('should extract simple VP', () => {
      const text = 'The soldier runs';
      const tokens = PosTagger.tagPOS(text);
      const vps = ChunkParser.extractVerbPhrases(tokens);
      
      expect(vps.length).toBeGreaterThan(0);
      expect(vps[0].text.toLowerCase()).toContain('run');
    });

    it('should extract VP with adverb', () => {
      const text = 'The soldier runs quickly';
      const tokens = PosTagger.tagPOS(text);
      const vps = ChunkParser.extractVerbPhrases(tokens);
      
      expect(vps.length).toBeGreaterThan(0);
      const vp = vps[0];
      expect(vp.text.toLowerCase()).toContain('run');
    });

    it('should identify main verb', () => {
      const text = 'The soldier is running';
      const tokens = PosTagger.tagPOS(text);
      const vps = ChunkParser.extractVerbPhrases(tokens);
      
      expect(vps.length).toBeGreaterThan(0);
      const mainVerb = vps[0].getMainVerb();
      expect(mainVerb).toBeDefined();
    });
  });

  describe('Prepositional Phrase Extraction', () => {
    it('should extract simple PP', () => {
      const text = 'The soldier runs in the forest';
      const tokens = PosTagger.tagPOS(text);
      const pps = ChunkParser.extractPrepositionalPhrases(tokens);
      
      expect(pps.length).toBeGreaterThan(0);
      expect(pps[0].text.toLowerCase()).toContain('in');
    });

    it('should identify preposition', () => {
      const text = 'A man with a hat';
      const tokens = PosTagger.tagPOS(text);
      const pps = ChunkParser.extractPrepositionalPhrases(tokens);
      
      expect(pps.length).toBeGreaterThan(0);
      const prep = pps[0].getPreposition();
      expect(prep).toBeDefined();
      expect(prep.word.toLowerCase()).toBe('with');
    });

    it('should extract PP object', () => {
      const text = 'In a dark forest';
      const tokens = PosTagger.tagPOS(text);
      const pps = ChunkParser.extractPrepositionalPhrases(tokens);
      
      expect(pps.length).toBeGreaterThan(0);
      const object = pps[0].getObject();
      expect(object).toBeDefined();
      expect(object.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Sentences', () => {
    it('should parse full video prompt', () => {
      const text = 'A weathered robotic soldier runs through a dark forest';
      const tokens = PosTagger.tagPOS(text);
      const analysis = ChunkParser.analyzeChunks(tokens);
      
      expect(analysis.nounPhrases.length).toBeGreaterThanOrEqual(2);
      expect(analysis.verbPhrases.length).toBeGreaterThanOrEqual(1);
      expect(analysis.prepositionalPhrases.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle camera movement prompt', () => {
      const text = 'Camera pans left across the cityscape';
      const tokens = PosTagger.tagPOS(text);
      const chunks = ChunkParser.extractChunks(tokens);
      
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('IOB Tagging', () => {
    it('should assign B- tags to chunk beginnings', () => {
      const text = 'The soldier';
      const tokens = PosTagger.tagPOS(text);
      const iobTagged = ChunkParser.assignIOBTags(tokens);
      
      const bTags = iobTagged.filter(t => t.iobTag.startsWith('B-'));
      expect(bTags.length).toBeGreaterThan(0);
    });

    it('should assign I- tags to chunk continuations', () => {
      const text = 'A dark forest';
      const tokens = PosTagger.tagPOS(text);
      const iobTagged = ChunkParser.assignIOBTags(tokens);
      
      const iTags = iobTagged.filter(t => t.iobTag.startsWith('I-'));
      expect(iTags.length).toBeGreaterThan(0);
    });
  });

  describe('Chunk Statistics', () => {
    it('should provide chunk statistics', () => {
      const text = 'The soldier runs through the forest';
      const tokens = PosTagger.tagPOS(text);
      const analysis = ChunkParser.analyzeChunks(tokens);
      
      expect(analysis.stats).toBeDefined();
      expect(analysis.stats.totalChunks).toBeGreaterThan(0);
      expect(analysis.stats.npCount).toBeGreaterThan(0);
      expect(analysis.stats.vpCount).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const chunks = ChunkParser.extractChunks([]);
      expect(chunks).toEqual([]);
    });

    it('should handle single word', () => {
      const text = 'Run';
      const tokens = PosTagger.tagPOS(text);
      const chunks = ChunkParser.extractChunks(tokens);
      
      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });
  });
});

