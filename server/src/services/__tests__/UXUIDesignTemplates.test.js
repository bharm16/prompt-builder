/**
 * Tests for UX/UI Design Templates
 * Verify task detection accuracy and template generation
 */

import UXUIDesignTemplates from '../UXUIDesignTemplates.js';

describe('UXUIDesignTemplates', () => {
  describe('Task Detection', () => {
    test('detects persona generation', () => {
      const inputs = [
        'Create a user persona for our fitness app',
        'Generate a persona for an e-commerce customer',
        'I need a user profile for our target audience',
      ];

      inputs.forEach((input) => {
        const detected = UXUIDesignTemplates.detectTaskType(input);
        expect(detected).toBe('persona-generation');
      });
    });

    test('detects wireframe creation', () => {
      const inputs = [
        'Design a wireframe for a checkout page',
        'Create a layout for the dashboard',
        'I need a mockup of the profile screen',
      ];

      inputs.forEach((input) => {
        const detected = UXUIDesignTemplates.detectTaskType(input);
        expect(detected).toBe('wireframe-creation');
      });
    });

    test('detects accessibility audit', () => {
      const inputs = [
        'Audit this form for WCAG AA compliance',
        'Check if my app is accessible',
        'Review for screen reader compatibility',
      ];

      inputs.forEach((input) => {
        const detected = UXUIDesignTemplates.detectTaskType(input);
        expect(detected).toBe('accessibility-audit');
      });
    });

    test('detects component design', () => {
      const inputs = [
        'Design a button component for our design system',
        'Create specs for a dropdown menu',
        'I need a card component specification',
      ];

      inputs.forEach((input) => {
        const detected = UXUIDesignTemplates.detectTaskType(input);
        expect(detected).toBe('component-design');
      });
    });

    test('detects research synthesis', () => {
      const inputs = [
        'Synthesize findings from 15 user interviews',
        'Analyze research data from our usability study',
        'Create a research synthesis report',
      ];

      inputs.forEach((input) => {
        const detected = UXUIDesignTemplates.detectTaskType(input);
        expect(detected).toBe('research-synthesis');
      });
    });

    test('detects UX microcopy', () => {
      const inputs = [
        'Write error messages for the login form',
        'Create button labels for the checkout flow',
        'I need microcopy for our sign-up form',
      ];

      inputs.forEach((input) => {
        const detected = UXUIDesignTemplates.detectTaskType(input);
        expect(detected).toBe('ux-microcopy');
      });
    });

    test('detects user journey mapping', () => {
      const inputs = [
        'Create a user journey map for booking a flight',
        'Map the user flow for our onboarding',
        'I need a journey map for the checkout process',
      ];

      inputs.forEach((input) => {
        const detected = UXUIDesignTemplates.detectTaskType(input);
        expect(detected).toBe('user-journey-mapping');
      });
    });

    test('falls back to general-design for ambiguous input', () => {
      const inputs = [
        'How do I make my app better?',
        'Improve the user experience',
        'Help me with design',
      ];

      inputs.forEach((input) => {
        const detected = UXUIDesignTemplates.detectTaskType(input);
        expect(detected).toBe('general-design');
      });
    });

    test('prioritizes more specific keywords', () => {
      // "design system component" should detect component-design, not design-system
      const input = 'create a design system component for a button';
      const detected = UXUIDesignTemplates.detectTaskType(input);
      expect(detected).toBe('component-design');
    });
  });

  describe('Template Generation', () => {
    test('generates persona template', () => {
      const input = 'Create a user persona for a productivity app';
      const taskType = UXUIDesignTemplates.detectTaskType(input);
      const template = UXUIDesignTemplates.buildTemplate(input, taskType);

      expect(template).toContain('user persona');
      expect(template).toContain('Demographics');
      expect(template).toContain('Goals');
      expect(template).toContain('Pain Points');
      expect(template).toContain('Jobs to be Done');
    });

    test('generates wireframe template', () => {
      const input = 'Design a wireframe for a mobile app home screen';
      const taskType = UXUIDesignTemplates.detectTaskType(input);
      const template = UXUIDesignTemplates.buildTemplate(input, taskType);

      expect(template).toContain('wireframe');
      expect(template).toContain('Layout Grid');
      expect(template).toContain('Visual Hierarchy');
      expect(template).toContain('Responsive');
      expect(template).toContain('Accessibility');
    });

    test('generates accessibility template', () => {
      const input = 'Audit our website for WCAG compliance';
      const taskType = UXUIDesignTemplates.detectTaskType(input);
      const template = UXUIDesignTemplates.buildTemplate(input, taskType);

      expect(template).toContain('WCAG');
      expect(template).toContain('accessibility');
      expect(template).toContain('Perceivable');
      expect(template).toContain('Operable');
      expect(template).toContain('Understandable');
      expect(template).toContain('Robust');
    });

    test('generates component template', () => {
      const input = 'Create a button component specification';
      const taskType = UXUIDesignTemplates.detectTaskType(input);
      const template = UXUIDesignTemplates.buildTemplate(input, taskType);

      expect(template).toContain('COMPONENT SPECIFICATION');
      expect(template).toContain('Variants');
      expect(template).toContain('States');
      expect(template).toContain('Props/API');
      expect(template).toContain('Accessibility');
      expect(template).toContain('USAGE GUIDELINES');
    });

    test('passes context to templates', () => {
      const input = 'Design a mobile app wireframe';
      const context = {
        platform: 'iOS',
        viewport: 'iPhone 14 (390px)',
        designSystem: 'Human Interface Guidelines',
      };
      const taskType = UXUIDesignTemplates.detectTaskType(input);
      const template = UXUIDesignTemplates.buildTemplate(input, taskType, context);

      expect(template).toContain('iOS');
      expect(template).toContain('iPhone 14');
      expect(template).toContain('Human Interface Guidelines');
    });
  });

  describe('Edge Cases', () => {
    test('handles empty input', () => {
      const detected = UXUIDesignTemplates.detectTaskType('');
      expect(detected).toBe('general-design');
    });

    test('handles very short input', () => {
      const detected = UXUIDesignTemplates.detectTaskType('ui');
      expect(detected).toBe('general-design');
    });

    test('handles mixed keywords', () => {
      // Multiple keywords should pick the first match in detection rules
      const input = 'create a persona and wireframe for accessibility';
      const detected = UXUIDesignTemplates.detectTaskType(input);
      // Should detect persona (first in rules order)
      expect(detected).toBe('persona-generation');
    });

    test('case-insensitive detection', () => {
      const inputs = [
        'CREATE A USER PERSONA',
        'Create A User Persona',
        'create a user persona',
      ];

      inputs.forEach((input) => {
        const detected = UXUIDesignTemplates.detectTaskType(input);
        expect(detected).toBe('persona-generation');
      });
    });
  });
});
