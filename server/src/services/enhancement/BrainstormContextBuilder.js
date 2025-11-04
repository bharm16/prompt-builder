/**
 * BrainstormContextBuilder
 * 
 * Responsible for building and formatting brainstorm context sections
 * for inclusion in prompts. Handles signature creation and value formatting.
 * 
 * Single Responsibility: Brainstorm context management and formatting
 */
export class BrainstormContextBuilder {
  constructor() {
    // No dependencies - pure logic
  }

  /**
   * Build a compact signature of brainstorm context for caching
   * @param {Object} brainstormContext - Brainstorm context object
   * @returns {Object|null} Normalized signature or null
   */
  buildBrainstormSignature(brainstormContext) {
    if (!brainstormContext || typeof brainstormContext !== 'object') {
      return null;
    }

    const { elements = {}, metadata = {} } = brainstormContext;

    const normalizedElements = Object.entries(elements).reduce((acc, [key, value]) => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          acc[key] = trimmed;
        }
      }
      return acc;
    }, {});

    const normalizedMetadata = {};
    if (metadata && typeof metadata === 'object') {
      if (typeof metadata.format === 'string' && metadata.format.trim()) {
        normalizedMetadata.format = metadata.format.trim();
      }

      if (metadata.technicalParams && typeof metadata.technicalParams === 'object') {
        const technicalEntries = Object.entries(metadata.technicalParams).reduce(
          (acc, [key, value]) => {
            if (value === undefined || value === null) {
              return acc;
            }

            if (typeof value === 'string') {
              const trimmedValue = value.trim();
              if (trimmedValue) {
                acc[key] = trimmedValue;
              }
              return acc;
            }

            if (Array.isArray(value)) {
              if (value.length > 0) {
                acc[key] = value;
              }
              return acc;
            }

            if (typeof value === 'object') {
              if (Object.keys(value).length > 0) {
                acc[key] = value;
              }
              return acc;
            }

            acc[key] = value;
            return acc;
          },
          {}
        );

        if (Object.keys(technicalEntries).length) {
          normalizedMetadata.technicalParams = technicalEntries;
        }
      }

      if (
        typeof metadata.validationScore === 'number' &&
        Number.isFinite(metadata.validationScore)
      ) {
        normalizedMetadata.validationScore = metadata.validationScore;
      }
    }

    const signature = {};
    if (Object.keys(normalizedElements).length) {
      signature.elements = normalizedElements;
    }
    if (Object.keys(normalizedMetadata).length) {
      signature.metadata = normalizedMetadata;
    }

    return Object.keys(signature).length ? signature : null;
  }

  /**
   * Build brainstorm context section for prompt inclusion
   * @param {Object} brainstormContext - Brainstorm context object
   * @param {Object} options - Options for context building
   * @returns {string} Formatted context section
   */
  buildBrainstormContextSection(
    brainstormContext,
    { includeCategoryGuidance = false, isVideoPrompt = false } = {}
  ) {
    if (!brainstormContext || typeof brainstormContext !== 'object') {
      return '';
    }

    const elements = brainstormContext.elements || {};
    const metadata = brainstormContext.metadata || {};

    const definedElements = Object.entries(elements).filter(([, value]) => {
      return typeof value === 'string' && value.trim().length > 0;
    });

    const technicalParams =
      metadata && typeof metadata.technicalParams === 'object'
        ? Object.entries(metadata.technicalParams).filter(([, value]) => {
            if (value === null || value === undefined) {
              return false;
            }
            if (typeof value === 'string') {
              return value.trim().length > 0;
            }
            if (Array.isArray(value)) {
              return value.length > 0;
            }
            if (typeof value === 'object') {
              return Object.keys(value).length > 0;
            }
            return true;
          })
        : [];

    const formatPreference =
      typeof metadata.format === 'string' && metadata.format.trim().length > 0
        ? metadata.format.trim()
        : null;

    const validationScore =
      typeof metadata.validationScore === 'number' &&
      Number.isFinite(metadata.validationScore)
        ? metadata.validationScore
        : null;

    if (!definedElements.length && !technicalParams.length && !formatPreference && validationScore === null) {
      return '';
    }

    let section = '**Creative Brainstorm Structured Context:**\n';
    section += 'These are user-confirmed anchors that suggestions must respect.\n';

    if (definedElements.length) {
      definedElements.forEach(([key, value]) => {
        section += `- ${this.formatBrainstormKey(key)}: ${value.trim()}\n`;
      });
    }

    if (formatPreference || technicalParams.length || validationScore !== null) {
      section += '\n**Metadata & Technical Guidance:**\n';

      if (formatPreference) {
        section += `- Format Preference: ${formatPreference}\n`;
      }

      if (validationScore !== null) {
        section += `- Validation Score: ${validationScore}\n`;
      }

      technicalParams.forEach(([key, value]) => {
        section += `- ${this.formatBrainstormKey(key)}: ${this.formatBrainstormValue(value)}\n`;
      });
    }

    if (includeCategoryGuidance) {
      section += '\nUse these anchors to inspire category labels and keep suggestions aligned with the user\'s core concept.\n';
    } else {
      section += '\nEnsure every rewrite strengthens these anchors rather than contradicting them.\n';
    }

    if (isVideoPrompt) {
      section += 'Translate these anchors into cinematic details whenever possible.\n';
    }

    return section;
  }

  /**
   * Format brainstorm keys into human-readable labels
   * @param {string} key - Key to format
   * @returns {string} Formatted key
   */
  formatBrainstormKey(key) {
    if (!key) {
      return '';
    }

    return key
      .toString()
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /**
   * Normalize brainstorm metadata values for prompt inclusion
   * @param {*} value - Value to format
   * @returns {string} Formatted value
   */
  formatBrainstormValue(value) {
    if (Array.isArray(value)) {
      return value.join(', ');
    }

    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }

    return String(value);
  }
}
