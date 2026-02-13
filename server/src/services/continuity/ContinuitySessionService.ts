import { logger } from '@infrastructure/Logger';
import { VIDEO_MODELS } from '@config/modelConfig';
import { STYLE_STRENGTH_PRESETS } from './StyleReferenceService';
import type {
  ContinuitySession,
  ContinuityShot,
  ContinuitySessionSettings,
  CreateSessionRequest,
  CreateShotRequest,
  StyleReference,
} from './types';
import { ContinuitySessionStore } from './ContinuitySessionStore';
import { ContinuityProviderService } from './ContinuityProviderService';
import { ContinuityMediaService } from './ContinuityMediaService';
import { ContinuityPostProcessingService } from './ContinuityPostProcessingService';
import { ContinuityShotGenerator } from './ContinuityShotGenerator';
import { enforceImmutableVersions } from '@services/sessions/utils/immutableMedia';
import type { ShotGenerationObserver } from './ShotGenerationProgress';

export class ContinuitySessionService {
  private readonly log = logger.child({ service: 'ContinuitySessionService' });

  constructor(
    private providerService: ContinuityProviderService,
    private mediaService: ContinuityMediaService,
    private postProcessingService: ContinuityPostProcessingService,
    private shotGenerator: ContinuityShotGenerator,
    private sessionStore: ContinuitySessionStore
  ) {}

  async createSession(userId: string, request: CreateSessionRequest): Promise<ContinuitySession> {
    this.log.info('Creating continuity session', { userId, name: request.name });

    if (request.sessionId) {
      const existing = await this.sessionStore.get(request.sessionId);
      if (existing) {
        return existing;
      }
    }

    let primaryStyleReference: StyleReference;

    if (request.sourceVideoId) {
      const videoUrl = await this.mediaService.getVideoUrl(request.sourceVideoId, userId);
      if (!videoUrl) throw new Error('Source video not found');
      primaryStyleReference = await this.mediaService.createStyleReferenceFromVideoAsset(
        userId,
        request.sourceVideoId,
        videoUrl,
        'initial'
      );
    } else if (request.sourceImageUrl) {
      primaryStyleReference = await this.mediaService.createStyleReferenceFromImage(
        request.sourceImageUrl
      );
    } else {
      throw new Error('Must provide sourceVideoId or sourceImageUrl');
    }

    primaryStyleReference = await this.mediaService.analyzeStyleReference(primaryStyleReference);

    const sessionId = request.sessionId ?? this.generateSessionId();
    const session: ContinuitySession = {
      id: sessionId,
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
      const provider = this.providerService.getProviderFromModel(modelId);
      const caps = this.providerService.getCapabilities(provider, modelId);
      if (!caps.supportsStartImage && !caps.supportsNativeStyleReference) {
        throw new Error(
          `Model ${modelId} does not support continuity (no image input or style reference). Switch to an eligible model.`
        );
      }
    }

    let frameBridge = previousShot?.frameBridge;
    if (!frameBridge && continuityMode === 'frame-bridge' && previousShot?.videoAssetId) {
      const videoUrl = await this.mediaService.getVideoUrl(previousShot.videoAssetId, session.userId);
      if (videoUrl) {
        try {
          frameBridge = await this.mediaService.extractBridgeFrame(
            session.userId,
            previousShot.videoAssetId,
            videoUrl,
            previousShot.id,
            'last'
          );
        } catch (error) {
          this.log.warn('Frame bridge extraction failed during shot creation; continuing without frame bridge', {
            sessionId: session.id,
            previousShotId: previousShot.id,
            previousShotVideoAssetId: previousShot.videoAssetId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const hasSourceVideo = Boolean(request.sourceVideoId);
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
      ...(hasSourceVideo ? { videoAssetId: request.sourceVideoId } : {}),
      status: hasSourceVideo ? 'completed' : 'draft',
      createdAt: new Date(),
      ...(hasSourceVideo ? { generatedAt: new Date() } : {}),
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

  async generateShot(
    sessionId: string,
    shotId: string,
    observer?: ShotGenerationObserver
  ): Promise<ContinuityShot> {
    return await this.shotGenerator.generateShot(sessionId, shotId, observer);
  }

  async updateShot(
    sessionId: string,
    shotId: string,
    updates: {
      prompt?: string;
      continuityMode?: ContinuityShot['continuityMode'];
      generationMode?: ContinuityShot['generationMode'];
      styleReferenceId?: ContinuityShot['styleReferenceId'];
      styleStrength?: ContinuityShot['styleStrength'];
      modelId?: ContinuityShot['modelId'];
      characterAssetId?: ContinuityShot['characterAssetId'] | null;
      faceStrength?: ContinuityShot['faceStrength'];
      camera?: ContinuityShot['camera'];
      versions?: ContinuityShot['versions'];
    }
  ): Promise<ContinuityShot> {
    const session = await this.sessionStore.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    const shotIndex = session.shots.findIndex((s) => s.id === shotId);
    if (shotIndex < 0) throw new Error(`Shot not found: ${shotId}`);

    const shot = session.shots[shotIndex]!;
    let nextVersions = updates.versions;
    if (updates.versions !== undefined) {
      const enforced = enforceImmutableVersions(shot.versions ?? null, updates.versions ?? null);
      nextVersions = enforced.versions ?? undefined;
      if (enforced.warnings.length) {
        this.log.warn('Preserved immutable media references during continuity shot update', {
          sessionId,
          shotId,
          warningCount: enforced.warnings.length,
        });
      }
    }

    let next: ContinuityShot = {
      ...shot,
      ...(updates.prompt !== undefined ? { userPrompt: updates.prompt } : {}),
      ...(updates.continuityMode ? { continuityMode: updates.continuityMode } : {}),
      ...(updates.generationMode ? { generationMode: updates.generationMode } : {}),
      ...(updates.styleReferenceId !== undefined ? { styleReferenceId: updates.styleReferenceId } : {}),
      ...(updates.styleStrength !== undefined ? { styleStrength: updates.styleStrength } : {}),
      ...(updates.modelId ? { modelId: updates.modelId } : {}),
      ...(updates.faceStrength !== undefined ? { faceStrength: updates.faceStrength } : {}),
      ...(updates.camera ? { camera: { ...(shot.camera ?? {}), ...updates.camera } } : {}),
      ...(nextVersions !== undefined ? { versions: nextVersions } : {}),
    };

    if (updates.characterAssetId !== undefined) {
      if (updates.characterAssetId) {
        next = {
          ...next,
          characterAssetId: updates.characterAssetId,
        };
      } else {
        const { characterAssetId: _unused, ...withoutCharacterAsset } = next;
        next = withoutCharacterAsset;
      }
    }

    session.shots[shotIndex] = next;
    session.updatedAt = new Date();
    await this.sessionStore.save(session);
    return next;
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
      const videoUrl = await this.mediaService.getVideoUrl(sourceVideoId, session.userId);
      if (!videoUrl) throw new Error('Source video not found');
      session.primaryStyleReference = await this.mediaService.createStyleReferenceFromVideoAsset(
        session.userId,
        sourceVideoId,
        videoUrl,
        'updated'
      );
    } else if (sourceImageUrl) {
      session.primaryStyleReference = await this.mediaService.createStyleReferenceFromImage(sourceImageUrl);
    }

    session.primaryStyleReference = await this.mediaService.analyzeStyleReference(
      session.primaryStyleReference
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


  async createSceneProxy(sessionId: string, sourceShotId?: string, sourceVideoId?: string): Promise<ContinuitySession> {
    const session = await this.sessionStore.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    let videoId: string | undefined;
    let videoUrl: string | null | undefined;

    if (sourceShotId) {
      const shot = session.shots.find((s) => s.id === sourceShotId);
      if (!shot?.videoAssetId) throw new Error('Shot has no video asset');
      videoId = shot.videoAssetId;
      videoUrl = await this.mediaService.getVideoUrl(shot.videoAssetId, session.userId);
    } else if (sourceVideoId) {
      videoId = sourceVideoId;
      videoUrl = await this.mediaService.getVideoUrl(sourceVideoId, session.userId);
    }

    if (!videoId || !videoUrl) throw new Error('Source video not found for proxy');

    const proxy = await this.postProcessingService.createSceneProxyFromVideo(
      session.userId,
      videoId,
      videoUrl
    );
    session.sceneProxy = proxy;
    if (proxy.status === 'ready') {
      session.defaultSettings.useSceneProxy = true;
    }
    session.updatedAt = new Date();
    await this.sessionStore.save(session);
    return session;
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

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateShotId(): string {
    return `shot_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
