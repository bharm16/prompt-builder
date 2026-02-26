import type { PromptRequirements, PromptSpan } from '../types';

const toLower = (value: string): string => value.toLowerCase();

const resolveSpanRole = (span: PromptSpan): string | null => {
  if (typeof span.role === 'string' && span.role.trim().length > 0) {
    return span.role.trim();
  }
  const maybeCategory = span.category;
  return typeof maybeCategory === 'string' && maybeCategory.trim().length > 0
    ? maybeCategory.trim()
    : null;
};

export class PromptRequirementsService {
  extractRequirements(prompt: string, spans: PromptSpan[]): PromptRequirements {
    const roles = spans
      .map(resolveSpanRole)
      .filter((role): role is string => typeof role === 'string');

    return {
      physics: this.analyzePhysics(prompt, spans, roles),
      character: this.analyzeCharacter(prompt, spans, roles),
      environment: this.analyzeEnvironment(prompt, spans, roles),
      lighting: this.analyzeLighting(prompt, spans, roles),
      style: this.analyzeStyle(prompt, spans, roles),
      motion: this.analyzeMotion(prompt, spans, roles),
      detectedCategories: roles,
      confidenceScore: this.calculateConfidence(spans),
    };
  }

  private analyzePhysics(
    prompt: string,
    spans: PromptSpan[],
    roles: string[]
  ): PromptRequirements['physics'] {
    const allText = this.buildSearchText(prompt, spans);

    const hasWater = /\b(water|rain|ocean|river|splash|wet|puddle|wave)\b/.test(allText);
    const hasFire = /\b(fire|flame|burning|explosion|spark)\b/.test(allText);
    const hasParticles = /\b(rain|snow|smoke|dust|sparks|embers|fog)\b/.test(allText);
    const hasCloth = /\b(dress|cape|curtain|flag|fabric|flowing)\b/.test(allText);
    const hasCollision = /\b(crash|impact|breaking|shatter|collision)\b/.test(allText);

    const weatherSpans = roles.filter(
      (role) => role === 'environment.weather' || role.startsWith('environment.weather.')
    );

    const complexityScore = [hasWater, hasFire, hasParticles, hasCloth, hasCollision].filter(Boolean)
      .length;

    return {
      hasComplexPhysics: complexityScore >= 2 || hasWater || hasFire,
      hasParticleSystems: hasParticles || weatherSpans.length > 0,
      hasFluidDynamics: hasWater,
      hasSoftBodyPhysics: hasCloth,
      physicsComplexity: this.scoreToComplexity(complexityScore, 4),
    };
  }

  private analyzeCharacter(
    prompt: string,
    spans: PromptSpan[],
    roles: string[]
  ): PromptRequirements['character'] {
    const subjectRoles = roles.filter((role) => role.startsWith('subject.'));
    const emotionRoles = roles.filter((role) => role === 'subject.emotion');
    const actionRoles = roles.filter((role) => role.startsWith('action.'));

    const allText = this.buildSearchText(prompt, spans);

    const hasHuman =
      subjectRoles.includes('subject.identity') ||
      /\b(person|man|woman|child|people|face|human|girl|boy)\b/.test(allText);
    const hasAnimal = /\b(dog|cat|bird|animal|creature|horse)\b/.test(allText);
    const hasMech = /\b(robot|machine|android|mech|drone|vehicle)\b/.test(allText);

    const needsFace =
      emotionRoles.length > 0 ||
      /\b(expression|smile|cry|laugh|frown|gaze|eyes|face)\b/.test(allText);
    const needsBody =
      actionRoles.length > 0 ||
      /\b(gesture|posture|stance|movement|walk|run|dance|sit|stand)\b/.test(allText);

    const emotionalIntensity = this.assessEmotionalIntensity(emotionRoles, allText);

    return {
      hasHumanCharacter: hasHuman,
      hasAnimalCharacter: hasAnimal,
      hasMechanicalCharacter: hasMech,
      requiresFacialPerformance: hasHuman && needsFace,
      requiresBodyLanguage: hasHuman && needsBody,
      requiresLipSync: /\b(speak|talk|sing)\b/.test(allText),
      emotionalIntensity,
    };
  }

  private analyzeEnvironment(
    prompt: string,
    spans: PromptSpan[],
    roles: string[]
  ): PromptRequirements['environment'] {
    const envRoles = roles.filter((role) => role.startsWith('environment.'));
    const allText = this.buildSearchText(prompt, spans);

    const hasInterior = /\b(room|interior|inside|indoor|house|building|office|kitchen|bedroom)\b/.test(
      allText
    );
    const hasExterior = /\b(outside|outdoor|street|city|forest|beach|mountain|sky)\b/.test(allText);

    const complexity = envRoles.length <= 1 ? 'simple' : envRoles.length <= 3 ? 'moderate' : 'complex';

    return {
      complexity,
      type: hasInterior && hasExterior ? 'mixed' : hasInterior ? 'interior' : hasExterior ? 'exterior' : 'abstract',
      hasArchitecture: /\b(building|architecture|city|street)\b/.test(allText),
      hasNature: /\b(tree|forest|ocean|mountain)\b/.test(allText),
      hasUrbanElements: /\b(city|urban|neon|street)\b/.test(allText),
    };
  }

  private analyzeLighting(
    prompt: string,
    spans: PromptSpan[],
    roles: string[]
  ): PromptRequirements['lighting'] {
    const lightingRoles = roles.filter((role) => role.startsWith('lighting.'));
    const allText = this.buildSearchText(prompt, spans);

    const hasDramatic = /\b(dramatic|rim|backlight|silhouette|chiaroscuro|noir|moody|contrast)\b/.test(
      allText
    );
    const hasStylized = /\b(neon|colorful|vibrant|saturated)\b/.test(allText);
    const hasPractical = /\b(neon|lamp|screen|sign|glow|light source)\b/.test(allText);
    const hasAtmospherics = /\b(fog|haze|mist|smoke|volumetric|rays)\b/.test(allText);

    return {
      requirements: hasDramatic ? 'dramatic' : hasStylized ? 'stylized' : 'natural',
      complexity:
        lightingRoles.length <= 1 ? 'simple' : lightingRoles.length <= 2 ? 'moderate' : 'complex',
      hasPracticalLights: hasPractical,
      requiresAtmospherics: hasAtmospherics,
    };
  }

  private analyzeStyle(
    prompt: string,
    spans: PromptSpan[],
    roles: string[]
  ): PromptRequirements['style'] {
    const allText = this.buildSearchText(prompt, spans);

    const isPhotorealistic = /\b(realistic|photorealistic|lifelike|real)\b/.test(allText);
    const isStylized = /\b(anime|cartoon|illustration|painted|artistic|stylized|abstract)\b/.test(
      allText
    );
    const isCinematic = /\b(cinematic|film|movie|cinema|theatrical|anamorphic|widescreen|letterbox)\b/.test(
      allText
    );

    let specificAesthetic: string | null = null;
    const aesthetics = ['anime', 'noir', 'cyberpunk', 'vintage', 'retro', 'minimalist', 'surreal', 'gothic'];
    for (const aesthetic of aesthetics) {
      if (allText.includes(aesthetic)) {
        specificAesthetic = aesthetic;
        break;
      }
    }

    return {
      isPhotorealistic: isPhotorealistic && !isStylized,
      isStylized,
      isAbstract: allText.includes('abstract'),
      requiresCinematicLook: isCinematic,
      hasSpecificAesthetic: specificAesthetic,
    };
  }

  private analyzeMotion(
    prompt: string,
    spans: PromptSpan[],
    roles: string[]
  ): PromptRequirements['motion'] {
    const cameraRoles = roles.filter((role) => role.startsWith('camera.'));
    const actionRoles = roles.filter((role) => role.startsWith('action.'));
    const allText = this.buildSearchText(prompt, spans);

    const complexCamera = /\b(tracking|dolly|crane|aerial|orbit)\b/.test(allText);
    const simpleCamera = /\b(pan|tilt|zoom)\b/.test(allText);
    const staticCamera = /\b(static|locked|still|fixed)\b/.test(allText);

    let cameraComplexity: PromptRequirements['motion']['cameraComplexity'] = 'static';
    if (complexCamera) {
      cameraComplexity = 'complex';
    } else if (simpleCamera) {
      cameraComplexity = 'simple';
    } else if (cameraRoles.length > 0 && !staticCamera) {
      cameraComplexity = 'moderate';
    }

    const subjectComplexity: PromptRequirements['motion']['subjectComplexity'] =
      actionRoles.length === 0
        ? 'static'
        : actionRoles.length <= 1
          ? 'simple'
          : actionRoles.length <= 2
            ? 'moderate'
            : 'complex';

    const hasMorphing = /\b(morph|transform|transition|become|change into)\b/.test(allText);

    return {
      cameraComplexity,
      subjectComplexity,
      hasMorphing,
      hasTransitions: hasMorphing || allText.includes('transition'),
    };
  }

  private assessEmotionalIntensity(
    emotionRoles: string[],
    allText: string
  ): PromptRequirements['character']['emotionalIntensity'] {
    if (emotionRoles.length === 0) return 'none';

    if (/\b(crying|screaming|rage|terror|ecstatic|devastated|furious)\b/.test(allText)) {
      return 'intense';
    }
    if (/\b(sad|happy|angry|scared|excited|worried|joyful)\b/.test(allText)) {
      return 'moderate';
    }
    return 'subtle';
  }

  private scoreToComplexity(
    score: number,
    max: number
  ): PromptRequirements['physics']['physicsComplexity'] {
    const ratio = score / max;
    if (ratio === 0) return 'none';
    if (ratio <= 0.25) return 'simple';
    if (ratio <= 0.5) return 'moderate';
    return 'complex';
  }

  private calculateConfidence(spans: PromptSpan[]): number {
    if (spans.length === 0) return 0.3;

    const spanConfidence = Math.min(spans.length / 10, 1);
    const avgSpanConfidence =
      spans.reduce((sum, span) => sum + (span.confidence ?? 0.5), 0) / spans.length;

    return spanConfidence * 0.4 + avgSpanConfidence * 0.6;
  }

  private buildSearchText(prompt: string, spans: PromptSpan[]): string {
    const spanText = spans.map((span) => toLower(span.text)).join(' ');
    const promptText = prompt ? toLower(prompt) : '';
    return `${promptText} ${spanText}`.trim();
  }
}
