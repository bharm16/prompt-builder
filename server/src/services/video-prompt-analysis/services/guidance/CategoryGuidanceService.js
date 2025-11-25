import { CATEGORY_GUIDANCE, GUIDANCE_MAPPING } from '../../config/categoryGuidance.js';
import { TAXONOMY } from '#shared/taxonomy.ts';
import { normalizeText } from '../../utils/textHelpers.js';

/**
 * Service responsible for providing context-aware category-specific guidance
 * Transformed from static lists to intelligent, prescriptive recommendations
 */
export class CategoryGuidanceService {
  /**
   * Get context-aware category-specific focus guidance
   * NEW: Analyzes existing context to provide prescriptive, gap-filling guidance
   * 
   * @param {string} phraseRole - Role of the phrase
   * @param {string} categoryHint - Category hint
   * @param {string} fullContext - Full prompt text (NEW)
   * @param {Array} allSpans - All labeled spans (NEW)
   * @param {Array} editHistory - Recent edits (NEW)
   * @returns {Array|null} Array of guidance strings or null
   */
  getCategoryFocusGuidance(phraseRole, categoryHint, fullContext = '', allSpans = [], editHistory = []) {
    if (!phraseRole) return null;

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
        return contextAwareGuidance;
      }
    }

    // Fallback to static guidance
    const guidanceKey = this._findGuidanceKey(role, hint);
    if (guidanceKey) {
      return CATEGORY_GUIDANCE[guidanceKey];
    }

    return null;
  }

  /**
   * Get context-aware guidance (intelligent, prescriptive)
   * Main method that analyzes context and provides targeted guidance
   * 
   * @param {string} phraseRole - Role of the phrase
   * @param {string} categoryHint - Category hint
   * @param {string} fullContext - Full prompt text
   * @param {Array} allSpans - All labeled spans
   * @param {Array} editHistory - Recent edits
   * @returns {Array} Array of prescriptive guidance strings
   */
  getContextAwareGuidance(phraseRole, categoryHint, fullContext, allSpans, editHistory) {
    const guidance = [];
    const normalized = normalizeText(fullContext);
    const category = (categoryHint || phraseRole || '').toLowerCase();

    // Analyze existing elements
    const existingElements = this.analyzeExistingElements(fullContext, allSpans);
    
    // Identify gaps for this category
    const gaps = this.identifyGaps(category, existingElements);
    
    // Analyze relationships with existing elements
    const relationships = this.analyzeRelationships(category, existingElements);

    // Build prescriptive guidance based on analysis (using TAXONOMY)
    if (category === TAXONOMY.LIGHTING.id || category.includes('lighting')) {
      guidance.push(...this._buildLightingGuidance(existingElements, gaps, relationships, editHistory));
    } else if (category === TAXONOMY.CAMERA.id || category.includes('camera')) {
      guidance.push(...this._buildCameraGuidance(existingElements, gaps, relationships, editHistory));
    } else if (category === TAXONOMY.SUBJECT.id || category.includes('subject') || category.includes('character')) {
      guidance.push(...this._buildSubjectGuidance(existingElements, gaps, relationships));
    } else if (category === TAXONOMY.SUBJECT.attributes.ACTION || category.includes('action') || category.includes('movement')) {
      guidance.push(...this._buildActionGuidance(existingElements, gaps, relationships));
    } else if (category === TAXONOMY.ENVIRONMENT.id || category.includes('location') || category.includes('environment')) {
      guidance.push(...this._buildLocationGuidance(existingElements, gaps, relationships));
    } else if (category.includes('mood') || category.includes('atmosphere')) {
      guidance.push(...this._buildMoodGuidance(existingElements, gaps, relationships, editHistory));
    }

    return guidance.length > 0 ? guidance : null;
  }

  /**
   * Analyze existing elements in the context
   * Extracts what's already specified in the prompt
   * 
   * @param {string} fullContext - Full prompt text
   * @param {Array} allSpans - All labeled spans
   * @returns {Object} Map of category to existing values
   */
  analyzeExistingElements(fullContext, allSpans) {
    const elements = {
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
   * 
   * @param {string} category - Category being edited
   * @param {Object} existingElements - Existing elements from analysis
   * @returns {Array} Array of missing aspects
   */
  identifyGaps(category, existingElements) {
    const gaps = [];

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
   * 
   * @param {string} category - Category being edited
   * @param {Object} existingElements - Existing elements from analysis
   * @returns {Object} Constraints and opportunities
   */
  analyzeRelationships(category, existingElements) {
    const relationships = {
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
   * @private
   */
  _buildLightingGuidance(existing, gaps, relationships, editHistory) {
    const guidance = [];

    // Check edit history for lighting changes
    const lightingEdits = editHistory.filter(e => 
      e.category && e.category.toLowerCase().includes('lighting')
    );
    
    if (lightingEdits.length > 0) {
      const latestEdit = lightingEdits[0]; // Most recent
      if (latestEdit.replacement.includes('moody') || latestEdit.replacement.includes('dark')) {
        guidance.push('MAINTAIN MOODY TONE: Use low key ratios (4:1 or higher), selective pools of light');
      } else if (latestEdit.replacement.includes('soft') || latestEdit.replacement.includes('gentle')) {
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
   * @private
   */
  _buildCameraGuidance(existing, gaps, relationships, editHistory) {
    const guidance = [];

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
   * @private
   */
  _buildSubjectGuidance(existing, gaps, relationships) {
    const guidance = [];

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
   * @private
   */
  _buildActionGuidance(existing, gaps, relationships) {
    const guidance = [];

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
   * @private
   */
  _buildLocationGuidance(existing, gaps, relationships) {
    const guidance = [];

    if (relationships.opportunities.length > 0) {
      guidance.push(...relationships.opportunities);
    }

    guidance.push('Be SPECIFIC: not "outdoors" but "pine forest clearing" or "cobblestone alley"');
    guidance.push('Include ENVIRONMENTAL DETAILS: weather, atmosphere, time-specific elements');

    return guidance;
  }

  /**
   * Build mood-specific guidance
   * @private
   */
  _buildMoodGuidance(existing, gaps, relationships, editHistory) {
    const guidance = [];

    // Check for mood changes in edit history
    const moodEdits = editHistory.filter(e => 
      e.category && e.category.toLowerCase().includes('mood')
    );
    
    if (moodEdits.length > 0) {
      const latestEdit = moodEdits[0];
      guidance.push(`RESPECT mood evolution from "${latestEdit.original}" to "${latestEdit.replacement}"`);
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
   * @private
   */
  _extractTimeOfDay(context) {
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
   * @private
   */
  _extractLocation(context) {
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
   * @private
   */
  _extractMood(context) {
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
   * @private
   */
  _extractSubject(spans) {
    const subjectSpans = spans.filter(s => 
      s.category && (s.category.includes('subject') || s.category.includes('character'))
    );
    
    return {
      core: subjectSpans.map(s => s.text).join(', '),
      appearance: subjectSpans.some(s => s.text.match(/elderly|young|tall|short/i)),
      emotion: subjectSpans.some(s => s.text.match(/happy|sad|angry|peaceful/i)),
      details: subjectSpans.length > 1,
    };
  }

  /**
   * Extract existing lighting from spans
   * @private
   */
  _extractExistingLighting(spans) {
    const lightingSpans = spans.filter(s => 
      s.category && s.category.toLowerCase().includes('lighting')
    );
    
    const texts = lightingSpans.map(s => normalizeText(s.text)).join(' ');
    
    return {
      direction: texts.match(/\b(left|right|front|back|side|top|above|below)\b/) !== null,
      quality: texts.match(/\b(soft|hard|diffused|harsh|gentle)\b/) !== null,
      temperature: texts.match(/\b(\d{3,4}k|warm|cool|tungsten|daylight)\b/) !== null,
      intensity: texts.match(/\b(bright|dim|low|high|intense)\b/) !== null,
    };
  }

  /**
   * Extract existing camera specs from spans
   * @private
   */
  _extractExistingCamera(spans) {
    const cameraSpans = spans.filter(s => 
      s.category && s.category.toLowerCase().includes('camera')
    );
    
    const texts = cameraSpans.map(s => normalizeText(s.text)).join(' ');
    
    return {
      movement: texts.match(/\b(dolly|crane|handheld|tracking|static|pan|tilt)\b/) !== null,
      lens: texts.match(/\b(\d{2,3}mm|wide|telephoto|standard)\b/) !== null,
      angle: texts.match(/\b(high|low|eye.level|dutch|overhead)\b/) !== null,
      framing: texts.match(/\b(close.?up|medium|wide|extreme)\b/) !== null,
    };
  }

  /**
   * Extract action from spans
   * @private
   */
  _extractExistingAction(spans) {
    const actionSpans = spans.filter(s => 
      s.category && s.category.toLowerCase().includes('action')
    );
    
    return actionSpans.map(s => s.text).join(', ');
  }

  /**
   * Extract style from context and spans
   * @private
   */
  _extractStyle(context, spans) {
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
   * @private
   */
  _findGuidanceKey(role, hint) {
    for (const [keyword, guidanceKey] of Object.entries(GUIDANCE_MAPPING)) {
      if (role.includes(keyword) || hint.includes(keyword)) {
        return guidanceKey;
      }
    }
    return null;
  }
}

