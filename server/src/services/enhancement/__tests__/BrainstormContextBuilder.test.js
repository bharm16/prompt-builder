/**
 * @test {BrainstormContextBuilder}
 * @description Comprehensive test suite for context-aware brainstorm intelligence
 * 
 * Test Coverage:
 * - Creative intent inference (nostalgic, futuristic, dreamlike, tension, tranquil, kinetic)
 * - Missing element suggestions based on intent
 * - Style conflict detection
 * - Complementary element recommendations
 * - Enhanced brainstorm context section building
 * 
 * Pattern: Pure logic service with no external dependencies
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BrainstormContextBuilder } from '../services/BrainstormContextBuilder.js';

describe('BrainstormContextBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new BrainstormContextBuilder();
  });

  // ============================================
  // inferCreativeIntent
  // ============================================

  describe('inferCreativeIntent', () => {
    it('should detect nostalgic narrative intent', () => {
      // Arrange
      const elements = {
        mood: 'nostalgic memory',
        setting: 'vintage 1950s diner',
        atmosphere: 'past reflection'
      };

      // Act
      const intent = builder.inferCreativeIntent(elements);

      // Assert
      expect(intent).toBeDefined();
      expect(intent.primaryIntent).toBe('nostalgic narrative');
      expect(intent.supportingThemes).toContain('temporal reflection');
    });

    it('should detect futuristic vision intent', () => {
      // Arrange
      const elements = {
        setting: 'neon-lit cyberpunk city',
        style: 'sci-fi futuristic',
        tech: 'holographic displays'
      };

      // Act
      const intent = builder.inferCreativeIntent(elements);

      // Assert
      expect(intent).toBeDefined();
      expect(intent.primaryIntent).toBe('futuristic vision');
      expect(intent.supportingThemes).toContain('technological advancement');
    });

    it('should detect dreamlike exploration intent', () => {
      // Arrange
      const elements = {
        atmosphere: 'surreal dreamscape',
        mood: 'ethereal and abstract',
        style: 'dream-like visuals'
      };

      // Act
      const intent = builder.inferCreativeIntent(elements);

      // Assert
      expect(intent).toBeDefined();
      expect(intent.primaryIntent).toBe('dreamlike exploration');
      expect(intent.supportingThemes).toContain('subconscious imagery');
    });

    it('should detect tension and suspense intent', () => {
      // Arrange
      const elements = {
        mood: 'dark and tense',
        atmosphere: 'thriller suspense',
        style: 'psychological tension'
      };

      // Act
      const intent = builder.inferCreativeIntent(elements);

      // Assert
      expect(intent).toBeDefined();
      expect(intent.primaryIntent).toBe('tension and suspense');
      expect(intent.supportingThemes).toContain('psychological pressure');
    });

    it('should detect tranquil contemplation intent', () => {
      // Arrange
      const elements = {
        mood: 'calm and peaceful',
        atmosphere: 'serene meditation',
        style: 'gentle contemplation'
      };

      // Act
      const intent = builder.inferCreativeIntent(elements);

      // Assert
      expect(intent).toBeDefined();
      expect(intent.primaryIntent).toBe('tranquil contemplation');
      expect(intent.supportingThemes).toContain('meditative atmosphere');
    });

    it('should detect kinetic energy intent', () => {
      // Arrange
      const elements = {
        action: 'fast-paced dynamic movement',
        mood: 'energetic and intense',
        style: 'action-packed'
      };

      // Act
      const intent = builder.inferCreativeIntent(elements);

      // Assert
      expect(intent).toBeDefined();
      expect(intent.primaryIntent).toBe('kinetic energy');
      expect(intent.supportingThemes).toContain('movement and momentum');
    });

    it('should detect narrative direction - journey/quest', () => {
      // Arrange
      const elements = {
        story: 'character on a journey to destination',
        theme: 'travel and exploration'
      };

      // Act
      const intent = builder.inferCreativeIntent(elements);

      // Assert
      expect(intent).toBeDefined();
      expect(intent.narrativeDirection).toBe('journey/quest');
    });

    it('should detect narrative direction - transformation', () => {
      // Arrange
      const elements = {
        story: 'character transforms and evolves',
        theme: 'change and becoming'
      };

      // Act
      const intent = builder.inferCreativeIntent(elements);

      // Assert
      expect(intent).toBeDefined();
      expect(intent.narrativeDirection).toBe('transformation');
    });

    it('should detect narrative direction - discovery', () => {
      // Arrange
      const elements = {
        story: 'uncover secrets and reveal truth',
        theme: 'discovery and finding answers'
      };

      // Act
      const intent = builder.inferCreativeIntent(elements);

      // Assert
      expect(intent).toBeDefined();
      expect(intent.narrativeDirection).toBe('discovery');
    });

    it('should detect emotional tone - hopeful', () => {
      // Arrange
      const elements = {
        mood: 'hopeful and inspiring',
        atmosphere: 'uplifting spirit'
      };

      // Act
      const intent = builder.inferCreativeIntent(elements);

      // Assert
      expect(intent).toBeDefined();
      expect(intent.emotionalTone).toBe('hopeful');
    });

    it('should detect emotional tone - melancholic', () => {
      // Arrange
      const elements = {
        mood: 'melancholic and sad',
        atmosphere: 'somber reflection'
      };

      // Act
      const intent = builder.inferCreativeIntent(elements);

      // Assert
      expect(intent).toBeDefined();
      expect(intent.emotionalTone).toBe('melancholic');
    });

    it('should return null when no recognizable intent', () => {
      // Arrange
      const elements = {
        random: 'unrelated content',
        other: 'no clear pattern'
      };

      // Act
      const intent = builder.inferCreativeIntent(elements);

      // Assert
      expect(intent).toBeNull();
    });

    it('should handle null elements', () => {
      // Arrange
      const elements = null;

      // Act
      const intent = builder.inferCreativeIntent(elements);

      // Assert
      expect(intent).toBeNull();
    });
  });

  // ============================================
  // suggestMissingElements
  // ============================================

  describe('suggestMissingElements', () => {
    it('should suggest time period for nostalgic narrative', () => {
      // Arrange
      const intent = {
        primaryIntent: 'nostalgic narrative',
        supportingThemes: ['temporal reflection']
      };
      const elements = {};

      // Act
      const suggestions = builder.suggestMissingElements(intent, elements);

      // Assert
      expect(suggestions).toBeDefined();
      expect(suggestions.some(s => s.category === 'time_period')).toBe(true);
      expect(suggestions.find(s => s.category === 'time_period').reason).toContain('temporal anchoring');
    });

    it('should suggest visual treatment for nostalgic narrative', () => {
      // Arrange
      const intent = {
        primaryIntent: 'nostalgic narrative'
      };
      const elements = {};

      // Act
      const suggestions = builder.suggestMissingElements(intent, elements);

      // Assert
      expect(suggestions.some(s => s.category === 'visual_treatment')).toBe(true);
    });

    it('should not suggest elements that are already present', () => {
      // Arrange
      const intent = {
        primaryIntent: 'nostalgic narrative'
      };
      const elements = {
        period: '1950s era style',
        visual: 'sepia faded vintage look'
      };

      // Act
      const suggestions = builder.suggestMissingElements(intent, elements);

      // Assert
      expect(suggestions).toEqual([]);
    });

    it('should suggest lighting for futuristic vision', () => {
      // Arrange
      const intent = {
        primaryIntent: 'futuristic vision'
      };
      const elements = {};

      // Act
      const suggestions = builder.suggestMissingElements(intent, elements);

      // Assert
      expect(suggestions.some(s => s.category === 'lighting')).toBe(true);
      expect(suggestions.find(s => s.category === 'lighting').reason).toContain('neon lighting');
    });

    it('should suggest materials for futuristic vision', () => {
      // Arrange
      const intent = {
        primaryIntent: 'futuristic vision'
      };
      const elements = {};

      // Act
      const suggestions = builder.suggestMissingElements(intent, elements);

      // Assert
      expect(suggestions.some(s => s.category === 'materials')).toBe(true);
    });

    it('should suggest lighting for tension and suspense', () => {
      // Arrange
      const intent = {
        primaryIntent: 'tension and suspense'
      };
      const elements = {};

      // Act
      const suggestions = builder.suggestMissingElements(intent, elements);

      // Assert
      expect(suggestions.some(s => s.category === 'lighting')).toBe(true);
      expect(suggestions.find(s => s.category === 'lighting').reason).toContain('low-key lighting');
    });

    it('should suggest camera for tension and suspense', () => {
      // Arrange
      const intent = {
        primaryIntent: 'tension and suspense'
      };
      const elements = {};

      // Act
      const suggestions = builder.suggestMissingElements(intent, elements);

      // Assert
      expect(suggestions.some(s => s.category === 'camera')).toBe(true);
    });

    it('should suggest environment for journey narrative', () => {
      // Arrange
      const intent = {
        primaryIntent: null,
        narrativeDirection: 'journey/quest'
      };
      const elements = {};

      // Act
      const suggestions = builder.suggestMissingElements(intent, elements);

      // Assert
      expect(suggestions.some(s => s.category === 'environment')).toBe(true);
    });

    it('should return empty array when no intent', () => {
      // Arrange
      const intent = null;
      const elements = {};

      // Act
      const suggestions = builder.suggestMissingElements(intent, elements);

      // Assert
      expect(suggestions).toEqual([]);
    });
  });

  // ============================================
  // detectStyleConflicts
  // ============================================

  describe('detectStyleConflicts', () => {
    it('should detect temporal clash between vintage and futuristic', () => {
      // Arrange
      const elements = {
        style: 'vintage retro aesthetics',
        setting: 'futuristic sci-fi city'
      };

      // Act
      const conflicts = builder.detectStyleConflicts(elements);

      // Assert
      expect(conflicts).toBeDefined();
      expect(conflicts.some(c => c.type === 'temporal_clash')).toBe(true);
      expect(conflicts.find(c => c.type === 'temporal_clash').suggestion).toContain('retrofuturism');
    });

    it('should detect mood clash between calm and chaotic', () => {
      // Arrange
      const elements = {
        mood: 'calm peaceful atmosphere',
        action: 'chaotic intense frantic energy'
      };

      // Act
      const conflicts = builder.detectStyleConflicts(elements);

      // Assert
      expect(conflicts).toBeDefined();
      expect(conflicts.some(c => c.type === 'mood_clash')).toBe(true);
    });

    it('should detect lighting clash between bright and dark', () => {
      // Arrange
      const elements = {
        lighting: 'bright sunny golden hour',
        atmosphere: 'dark moody noir lighting'
      };

      // Act
      const conflicts = builder.detectStyleConflicts(elements);

      // Assert
      expect(conflicts).toBeDefined();
      expect(conflicts.some(c => c.type === 'lighting_clash')).toBe(true);
      expect(conflicts.find(c => c.type === 'lighting_clash').suggestion).toContain('chiaroscuro');
    });

    it('should detect style clash between realistic and stylized', () => {
      // Arrange
      const elements = {
        approach: 'realistic documentary style',
        visual: 'abstract surreal stylized look'
      };

      // Act
      const conflicts = builder.detectStyleConflicts(elements);

      // Assert
      expect(conflicts).toBeDefined();
      expect(conflicts.some(c => c.type === 'style_clash')).toBe(true);
    });

    it('should return empty array when no conflicts', () => {
      // Arrange
      const elements = {
        mood: 'calm peaceful',
        lighting: 'soft gentle light'
      };

      // Act
      const conflicts = builder.detectStyleConflicts(elements);

      // Assert
      expect(conflicts).toEqual([]);
    });

    it('should handle null elements', () => {
      // Arrange
      const elements = null;

      // Act
      const conflicts = builder.detectStyleConflicts(elements);

      // Assert
      expect(conflicts).toEqual([]);
    });
  });

  // ============================================
  // getComplementaryElements
  // ============================================

  describe('getComplementaryElements', () => {
    it('should suggest complements for golden hour lighting', () => {
      // Arrange
      const element = 'golden hour lighting';
      const intent = null;

      // Act
      const complements = builder.getComplementaryElements(element, intent);

      // Assert
      expect(complements).toBeDefined();
      expect(complements.some(c => c.element.includes('warm color grading'))).toBe(true);
      expect(complements.some(c => c.element.includes('rim lighting'))).toBe(true);
      expect(complements.some(c => c.element.includes('lens flare'))).toBe(true);
    });

    it('should suggest complements for underwater scene', () => {
      // Arrange
      const element = 'underwater environment';
      const intent = null;

      // Act
      const complements = builder.getComplementaryElements(element, intent);

      // Assert
      expect(complements).toBeDefined();
      expect(complements.some(c => c.element.includes('caustic light patterns'))).toBe(true);
      expect(complements.some(c => c.element.includes('slow, fluid movement'))).toBe(true);
      expect(complements.some(c => c.element.includes('blue-green color cast'))).toBe(true);
    });

    it('should suggest complements for moody lighting', () => {
      // Arrange
      const element = 'moody dark lighting';
      const intent = null;

      // Act
      const complements = builder.getComplementaryElements(element, intent);

      // Assert
      expect(complements).toBeDefined();
      expect(complements.some(c => c.element.includes('high contrast ratio'))).toBe(true);
      expect(complements.some(c => c.element.includes('selective pools of light'))).toBe(true);
      expect(complements.some(c => c.element.includes('smoke or haze'))).toBe(true);
    });

    it('should suggest complements for handheld camera', () => {
      // Arrange
      const element = 'handheld camera';
      const intent = null;

      // Act
      const complements = builder.getComplementaryElements(element, intent);

      // Assert
      expect(complements).toBeDefined();
      expect(complements.some(c => c.element.includes('documentary-style'))).toBe(true);
      expect(complements.some(c => c.element.includes('natural lighting'))).toBe(true);
    });

    it('should add claustrophobic framing for handheld with tension intent', () => {
      // Arrange
      const element = 'handheld camera';
      const intent = {
        primaryIntent: 'tension and suspense'
      };

      // Act
      const complements = builder.getComplementaryElements(element, intent);

      // Assert
      expect(complements).toBeDefined();
      expect(complements.some(c => c.element.includes('close-up framing'))).toBe(true);
      expect(complements.find(c => c.element.includes('close-up')).reason).toContain('claustrophobia');
    });

    it('should suggest complements for cinematic style', () => {
      // Arrange
      const element = 'cinematic 35mm film look';
      const intent = null;

      // Act
      const complements = builder.getComplementaryElements(element, intent);

      // Assert
      expect(complements).toBeDefined();
      expect(complements.some(c => c.element.includes('2.39:1 aspect ratio'))).toBe(true);
      expect(complements.some(c => c.element.includes('shallow depth of field'))).toBe(true);
      expect(complements.some(c => c.element.includes('motivated lighting'))).toBe(true);
    });

    it('should return empty array for unrecognized element', () => {
      // Arrange
      const element = 'random unrelated thing';
      const intent = null;

      // Act
      const complements = builder.getComplementaryElements(element, intent);

      // Assert
      expect(complements).toEqual([]);
    });

    it('should handle null element', () => {
      // Arrange
      const element = null;
      const intent = null;

      // Act
      const complements = builder.getComplementaryElements(element, intent);

      // Assert
      expect(complements).toEqual([]);
    });
  });

  // ============================================
  // buildBrainstormContextSection - Enhanced
  // ============================================

  describe('buildBrainstormContextSection', () => {
    it('should include creative intent analysis', () => {
      // Arrange
      const brainstormContext = {
        elements: {
          mood: 'nostalgic memory',
          setting: 'vintage 1950s',
          theme: 'journey through time'
        },
        metadata: {}
      };

      // Act
      const section = builder.buildBrainstormContextSection(brainstormContext, {
        isVideoPrompt: true
      });

      // Assert
      expect(section).toContain('Creative Intent Analysis');
      expect(section).toContain('nostalgic narrative');
      expect(section).toContain('journey/quest');
    });

    it('should include element relationships', () => {
      // Arrange
      const brainstormContext = {
        elements: {
          lighting: 'golden hour',
          camera: 'handheld'
        },
        metadata: {}
      };

      // Act
      const section = builder.buildBrainstormContextSection(brainstormContext, {
        isVideoPrompt: true
      });

      // Assert
      expect(section).toContain('Element Relationships');
      expect(section).toContain('golden hour');
      expect(section).toContain('warm color grading');
    });

    it('should include opportunities to strengthen', () => {
      // Arrange
      const brainstormContext = {
        elements: {
          mood: 'nostalgic'
        },
        metadata: {}
      };

      // Act
      const section = builder.buildBrainstormContextSection(brainstormContext, {
        isVideoPrompt: true
      });

      // Assert
      expect(section).toContain('Opportunities to Strengthen');
      expect(section).toContain('time_period');
    });

    it('should include style conflict warnings', () => {
      // Arrange
      const brainstormContext = {
        elements: {
          style: 'vintage retro',
          setting: 'futuristic neon city'
        },
        metadata: {}
      };

      // Act
      const section = builder.buildBrainstormContextSection(brainstormContext, {
        isVideoPrompt: true
      });

      // Assert
      expect(section).toContain('Style Considerations');
      expect(section).toContain('temporal_clash');
      expect(section).toContain('retrofuturism');
    });

    it('should include metadata section', () => {
      // Arrange
      const brainstormContext = {
        elements: {
          mood: 'calm'
        },
        metadata: {
          format: '16:9 widescreen',
          validationScore: 85
        }
      };

      // Act
      const section = builder.buildBrainstormContextSection(brainstormContext);

      // Assert
      expect(section).toContain('Metadata & Technical Guidance');
      expect(section).toContain('Format Preference: 16:9 widescreen');
      expect(section).toContain('Validation Score: 85');
    });

    it('should return empty string when no context', () => {
      // Arrange
      const brainstormContext = null;

      // Act
      const section = builder.buildBrainstormContextSection(brainstormContext);

      // Assert
      expect(section).toBe('');
    });

    it('should return empty string when context has no elements', () => {
      // Arrange
      const brainstormContext = {
        elements: {},
        metadata: {}
      };

      // Act
      const section = builder.buildBrainstormContextSection(brainstormContext);

      // Assert
      expect(section).toBe('');
    });

    it('should include video prompt guidance when isVideoPrompt is true', () => {
      // Arrange
      const brainstormContext = {
        elements: {
          mood: 'calm'
        },
        metadata: {}
      };

      // Act
      const section = builder.buildBrainstormContextSection(brainstormContext, {
        isVideoPrompt: true
      });

      // Assert
      expect(section).toContain('cinematic details');
      expect(section).toContain('narrative direction');
    });
  });

  // ============================================
  // Existing Methods (Signature & Formatting)
  // ============================================

  describe('buildBrainstormSignature', () => {
    it('should build normalized signature', () => {
      // Arrange
      const brainstormContext = {
        elements: {
          mood: '  calm  ',
          setting: 'beach'
        },
        metadata: {
          format: '16:9'
        }
      };

      // Act
      const signature = builder.buildBrainstormSignature(brainstormContext);

      // Assert
      expect(signature).toBeDefined();
      expect(signature.elements.mood).toBe('calm');
      expect(signature.elements.setting).toBe('beach');
      expect(signature.metadata.format).toBe('16:9');
    });

    it('should return null for invalid context', () => {
      // Arrange
      const brainstormContext = null;

      // Act
      const signature = builder.buildBrainstormSignature(brainstormContext);

      // Assert
      expect(signature).toBeNull();
    });
  });

  describe('formatBrainstormKey', () => {
    it('should format camelCase to Title Case', () => {
      // Arrange
      const key = 'timeOfDay';

      // Act
      const formatted = builder.formatBrainstormKey(key);

      // Assert
      expect(formatted).toBe('Time Of Day');
    });

    it('should handle snake_case', () => {
      // Arrange
      const key = 'camera_movement';

      // Act
      const formatted = builder.formatBrainstormKey(key);

      // Assert
      expect(formatted).toBe('Camera Movement');
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('should handle very large elements object', () => {
      // Arrange
      const elements = {};
      for (let i = 0; i < 100; i++) {
        elements[`element${i}`] = `value${i}`;
      }

      // Act & Assert - should not throw
      expect(() => {
        builder.inferCreativeIntent(elements);
      }).not.toThrow();
    });

    it('should handle elements with special characters', () => {
      // Arrange
      const elements = {
        mood: 'nostalgic & melancholic (bittersweet)',
        setting: 'vintage "1950s" diner'
      };

      // Act
      const intent = builder.inferCreativeIntent(elements);

      // Assert
      expect(intent).toBeDefined();
      expect(intent.primaryIntent).toBe('nostalgic narrative');
    });

    it('should handle unicode characters', () => {
      // Arrange
      const elements = {
        mood: 'nostalgic 懐かしい',
        theme: 'retro 复古'
      };

      // Act
      const intent = builder.inferCreativeIntent(elements);

      // Assert
      expect(intent).toBeDefined();
    });

    it('should handle empty strings in elements', () => {
      // Arrange
      const elements = {
        mood: '',
        setting: '  ',
        theme: null
      };

      // Act
      const intent = builder.inferCreativeIntent(elements);

      // Assert
      expect(intent).toBeNull();
    });
  });
});

