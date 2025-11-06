/**
 * @test {CategoryGuidanceService}
 * @description Comprehensive test suite for context-aware category guidance
 * 
 * Test Coverage:
 * - Context-aware guidance generation
 * - Element analysis (time, location, mood, lighting, camera, action, style)
 * - Gap identification
 * - Relationship analysis (constraints and opportunities)
 * - Category-specific guidance builders
 * - Edit history consistency
 * 
 * Pattern: Pure logic service with no external dependencies
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CategoryGuidanceService } from '../CategoryGuidanceService.js';

describe('CategoryGuidanceService', () => {
  let service;

  beforeEach(() => {
    service = new CategoryGuidanceService();
  });

  // ============================================
  // analyzeExistingElements
  // ============================================

  describe('analyzeExistingElements', () => {
    it('should extract time of day from context', () => {
      // Arrange
      const fullContext = 'A scene during golden hour with warm lighting';
      const allSpans = [];

      // Act
      const result = service.analyzeExistingElements(fullContext, allSpans);

      // Assert
      expect(result.timeOfDay).toBe('golden hour');
    });

    it('should extract location from context', () => {
      // Arrange
      const fullContext = 'An underwater scene with a diver exploring a reef';
      const allSpans = [];

      // Act
      const result = service.analyzeExistingElements(fullContext, allSpans);

      // Assert
      expect(result.location).toBe('underwater');
    });

    it('should extract mood from context', () => {
      // Arrange
      const fullContext = 'A moody and dark atmosphere fills the room';
      const allSpans = [];

      // Act
      const result = service.analyzeExistingElements(fullContext, allSpans);

      // Assert
      expect(result.mood).toBe('moody');
    });

    it('should extract subject from spans', () => {
      // Arrange
      const fullContext = '';
      const allSpans = [
        { category: 'subject', text: 'elderly woman' },
        { category: 'subject', text: 'tall man' }
      ];

      // Act
      const result = service.analyzeExistingElements(fullContext, allSpans);

      // Assert
      expect(result.subject.core).toBe('elderly woman, tall man');
      expect(result.subject.appearance).toBe(true);
    });

    it('should extract lighting details from spans', () => {
      // Arrange
      const fullContext = '';
      const allSpans = [
        { category: 'lighting', text: 'soft light from left, 3200K warm' }
      ];

      // Act
      const result = service.analyzeExistingElements(fullContext, allSpans);

      // Assert
      expect(result.lighting.direction).toBe(true);
      expect(result.lighting.quality).toBe(true);
      expect(result.lighting.temperature).toBe(true);
    });

    it('should extract camera details from spans', () => {
      // Arrange
      const fullContext = '';
      const allSpans = [
        { category: 'camera', text: 'handheld 35mm, low angle' }
      ];

      // Act
      const result = service.analyzeExistingElements(fullContext, allSpans);

      // Assert
      expect(result.camera.movement).toBe(true);
      expect(result.camera.lens).toBe(true);
      expect(result.camera.angle).toBe(true);
    });

    it('should handle empty context and spans', () => {
      // Arrange
      const fullContext = '';
      const allSpans = [];

      // Act
      const result = service.analyzeExistingElements(fullContext, allSpans);

      // Assert
      expect(result.timeOfDay).toBeNull();
      expect(result.location).toBeNull();
      expect(result.mood).toBeNull();
      expect(result.subject.core).toBe('');
    });
  });

  // ============================================
  // identifyGaps
  // ============================================

  describe('identifyGaps', () => {
    it('should identify missing lighting aspects', () => {
      // Arrange
      const category = 'lighting';
      const existingElements = {
        lighting: {
          direction: false,
          quality: false,
          temperature: false,
          intensity: false
        }
      };

      // Act
      const gaps = service.identifyGaps(category, existingElements);

      // Assert
      expect(gaps).toContain('direction');
      expect(gaps).toContain('quality');
      expect(gaps).toContain('temperature');
      expect(gaps).toContain('intensity');
    });

    it('should identify missing camera aspects', () => {
      // Arrange
      const category = 'camera';
      const existingElements = {
        camera: {
          movement: false,
          lens: false,
          angle: false,
          framing: false
        }
      };

      // Act
      const gaps = service.identifyGaps(category, existingElements);

      // Assert
      expect(gaps).toContain('movement');
      expect(gaps).toContain('lens');
      expect(gaps).toContain('angle');
      expect(gaps).toContain('framing');
    });

    it('should identify missing subject aspects', () => {
      // Arrange
      const category = 'subject';
      const existingElements = {
        subject: {
          appearance: false,
          emotion: false,
          details: false
        }
      };

      // Act
      const gaps = service.identifyGaps(category, existingElements);

      // Assert
      expect(gaps).toContain('appearance');
      expect(gaps).toContain('emotion');
      expect(gaps).toContain('details');
    });

    it('should return empty array when all aspects are present', () => {
      // Arrange
      const category = 'lighting';
      const existingElements = {
        lighting: {
          direction: true,
          quality: true,
          temperature: true,
          intensity: true
        }
      };

      // Act
      const gaps = service.identifyGaps(category, existingElements);

      // Assert
      expect(gaps).toEqual([]);
    });
  });

  // ============================================
  // analyzeRelationships
  // ============================================

  describe('analyzeRelationships', () => {
    it('should identify golden hour lighting opportunities', () => {
      // Arrange
      const category = 'lighting';
      const existingElements = {
        timeOfDay: 'golden hour',
        location: null,
        mood: null,
        subject: { core: '' }
      };

      // Act
      const relationships = service.analyzeRelationships(category, existingElements);

      // Assert
      expect(relationships.opportunities).toContain('Warm rim light to complement golden hour');
      expect(relationships.constraints).toContain('Avoid cool/blue tones that contradict warm golden light');
    });

    it('should identify night lighting constraints', () => {
      // Arrange
      const category = 'lighting';
      const existingElements = {
        timeOfDay: 'night',
        location: null,
        mood: null,
        subject: { core: '' }
      };

      // Act
      const relationships = service.analyzeRelationships(category, existingElements);

      // Assert
      expect(relationships.opportunities).toContain('Artificial light sources, practicals');
      expect(relationships.constraints).toContain('Low ambient light levels');
    });

    it('should identify underwater lighting and camera constraints', () => {
      // Arrange
      const existingElements = {
        timeOfDay: null,
        location: 'underwater',
        mood: null,
        subject: { core: '' }
      };

      // Act - lighting
      const lightingRel = service.analyzeRelationships('lighting', existingElements);
      // Act - camera
      const cameraRel = service.analyzeRelationships('camera', existingElements);

      // Assert
      expect(lightingRel.opportunities).toContain('Caustic light patterns essential');
      expect(lightingRel.constraints).toContain('Blue-green color cast required');
      expect(cameraRel.opportunities).toContain('Slow, fluid movement');
    });

    it('should identify elderly subject lighting considerations', () => {
      // Arrange
      const category = 'lighting';
      const existingElements = {
        timeOfDay: null,
        location: null,
        mood: null,
        subject: { core: 'elderly woman' }
      };

      // Act
      const relationships = service.analyzeRelationships(category, existingElements);

      // Assert
      expect(relationships.opportunities).toContain('Soft, flattering light');
      expect(relationships.constraints).toContain('Avoid harsh shadows on wrinkled skin (max 3:1 ratio)');
    });

    it('should identify child subject camera considerations', () => {
      // Arrange
      const category = 'camera';
      const existingElements = {
        timeOfDay: null,
        location: null,
        mood: null,
        subject: { core: 'child playing' }
      };

      // Act
      const relationships = service.analyzeRelationships(category, existingElements);

      // Assert
      expect(relationships.opportunities).toContain('Lower camera angles to child\'s eye level');
    });

    it('should identify moody lighting requirements', () => {
      // Arrange
      const category = 'lighting';
      const existingElements = {
        timeOfDay: null,
        location: null,
        mood: 'moody',
        subject: { core: '' }
      };

      // Act
      const relationships = service.analyzeRelationships(category, existingElements);

      // Assert
      expect(relationships.opportunities).toContain('Low key lighting, high contrast ratios (4:1+)');
      expect(relationships.constraints).toContain('Avoid bright, even illumination');
    });

    it('should handle no relationships', () => {
      // Arrange
      const category = 'lighting';
      const existingElements = {
        timeOfDay: null,
        location: null,
        mood: null,
        subject: { core: '' }
      };

      // Act
      const relationships = service.analyzeRelationships(category, existingElements);

      // Assert
      expect(relationships.opportunities).toEqual([]);
      expect(relationships.constraints).toEqual([]);
    });
  });

  // ============================================
  // getContextAwareGuidance - Main Intelligence Method
  // ============================================

  describe('getContextAwareGuidance', () => {
    it('should generate lighting guidance with golden hour and gaps', () => {
      // Arrange
      const phraseRole = 'lighting';
      const categoryHint = 'lighting';
      const fullContext = 'A golden hour scene with an elderly woman';
      const allSpans = [
        { category: 'time', text: 'golden hour' },
        { category: 'subject', text: 'elderly woman' }
      ];
      const editHistory = [];

      // Act
      const guidance = service.getContextAwareGuidance(
        phraseRole,
        categoryHint,
        fullContext,
        allSpans,
        editHistory
      );

      // Assert
      expect(guidance).toBeDefined();
      expect(guidance.length).toBeGreaterThan(0);
      // Should include golden hour opportunities
      expect(guidance.some(g => g.includes('Warm rim light') || g.includes('golden hour'))).toBe(true);
      // Should include gap-filling guidance
      expect(guidance.some(g => g.includes('direction') || g.includes('DIRECTION'))).toBe(true);
    });

    it('should generate camera guidance with mood alignment', () => {
      // Arrange
      const phraseRole = 'camera';
      const categoryHint = 'camera';
      const fullContext = 'An energetic scene with fast movement';
      const allSpans = [];
      const editHistory = [];

      // Act
      const guidance = service.getContextAwareGuidance(
        phraseRole,
        categoryHint,
        fullContext,
        allSpans,
        editHistory
      );

      // Assert
      expect(guidance).toBeDefined();
      expect(guidance.some(g => g.includes('DYNAMIC camera movement'))).toBe(true);
    });

    it('should generate subject guidance with gaps', () => {
      // Arrange
      const phraseRole = 'subject';
      const categoryHint = 'subject';
      const fullContext = 'A person in the scene';
      const allSpans = [];
      const editHistory = [];

      // Act
      const guidance = service.getContextAwareGuidance(
        phraseRole,
        categoryHint,
        fullContext,
        allSpans,
        editHistory
      );

      // Assert
      expect(guidance).toBeDefined();
      expect(guidance.some(g => g.includes('PHYSICAL DETAILS'))).toBe(true);
      expect(guidance.some(g => g.includes('EMOTIONAL STATE'))).toBe(true);
    });

    it('should respect edit history for lighting consistency', () => {
      // Arrange
      const phraseRole = 'lighting';
      const categoryHint = 'lighting';
      const fullContext = 'A scene with lighting';
      const allSpans = [];
      const editHistory = [
        {
          category: 'lighting',
          original: 'harsh light',
          replacement: 'soft gentle light',
          timestamp: Date.now()
        }
      ];

      // Act
      const guidance = service.getContextAwareGuidance(
        phraseRole,
        categoryHint,
        fullContext,
        allSpans,
        editHistory
      );

      // Assert
      expect(guidance).toBeDefined();
      expect(guidance.some(g => g.includes('MAINTAIN SOFT LIGHTING'))).toBe(true);
    });

    it('should respect edit history for moody lighting', () => {
      // Arrange
      const phraseRole = 'lighting';
      const categoryHint = 'lighting';
      const fullContext = 'A scene with lighting';
      const allSpans = [];
      const editHistory = [
        {
          category: 'lighting',
          original: 'bright light',
          replacement: 'dark moody lighting',
          timestamp: Date.now()
        }
      ];

      // Act
      const guidance = service.getContextAwareGuidance(
        phraseRole,
        categoryHint,
        fullContext,
        allSpans,
        editHistory
      );

      // Assert
      expect(guidance).toBeDefined();
      expect(guidance.some(g => g.includes('MAINTAIN MOODY TONE'))).toBe(true);
    });

    it('should return null when no context or category', () => {
      // Arrange
      const phraseRole = '';
      const categoryHint = '';
      const fullContext = '';
      const allSpans = [];
      const editHistory = [];

      // Act
      const guidance = service.getContextAwareGuidance(
        phraseRole,
        categoryHint,
        fullContext,
        allSpans,
        editHistory
      );

      // Assert
      expect(guidance).toBeNull();
    });

    it('should handle action category guidance', () => {
      // Arrange
      const phraseRole = 'action';
      const categoryHint = 'action';
      const fullContext = 'underwater swimming scene';
      const allSpans = [];
      const editHistory = [];

      // Act
      const guidance = service.getContextAwareGuidance(
        phraseRole,
        categoryHint,
        fullContext,
        allSpans,
        editHistory
      );

      // Assert
      expect(guidance).toBeDefined();
      expect(guidance.some(g => g.includes('UNDERWATER ACTIONS'))).toBe(true);
    });

    it('should handle location category guidance', () => {
      // Arrange
      const phraseRole = 'location';
      const categoryHint = 'location';
      const fullContext = 'a location scene';
      const allSpans = [];
      const editHistory = [];

      // Act
      const guidance = service.getContextAwareGuidance(
        phraseRole,
        categoryHint,
        fullContext,
        allSpans,
        editHistory
      );

      // Assert
      expect(guidance).toBeDefined();
      expect(guidance.some(g => g.includes('SPECIFIC'))).toBe(true);
    });

    it('should handle mood category guidance with edit history', () => {
      // Arrange
      const phraseRole = 'mood';
      const categoryHint = 'mood';
      const fullContext = 'a moody scene';
      const allSpans = [];
      const editHistory = [
        {
          category: 'mood',
          original: 'happy',
          replacement: 'melancholic',
          timestamp: Date.now()
        }
      ];

      // Act
      const guidance = service.getContextAwareGuidance(
        phraseRole,
        categoryHint,
        fullContext,
        allSpans,
        editHistory
      );

      // Assert
      expect(guidance).toBeDefined();
      expect(guidance.some(g => g.includes('RESPECT mood evolution'))).toBe(true);
    });
  });

  // ============================================
  // getCategoryFocusGuidance - Main Public API
  // ============================================

  describe('getCategoryFocusGuidance', () => {
    it('should use context-aware guidance when context is provided', () => {
      // Arrange
      const phraseRole = 'lighting';
      const categoryHint = 'lighting';
      const fullContext = 'golden hour scene';
      const allSpans = [];
      const editHistory = [];

      // Act
      const guidance = service.getCategoryFocusGuidance(
        phraseRole,
        categoryHint,
        fullContext,
        allSpans,
        editHistory
      );

      // Assert
      expect(guidance).toBeDefined();
      expect(Array.isArray(guidance)).toBe(true);
      expect(guidance.length).toBeGreaterThan(0);
    });

    it('should fall back to static guidance when no context', () => {
      // Arrange
      const phraseRole = 'lighting';
      const categoryHint = 'lighting';
      const fullContext = '';
      const allSpans = [];
      const editHistory = [];

      // Act
      const guidance = service.getCategoryFocusGuidance(
        phraseRole,
        categoryHint,
        fullContext,
        allSpans,
        editHistory
      );

      // Assert - should fall back to static guidance or null
      // The method should still work, just without context-aware intelligence
      expect(guidance === null || Array.isArray(guidance)).toBe(true);
    });

    it('should return null when phraseRole is missing', () => {
      // Arrange
      const phraseRole = null;
      const categoryHint = 'lighting';

      // Act
      const guidance = service.getCategoryFocusGuidance(phraseRole, categoryHint);

      // Assert
      expect(guidance).toBeNull();
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should handle null context gracefully', () => {
      // Arrange
      const phraseRole = 'lighting';
      const categoryHint = 'lighting';
      const fullContext = '';
      const allSpans = [];
      const editHistory = [];

      // Act
      const guidance = service.getContextAwareGuidance(
        phraseRole,
        categoryHint,
        fullContext,
        allSpans,
        editHistory
      );

      // Assert - should return null or empty array, not throw
      expect(guidance === null || Array.isArray(guidance)).toBe(true);
    });

    it('should handle very long context without performance issues', () => {
      // Arrange
      const phraseRole = 'lighting';
      const categoryHint = 'lighting';
      const fullContext = 'golden hour '.repeat(1000); // Very long context
      const allSpans = [];
      const editHistory = [];

      // Act
      const start = Date.now();
      const guidance = service.getContextAwareGuidance(
        phraseRole,
        categoryHint,
        fullContext,
        allSpans,
        editHistory
      );
      const duration = Date.now() - start;

      // Assert
      expect(guidance).toBeDefined();
      expect(duration).toBeLessThan(100); // Should be fast
    });

    it('should handle many spans without performance issues', () => {
      // Arrange
      const phraseRole = 'lighting';
      const categoryHint = 'lighting';
      const fullContext = '';
      const allSpans = Array(100).fill(null).map((_, i) => ({
        category: 'lighting',
        text: `light ${i}`
      }));
      const editHistory = [];

      // Act
      const start = Date.now();
      const guidance = service.getContextAwareGuidance(
        phraseRole,
        categoryHint,
        fullContext,
        allSpans,
        editHistory
      );
      const duration = Date.now() - start;

      // Assert
      expect(guidance).toBeDefined();
      expect(duration).toBeLessThan(100);
    });

    it('should handle mixed-case category names', () => {
      // Arrange
      const phraseRole = 'LIGHTING';
      const categoryHint = 'LiGhTiNg';
      const fullContext = 'golden hour';
      const allSpans = [];
      const editHistory = [];

      // Act
      const guidance = service.getContextAwareGuidance(
        phraseRole,
        categoryHint,
        fullContext,
        allSpans,
        editHistory
      );

      // Assert
      expect(guidance).toBeDefined();
      expect(guidance.length).toBeGreaterThan(0);
    });
  });
});

