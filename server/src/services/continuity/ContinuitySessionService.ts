import { logger } from '@infrastructure/Logger';
import type { AssetService } from '@services/asset/AssetService';
import type { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import type { VideoGenerationOptions } from '@services/video-generation/types';
import { VIDEO_MODELS } from '@config/modelConfig';
import { STYLE_STRENGTH_PRESETS } from './StyleReferenceService';
import type {
  ContinuitySession,
  ContinuityShot,
  ContinuityMode,
  ContinuitySessionSettings,
  CreateSessionRequest,
  CreateShotRequest,
  StyleReference,
  ProviderContinuityCapabilities,
  ContinuityStrategy,
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
import { ContinuitySessionStore, ContinuitySessionVersionMismatchError } from './ContinuitySessionStore';

const DEFAULT_FACE_STRENGTH = 0.8;
const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4'] as const;
type AspectRatio = typeof ASPECT_RATIOS[number];

type ContinuityMechanismContext = {
  session: ContinuitySession;
  shot: ContinuityShot;
  previousShot?: ContinuityShot;
  provider: string;
  providerCaps: ProviderContinuityCapabilities;
  strategy: ContinuityStrategy;
  isContinuity: boolean;
  modeForStrategy: ContinuityMode;
  supportsSeedPersistence: boolean;
  inheritedSeed?: number;
  requiresCharacter: boolean;
};

type ContinuityMechanismResult = {
  startImageUrl?: string;
  continuityMechanismUsed: ContinuityShot['continuityMechanismUsed'];
};

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
      const refreshed = await this.sessionStore.get(session.id);
      if (refreshed) {
        return refreshed;
      }
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

    const styleReferenceId =
      request.styleReferenceId !== undefined
        ? request.styleReferenceId
        : previousShot?.id || null;
    const continuityMode = request.continuityMode || session.defaultSettings.defaultContinuityMode;
    const generationMode = request.generationMode || session.defaultSettings.generationMode;
    const modelId = request.modelId || session.defaultSettings.defaultModel;

    if (generationMode === 'continuity') {
      const provider = this.providerAdapter.getProviderFromModel(modelId);
      const caps = this.providerAdapter.getCapabilities(provider, modelId);
      if (!caps.supportsStartImage && !caps.supportsNativeStyleReference) {
        throw new Error(
          `Model ${modelId} does not support continuity (no image input or style reference). Switch to an eligible model.`
        );
      }
    }

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
      generationMode,
      continuityMode,
      styleStrength: request.styleStrength ?? session.defaultSettings.defaultStyleStrength,
      styleReferenceId,
      modelId,
      status: 'draft',
      createdAt: new Date(),
      ...(frameBridge ? { frameBridge } : {}),
      ...(request.characterAssetId ? { characterAssetId: request.characterAssetId } : {}),
      ...(request.faceStrength !== undefined ? { faceStrength: request.faceStrength } : {}),
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
    const providerCaps = this.providerAdapter.getCapabilities(provider, shot.modelId);

    const generationMode = shot.generationMode || session.defaultSettings.generationMode;
    const isContinuity = generationMode === 'continuity';
    const effectiveContinuityMode = isContinuity
      ? shot.continuityMode
      : shot.continuityMode === 'frame-bridge'
        ? 'frame-bridge'
        : 'none';

    if (isContinuity) {
      this.anchorService.assertProviderSupportsContinuity(provider, shot.modelId);
    }

    if (effectiveContinuityMode === 'frame-bridge' && !shot.frameBridge && previousShot?.videoAssetId) {
      const videoUrl = await this.videoGenerator.getVideoUrl(previousShot.videoAssetId);
      if (videoUrl) {
        try {
          shot.frameBridge = await this.frameBridge.extractBridgeFrame(
            session.userId,
            previousShot.videoAssetId,
            videoUrl,
            previousShot.id,
            'last'
          );
        } catch (error) {
          this.log.warn('Failed to extract frame bridge on-demand', {
            shotId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const resolvedContinuityMode = isContinuity
      ? this.resolveContinuityMode(
          effectiveContinuityMode,
          providerCaps,
          Boolean(shot.frameBridge)
        )
      : effectiveContinuityMode;


    const maxRetries = session.defaultSettings.maxRetries ?? 1;
    let attempt = 0;
    let finalResult: ContinuityShot | null = null;

    while (attempt <= maxRetries) {
      attempt += 1;
      shot.retryCount = attempt - 1;

      try {
        if (isContinuity && resolvedContinuityMode === 'none') {
          throw new Error('Continuity mode requires a visual anchor, but the selected provider cannot accept image inputs or style references. Switch to an eligible provider.');
        }

        shot.styleDegraded = false;
        delete shot.styleDegradedReason;
        shot.styleTransferApplied = false;

        const supportsSeedPersistence = providerCaps.supportsSeedPersistence;
        const inheritedSeed = supportsSeedPersistence
          ? this.seedService.getInheritedSeed(previousShot?.seedInfo, provider)
          : undefined;
        if (inheritedSeed !== undefined) {
          shot.inheritedSeed = inheritedSeed;
        }

        const requiresCharacter = this.requiresCharacterConsistency(shot, session);
        const modeForStrategy = isContinuity ? resolvedContinuityMode : effectiveContinuityMode;
        const strategy = this.providerAdapter.getContinuityStrategy(provider, modeForStrategy, shot.modelId);

        const mechanism = await this.resolveContinuityMechanism({
          session,
          shot,
          previousShot,
          provider,
          providerCaps,
          strategy,
          isContinuity,
          modeForStrategy,
          supportsSeedPersistence,
          inheritedSeed,
          requiresCharacter,
        });

        const startImageUrl = mechanism.startImageUrl;
        const continuityMechanismUsed = mechanism.continuityMechanismUsed;

        if (
          isContinuity &&
          !startImageUrl &&
          strategy.type !== 'native-style-ref'
        ) {
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

        const seedParams = supportsSeedPersistence
          ? this.seedService.buildSeedParam(provider, inheritedSeed)
          : {};
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

        if (supportsSeedPersistence) {
          const seedInfo = this.seedService.extractSeed(provider, shot.modelId, result);
          if (seedInfo) {
            shot.seedInfo = seedInfo;
          }
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

          const styleThreshold = session.defaultSettings.qualityThresholds?.style ?? 0.75;
          const identityThreshold = session.defaultSettings.qualityThresholds?.identity ?? 0.6;

          if (!quality.passed && session.defaultSettings.autoRetryOnFailure && attempt <= maxRetries) {
            const adjusted = this.adjustForQualityGate(shot, quality, {
              styleThreshold,
              identityThreshold,
            });

            if (adjusted) {
              this.log.warn('Quality gate failed, retrying', {
                shotId,
                attempt,
                styleScore: quality.styleScore,
                identityScore: quality.identityScore,
                nextStyleStrength: shot.styleStrength,
                nextFaceStrength: shot.faceStrength,
              });
              continue;
            }
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

    // Ensure shot has a terminal status if the loop ended without break
    if (!finalResult) {
      shot.status = shot.videoAssetId ? 'completed' : 'failed';
      if (!shot.videoAssetId && !shot.error) {
        shot.error = 'Quality gate not passed after maximum retries';
      }
      shot.generatedAt = new Date();
      finalResult = shot;
    }

    await this.persistShotResult(sessionId, shotId, finalResult, session);
    return finalResult;
  }

  async updateShotStyleReference(sessionId: string, shotId: string, styleReferenceId: string | null): Promise<ContinuityShot> {
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

  async updateSessionSettings(
    sessionId: string,
    settings: Partial<ContinuitySessionSettings>
  ): Promise<ContinuitySession> {
    const session = await this.sessionStore.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const allowedKeys: Array<keyof ContinuitySessionSettings> = [
      'generationMode',
      'defaultContinuityMode',
      'defaultStyleStrength',
      'defaultModel',
      'autoExtractFrameBridge',
      'useCharacterConsistency',
      'useSceneProxy',
      'autoRetryOnFailure',
      'maxRetries',
      'qualityThresholds',
    ];

    const sanitized: Partial<ContinuitySessionSettings> = {};
    for (const key of allowedKeys) {
      if (settings[key] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic key iteration requires widening
        (sanitized as Record<string, any>)[key] = settings[key];
      }
    }

    session.defaultSettings = {
      ...session.defaultSettings,
      ...sanitized,
    };

    session.updatedAt = new Date();
    await this.sessionStore.save(session);
    return session;
  }

  private async resolveContinuityMechanism(
    context: ContinuityMechanismContext
  ): Promise<ContinuityMechanismResult> {
    const chain: Array<
      (ctx: ContinuityMechanismContext) => Promise<ContinuityMechanismResult | null>
    > = context.isContinuity
      ? [
          this.applySceneProxyMechanism.bind(this),
          this.applyNativeStyleReferenceMechanism.bind(this),
          this.applyFrameBridgeMechanism.bind(this),
          this.applyIpAdapterMechanism.bind(this),
        ]
      : [
          this.applyStandardFrameBridgeMechanism.bind(this),
          this.applySeedOnlyMechanism.bind(this),
        ];

    for (const handler of chain) {
      const result = await handler(context);
      if (result) {
        return result;
      }
    }

    return { continuityMechanismUsed: 'none' };
  }

  private async persistShotResult(
    sessionId: string,
    shotId: string,
    result: ContinuityShot,
    fallbackSession: ContinuitySession
  ): Promise<void> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const freshSession = await this.sessionStore.get(sessionId);
      if (!freshSession) {
        fallbackSession.updatedAt = new Date();
        await this.sessionStore.save(fallbackSession);
        return;
      }

      const shotIndex = freshSession.shots.findIndex((s) => s.id === shotId);
      if (shotIndex >= 0) {
        freshSession.shots[shotIndex] = result;
      } else {
        freshSession.shots.push(result);
      }

      freshSession.updatedAt = new Date();

      try {
        if (typeof freshSession.version === 'number') {
          const newVersion = await this.sessionStore.saveWithVersion(
            freshSession,
            freshSession.version
          );
          freshSession.version = newVersion;
        } else {
          await this.sessionStore.save(freshSession);
        }
        return;
      } catch (error) {
        if (error instanceof ContinuitySessionVersionMismatchError && attempt < maxAttempts) {
          this.log.warn('Continuity session version conflict, retrying save', {
            sessionId,
            shotId,
            attempt,
            expectedVersion: error.expectedVersion,
            actualVersion: error.actualVersion,
          });
          continue;
        }
        this.log.error('Failed to persist continuity shot update', error as Error, {
          sessionId,
          shotId,
        });
        throw error;
      }
    }
  }

  private async applySceneProxyMechanism(
    context: ContinuityMechanismContext
  ): Promise<ContinuityMechanismResult | null> {
    if (!context.isContinuity) return null;
    if (!context.session.sceneProxy) return null;
    if (!this.anchorService.shouldUseSceneProxy(context.session, context.shot, context.modeForStrategy)) {
      return null;
    }

    const render = await this.sceneProxy.renderFromProxy(
      context.session.userId,
      context.session.sceneProxy,
      context.shot.id,
      context.shot.camera
    );
    context.shot.sceneProxyRenderUrl = render.renderUrl;
    return {
      startImageUrl: render.renderUrl,
      continuityMechanismUsed: 'scene-proxy',
    };
  }

  private async applyNativeStyleReferenceMechanism(
    context: ContinuityMechanismContext
  ): Promise<ContinuityMechanismResult | null> {
    if (!context.isContinuity) return null;
    if (context.strategy.type !== 'native-style-ref') return null;
    return { continuityMechanismUsed: 'native-style-ref' };
  }

  private async applyFrameBridgeMechanism(
    context: ContinuityMechanismContext
  ): Promise<ContinuityMechanismResult | null> {
    if (!context.isContinuity) return null;
    if (context.strategy.type !== 'frame-bridge') return null;
    if (!context.shot.frameBridge) return null;
    return {
      startImageUrl: context.shot.frameBridge.frameUrl,
      continuityMechanismUsed: 'frame-bridge',
    };
  }

  private async applyStandardFrameBridgeMechanism(
    context: ContinuityMechanismContext
  ): Promise<ContinuityMechanismResult | null> {
    if (context.isContinuity) return null;
    if (context.strategy.type !== 'frame-bridge') return null;
    if (!context.shot.frameBridge) return null;
    return {
      startImageUrl: context.shot.frameBridge.frameUrl,
      continuityMechanismUsed: 'frame-bridge',
    };
  }

  private async applySeedOnlyMechanism(
    context: ContinuityMechanismContext
  ): Promise<ContinuityMechanismResult | null> {
    if (context.isContinuity) return null;
    if (!context.supportsSeedPersistence) return null;
    if (context.inheritedSeed === undefined) return null;
    return { continuityMechanismUsed: 'seed-only' };
  }

  private async applyIpAdapterMechanism(
    context: ContinuityMechanismContext
  ): Promise<ContinuityMechanismResult | null> {
    if (!context.isContinuity) return null;
    if (context.strategy.type !== 'ip-adapter') return null;

    context.shot.status = 'generating-keyframe';
    await this.sessionStore.save(context.session);

    const styleRef = this.resolveStyleReference(context.session, context.shot);
    context.shot.styleReference = styleRef;

    let startImageUrl: string | undefined;
    let continuityMechanismUsed: ContinuityShot['continuityMechanismUsed'] = 'ip-adapter';

    if (context.requiresCharacter) {
      if (!this.characterKeyframes) {
        throw new Error(
          'PuLID keyframe generation is not available. Configure FAL_KEY/FAL_API_KEY to enable character consistency.'
        );
      }
      const characterAssetId =
        context.shot.characterAssetId ||
        (context.session.defaultSettings.useCharacterConsistency
          ? this.resolveCharacterFromSession(context.session)
          : undefined);
      if (!characterAssetId) {
        throw new Error('Character consistency requested but no characterAssetId provided');
      }
      const faceStrength = context.shot.faceStrength ?? DEFAULT_FACE_STRENGTH;
      const aspectRatio = this.coerceAspectRatio(styleRef.aspectRatio);
      startImageUrl = await this.characterKeyframes.generateKeyframe({
        userId: context.session.userId,
        prompt: context.shot.userPrompt,
        characterAssetId,
        ...(aspectRatio ? { aspectRatio } : {}),
        faceStrength,
      });
      context.shot.faceStrength = faceStrength;
      continuityMechanismUsed = 'pulid-keyframe';

      if (context.modeForStrategy === 'style-match') {
        const transfer = await this.grading.matchImagePalette(
          context.session.userId,
          startImageUrl,
          styleRef.frameUrl
        );
        if (transfer.applied && transfer.imageUrl) {
          startImageUrl = transfer.imageUrl;
          context.shot.styleTransferApplied = true;
        } else {
          context.shot.styleDegraded = true;
          context.shot.styleDegradedReason = 'style-transfer-unavailable';
        }
      }
    } else {
      try {
        const aspectRatio = this.coerceAspectRatio(styleRef.aspectRatio);
        startImageUrl = await this.styleReference.generateStyledKeyframe({
          userId: context.session.userId,
          prompt: context.shot.userPrompt,
          styleReferenceUrl: styleRef.frameUrl,
          strength: context.shot.styleStrength,
          ...(aspectRatio ? { aspectRatio } : {}),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Style keyframe generation failed (IP-Adapter). ${message}`);
      }
      continuityMechanismUsed = 'ip-adapter';
    }

    context.shot.generatedKeyframeUrl = startImageUrl;

    return { startImageUrl, continuityMechanismUsed };
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
    if (proxy.status === 'ready') {
      session.defaultSettings.useSceneProxy = true;
    }
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

  private resolveContinuityMode(
    requested: ContinuityMode,
    capabilities: { supportsStartImage: boolean; supportsNativeStyleReference: boolean },
    hasFrameBridge: boolean
  ): ContinuityMode {
    let mode: ContinuityMode = requested;

    if (!capabilities.supportsStartImage && !capabilities.supportsNativeStyleReference) {
      return 'none';
    }

    if (requested === 'frame-bridge') {
      if (!hasFrameBridge || !capabilities.supportsStartImage) {
        mode = capabilities.supportsNativeStyleReference ? 'native' : 'style-match';
      }
    } else if (requested === 'native') {
      if (!capabilities.supportsNativeStyleReference) {
        mode = capabilities.supportsStartImage ? 'style-match' : 'none';
      }
    } else if (requested === 'style-match') {
      if (capabilities.supportsNativeStyleReference) {
        mode = 'native';
      } else if (!capabilities.supportsStartImage) {
        mode = 'none';
      }
    }

    if (mode === 'style-match' && !capabilities.supportsStartImage && !capabilities.supportsNativeStyleReference) {
      return 'none';
    }

    return mode;
  }

  private requiresCharacterConsistency(shot: ContinuityShot, session: ContinuitySession): boolean {
    return Boolean(shot.characterAssetId || session.defaultSettings.useCharacterConsistency);
  }

  private adjustForQualityGate(
    shot: ContinuityShot,
    quality: { styleScore?: number; identityScore?: number; passed: boolean },
    thresholds: { styleThreshold: number; identityThreshold: number }
  ): boolean {
    const { styleThreshold, identityThreshold } = thresholds;
    const hasStyle = typeof quality.styleScore === 'number';
    const hasIdentity = typeof quality.identityScore === 'number';

    const needsIdentity = hasIdentity && (quality.identityScore as number) < identityThreshold;
    const needsStyle = hasStyle && (quality.styleScore as number) < styleThreshold;

    let adjusted = false;

    if (needsIdentity) {
      const nextStyleStrength = Math.max(0.35, shot.styleStrength - 0.1);
      if (nextStyleStrength !== shot.styleStrength) {
        shot.styleStrength = nextStyleStrength;
        adjusted = true;
      }
      const nextFaceStrength = Math.min(0.95, (shot.faceStrength ?? DEFAULT_FACE_STRENGTH) + 0.05);
      if (nextFaceStrength !== shot.faceStrength) {
        shot.faceStrength = nextFaceStrength;
        adjusted = true;
      }
      shot.styleDegraded = true;
      shot.styleDegradedReason = 'identity-threshold';
    } else if (needsStyle) {
      const nextStyleStrength = Math.min(0.95, shot.styleStrength + 0.1);
      if (nextStyleStrength !== shot.styleStrength) {
        shot.styleStrength = nextStyleStrength;
        adjusted = true;
      }
    }

    return adjusted;
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
      defaultModel: VIDEO_MODELS.PRO,
      autoExtractFrameBridge: true,
      useCharacterConsistency: false,
      useSceneProxy: false,
      autoRetryOnFailure: true,
      maxRetries: 1,
      qualityThresholds: { style: 0.75, identity: 0.6 },
    };
  }

  private coerceAspectRatio(value: string | undefined): AspectRatio | undefined {
    if (!value) return undefined;
    return ASPECT_RATIOS.includes(value as AspectRatio) ? (value as AspectRatio) : undefined;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateShotId(): string {
    return `shot_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
