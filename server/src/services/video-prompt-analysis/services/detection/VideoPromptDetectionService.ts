import { logger } from '@infrastructure/Logger';
import { DETECTION_MARKERS, DETECTION_THRESHOLDS } from '@services/video-prompt-analysis/config/detectionMarkers';
import { normalizeText } from '@services/video-prompt-analysis/utils/textHelpers';

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

    const normalized = normalizeText(fullPrompt);

    if (this._hasJsonPrompt(normalized)) {
      this.log.debug('Video prompt detected via JSON structure', {
        operation,
      });
      return true;
    }

    // If this looks like JSON but failed structured checks, do not fall through
    // to natural-language marker heuristics.
    if (this._looksLikeJson(normalized)) {
      this.log.debug('JSON-like prompt missing required video fields', {
        operation,
      });
      return false;
    }

    // Check legacy markers
    if (this._hasLegacyMarkers(normalized)) {
      return true;
    }

    // Check modern template markers
    if (this._hasModernMarkers(normalized)) {
      return true;
    }

    // Check natural-language cinematographic markers
    if (this._hasCinematographicLanguage(normalized)) {
      this.log.debug('Video prompt detected via cinematographic language', {
        operation,
      });
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
   * Check for natural-language cinematographic language
   */
  private _hasCinematographicLanguage(normalizedText: string): boolean {
    const matches = DETECTION_MARKERS.CINEMATOGRAPHIC.filter((marker) =>
      normalizedText.includes(marker)
    );

    return matches.length >= DETECTION_THRESHOLDS.CINEMATOGRAPHIC_THRESHOLD;
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

  /**
   * Check for JSON prompt structures (e.g., Veo-style or structured prompt output)
   */
  private _hasJsonPrompt(normalizedText: string): boolean {
    const hasSubject = normalizedText.includes('"subject"');
    const hasCamera = normalizedText.includes('"camera"') || normalizedText.includes('"shot"');
    const hasEnvironment =
      normalizedText.includes('"environment"') ||
      normalizedText.includes('"setting"') ||
      normalizedText.includes('"location"');
    const hasLighting = normalizedText.includes('"lighting"');
    const hasAction = normalizedText.includes('"action"');
    const hasStyle =
      normalizedText.includes('"style_preset"') || normalizedText.includes('"style"');

    return (
      hasSubject &&
      (hasCamera || hasAction) &&
      (hasEnvironment || hasLighting || hasStyle)
    );
  }

  private _looksLikeJson(normalizedText: string): boolean {
    const trimmed = normalizedText.trim();
    return (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    );
  }
}
