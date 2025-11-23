/**
 * ExampleRanker Tests
 * 
 * Tests intelligent example selection and ranking for enhanced SemanticRouter
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ExampleRanker } from '../../../server/src/llm/span-labeling/routing/ExampleRanker.js';

describe('ExampleRanker', () => {
  let ranker;
  let mockExampleBank;

  beforeEach(() => {
    ranker = new ExampleRanker();
    
    mockExampleBank = [
      {
        input: 'The camera dollies back',
        domains: ['cinematography', 'technical'],
        keywords: ['camera', 'dolly', 'movement'],
        ambiguity: 'camera_vs_subject_movement',
      },
      {
        input: 'According to Smith et al. (2023), the hypothesis',
        domains: ['academic', 'research'],
        keywords: ['citation', 'hypothesis', 'research'],
        ambiguity: 'citation_format',
      },
      {
        input: 'The sunset painted the sky',
        domains: ['creative', 'poetic'],
        keywords: ['sunset', 'painted', 'metaphor'],
        ambiguity: 'figurative_language',
      },
      {
        input: 'I\'m gonna grab some coffee',
        domains: ['conversational', 'informal'],
        keywords: ['gonna', 'grab', 'coffee'],
        ambiguity: 'informal_contractions',
      },
    ];
  });

  describe('rankExamples', () => {
    it('should rank cinematography examples highly for camera text', () => {
      const text = 'The camera pans left as the subject walks';
      
      const ranked = ranker.rankExamples(text, mockExampleBank, 2);
      
      expect(ranked).toHaveLength(2);
      expect(ranked[0].example.domains).toContain('cinematography');
    });

    it('should rank academic examples highly for research text', () => {
      const text = 'The study analyzed data from 150 participants using statistical methods';
      
      const ranked = ranker.rankExamples(text, mockExampleBank, 2);
      
      expect(ranked[0].example.domains).toContain('academic');
    });

    it('should rank creative examples highly for poetic text', () => {
      const text = 'The moon danced across the obsidian sky like a silver coin';
      
      const ranked = ranker.rankExamples(text, mockExampleBank, 2);
      
      expect(ranked[0].example.domains).toContain('creative');
    });

    it('should rank conversational examples highly for casual text', () => {
      const text = 'Yeah, I\'m totally gonna hit up that new place later';
      
      const ranked = ranker.rankExamples(text, mockExampleBank, 2);
      
      expect(ranked[0].example.domains).toContain('conversational');
    });

    it('should respect maxResults parameter', () => {
      const text = 'camera dolly pan tilt';
      
      const ranked = ranker.rankExamples(text, mockExampleBank, 3);
      
      expect(ranked).toHaveLength(3);
    });

    it('should return empty array for empty bank', () => {
      const ranked = ranker.rankExamples('test', [], 5);
      
      expect(ranked).toEqual([]);
    });

    it('should include score breakdown', () => {
      const text = 'camera movement';
      
      const ranked = ranker.rankExamples(text, mockExampleBank, 1);
      
      expect(ranked[0]).toHaveProperty('totalScore');
      expect(ranked[0]).toHaveProperty('scores');
      expect(ranked[0].scores).toHaveProperty('keywordOverlap');
      expect(ranked[0].scores).toHaveProperty('domainMatch');
      expect(ranked[0].scores).toHaveProperty('structuralSimilarity');
      expect(ranked[0].scores).toHaveProperty('ambiguityMatch');
    });
  });

  describe('_detectDomains', () => {
    it('should detect cinematography domain', () => {
      const domains = ranker._detectDomains('camera pans left', ['camera', 'pans', 'left']);
      
      expect(domains).toContain('cinematography');
      expect(domains).toContain('technical');
    });

    it('should detect academic domain', () => {
      const domains = ranker._detectDomains(
        'hypothesis methodology research',
        ['hypothesis', 'methodology', 'research']
      );
      
      expect(domains).toContain('academic');
    });

    it('should detect creative domain from metaphors', () => {
      const domains = ranker._detectDomains(
        'the stars danced like diamonds',
        ['the', 'stars', 'danced', 'like', 'diamonds']
      );
      
      expect(domains).toContain('creative');
      expect(domains).toContain('poetic');
    });

    it('should detect conversational domain', () => {
      const domains = ranker._detectDomains(
        'yeah gonna wanna totally',
        ['yeah', 'gonna', 'wanna', 'totally']
      );
      
      expect(domains).toContain('conversational');
      expect(domains).toContain('informal');
    });

    it('should default to general for unrecognized text', () => {
      const domains = ranker._detectDomains('xyz abc def', ['xyz', 'abc', 'def']);
      
      expect(domains).toContain('general');
    });
  });

  describe('_detectAmbiguity', () => {
    it('should detect homonyms', () => {
      const ambiguities = ranker._detectAmbiguity('pan the camera', ['pan', 'the', 'camera']);
      
      expect(ambiguities).toContain('homonym_disambiguation');
    });

    it('should detect camera vs subject movement', () => {
      const ambiguities = ranker._detectAmbiguity(
        'camera moves forward',
        ['camera', 'moves', 'forward']
      );
      
      expect(ambiguities).toContain('camera_vs_subject_movement');
    });

    it('should detect figurative language', () => {
      const ambiguities = ranker._detectAmbiguity(
        'like a bird in flight',
        ['like', 'a', 'bird', 'in', 'flight']
      );
      
      expect(ambiguities).toContain('figurative_language');
    });

    it('should detect technical terminology', () => {
      const ambiguities = ranker._detectAmbiguity(
        'shot at f/2.8 with bokeh',
        ['shot', 'at', 'f', '2', '8', 'with', 'bokeh']
      );
      
      expect(ambiguities).toContain('technical_terminology');
    });
  });

  describe('_scoreKeywordOverlap', () => {
    it('should score perfect match as 1.0', () => {
      const textWords = ['camera', 'dolly', 'movement'];
      const keywords = ['camera', 'dolly', 'movement'];
      
      const score = ranker._scoreKeywordOverlap(textWords, keywords);
      
      expect(score).toBe(1.0);
    });

    it('should score partial match proportionally', () => {
      const textWords = ['camera', 'dolly'];
      const keywords = ['camera', 'dolly', 'movement', 'pan'];
      
      const score = ranker._scoreKeywordOverlap(textWords, keywords);
      
      expect(score).toBe(0.5); // 2 out of 4 keywords matched
    });

    it('should score no match as 0', () => {
      const textWords = ['apple', 'orange'];
      const keywords = ['camera', 'dolly'];
      
      const score = ranker._scoreKeywordOverlap(textWords, keywords);
      
      expect(score).toBe(0);
    });
  });

  describe('_scoreDomainMatch', () => {
    it('should score perfect domain match as 1.0', () => {
      const detectedDomains = ['cinematography', 'technical'];
      const exampleDomains = ['cinematography', 'technical'];
      
      const score = ranker._scoreDomainMatch(detectedDomains, exampleDomains);
      
      expect(score).toBe(1.0);
    });

    it('should score partial domain match proportionally', () => {
      const detectedDomains = ['cinematography'];
      const exampleDomains = ['cinematography', 'technical'];
      
      const score = ranker._scoreDomainMatch(detectedDomains, exampleDomains);
      
      expect(score).toBe(0.5);
    });

    it('should return neutral score for empty example domains', () => {
      const detectedDomains = ['cinematography'];
      const exampleDomains = [];
      
      const score = ranker._scoreDomainMatch(detectedDomains, exampleDomains);
      
      expect(score).toBe(0.5);
    });
  });

  describe('explainRanking', () => {
    it('should provide human-readable explanation', () => {
      const rankedExample = {
        totalScore: 0.75,
        scores: {
          keywordOverlap: 0.8,
          domainMatch: 1.0,
          structuralSimilarity: 0.6,
          ambiguityMatch: 0.5,
        },
      };
      
      const explanation = ranker.explainRanking(rankedExample);
      
      expect(explanation).toContain('0.750');
      expect(explanation).toContain('Keyword');
      expect(explanation).toContain('Domain');
      expect(explanation).toContain('Structure');
      expect(explanation).toContain('Ambiguity');
    });
  });
});

