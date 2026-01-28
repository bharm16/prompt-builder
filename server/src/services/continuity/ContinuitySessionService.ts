import { logger } from '@infrastructure/Logger';
import type { AssetService } from '@services/asset/AssetService';
import type { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import type { VideoGenerationOptions } from '@services/video-generation/types';
import { STYLE_STRENGTH_PRESETS } from './StyleReferenceService';
import type {
  ContinuitySession,
  ContinuityShot,
  CreateSessionRequest,
  CreateShotRequest,
  StyleReference,
} from './types';
import { FrameBridgeService } from './FrameBridgeService';
import { StyleReferenceService } from './StyleReferenceService';
import { CharacterKeyframeService } from './CharacterKeyframeService';
import { ProviderStyleAdapter } from './ProviderStyleAdapter';
import { SeedPersistenceService } from './SeedPersistenceService';
import { StyleAnalysisService } from './StyleAnalysisService';
import { AnchorService } from './AnchorService';
import { GradingService } from './GradingService';
import { QualityGateService } from './QualityGateService';
import { SceneProxyService } from './SceneProxyService';
import { ContinuitySessionStore } from './ContinuitySessionStore';

export class ContinuitySessionService {
  private readonly log = logger.child({ service: 'ContinuitySessionService' });

  constructor(
    private anchorService: AnchorService,
    private frameBridge: FrameBridgeService,
    private styleReference: StyleReferenceService,
    private characterKeyframes: CharacterKeyframeService | null,
    private providerAdapter: ProviderStyleAdapter,
    private seedService: SeedPersistenceService,
    private styleAnalysis: StyleAnalysisService,
    private grading: GradingService,
    private qualityGate: QualityGateService,
    private sceneProxy: SceneProxyService,
    private videoGenerator: VideoGenerationService,
    private assetService: AssetService,
    private sessionStore: ContinuitySessionStore
  ) {}

  async createSession(userId: string, request: CreateSessionRequest): Promise<ContinuitySession> {
    this.log.info('Creating continuity session', { userId, name: request.name });

    let primaryStyleReference: StyleReference;

    if (request.sourceVideoId) {
      const videoUrl = await this.videoGenerator.getVideoUrl(request.sourceVideoId);
      if (!videoUrl) throw new Error('Source video not found');
      const frame = await this.frameBridge.extractRepresentativeFrame(
        userId,
        request.sourceVideoId,
        videoUrl,
        'initial'
      );
      primaryStyleReference = await this.styleReference.createFromVideo(
        request.sourceVideoId,
        frame
      );
    } else if (request.sourceImageUrl) {
      const resolution = await this.resolveImageResolution(request.sourceImageUrl);
      primaryStyleReference = await this.styleReference.createFromImage(
        request.sourceImageUrl,
        resolution
      );
    } else {
      throw new Error('Must provide sourceVideoId or sourceImageUrl');
    }

    primaryStyleReference.analysisMetadata = await this.styleAnalysis.analyzeForDisplay(
      primaryStyleReference.frameUrl
    );

    const session: ContinuitySession = {
      id: this.generateSessionId(),
      userId,
      name: request.name,
      ...(typeof request.description === 'string' ? { description: request.description } : {}),
      primaryStyleReference,
      shots: [],
      defaultSettings: { ...this.defaultSettings(), ...request.settings },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.sessionStore.save(session);

    // Optionally create initial shot
    if (request.initialPrompt) {
      const shot = await this.addShot({
        sessionId: session.id,
        prompt: request.initialPrompt,
      });
      await this.generateShot(session.id, shot.id);
    }

    return session;
  }

  async getSession(sessionId: string): Promise<ContinuitySession | null> {
    return await this.sessionStore.get(sessionId);
  }

  async getUserSessions(userId: string): Promise<ContinuitySession[]> {
    return await this.sessionStore.findByUser(userId);
  }

  async addShot(request: CreateShotRequest): Promise<ContinuityShot> {
    const session = await this.sessionStore.get(request.sessionId);
    if (!session) throw new Error(`Session not found: ${request.sessionId}`);

    const sequenceIndex = session.shots.length;
    const previousShot = session.shots[sequenceIndex - 1];

    const styleReferenceId = request.styleReferenceId || previousShot?.id || null;
    const continuityMode = request.continuityMode || session.defaultSettings.defaultContinuityMode;

    let frameBridge = previousShot?.frameBridge;
    if (!frameBridge && continuityMode === 'frame-bridge' && previousShot?.videoAssetId) {
      const videoUrl = await this.videoGenerator.getVideoUrl(previousShot.videoAssetId);
      if (videoUrl) {
        frameBridge = await this.frameBridge.extractBridgeFrame(
          session.userId,
          previousShot.videoAssetId,
          videoUrl,
          previousShot.id,
          'last'
        );
      }
    }

    const shot: ContinuityShot = {
      id: this.generateShotId(),
      sessionId: session.id,
      sequenceIndex,
      userPrompt: request.prompt,
      generationMode: request.generationMode || session.defaultSettings.generationMode,
      continuityMode,
      styleStrength: request.styleStrength ?? session.defaultSettings.defaultStyleStrength,
      styleReferenceId,
      modelId: request.modelId || session.defaultSettings.defaultModel,
      status: 'draft',
      createdAt: new Date(),
      ...(frameBridge ? { frameBridge } : {}),
      ...(request.characterAssetId ? { characterAssetId: request.characterAssetId } : {}),
      ...(request.camera ? { camera: request.camera } : {}),
    };

    session.shots.push(shot);
    session.updatedAt = new Date();
    await this.sessionStore.save(session);

    return shot;
  }

  async generateShot(sessionId: string, shotId: string): Promise<ContinuityShot> {
    const session = await this.sessionStore.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    const shot = session.shots.find((s) => s.id === shotId);
    if (!shot) throw new Error(`Shot not found: ${shotId}`);

    const provider = this.providerAdapter.getProviderFromModel(shot.modelId);
    const previousShot = session.shots.find((s) => s.sequenceIndex === shot.sequenceIndex - 1);

    const generationMode = shot.generationMode || session.defaultSettings.generationMode;
    if (generationMode === 'continuity') {
      this.anchorService.assertProviderSupportsContinuity(provider, shot.modelId);
    } else {
      shot.continuityMode = 'none';
    }

    const maxRetries = session.defaultSettings.maxRetries ?? 1;
    let attempt = 0;
    let finalResult: ContinuityShot | null = null;

    while (attempt <= maxRetries) {
      attempt += 1;
      shot.retryCount = attempt - 1;

      try {
        let startImageUrl: string | undefined;
        let continuityMechanismUsed: ContinuityShot['continuityMechanismUsed'] = 'none';

        const inheritedSeed = this.seedService.getInheritedSeed(previousShot?.seedInfo, provider);
        if (inheritedSeed !== undefined) {
          shot.inheritedSeed = inheritedSeed;
        }

        const strategy = this.providerAdapter.getContinuityStrategy(provider, shot.continuityMode, shot.modelId);

        if (generationMode === 'standard') {
          continuityMechanismUsed = 'none';
        } else if (this.anchorService.shouldUseSceneProxy(session, shot) && session.sceneProxy) {
          const render = await this.sceneProxy.renderFromProxy(
            session.userId,
            session.sceneProxy,
            shot.id,
            shot.camera
          );
          startImageUrl = render.renderUrl;
          shot.sceneProxyRenderUrl = render.renderUrl;
          continuityMechanismUsed = 'scene-proxy';
        } else if (strategy.type === 'native-style-ref') {
          continuityMechanismUsed = 'native-style-ref';
        } else if (strategy.type === 'frame-bridge' && shot.frameBridge) {
          startImageUrl = shot.frameBridge.frameUrl;
          continuityMechanismUsed = 'frame-bridge';
        } else if (strategy.type === 'ip-adapter') {
          shot.status = 'generating-keyframe';
          await this.sessionStore.save(session);

          const styleRef = this.resolveStyleReference(session, shot);
          shot.styleReference = styleRef;

          if (shot.characterAssetId || session.defaultSettings.useCharacterConsistency) {
            if (!this.characterKeyframes) {
              throw new Error('PuLID keyframe generation is not available. Configure FAL_KEY/FAL_API_KEY to enable character consistency.');
            }
            const characterAssetId = shot.characterAssetId
              || (session.defaultSettings.useCharacterConsistency ? this.resolveCharacterFromSession(session) : undefined);
            if (!characterAssetId) {
              throw new Error('Character consistency requested but no characterAssetId provided');
            }
            startImageUrl = await this.characterKeyframes.generateKeyframe({
              userId: session.userId,
              prompt: shot.userPrompt,
              characterAssetId,
              aspectRatio: styleRef.aspectRatio as any,
            });
            continuityMechanismUsed = 'pulid-keyframe';
          } else {
            try {
              startImageUrl = await this.styleReference.generateStyledKeyframe({
                userId: session.userId,
                prompt: shot.userPrompt,
                styleReferenceUrl: styleRef.frameUrl,
                strength: shot.styleStrength,
                aspectRatio: styleRef.aspectRatio as any,
              });
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unknown error';
              throw new Error(`Style keyframe generation failed: ${message}`);
            }
            continuityMechanismUsed = 'ip-adapter';
          }

          shot.generatedKeyframeUrl = startImageUrl;
        } else if (inheritedSeed) {
          continuityMechanismUsed = 'seed-only';
        }

        if (generationMode === 'continuity' && !startImageUrl && strategy.type !== 'native-style-ref') {
          throw new Error('Continuity mode requires a visual anchor (startImage or native style reference).');
        }

        let generationOptions: Record<string, unknown> = {
          model: shot.modelId,
          startImage: startImageUrl,
        };

        if (shot.characterAssetId && generationMode === 'standard') {
          generationOptions = {
            ...generationOptions,
            characterAssetId: shot.characterAssetId,
            autoKeyframe: true,
          };
        } else if (shot.characterAssetId) {
          generationOptions = {
            ...generationOptions,
            characterAssetId: shot.characterAssetId,
            autoKeyframe: false,
          };
        }

        const seedParams = this.seedService.buildSeedParam(provider, inheritedSeed);
        generationOptions = { ...generationOptions, ...seedParams };

        if (strategy.type === 'native-style-ref') {
          const styleRef = this.resolveStyleReference(session, shot);
          shot.styleReference = styleRef;
          const { options } = await this.providerAdapter.buildGenerationOptions(
            provider,
            generationOptions,
            styleRef,
            shot.styleStrength
          );
          generationOptions = options;
        }

        shot.status = 'generating-video';
        await this.sessionStore.save(session);

        const result = await this.videoGenerator.generateVideo(
          shot.userPrompt,
          generationOptions as VideoGenerationOptions
        );

        const seedInfo = this.seedService.extractSeed(provider, shot.modelId, result);
        if (seedInfo) {
          shot.seedInfo = seedInfo;
        }

        // Post-grade
        if (generationMode === 'continuity') {
          const styleRef = this.resolveStyleReference(session, shot);
          shot.styleReference = styleRef;
          const graded = await this.grading.matchPalette(result.assetId, styleRef.frameUrl);
          if (graded.applied && graded.assetId) {
            shot.videoAssetId = graded.assetId;
          } else {
            shot.videoAssetId = result.assetId;
          }

          // Quality gate
          const quality = await this.qualityGate.evaluate({
            userId: session.userId,
            referenceImageUrl: styleRef.frameUrl,
            generatedVideoUrl: graded.videoUrl || result.videoUrl,
            ...(shot.characterAssetId
              ? {
                  characterReferenceUrl: await this.getCharacterReferenceUrl(
                    session.userId,
                    shot.characterAssetId
                  ),
                }
              : {}),
            ...(session.defaultSettings.qualityThresholds?.style !== undefined
              ? { styleThreshold: session.defaultSettings.qualityThresholds.style }
              : {}),
            ...(session.defaultSettings.qualityThresholds?.identity !== undefined
              ? { identityThreshold: session.defaultSettings.qualityThresholds.identity }
              : {}),
          });
          if (quality.styleScore !== undefined) {
            shot.styleScore = quality.styleScore;
          }
          if (quality.identityScore !== undefined) {
            shot.identityScore = quality.identityScore;
          }
          shot.qualityScore = quality.passed ? 1 : 0;

          if (!quality.passed && session.defaultSettings.autoRetryOnFailure && attempt <= maxRetries) {
            // Adjust style strength and retry
            shot.styleStrength = Math.min(0.95, shot.styleStrength + 0.1);
            this.log.warn('Quality gate failed, retrying', {
              shotId,
              attempt,
              styleScore: quality.styleScore,
              identityScore: quality.identityScore,
            });
            continue;
          }
        } else {
          shot.videoAssetId = result.assetId;
        }

        shot.continuityMechanismUsed = continuityMechanismUsed;
        shot.status = 'completed';
        shot.generatedAt = new Date();

        if (session.defaultSettings.autoExtractFrameBridge && shot.videoAssetId) {
          const videoUrl = await this.videoGenerator.getVideoUrl(shot.videoAssetId);
          if (videoUrl) {
            try {
              const bridge = await this.frameBridge.extractBridgeFrame(
                session.userId,
                shot.videoAssetId,
                videoUrl,
                shot.id,
                'last'
              );
              shot.frameBridge = bridge;

              const representative = await this.frameBridge.extractRepresentativeFrame(
                session.userId,
                shot.videoAssetId,
                videoUrl,
                shot.id
              );
              shot.styleReference = await this.styleReference.createFromVideo(
                shot.videoAssetId,
                representative
              );
            } catch (error) {
              this.log.warn('Post-generation frame extraction failed', {
                shotId,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }

        finalResult = shot;
        break;
      } catch (error) {
        shot.status = 'failed';
        shot.error = error instanceof Error ? error.message : 'Generation failed';
        const err = error instanceof Error ? error : new Error(shot.error);
        this.log.error('Shot generation failed', err, { shotId });
        finalResult = shot;
        break;
      }
    }

    session.updatedAt = new Date();
    await this.sessionStore.save(session);
    return finalResult || shot;
  }

  async updateShotStyleReference(sessionId: string, shotId: string, styleReferenceId: string): Promise<ContinuityShot> {
    const session = await this.sessionStore.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    const shot = session.shots.find((s) => s.id === shotId);
    if (!shot) throw new Error(`Shot not found: ${shotId}`);

    shot.styleReferenceId = styleReferenceId;
    session.updatedAt = new Date();
    await this.sessionStore.save(session);
    return shot;
  }

  async updatePrimaryStyleReference(
    sessionId: string,
    sourceVideoId?: string,
    sourceImageUrl?: string
  ): Promise<ContinuitySession> {
    const session = await this.sessionStore.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    if (sourceVideoId) {
      const videoUrl = await this.videoGenerator.getVideoUrl(sourceVideoId);
      if (!videoUrl) throw new Error('Source video not found');
      const frame = await this.frameBridge.extractRepresentativeFrame(
        session.userId,
        sourceVideoId,
        videoUrl,
        'updated'
      );
      session.primaryStyleReference = await this.styleReference.createFromVideo(sourceVideoId, frame);
    } else if (sourceImageUrl) {
      const resolution = await this.resolveImageResolution(sourceImageUrl);
      session.primaryStyleReference = await this.styleReference.createFromImage(sourceImageUrl, resolution);
    }

    session.primaryStyleReference.analysisMetadata = await this.styleAnalysis.analyzeForDisplay(
      session.primaryStyleReference.frameUrl
    );

    session.updatedAt = new Date();
    await this.sessionStore.save(session);
    return session;
  }

  async createSceneProxy(sessionId: string, sourceShotId?: string, sourceVideoId?: string): Promise<ContinuitySession> {
    const session = await this.sessionStore.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    let videoId: string | undefined;
    let videoUrl: string | null | undefined;

    if (sourceShotId) {
      const shot = session.shots.find((s) => s.id === sourceShotId);
      if (!shot?.videoAssetId) throw new Error('Shot has no video asset');
      videoId = shot.videoAssetId;
      videoUrl = await this.videoGenerator.getVideoUrl(shot.videoAssetId);
    } else if (sourceVideoId) {
      videoId = sourceVideoId;
      videoUrl = await this.videoGenerator.getVideoUrl(sourceVideoId);
    }

    if (!videoId || !videoUrl) throw new Error('Source video not found for proxy');

    const proxy = await this.sceneProxy.createProxyFromVideo(session.userId, videoId, videoUrl);
    session.sceneProxy = proxy;
    session.updatedAt = new Date();
    await this.sessionStore.save(session);
    return session;
  }

  private resolveStyleReference(session: ContinuitySession, shot: ContinuityShot): StyleReference {
    if (!shot.styleReferenceId) {
      return session.primaryStyleReference;
    }

    const refShot = session.shots.find((s) => s.id === shot.styleReferenceId);
    if (!refShot?.styleReference) {
      return session.primaryStyleReference;
    }

    return refShot.styleReference;
  }

  private async resolveImageResolution(imageUrl: string): Promise<{ width: number; height: number }> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return { width: 1920, height: 1080 };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const metadata = await (await import('sharp')).default(buffer).metadata();
    return { width: metadata.width || 1920, height: metadata.height || 1080 };
  }

  private async getCharacterReferenceUrl(userId: string, assetId: string): Promise<string> {
    const character = await this.assetService.getAssetForGeneration(userId, assetId);
    if (!character.primaryImageUrl) {
      throw new Error('Character has no primary reference image');
    }
    return character.primaryImageUrl;
  }

  private resolveCharacterFromSession(session: ContinuitySession): string | undefined {
    for (let i = session.shots.length - 1; i >= 0; i -= 1) {
      const candidate = session.shots[i]?.characterAssetId;
      if (candidate) return candidate;
    }
    return undefined;
  }

  private defaultSettings() {
    return {
      generationMode: 'continuity' as const,
      defaultContinuityMode: 'frame-bridge' as const,
      defaultStyleStrength: STYLE_STRENGTH_PRESETS.balanced,
      defaultModel: 'google/veo-3' as any,
      autoExtractFrameBridge: true,
      useCharacterConsistency: false,
      useSceneProxy: false,
      autoRetryOnFailure: true,
      maxRetries: 1,
      qualityThresholds: { style: 0.75, identity: 0.6 },
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateShotId(): string {
    return `shot_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
