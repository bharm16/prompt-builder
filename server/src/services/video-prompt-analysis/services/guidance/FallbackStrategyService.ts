import { logger } from '@infrastructure/Logger';
import { getFallbackModes } from '@services/video-prompt-analysis/config/fallbackStrategy';
import type { ConstraintConfig, ConstraintDetails, ConstraintOptions } from '@services/video-prompt-analysis/types';

/**
 * Service responsible for determining fallback constraints when suggestions fail
 */
export class FallbackStrategyService {
  private readonly log = logger.child({ service: 'FallbackStrategyService' });
  private static readonly STRICT_CATEGORY_CONFIDENCE_THRESHOLD = 0.7;

  /**
   * Determine the next fallback constraint mode to try
   */
  getVideoFallbackConstraints(
    currentConstraints: ConstraintConfig | null | undefined,
    details: ConstraintDetails = {},
    attemptedModes: Set<string> = new Set(),
    getConstraintsFn: (details: ConstraintDetails, options: ConstraintOptions) => ConstraintConfig
  ): ConstraintConfig | null {
    // Determine current mode (use 'default' if null/undefined)
    const currentMode = currentConstraints?.mode ?? 'default';

    // Get fallback order for current mode
    const fallbackOrder = getFallbackModes(currentMode);
    const strictGuardEnabled = this._shouldGuardStrictCategories(details);

    // Find first unattempted mode
    for (const mode of fallbackOrder) {
      if (attemptedModes.has(mode)) {
        continue;
      }

      if (strictGuardEnabled && this._isUnsafeStrictFallbackMode(mode, details.highlightedCategory)) {
        attemptedModes.add(mode);
        this.log.debug('Skipping unsafe fallback mode for strict taxonomy span', {
          highlightedCategory: details.highlightedCategory ?? null,
          highlightedCategoryConfidence: details.highlightedCategoryConfidence ?? null,
          skippedMode: mode,
          currentMode,
        });
        continue;
      }

      // Generate constraints for this fallback mode
      const fallbackConstraints = getConstraintsFn(details, { forceMode: mode });

      // Prevent retry loops when mode coercion resolves back to an already-attempted mode.
      if (fallbackConstraints.mode && attemptedModes.has(fallbackConstraints.mode)) {
        attemptedModes.add(mode);
        continue;
      }

      return fallbackConstraints;
    }

    // No more fallbacks available
    return null;
  }

  private _shouldGuardStrictCategories(details: ConstraintDetails): boolean {
    const category = (details.highlightedCategory || '').toLowerCase();
    if (!this._isStrictCategory(category)) {
      return false;
    }

    const confidence = details.highlightedCategoryConfidence;
    if (confidence === null || confidence === undefined || !Number.isFinite(confidence)) {
      return false;
    }

    return confidence >= FallbackStrategyService.STRICT_CATEGORY_CONFIDENCE_THRESHOLD;
  }

  private _isStrictCategory(category: string): boolean {
    return (
      category === 'camera' ||
      category.startsWith('camera.') ||
      category === 'shot' ||
      category.startsWith('shot.') ||
      category === 'style' ||
      category.startsWith('style.')
    );
  }

  private _isUnsafeStrictFallbackMode(mode: string, highlightedCategory?: string | null): boolean {
    const category = (highlightedCategory || '').toLowerCase();

    if (category === 'camera' || category.startsWith('camera.')) {
      return mode !== 'camera';
    }
    if (category === 'shot' || category.startsWith('shot.')) {
      return mode !== 'micro';
    }
    if (category === 'style' || category.startsWith('style.')) {
      return mode !== 'style' && mode !== 'adjective';
    }

    return false;
  }
}
