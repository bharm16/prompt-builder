import { logger } from '@infrastructure/Logger';
import type { VideoGenerationOptions } from '@services/video-generation/types';
import type {
  ContinuitySession,
  ContinuityShot,
  ContinuityMode,
  ProviderContinuityCapabilities,
  ContinuityStrategy,
  StyleReference,
} from './types';
import type { CharacterKeyframeService } from './CharacterKeyframeService';
import { ContinuitySessionStore, ContinuitySessionVersionMismatchError } from './ContinuitySessionStore';
import { ContinuityProviderService } from './ContinuityProviderService';
import { ContinuityMediaService } from './ContinuityMediaService';
import { ContinuityPostProcessingService } from './ContinuityPostProcessingService';

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

export class ContinuityShotGenerator {
  private readonly log = logger.child({ service: 'ContinuityShotGenerator' });

  constructor(
    private providerService: ContinuityProviderService,
    private mediaService: ContinuityMediaService,
    private postProcessingService: ContinuityPostProcessingService,
    private characterKeyframes: CharacterKeyframeService | null,
    private sessionStore: ContinuitySessionStore
  ) {}

  async generateShot(sessionId: string, shotId: string): Promise<ContinuityShot> {
    const session = await this.sessionStore.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    const shot = session.shots.find((s) => s.id === shotId);
    if (!shot) throw new Error(`Shot not found: ${shotId}`);

    const provider = this.providerService.getProviderFromModel(shot.modelId);
    const previousShot = session.shots.find((s) => s.sequenceIndex === shot.sequenceIndex - 1);
    const providerCaps = this.providerService.getCapabilities(provider, shot.modelId);

    const generationMode = shot.generationMode || session.defaultSettings.generationMode;
    const isContinuity = generationMode === 'continuity';
    const effectiveContinuityMode = isContinuity
      ? shot.continuityMode
      : shot.continuityMode === 'frame-bridge'
        ? 'frame-bridge'
        : 'none';

    if (isContinuity) {
      this.providerService.assertProviderSupportsContinuity(provider, shot.modelId);
    }

    if (effectiveContinuityMode === 'frame-bridge' && !shot.frameBridge && previousShot?.videoAssetId) {
      const videoUrl = await this.mediaService.getVideoUrl(previousShot.videoAssetId);
      if (videoUrl) {
        try {
          shot.frameBridge = await this.mediaService.extractBridgeFrame(
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
          ? this.providerService.getInheritedSeed(previousShot?.seedInfo, provider)
          : undefined;
        if (inheritedSeed !== undefined) {
          shot.inheritedSeed = inheritedSeed;
        }

        const requiresCharacter = this.requiresCharacterConsistency(shot, session);
        const modeForStrategy = isContinuity ? resolvedContinuityMode : effectiveContinuityMode;
        const strategy = this.providerService.getContinuityStrategy(provider, modeForStrategy, shot.modelId);

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
          ? this.providerService.buildSeedParam(provider, inheritedSeed)
          : {};
        generationOptions = { ...generationOptions, ...seedParams };

        if (strategy.type === 'native-style-ref') {
          const styleRef = this.resolveStyleReference(session, shot);
          shot.styleReference = styleRef;
          const { options } = await this.providerService.buildGenerationOptions(
            provider,
            generationOptions,
            styleRef,
            shot.styleStrength
          );
          generationOptions = options;
        }

        shot.status = 'generating-video';
        await this.sessionStore.save(session);

        const result = await this.mediaService.generateVideo(
          shot.userPrompt,
          generationOptions as VideoGenerationOptions
        );

        if (supportsSeedPersistence) {
          const seedInfo = this.providerService.extractSeed(provider, shot.modelId, result as Record<string, unknown>);
          if (seedInfo) {
            shot.seedInfo = seedInfo;
          }
        }

        // Post-grade
        if (generationMode === 'continuity') {
          const styleRef = this.resolveStyleReference(session, shot);
          shot.styleReference = styleRef;
          const graded = await this.postProcessingService.matchPalette(result.assetId, styleRef.frameUrl);
          if (graded.applied && graded.assetId) {
            shot.videoAssetId = graded.assetId;
          } else {
            shot.videoAssetId = result.assetId;
          }

          // Quality gate
          const quality = await this.postProcessingService.evaluateQuality({
            userId: session.userId,
            referenceImageUrl: styleRef.frameUrl,
            generatedVideoUrl: graded.videoUrl || result.videoUrl,
            ...(shot.characterAssetId
              ? {
                  characterReferenceUrl: await this.mediaService.getCharacterReferenceUrl(
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
          const videoUrl = await this.mediaService.getVideoUrl(shot.videoAssetId);
          if (videoUrl) {
            try {
              const bridge = await this.mediaService.extractBridgeFrame(
                session.userId,
                shot.videoAssetId,
                videoUrl,
                shot.id,
                'last'
              );
              shot.frameBridge = bridge;

              const representative = await this.mediaService.extractRepresentativeFrame(
                session.userId,
                shot.videoAssetId,
                videoUrl,
                shot.id
              );
              shot.styleReference = await this.mediaService.createStyleReferenceFromVideo(
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
    if (!this.providerService.shouldUseSceneProxy(context.session, context.shot, context.modeForStrategy)) {
      return null;
    }

    const render = await this.postProcessingService.renderSceneProxy(
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
        const transfer = await this.postProcessingService.matchImagePalette(
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
        startImageUrl = await this.mediaService.generateStyledKeyframe({
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

  private resolveCharacterFromSession(session: ContinuitySession): string | undefined {
    for (let i = session.shots.length - 1; i >= 0; i -= 1) {
      const candidate = session.shots[i]?.characterAssetId;
      if (candidate) return candidate;
    }
    return undefined;
  }

  private coerceAspectRatio(value: string | undefined): AspectRatio | undefined {
    if (!value) return undefined;
    return ASPECT_RATIOS.includes(value as AspectRatio) ? (value as AspectRatio) : undefined;
  }
}
