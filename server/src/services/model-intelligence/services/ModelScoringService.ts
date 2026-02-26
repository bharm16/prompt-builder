import type { ModelCapabilities, ModelScore, PromptRequirements, FactorScore } from '../types';

interface ScoringWeight {
  factor: keyof ModelCapabilities;
  label: string;
  weight: number;
  explanation: (req: PromptRequirements) => string;
}

const MODE_BOOST_DEFAULT = 1;

export class ModelScoringService {
  scoreModel(
    modelId: ModelScore['modelId'],
    capabilities: ModelCapabilities,
    requirements: PromptRequirements,
    mode: 't2v' | 'i2v'
  ): ModelScore {
    const weights = this.calculateWeights(requirements);
    const modeBoost = this.getModeBoost(capabilities, mode);
    const factorScores = this.calculateFactorScores(capabilities, weights, requirements, modeBoost);
    const overallScore = this.calculateOverallScore(factorScores);
    const { strengths, weaknesses, warnings } = this.analyzeStrengthsWeaknesses(
      capabilities,
      requirements,
      factorScores
    );

    return {
      modelId,
      overallScore,
      factorScores,
      strengths,
      weaknesses,
      warnings,
    };
  }

  private calculateWeights(requirements: PromptRequirements): ScoringWeight[] {
    const weights: ScoringWeight[] = [];

    if (requirements.physics.hasComplexPhysics) {
      weights.push({
        factor: 'physics',
        label: 'Complex Physics',
        weight: 2,
        explanation: () => 'Prompt requires accurate physics simulation',
      });
    }

    if (requirements.physics.hasParticleSystems) {
      weights.push({
        factor: 'particleSystems',
        label: 'Particle Effects',
        weight: 1.5,
        explanation: () => 'Particle effects such as rain, smoke, or sparks are present',
      });
    }

    if (requirements.physics.hasFluidDynamics) {
      weights.push({
        factor: 'fluidDynamics',
        label: 'Fluid Dynamics',
        weight: 1.8,
        explanation: () => 'Water or fluid simulation is needed',
      });
    }

    if (requirements.character.requiresFacialPerformance) {
      weights.push({
        factor: 'facialPerformance',
        label: 'Facial Performance',
        weight: 2,
        explanation: () => 'Human emotion or facial performance is required',
      });
    }

    if (requirements.character.requiresBodyLanguage) {
      weights.push({
        factor: 'bodyLanguage',
        label: 'Body Language',
        weight: 1.3,
        explanation: () => 'Character movement and gesture are important',
      });
    }

    if (requirements.character.emotionalIntensity === 'intense') {
      weights.push({
        factor: 'characterActing',
        label: 'Character Acting',
        weight: 1.8,
        explanation: () => 'Intense emotional performance is required',
      });
    }

    if (requirements.lighting.requirements === 'dramatic') {
      weights.push({
        factor: 'cinematicLighting',
        label: 'Cinematic Lighting',
        weight: 1.6,
        explanation: () => 'Dramatic or cinematic lighting is specified',
      });
    }

    if (requirements.lighting.requiresAtmospherics) {
      weights.push({
        factor: 'atmospherics',
        label: 'Atmospheric Effects',
        weight: 1.4,
        explanation: () => 'Fog, haze, or volumetric effects are required',
      });
    }

    if (requirements.environment.complexity === 'complex') {
      weights.push({
        factor: 'environmentDetail',
        label: 'Environment Detail',
        weight: 1.5,
        explanation: () => 'The environment contains many details',
      });
    }

    if (requirements.environment.hasArchitecture) {
      weights.push({
        factor: 'architecturalAccuracy',
        label: 'Architectural Detail',
        weight: 1.2,
        explanation: () => 'Architectural elements or buildings are present',
      });
    }

    if (requirements.style.requiresCinematicLook) {
      weights.push({
        factor: 'cinematicLighting',
        label: 'Cinematic Look',
        weight: 1.4,
        explanation: () => 'A cinematic look is requested',
      });
    }

    if (requirements.style.isStylized) {
      weights.push({
        factor: 'stylization',
        label: 'Stylization',
        weight: 1.5,
        explanation: () => 'Stylized or non-photorealistic look requested',
      });
    }

    if (requirements.style.isPhotorealistic) {
      weights.push({
        factor: 'photorealism',
        label: 'Photorealism',
        weight: 1.5,
        explanation: () => 'Photorealistic output requested',
      });
    }

    if (requirements.motion.cameraComplexity === 'complex') {
      weights.push({
        factor: 'cameraControl',
        label: 'Camera Control',
        weight: 1.3,
        explanation: () => 'Complex camera movement is specified',
      });
    }

    if (requirements.motion.subjectComplexity === 'complex') {
      weights.push({
        factor: 'motionComplexity',
        label: 'Subject Motion',
        weight: 1.2,
        explanation: () => 'Subject motion is complex',
      });
    }

    if (requirements.motion.hasMorphing) {
      weights.push({
        factor: 'morphing',
        label: 'Morphing',
        weight: 2,
        explanation: () => 'Morphing or transformation effects are required',
      });
    }

    if (weights.length === 0) {
      weights.push(
        {
          factor: 'photorealism',
          label: 'General Quality',
          weight: 1,
          explanation: () => 'Overall video quality',
        },
        {
          factor: 'motionComplexity',
          label: 'Motion Quality',
          weight: 1,
          explanation: () => 'Smooth motion rendering',
        }
      );
    }

    return weights;
  }

  private calculateFactorScores(
    capabilities: ModelCapabilities,
    weights: ScoringWeight[],
    requirements: PromptRequirements,
    modeBoost: number
  ): FactorScore[] {
    return weights.map((weight) => {
      const capabilityValue = Number(capabilities[weight.factor]) * modeBoost;
      return {
        factor: weight.factor,
        label: weight.label,
        weight: weight.weight,
        capability: capabilityValue,
        contribution: capabilityValue * weight.weight,
        explanation: weight.explanation(requirements),
      };
    });
  }

  private calculateOverallScore(factorScores: FactorScore[]): number {
    if (factorScores.length === 0) return 50;

    const totalContribution = factorScores.reduce((sum, score) => sum + score.contribution, 0);
    const totalWeight = factorScores.reduce((sum, score) => sum + score.weight, 0);

    if (totalWeight === 0) return 50;

    return Math.round((totalContribution / totalWeight) * 100);
  }

  private analyzeStrengthsWeaknesses(
    capabilities: ModelCapabilities,
    requirements: PromptRequirements,
    factorScores: FactorScore[]
  ): { strengths: string[]; weaknesses: string[]; warnings: string[] } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const warnings: string[] = [];

    for (const factor of factorScores) {
      if (factor.capability >= 0.85) {
        strengths.push(`${factor.label}: ${factor.explanation}`);
      } else if (factor.capability < 0.6 && factor.weight >= 1.5) {
        weaknesses.push(`${factor.label}: May struggle with this requirement`);
      }
    }

    if (requirements.physics.hasComplexPhysics && capabilities.physics < 0.7) {
      warnings.push('Physics simulation may be inconsistent');
    }

    if (requirements.character.requiresFacialPerformance && capabilities.facialPerformance < 0.7) {
      warnings.push('Facial expressions may lack subtlety');
    }

    if (requirements.motion.hasMorphing && capabilities.morphing < 0.6) {
      warnings.push('Morphing effects may not render smoothly');
    }

    return { strengths, weaknesses, warnings };
  }

  private getModeBoost(capabilities: ModelCapabilities, mode: 't2v' | 'i2v'): number {
    if (mode === 'i2v') return capabilities.i2vBoost ?? MODE_BOOST_DEFAULT;
    return capabilities.t2vBoost ?? MODE_BOOST_DEFAULT;
  }
}
