import { logger } from '@infrastructure/Logger';
import { CATEGORY_GUIDANCE, GUIDANCE_MAPPING } from '@services/video-prompt-analysis/config/categoryGuidance';
import { TAXONOMY } from '#shared/taxonomy';
import { normalizeText } from '@services/video-prompt-analysis/utils/textHelpers';
import type { GuidanceSpan, EditHistoryEntry, ExistingElements, CategoryRelationships } from '@services/video-prompt-analysis/types';

/**
 * Service responsible for providing context-aware category-specific guidance
 * Transformed from static lists to intelligent, prescriptive recommendations
 */
export class CategoryGuidanceService {
  private readonly log = logger.child({ service: 'CategoryGuidanceService' });

  /**
   * Get context-aware category-specific focus guidance
   * NEW: Analyzes existing context to provide prescriptive, gap-filling guidance
   */
  getCategoryFocusGuidance(
    phraseRole: string | null | undefined,
    categoryHint: string | null | undefined,
    fullContext: string = '',
    allSpans: GuidanceSpan[] = [],
    editHistory: EditHistoryEntry[] = []
  ): string[] | null {
    const operation = 'getCategoryFocusGuidance';
    
    this.log.debug('Starting guidance generation', {
      operation,
      phraseRole: phraseRole || null,
      categoryHint: categoryHint || null,
      hasContext: !!fullContext,
      spansCount: allSpans.length,
      editHistoryCount: editHistory.length,
    });

    if (!phraseRole) {
      this.log.debug('No phrase role provided, returning null', { operation });
      return null;
    }

    const role = normalizeText(phraseRole);
    const hint = normalizeText(categoryHint);

    // If we have rich context, use intelligent analysis
    if (fullContext || allSpans.length > 0) {
      const contextAwareGuidance = this.getContextAwareGuidance(
        phraseRole,
        categoryHint,
        fullContext,
        allSpans,
        editHistory
      );
      
      if (contextAwareGuidance && contextAwareGuidance.length > 0) {
        this.log.info('Context-aware guidance generated', {
          operation,
          guidanceCount: contextAwareGuidance.length,
          category: categoryHint || phraseRole,
        });
        return contextAwareGuidance;
      }
    }

    // Fallback to static guidance
    const guidanceKey = this._findGuidanceKey(role, hint);
    if (guidanceKey) {
      const staticGuidance = CATEGORY_GUIDANCE[guidanceKey as keyof typeof CATEGORY_GUIDANCE] || null;
      if (staticGuidance) {
        this.log.info('Static guidance returned', {
          operation,
          guidanceKey,
          guidanceCount: staticGuidance.length,
        });
      }
      return staticGuidance;
    }

    this.log.debug('No guidance found, returning null', { operation });
    return null;
  }

  /**
   * Get context-aware guidance (intelligent, prescriptive)
   * Main method that analyzes context and provides targeted guidance
   */
  getContextAwareGuidance(
    phraseRole: string | null | undefined,
    categoryHint: string | null | undefined,
    fullContext: string,
    allSpans: GuidanceSpan[],
    editHistory: EditHistoryEntry[]
  ): string[] | null {
    const operation = 'getContextAwareGuidance';
    const guidance: string[] = [];
    const normalized = normalizeText(fullContext);
    const category = (categoryHint || phraseRole || '').toLowerCase();

    this.log.debug('Analyzing context for guidance', {
      operation,
      category,
      contextLength: fullContext.length,
      spansCount: allSpans.length,
    });

    // Analyze existing elements
    const existingElements = this.analyzeExistingElements(fullContext, allSpans);
    
    // Identify gaps for this category
    const gaps = this.identifyGaps(category, existingElements);
    
    // Analyze relationships with existing elements
    const relationships = this.analyzeRelationships(category, existingElements);

    this.log.debug('Context analysis complete', {
      operation,
      category,
      gapsCount: gaps.length,
      opportunitiesCount: relationships.opportunities.length,
      constraintsCount: relationships.constraints.length,
    });

    // Build prescriptive guidance based on analysis (using TAXONOMY)
    if (category === TAXONOMY.LIGHTING.id || category.includes('lighting')) {
      guidance.push(...this._buildLightingGuidance(existingElements, gaps, relationships, editHistory));
    } else if (category === TAXONOMY.CAMERA.id || category.includes('camera')) {
      guidance.push(...this._buildCameraGuidance(existingElements, gaps, relationships, editHistory));
    } else if (category === TAXONOMY.SUBJECT.id || category.includes('subject') || category.includes('character')) {
      guidance.push(...this._buildSubjectGuidance(existingElements, gaps, relationships));
    } else if (category === TAXONOMY.SUBJECT.attributes?.ACTION || category.includes('action') || category.includes('movement')) {
      guidance.push(...this._buildActionGuidance(existingElements, gaps, relationships));
    } else if (category === TAXONOMY.ENVIRONMENT.id || category.includes('location') || category.includes('environment')) {
      guidance.push(...this._buildLocationGuidance(existingElements, gaps, relationships));
    } else if (category.includes('mood') || category.includes('atmosphere')) {
      guidance.push(...this._buildMoodGuidance(existingElements, gaps, relationships, editHistory));
    }

    if (guidance.length > 0) {
      this.log.info('Context-aware guidance generated', {
        operation,
        category,
        guidanceCount: guidance.length,
      });
    } else {
      this.log.debug('No guidance generated for category', { operation, category });
    }

    return guidance.length > 0 ? guidance : null;
  }

  /**
   * Analyze existing elements in the context
   * Extracts what's already specified in the prompt
   */
  analyzeExistingElements(fullContext: string, allSpans: GuidanceSpan[]): ExistingElements {
    const elements: ExistingElements = {
      timeOfDay: this._extractTimeOfDay(fullContext),
      location: this._extractLocation(fullContext),
      mood: this._extractMood(fullContext),
      subject: this._extractSubject(allSpans),
      lighting: this._extractExistingLighting(allSpans),
      camera: this._extractExistingCamera(allSpans),
      action: this._extractExistingAction(allSpans),
      style: this._extractStyle(fullContext, allSpans),
    };

    return elements;
  }

  /**
   * Identify gaps for a category
   * Determines what's missing or underspecified
   */
  identifyGaps(category: string, existingElements: ExistingElements): string[] {
    const gaps: string[] = [];

    if (category.includes('lighting')) {
      if (!existingElements.lighting.direction) gaps.push('direction');
      if (!existingElements.lighting.quality) gaps.push('quality');
      if (!existingElements.lighting.temperature) gaps.push('temperature');
      if (!existingElements.lighting.intensity) gaps.push('intensity');
    }

    if (category.includes('camera')) {
      if (!existingElements.camera.movement) gaps.push('movement');
      if (!existingElements.camera.lens) gaps.push('lens');
      if (!existingElements.camera.angle) gaps.push('angle');
      if (!existingElements.camera.framing) gaps.push('framing');
    }

    if (category.includes('subject')) {
      if (!existingElements.subject.appearance) gaps.push('appearance');
      if (!existingElements.subject.emotion) gaps.push('emotion');
      if (!existingElements.subject.details) gaps.push('details');
    }

    return gaps;
  }

  /**
   * Analyze relationships between category and existing elements
   * How do existing elements constrain or guide this category?
   */
  analyzeRelationships(category: string, existingElements: ExistingElements): CategoryRelationships {
    const relationships: CategoryRelationships = {
      constraints: [],
      opportunities: [],
    };

    // Time of day affects lighting
    if (category.includes('lighting') && existingElements.timeOfDay) {
      const time = existingElements.timeOfDay;
      if (time.includes('golden hour')) {
        relationships.opportunities.push('Warm rim light to complement golden hour');
        relationships.constraints.push('Avoid cool/blue tones that contradict warm golden light');
      } else if (time.includes('night')) {
        relationships.opportunities.push('Artificial light sources, practicals');
        relationships.constraints.push('Low ambient light levels');
      } else if (time.includes('overcast')) {
        relationships.opportunities.push('Soft, diffused lighting naturally');
        relationships.constraints.push('Low contrast, no hard shadows');
      }
    }

    // Location affects multiple categories
    if (existingElements.location) {
      const loc = existingElements.location;
      if (loc.includes('underwater')) {
        if (category.includes('lighting')) {
          relationships.opportunities.push('Caustic light patterns essential');
          relationships.constraints.push('Blue-green color cast required');
        }
        if (category.includes('camera')) {
          relationships.opportunities.push('Slow, fluid movement');
          relationships.constraints.push('Limited visibility, hazy atmosphere');
        }
      } else if (loc.includes('desert')) {
        if (category.includes('lighting')) {
          relationships.opportunities.push('Harsh, high-contrast lighting');
          relationships.constraints.push('Strong shadows, bright highlights');
        }
      }
    }

    // Subject affects camera and lighting
    if (existingElements.subject.core) {
      const subj = existingElements.subject.core;
      if (subj.includes('elderly')) {
        if (category.includes('lighting')) {
          relationships.opportunities.push('Soft, flattering light');
          relationships.constraints.push('Avoid harsh shadows on wrinkled skin (max 3:1 ratio)');
        }
      } else if (subj.includes('child')) {
        if (category.includes('camera')) {
          relationships.opportunities.push('Lower camera angles to child\'s eye level');
        }
      }
    }

    // Mood affects multiple categories
    if (existingElements.mood) {
      const mood = existingElements.mood;
      if (mood.includes('moody') || mood.includes('dark') || mood.includes('tense')) {
        if (category.includes('lighting')) {
          relationships.opportunities.push('Low key lighting, high contrast ratios (4:1+)');
          relationships.constraints.push('Avoid bright, even illumination');
        }
      }
    }

    return relationships;
  }

  /**
   * Build lighting-specific guidance
   */
  private _buildLightingGuidance(
    existing: ExistingElements,
    gaps: string[],
    relationships: CategoryRelationships,
    editHistory: EditHistoryEntry[]
  ): string[] {
    const guidance: string[] = [];

    // Check edit history for lighting changes
    const lightingEdits = editHistory.filter(e => 
      e.category && e.category.toLowerCase().includes('lighting')
    );
    
    const latestLightingEdit = lightingEdits[0];
    if (latestLightingEdit) {
      if (latestLightingEdit.replacement?.includes('moody') || latestLightingEdit.replacement?.includes('dark')) {
        guidance.push('MAINTAIN MOODY TONE: Use low key ratios (4:1 or higher), selective pools of light');
      } else if (latestLightingEdit.replacement?.includes('soft') || latestLightingEdit.replacement?.includes('gentle')) {
        guidance.push('MAINTAIN SOFT LIGHTING: Diffused sources, low contrast ratios (2:1 to 3:1)');
      }
    }

    // Add relationship-based guidance
    if (relationships.opportunities.length > 0) {
      guidance.push(...relationships.opportunities);
    }

    // Add gap-filling guidance
    if (gaps.includes('direction')) {
      guidance.push('Specify light DIRECTION: key light from left/right/front, backlight, side light');
    }
    if (gaps.includes('quality')) {
      guidance.push('Define light QUALITY: hard (direct sun, spot) or soft (diffused, overcast)');
    }
    if (gaps.includes('temperature')) {
      guidance.push('Include COLOR TEMPERATURE: 3200K (tungsten/warm), 5600K (daylight/neutral), 7000K+ (cool/blue)');
    }

    // Add constraints as warnings
    if (relationships.constraints.length > 0) {
      guidance.push(`AVOID: ${relationships.constraints.join('; ')}`);
    }

    return guidance;
  }

  /**
   * Build camera-specific guidance
   */
  private _buildCameraGuidance(
    existing: ExistingElements,
    gaps: string[],
    relationships: CategoryRelationships,
    editHistory: EditHistoryEntry[]
  ): string[] {
    const guidance: string[] = [];

    // Relationship-based guidance first
    if (relationships.opportunities.length > 0) {
      guidance.push(...relationships.opportunities);
    }

    // Gap-filling guidance
    if (gaps.includes('movement')) {
      guidance.push('Specify CAMERA MOVEMENT: dolly in/out, crane up/down, handheld, tracking, static');
    }
    if (gaps.includes('lens')) {
      guidance.push('Define LENS: 35mm (wide), 50mm (standard), 85mm (portrait), 24mm (ultra-wide)');
    }
    if (gaps.includes('angle')) {
      guidance.push('Include CAMERA ANGLE: eye level, low angle, high angle, Dutch tilt');
    }
    if (gaps.includes('framing')) {
      guidance.push('Specify FRAMING: close-up, medium, wide, extreme close-up');
    }

    // Check for mood-camera alignment
    if (existing.mood && existing.mood.includes('energetic') && !existing.camera.movement) {
      guidance.push('ENERGETIC MOOD suggests DYNAMIC camera movement: handheld, tracking, whip pans');
    } else if (existing.mood && existing.mood.includes('calm') && !existing.camera.movement) {
      guidance.push('CALM MOOD suggests STABLE camera: slow dolly, crane, or static with smooth movements');
    }

    return guidance;
  }

  /**
   * Build subject-specific guidance
   */
  private _buildSubjectGuidance(
    existing: ExistingElements,
    gaps: string[],
    relationships: CategoryRelationships
  ): string[] {
    const guidance: string[] = [];

    if (relationships.opportunities.length > 0) {
      guidance.push(...relationships.opportunities);
    }

    if (gaps.includes('appearance')) {
      guidance.push('Add PHYSICAL DETAILS: 2-3 specific characteristics (age, build, distinguishing features)');
    }
    if (gaps.includes('emotion')) {
      guidance.push('Include EMOTIONAL STATE or EXPRESSION: facial expression, body language');
    }
    if (gaps.includes('details')) {
      guidance.push('Specify WARDROBE or KEY DETAILS that support the narrative');
    }

    return guidance;
  }

  /**
   * Build action-specific guidance
   */
  private _buildActionGuidance(
    existing: ExistingElements,
    gaps: string[],
    relationships: CategoryRelationships
  ): string[] {
    const guidance: string[] = [];

    if (relationships.opportunities.length > 0) {
      guidance.push(...relationships.opportunities);
    }

    if (existing.location && existing.location.includes('underwater')) {
      guidance.push('UNDERWATER ACTIONS: slow, fluid movements; consider buoyancy and resistance');
    }

    guidance.push('Describe action with SPECIFIC VERBS: not "moving" but "walking/running/gliding"');
    guidance.push('Include MANNER: how is the action performed? (gracefully, hurriedly, cautiously)');

    return guidance;
  }

  /**
   * Build location-specific guidance
   */
  private _buildLocationGuidance(
    existing: ExistingElements,
    gaps: string[],
    relationships: CategoryRelationships
  ): string[] {
    const guidance: string[] = [];

    if (relationships.opportunities.length > 0) {
      guidance.push(...relationships.opportunities);
    }

    guidance.push('Be SPECIFIC: not "outdoors" but "pine forest clearing" or "cobblestone alley"');
    guidance.push('Include ENVIRONMENTAL DETAILS: weather, atmosphere, time-specific elements');

    return guidance;
  }

  /**
   * Build mood-specific guidance
   */
  private _buildMoodGuidance(
    existing: ExistingElements,
    gaps: string[],
    relationships: CategoryRelationships,
    editHistory: EditHistoryEntry[]
  ): string[] {
    const guidance: string[] = [];

    // Check for mood changes in edit history
    const moodEdits = editHistory.filter(e => 
      e.category && e.category.toLowerCase().includes('mood')
    );
    
    const latestMoodEdit = moodEdits[0];
    if (latestMoodEdit?.original && latestMoodEdit.replacement) {
      guidance.push(`RESPECT mood evolution from "${latestMoodEdit.original}" to "${latestMoodEdit.replacement}"`);
    }

    if (relationships.opportunities.length > 0) {
      guidance.push(...relationships.opportunities);
    }

    guidance.push('Mood should ALIGN with lighting, pacing, and camera choices');
    guidance.push('Use SENSORY DESCRIPTORS: how does the scene feel?');

    return guidance;
  }

  // ============ Context Extraction Helpers ============

  /**
   * Extract time of day from context
   */
  private _extractTimeOfDay(context: string): string | null {
    const normalized = normalizeText(context);
    const times = ['golden hour', 'dawn', 'dusk', 'sunrise', 'sunset', 'midday', 'noon', 
                   'afternoon', 'morning', 'evening', 'night', 'midnight', 'twilight', 'overcast'];
    
    for (const time of times) {
      if (normalized.includes(time)) {
        return time;
      }
    }
    return null;
  }

  /**
   * Extract location type from context
   */
  private _extractLocation(context: string): string | null {
    const normalized = normalizeText(context);
    const locations = ['underwater', 'desert', 'forest', 'urban', 'city', 'beach', 'mountain',
                       'indoor', 'outdoor', 'studio', 'street', 'room', 'office', 'park'];
    
    for (const loc of locations) {
      if (normalized.includes(loc)) {
        return loc;
      }
    }
    return null;
  }

  /**
   * Extract mood from context
   */
  private _extractMood(context: string): string | null {
    const normalized = normalizeText(context);
    const moods = ['moody', 'dark', 'bright', 'cheerful', 'somber', 'tense', 'calm', 
                   'peaceful', 'energetic', 'melancholic', 'joyful', 'suspenseful'];
    
    for (const mood of moods) {
      if (normalized.includes(mood)) {
        return mood;
      }
    }
    return null;
  }

  /**
   * Extract subject from spans
   */
  private _extractSubject(spans: GuidanceSpan[]): ExistingElements['subject'] {
    const subjectSpans = spans.filter(s => 
      s.category && (s.category.includes('subject') || s.category.includes('character'))
    );
    
    return {
      core: subjectSpans.map(s => s.text || '').join(', '),
      appearance: subjectSpans.some(s => (s.text || '').match(/elderly|young|tall|short/i) !== null),
      emotion: subjectSpans.some(s => (s.text || '').match(/happy|sad|angry|peaceful/i) !== null),
      details: subjectSpans.length > 1,
    };
  }

  /**
   * Extract existing lighting from spans
   */
  private _extractExistingLighting(spans: GuidanceSpan[]): ExistingElements['lighting'] {
    const lightingSpans = spans.filter(s => 
      s.category && s.category.toLowerCase().includes('lighting')
    );
    
    const texts = lightingSpans.map(s => normalizeText(s.text || '')).join(' ');
    
    return {
      direction: /\b(left|right|front|back|side|top|above|below)\b/.test(texts),
      quality: /\b(soft|hard|diffused|harsh|gentle)\b/.test(texts),
      temperature: /\b(\d{3,4}k|warm|cool|tungsten|daylight)\b/.test(texts),
      intensity: /\b(bright|dim|low|high|intense)\b/.test(texts),
    };
  }

  /**
   * Extract existing camera specs from spans
   */
  private _extractExistingCamera(spans: GuidanceSpan[]): ExistingElements['camera'] {
    const cameraSpans = spans.filter(s => 
      s.category && s.category.toLowerCase().includes('camera')
    );
    
    const texts = cameraSpans.map(s => normalizeText(s.text || '')).join(' ');
    
    return {
      movement: /\b(dolly|crane|handheld|tracking|static|pan|tilt)\b/.test(texts),
      lens: /\b(\d{2,3}mm|wide|telephoto|standard)\b/.test(texts),
      angle: /\b(high|low|eye.level|dutch|overhead)\b/.test(texts),
      framing: /\b(close.?up|medium|wide|extreme)\b/.test(texts),
    };
  }

  /**
   * Extract action from spans
   */
  private _extractExistingAction(spans: GuidanceSpan[]): string {
    const actionSpans = spans.filter(s => 
      s.category && s.category.toLowerCase().includes('action')
    );
    
    return actionSpans.map(s => s.text || '').join(', ');
  }

  /**
   * Extract style from context and spans
   */
  private _extractStyle(context: string, spans: GuidanceSpan[]): string | null {
    const normalized = normalizeText(context);
    const styles = ['documentary', 'cinematic', 'vintage', 'modern', 'noir', 'surreal',
                    'realistic', 'stylized', 'artistic', 'commercial'];
    
    for (const style of styles) {
      if (normalized.includes(style)) {
        return style;
      }
    }
    return null;
  }

  /**
   * Find guidance key by matching role and hint keywords (legacy fallback)
   */
  private _findGuidanceKey(role: string, hint: string): string | null {
    for (const [keyword, guidanceKey] of Object.entries(GUIDANCE_MAPPING)) {
      if (role.includes(keyword) || hint.includes(keyword)) {
        return guidanceKey;
      }
    }
    return null;
  }
}

