import { VIDEO_MODELS } from '@config/modelConfig';
import type { ModelCapabilities } from '../types';
import type { VideoModelId } from '@services/video-generation/types';

export class ModelCapabilityRegistry {
  private readonly capabilities: Map<VideoModelId, ModelCapabilities> = new Map();

  constructor() {
    this.initializeCapabilities();
  }

  getCapabilities(modelId: VideoModelId): ModelCapabilities | null {
    return this.capabilities.get(modelId) ?? null;
  }

  getAllModels(): VideoModelId[] {
    return Array.from(this.capabilities.keys());
  }

  getProductionModels(): VideoModelId[] {
    return Array.from(this.capabilities.entries())
      .filter(([, cap]) => cap.qualityTier !== 'preview')
      .map(([id]) => id);
  }

  updateCapability(modelId: VideoModelId, updates: Partial<ModelCapabilities>): void {
    const existing = this.capabilities.get(modelId);
    if (!existing) return;
    this.capabilities.set(modelId, { ...existing, ...updates });
  }

  private initializeCapabilities(): void {
    this.capabilities.set(VIDEO_MODELS.SORA_2, {
      physics: 0.95,
      particleSystems: 0.9,
      fluidDynamics: 0.92,
      facialPerformance: 0.7,
      bodyLanguage: 0.75,
      characterActing: 0.68,
      cinematicLighting: 0.8,
      atmospherics: 0.85,
      environmentDetail: 0.9,
      architecturalAccuracy: 0.88,
      motionComplexity: 0.85,
      cameraControl: 0.82,
      stylization: 0.6,
      photorealism: 0.88,
      morphing: 0.5,
      transitions: 0.55,
      t2vBoost: 1,
      i2vBoost: 0.9,
      speedTier: 'slow',
      costTier: 'high',
      qualityTier: 'premium',
    });

    this.capabilities.set(VIDEO_MODELS.VEO_3, {
      physics: 0.7,
      particleSystems: 0.65,
      fluidDynamics: 0.68,
      facialPerformance: 0.75,
      bodyLanguage: 0.72,
      characterActing: 0.7,
      cinematicLighting: 0.95,
      atmospherics: 0.92,
      environmentDetail: 0.85,
      architecturalAccuracy: 0.8,
      motionComplexity: 0.75,
      cameraControl: 0.78,
      stylization: 0.8,
      photorealism: 0.85,
      morphing: 0.6,
      transitions: 0.65,
      t2vBoost: 1,
      i2vBoost: 0.95,
      speedTier: 'medium',
      costTier: 'medium',
      qualityTier: 'premium',
    });

    this.capabilities.set(VIDEO_MODELS.KLING_V2_1, {
      physics: 0.65,
      particleSystems: 0.55,
      fluidDynamics: 0.58,
      facialPerformance: 0.92,
      bodyLanguage: 0.88,
      characterActing: 0.9,
      cinematicLighting: 0.7,
      atmospherics: 0.65,
      environmentDetail: 0.7,
      architecturalAccuracy: 0.65,
      motionComplexity: 0.8,
      cameraControl: 0.75,
      stylization: 0.65,
      photorealism: 0.78,
      morphing: 0.55,
      transitions: 0.5,
      t2vBoost: 1,
      i2vBoost: 0.95,
      speedTier: 'medium',
      costTier: 'medium',
      qualityTier: 'standard',
    });

    this.capabilities.set(VIDEO_MODELS.LUMA_RAY3, {
      physics: 0.6,
      particleSystems: 0.58,
      fluidDynamics: 0.55,
      facialPerformance: 0.65,
      bodyLanguage: 0.62,
      characterActing: 0.6,
      cinematicLighting: 0.75,
      atmospherics: 0.78,
      environmentDetail: 0.7,
      architecturalAccuracy: 0.65,
      motionComplexity: 0.7,
      cameraControl: 0.72,
      stylization: 0.88,
      photorealism: 0.68,
      morphing: 0.95,
      transitions: 0.92,
      t2vBoost: 0.95,
      i2vBoost: 1.1,
      speedTier: 'fast',
      costTier: 'medium',
      qualityTier: 'standard',
    });

    this.capabilities.set(VIDEO_MODELS.DRAFT, {
      physics: 0.55,
      particleSystems: 0.5,
      fluidDynamics: 0.48,
      facialPerformance: 0.58,
      bodyLanguage: 0.55,
      characterActing: 0.52,
      cinematicLighting: 0.6,
      atmospherics: 0.58,
      environmentDetail: 0.58,
      architecturalAccuracy: 0.55,
      motionComplexity: 0.55,
      cameraControl: 0.52,
      stylization: 0.6,
      photorealism: 0.55,
      morphing: 0.5,
      transitions: 0.48,
      t2vBoost: 1,
      i2vBoost: 1,
      speedTier: 'fast',
      costTier: 'low',
      qualityTier: 'preview',
    });

    const draftI2vCaps: ModelCapabilities = {
      physics: 0.55,
      particleSystems: 0.5,
      fluidDynamics: 0.48,
      facialPerformance: 0.58,
      bodyLanguage: 0.55,
      characterActing: 0.52,
      cinematicLighting: 0.6,
      atmospherics: 0.58,
      environmentDetail: 0.58,
      architecturalAccuracy: 0.55,
      motionComplexity: 0.55,
      cameraControl: 0.52,
      stylization: 0.6,
      photorealism: 0.55,
      morphing: 0.5,
      transitions: 0.48,
      t2vBoost: 1,
      i2vBoost: 1,
      speedTier: 'fast',
      costTier: 'low',
      qualityTier: 'preview',
    };

    this.capabilities.set(VIDEO_MODELS.DRAFT_I2V, draftI2vCaps);
    this.capabilities.set(VIDEO_MODELS.DRAFT_I2V_LEGACY, draftI2vCaps);
    this.capabilities.set(VIDEO_MODELS.DRAFT_I2V_WAN_2_5, {
      ...draftI2vCaps,
    });
  }
}
