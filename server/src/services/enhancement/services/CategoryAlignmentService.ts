import { logger } from '@infrastructure/Logger';
import { CATEGORY_CONSTRAINTS, detectSubcategory } from '../config/CategoryConstraints.js';
import { CONSTRAINT_THRESHOLDS } from '@services/video-prompt-analysis/config/constraintModes';
import { getParentCategory } from '@shared/taxonomy';
import type { Suggestion, ValidationParams, CategoryAlignmentResult } from './types.js';

/**
 * Interface for validation service
 */
interface ValidationService {
  validateSuggestions(suggestions: Suggestion[], highlightedText: string, category: string): Suggestion[];
}

/**
 * CategoryAlignmentService
 *
 * Responsible for enforcing category alignment and providing fallback suggestions.
 * Ensures suggestions match the expected category and provides alternatives when needed.
 *
 * Single Responsibility: Category validation and fallback management
 */
export class CategoryAlignmentService {
  private readonly log = logger.child({ service: 'CategoryAlignmentService' });
  private readonly legacyCategoryToParent: Record<string, string> = {
    descriptive: 'style',
    framing: 'shot',
    cameramove: 'camera',
  };
  private readonly attributeFallbacks: Record<string, Suggestion[]> = {
    'camera.focus': [
      { text: 'shallow depth of field bokeh', category: 'camera.focus', explanation: 'Foreground stays sharp while the background falls off softly' },
      { text: 'selective focus on foreground subject', category: 'camera.focus', explanation: 'Guides attention to the hero element' },
      { text: 'soft background defocus separation', category: 'camera.focus', explanation: 'Creates clear subject separation and depth' },
    ],
    'camera.angle': [
      { text: 'eye-level framing with 50mm lens', category: 'camera.angle', explanation: 'Natural perspective with neutral lens geometry' },
      { text: 'low-angle framing with 35mm lens', category: 'camera.angle', explanation: 'Adds perceived scale and energy' },
      { text: 'overhead perspective with 24mm lens', category: 'camera.angle', explanation: 'Top-down context with wide field coverage' },
    ],
    'camera.movement': [
      { text: 'slow dolly push with 50mm lens', category: 'camera.movement', explanation: 'Controlled forward movement with cinematic compression' },
      { text: 'gentle lateral track with 35mm lens', category: 'camera.movement', explanation: 'Smooth side movement while preserving spatial context' },
      { text: 'static lock-off with 85mm portrait frame', category: 'camera.movement', explanation: 'Deliberate stillness with intimate framing' },
    ],
    'shot.type': [
      { text: 'wide establishing shot composition', category: 'shot.type', explanation: 'Prioritizes scene geography and context' },
      { text: 'medium close-up shot framing', category: 'shot.type', explanation: 'Balances subject detail and environment' },
      { text: 'tight portrait close-up framing', category: 'shot.type', explanation: 'Focuses attention on character detail' },
    ],
    'lighting.source': [
      { text: 'window light from camera left', category: 'lighting.source', explanation: 'Single directional source with readable falloff' },
      { text: 'soft backlight from rear window', category: 'lighting.source', explanation: 'Rear source adds contour separation' },
      { text: 'overhead sunlight through canopy', category: 'lighting.source', explanation: 'Natural overhead source with filtered texture' },
    ],
    'lighting.quality': [
      { text: 'soft diffused light quality', category: 'lighting.quality', explanation: 'Low contrast rolloff with gentle transitions' },
      { text: 'high-contrast dramatic shadow edges', category: 'lighting.quality', explanation: 'Sharper separation for a punchier mood' },
      { text: 'warm ambient glow quality', category: 'lighting.quality', explanation: 'Even luminance with inviting warmth' },
    ],
    'lighting.timeOfDay': [
      { text: 'golden-hour sunlight ambience', category: 'lighting.timeOfDay', explanation: 'Warm directional light near sunset' },
      { text: 'blue-hour twilight ambience', category: 'lighting.timeOfDay', explanation: 'Cool post-sunset tonal balance' },
      { text: 'bright midday daylight ambience', category: 'lighting.timeOfDay', explanation: 'High-key daylight with crisp definition' },
    ],
    'lighting.colorTemp': [
      { text: 'warm 3200K tungsten glow', category: 'lighting.colorTemp', explanation: 'Amber-biased indoor cinematic warmth' },
      { text: 'neutral 5600K daylight balance', category: 'lighting.colorTemp', explanation: 'Natural daylight white point' },
      { text: 'cool 7000K moonlit cast', category: 'lighting.colorTemp', explanation: 'Blue-shifted nocturnal tone' },
    ],
    'style.aesthetic': [
      { text: 'documentary verite visual tone', category: 'style.aesthetic', explanation: 'Naturalistic visual language with grounded realism' },
      { text: 'vintage 35mm film grain look', category: 'style.aesthetic', explanation: 'Analog texture with cinematic softness' },
      { text: 'high-contrast neo-noir palette', category: 'style.aesthetic', explanation: 'Stylized contrast and moody color separation' },
    ],
    'style.filmStock': [
      { text: 'Kodak 35mm film stock profile', category: 'style.filmStock', explanation: 'Classic analog grain and color response' },
      { text: 'grainy 16mm indie stock look', category: 'style.filmStock', explanation: 'Coarser texture with documentary character' },
      { text: 'clean digital cinema stock profile', category: 'style.filmStock', explanation: 'Modern crisp image baseline' },
    ],
    'style.colorGrade': [
      { text: 'warm golden-hour color grade', category: 'style.colorGrade', explanation: 'Sunlit highlights with gentle warm mids' },
      { text: 'cool teal shadow color grade', category: 'style.colorGrade', explanation: 'Cool shadow bias with restrained contrast' },
      { text: 'muted desaturated neutral grade', category: 'style.colorGrade', explanation: 'Reduced saturation for subdued mood' },
    ],
    'subject.identity': [
      { text: 'smiling toddler as focal subject', category: 'subject.identity', explanation: 'Keeps the subject role human and child-centered' },
      { text: 'curious young child protagonist', category: 'subject.identity', explanation: 'Emphasizes youthful perspective and focus' },
      { text: 'playful kid with bright eyes', category: 'subject.identity', explanation: 'Maintains a child subject with clear visual cues' },
    ],
    'subject.appearance': [
      { text: 'round cheeks and bright eyes', category: 'subject.appearance', explanation: 'Visible facial traits conveying youth and warmth' },
      { text: 'tousled hair and soft features', category: 'subject.appearance', explanation: 'Natural texture details for close framing' },
      { text: 'freckled face with warm smile', category: 'subject.appearance', explanation: 'Distinctive facial detail with positive tone' },
    ],
    'subject.emotion': [
      { text: 'joyful expression with excitement', category: 'subject.emotion', explanation: 'Clear positive emotion in facial/body cues' },
      { text: 'quiet wonder in the gaze', category: 'subject.emotion', explanation: 'Subtle curiosity conveyed through eye-line' },
      { text: 'confident playful energy', category: 'subject.emotion', explanation: 'Upbeat emotional posture with childlike momentum' },
    ],
    'subject.wardrobe': [
      { text: 'colorful cotton play outfit', category: 'subject.wardrobe', explanation: 'Soft child-friendly wardrobe detail' },
      { text: 'casual denim jacket and tee', category: 'subject.wardrobe', explanation: 'Everyday clothing with texture and shape' },
      { text: 'soft knit sweater layers', category: 'subject.wardrobe', explanation: 'Simple layered wardrobe for visual depth' },
    ],
    'action.movement': [
      { text: 'gentle swaying with steady rhythm', category: 'action.movement', explanation: 'Continuous low-intensity movement readable on camera' },
      { text: 'playful reaching toward the wheel', category: 'action.movement', explanation: 'Single clear motion tied to scene context' },
      { text: 'slow forward lean in seat', category: 'action.movement', explanation: 'Subtle directional movement with natural continuity' },
    ],
    'action.state': [
      { text: 'upright seated pose in frame', category: 'action.state', explanation: 'Stable posture with clear body orientation' },
      { text: 'relaxed posture with open shoulders', category: 'action.state', explanation: 'Comfortable static state with readable body language' },
      { text: 'balanced stance with calm focus', category: 'action.state', explanation: 'Composed stillness without action sequencing' },
    ],
    'action.gesture': [
      { text: 'small hand wave toward camera', category: 'action.gesture', explanation: 'Brief visible micro-action with clear intention' },
      { text: 'light finger tap on wheel', category: 'action.gesture', explanation: 'Compact gesture grounded in local props' },
      { text: 'gentle head tilt and smile', category: 'action.gesture', explanation: 'Facial and posture gesture in one readable beat' },
    ],
    'environment.location': [
      { text: 'sunlit neighborhood park setting', category: 'environment.location', explanation: 'Open daytime outdoor location context' },
      { text: 'quiet cobblestone courtyard backdrop', category: 'environment.location', explanation: 'Architectural outdoor setting alternative' },
      { text: 'open meadow with tree line', category: 'environment.location', explanation: 'Natural landscape with depth cues' },
    ],
    'environment.weather': [
      { text: 'soft summer breeze conditions', category: 'environment.weather', explanation: 'Mild air movement without disruptive weather shift' },
      { text: 'light morning mist layer', category: 'environment.weather', explanation: 'Gentle atmospheric diffusion' },
      { text: 'clear sky golden-hour air', category: 'environment.weather', explanation: 'Warm dry weather with strong sunlight context' },
    ],
    'environment.context': [
      { text: 'active park with families', category: 'environment.context', explanation: 'Human activity density in the background' },
      { text: 'peaceful open space ambience', category: 'environment.context', explanation: 'Low-crowd environmental calm' },
      { text: 'bustling plaza background activity', category: 'environment.context', explanation: 'Higher-energy public context' },
    ],
  };
  private readonly parentCategoryFallbacks: Record<string, Suggestion[]> = {
    camera: [
      { text: 'medium framing with 50mm lens', category: 'camera', explanation: 'Balanced camera geometry and perspective' },
      { text: 'slow push-in camera movement', category: 'camera', explanation: 'Controlled forward motion for emphasis' },
      { text: 'static composition with shallow focus', category: 'camera', explanation: 'Stable framing with depth separation' },
    ],
    shot: [
      { text: 'wide establishing shot', category: 'shot', explanation: 'Shows full scene context' },
      { text: 'medium shot composition', category: 'shot', explanation: 'Balanced subject-to-background ratio' },
      { text: 'tight close-up framing', category: 'shot', explanation: 'Prioritizes subject detail' },
    ],
    lighting: [
      { text: 'soft directional light', category: 'lighting', explanation: 'Readable source with gentle falloff' },
      { text: 'high-contrast rim lighting', category: 'lighting', explanation: 'Stronger contour separation' },
      { text: 'warm ambient practical glow', category: 'lighting', explanation: 'Low-intensity fill from practical sources' },
    ],
    style: [
      { text: 'vintage cinematic film treatment', category: 'style', explanation: 'Classic analog-inspired style language' },
      { text: 'documentary realism visual style', category: 'style', explanation: 'Grounded naturalistic rendering style' },
      { text: 'stylized high-contrast noir aesthetic', category: 'style', explanation: 'Bold contrast and moody artistic tone' },
    ],
    subject: [
      { text: 'curious child subject in frame', category: 'subject', explanation: 'Human-centered subject default' },
      { text: 'smiling protagonist with bright eyes', category: 'subject', explanation: 'Readable face-driven subject presence' },
      { text: 'playful youth as focal point', category: 'subject', explanation: 'Keeps attention on a single clear subject' },
    ],
    action: [
      { text: 'single continuous body movement', category: 'action', explanation: 'Preserves one action per clip discipline' },
      { text: 'steady seated motion cue', category: 'action', explanation: 'Low-amplitude motion for stable continuity' },
      { text: 'small gesture with clear intent', category: 'action', explanation: 'Camera-visible micro-action' },
    ],
    environment: [
      { text: 'sunlit park environment', category: 'environment', explanation: 'Readable outdoor location baseline' },
      { text: 'urban courtyard surroundings', category: 'environment', explanation: 'Architectural context alternative' },
      { text: 'open natural landscape backdrop', category: 'environment', explanation: 'Nature-forward setting context' },
    ],
    technical: [
      { text: '24fps cinematic frame rate', category: 'technical', explanation: 'Default cinematic playback cadence' },
      { text: '16:9 widescreen aspect ratio', category: 'technical', explanation: 'Standard display aspect' },
      { text: '4k production resolution target', category: 'technical', explanation: 'High-detail delivery baseline' },
    ],
    audio: [
      { text: 'soft ambient environmental bed', category: 'audio', explanation: 'Low-intensity atmospheric sound layer' },
      { text: 'subtle orchestral underscore', category: 'audio', explanation: 'Emotional support without overpowering dialogue' },
      { text: 'light natural Foley texture', category: 'audio', explanation: 'Scene-matched diegetic detail' },
    ],
  };

  constructor(private readonly validationService: ValidationService) {}

  /**
   * Enforce category alignment for suggestions
   * Validates suggestions match the category or provides fallbacks
   * @param suggestions - Array of suggestions to validate
   * @param params - Validation parameters
   * @returns Result with suggestions and metadata
   */
  enforceCategoryAlignment(suggestions: Suggestion[], params: ValidationParams): CategoryAlignmentResult {
    const operation = 'enforceCategoryAlignment';
    const { highlightedText, highlightedCategory, highlightedCategoryConfidence } = params;
    const confidenceIsLow =
      typeof highlightedCategoryConfidence === 'number' &&
      highlightedCategoryConfidence < CONSTRAINT_THRESHOLDS.MIN_CATEGORY_CONFIDENCE;

    this.log.debug('Enforcing category alignment', {
      operation,
      suggestionCount: suggestions.length,
      category: highlightedCategory || null,
    });

    // Check if we need fallbacks
    const needsFallback = this.shouldUseFallback(
      suggestions,
      highlightedText,
      highlightedCategory,
      highlightedCategoryConfidence ?? null
    );

    if (needsFallback) {
      this.log.warn('Fallback required due to category mismatch or low confidence', {
        operation,
        originalSuggestionCount: suggestions.length,
        category: highlightedCategory || null,
      });
      
      const fallbacks = this.getCategoryFallbacks(highlightedText, highlightedCategory);
      
      this.log.info('Fallback suggestions applied', {
        operation,
        fallbackCount: fallbacks.length,
        category: highlightedCategory || null,
      });
      
      const context = {
        ...(highlightedCategory ? { baseCategory: highlightedCategory } : {}),
        originalSuggestionsRejected: suggestions.length,
        reason: 'Category mismatch or low confidence',
      };

      return {
        suggestions: fallbacks,
        fallbackApplied: true,
        context,
      };
    }

    if (confidenceIsLow) {
      this.log.info('Skipping category validation due to low confidence', {
        operation,
        category: highlightedCategory || null,
        confidence: highlightedCategoryConfidence,
      });
      return {
        suggestions,
        fallbackApplied: false,
        context: {
          ...(highlightedCategory ? { baseCategory: highlightedCategory } : {}),
          reason: 'Low category confidence',
        },
      };
    }

    // Validate and filter suggestions
    const validSuggestions = this.validationService.validateSuggestions(
      suggestions,
      highlightedText,
      highlightedCategory || ''
    );

    this.log.info('Category alignment completed', {
      operation,
      originalCount: suggestions.length,
      validCount: validSuggestions.length,
      category: highlightedCategory || null,
      fallbackApplied: false,
    });

    const context = highlightedCategory ? { baseCategory: highlightedCategory } : {};

    return {
      suggestions: validSuggestions,
      fallbackApplied: false,
      context,
    };
  }

  /**
   * Determine if fallback suggestions should be used
   * Checks for category mismatches and quality issues
   * @param suggestions - Suggestions to validate
   * @param highlightedText - Original text
   * @param category - Expected category
   * @returns True if fallbacks should be used
   */
  shouldUseFallback(
    suggestions: Suggestion[],
    highlightedText: string,
    category?: string,
    confidence?: number | null
  ): boolean {
    const operation = 'shouldUseFallback';
    const confidenceIsLow =
      typeof confidence === 'number' &&
      confidence < CONSTRAINT_THRESHOLDS.MIN_CATEGORY_CONFIDENCE;
    
    // Use fallback if no suggestions or very low count
    if (!suggestions || suggestions.length === 0) {
      this.log.debug('Fallback needed: insufficient suggestions', {
        operation,
        suggestionCount: suggestions?.length || 0,
      });
      return true;
    }

    if (confidenceIsLow) {
      this.log.debug('Category confidence low, skipping fallback checks', {
        operation,
        confidence,
      });
      return false;
    }

    if (suggestions.length < 2) {
      this.log.debug('Fallback needed: insufficient suggestions', {
        operation,
        suggestionCount: suggestions.length,
      });
      return true;
    }

    if (!category) {
      this.log.debug('No category specified, fallback not needed', { operation });
      return false;
    }

    // Check for category mismatches
    if (category === 'technical' && CATEGORY_CONSTRAINTS.technical) {
      const subcategory = detectSubcategory(highlightedText, category);
      if (subcategory) {
        const constraint = CATEGORY_CONSTRAINTS.technical[subcategory as keyof typeof CATEGORY_CONSTRAINTS.technical];
        if (
          constraint &&
          typeof constraint === 'object' &&
          'pattern' in constraint &&
          constraint.pattern instanceof RegExp
        ) {
          const validCount = suggestions.filter(s =>
            constraint.pattern.test(s.text)
          ).length;
          const needsFallback = validCount < suggestions.length * 0.5;
          
          if (needsFallback) {
            this.log.warn('Category mismatch detected in technical subcategory', {
              operation,
              subcategory,
              validCount,
              totalCount: suggestions.length,
              validRatio: validCount / suggestions.length,
            });
          }
          
          return needsFallback;
        }
      }
    }

    // Check for audio suggestions in non-audio categories
    if (['technical', 'framing', 'descriptive'].includes(category)) {
      const audioCount = suggestions.filter(s =>
        /audio|sound|music|score/i.test(s.text) ||
        (s.category && s.category.toLowerCase().includes('audio'))
      ).length;
      if (audioCount > 0) {
        this.log.warn('Audio suggestions detected in non-audio category', {
          operation,
          category,
          audioCount,
          totalCount: suggestions.length,
        });
        return true;
      }
    }

    // Check for lighting suggestions in style descriptors
    if (category === 'descriptive') {
      const lightingCount = suggestions.filter(s =>
        /light|shadow|glow|illuminat/i.test(s.text) ||
        (s.category && s.category.toLowerCase().includes('light'))
      ).length;
      const needsFallback = lightingCount > suggestions.length * 0.5;
      
      if (needsFallback) {
        this.log.warn('Lighting suggestions detected in descriptive category', {
          operation,
          lightingCount,
          totalCount: suggestions.length,
          lightingRatio: lightingCount / suggestions.length,
        });
      }
      
      return needsFallback;
    }

    this.log.debug('No fallback needed, suggestions are valid', {
      operation,
      category,
      suggestionCount: suggestions.length,
    });
    
    return false;
  }

  /**
   * Get fallback suggestions for a category
   * Provides category-appropriate fallback suggestions when primary suggestions fail
   * @param highlightedText - Original text
   * @param category - Category to get fallbacks for
   * @returns Fallback suggestions
   */
  getCategoryFallbacks(highlightedText: string, category?: string): Suggestion[] {
    const operation = 'getCategoryFallbacks';
    const normalizedCategory = (category || '').trim();
    
    this.log.debug('Getting category fallbacks', {
      operation,
      category: normalizedCategory || null,
    });

    if (!normalizedCategory) {
      this.log.debug('No category specified, using generic fallbacks', { operation });
      return this._getGenericFallbacks();
    }

    const subcategory = detectSubcategory(highlightedText, normalizedCategory);

    // Get specific fallbacks for technical subcategories
    if (normalizedCategory === 'technical' && subcategory && CATEGORY_CONSTRAINTS.technical) {
      const constraint = CATEGORY_CONSTRAINTS.technical[subcategory as keyof typeof CATEGORY_CONSTRAINTS.technical];
      if (
        constraint &&
        typeof constraint === 'object' &&
        'fallbacks' in constraint &&
        Array.isArray(constraint.fallbacks)
      ) {
        const fallbacks = this._retagFallbacks(constraint.fallbacks as Suggestion[], normalizedCategory);
        this.log.debug('Using technical subcategory fallbacks', {
          operation,
          subcategory,
          fallbackCount: fallbacks.length,
        });
        return fallbacks;
      }
    }

    const exactConstraintFallbacks = this._getConstraintFallbacks(normalizedCategory);
    if (exactConstraintFallbacks.length > 0) {
      this.log.debug('Using category-specific fallbacks', {
        operation,
        category: normalizedCategory,
        fallbackCount: exactConstraintFallbacks.length,
      });
      return this._retagFallbacks(exactConstraintFallbacks, normalizedCategory);
    }

    const exactAttributeFallbacks = this.attributeFallbacks[normalizedCategory];
    if (Array.isArray(exactAttributeFallbacks) && exactAttributeFallbacks.length > 0) {
      this.log.debug('Using attribute-specific fallbacks', {
        operation,
        category: normalizedCategory,
        fallbackCount: exactAttributeFallbacks.length,
      });
      return this._retagFallbacks(exactAttributeFallbacks, normalizedCategory);
    }

    const parentCategory = this._resolveParentCategory(normalizedCategory);
    if (parentCategory) {
      const parentConstraintFallbacks = this._getConstraintFallbacks(parentCategory);
      if (parentConstraintFallbacks.length > 0) {
        this.log.debug('Using parent category fallbacks from constraints', {
          operation,
          category: normalizedCategory,
          parentCategory,
          fallbackCount: parentConstraintFallbacks.length,
        });
        return this._retagFallbacks(parentConstraintFallbacks, normalizedCategory);
      }

      const parentDefaults = this.parentCategoryFallbacks[parentCategory];
      if (Array.isArray(parentDefaults) && parentDefaults.length > 0) {
        this.log.debug('Using parent category fallback defaults', {
          operation,
          category: normalizedCategory,
          parentCategory,
          fallbackCount: parentDefaults.length,
        });
        return this._retagFallbacks(parentDefaults, normalizedCategory);
      }
    }

    // Generic fallbacks as last resort
    this.log.debug('Using generic fallbacks as last resort', {
      operation,
      category: normalizedCategory,
    });
    return this._getGenericFallbacks(normalizedCategory);
  }

  private _getConstraintFallbacks(category: string): Suggestion[] {
    const categoryConstraints = CATEGORY_CONSTRAINTS[category as keyof typeof CATEGORY_CONSTRAINTS];
    if (
      categoryConstraints &&
      typeof categoryConstraints === 'object' &&
      'fallbacks' in categoryConstraints &&
      Array.isArray((categoryConstraints as { fallbacks?: Suggestion[] }).fallbacks)
    ) {
      return (categoryConstraints as { fallbacks: Suggestion[] }).fallbacks;
    }
    return [];
  }

  private _resolveParentCategory(category: string): string | null {
    const explicitParent = getParentCategory(category);
    if (explicitParent) {
      return explicitParent;
    }
    return this.legacyCategoryToParent[category.toLowerCase()] || null;
  }

  private _retagFallbacks(fallbacks: Suggestion[], category: string): Suggestion[] {
    return fallbacks.map((fallback) => ({
      ...fallback,
      category,
    }));
  }

  /**
   * Get generic fallback suggestions
   * @private
   */
  private _getGenericFallbacks(category?: string): Suggestion[] {
    return [
      {
        text: 'refined visual variation',
        category: category || 'general',
        explanation: 'Fallback option preserving visual intent',
      },
      {
        text: 'alternate cinematic phrasing',
        category: category || 'general',
        explanation: 'Category-safe replacement phrasing',
      },
      {
        text: 'complementary scene variation',
        category: category || 'general',
        explanation: 'Backup option when model output is unusable',
      },
    ];
  }
}
