import { logger } from '@infrastructure/Logger';
import { DETECTION_MARKERS, DETECTION_THRESHOLDS } from '../../config/detectionMarkers.js';
import { normalizeText } from '../../utils/textHelpers.js';

/**
 * Service responsible for detecting if a prompt is a video prompt
 */
export class VideoPromptDetectionService {
  private readonly log = logger.child({ service: 'VideoPromptDetectionService' });

  /**
   * Check if this is a video prompt
   */
  isVideoPrompt(fullPrompt: string | null | undefined): boolean {
    const operation = 'isVideoPrompt';
    
    if (typeof fullPrompt !== 'string' || fullPrompt.trim().length === 0) {
      this.log.debug('Empty prompt, not a video prompt', {
        operation,
      });
      return false;
    }
    if (typeof fullPrompt !== 'string' || fullPrompt.trim().length === 0) {
      return false;
    }

    const normalized = normalizeText(fullPrompt);

    // Check legacy markers
    if (this._hasLegacyMarkers(normalized)) {
      return true;
    }

    // Check modern template markers
    if (this._hasModernMarkers(normalized)) {
      return true;
    }

    // Check technical field patterns
    if (this._hasTechnicalFields(normalized)) {
      this.log.debug('Video prompt detected via technical fields', {
        operation,
      });
      return true;
    }

    this.log.debug('Not detected as video prompt', {
      operation,
    });
    
    return false;
  }

  /**
   * Check for legacy template markers
   */
  private _hasLegacyMarkers(normalizedText: string): boolean {
    return DETECTION_MARKERS.LEGACY.some((marker) => 
      normalizedText.includes(marker)
    );
  }

  /**
   * Check for modern template markers
   */
  private _hasModernMarkers(normalizedText: string): boolean {
    return DETECTION_MARKERS.MODERN.some((marker) => 
      normalizedText.includes(marker)
    );
  }

  /**
   * Check for technical field patterns
   */
  private _hasTechnicalFields(normalizedText: string): boolean {
    const matchedTechFields = DETECTION_MARKERS.TECHNICAL_FIELDS.filter((field) =>
      normalizedText.includes(field)
    );

    // Check: "technical specs" + at least 2 technical fields
    if (
      normalizedText.includes('technical specs') &&
      matchedTechFields.length >= DETECTION_THRESHOLDS.MIN_TECH_FIELDS_WITH_SPECS
    ) {
      return true;
    }

    // Check: At least 3 technical fields + "alternative approaches"
    if (
      matchedTechFields.length >= DETECTION_THRESHOLDS.MIN_TECH_FIELDS_WITH_ALTERNATIVES &&
      normalizedText.includes('alternative approaches')
    ) {
      return true;
    }

    return false;
  }
}

