import { v4 as uuidv4 } from 'uuid';
import { logger } from '@infrastructure/Logger';
import type {
  SessionDto,
  SessionContinuity,
  SessionContinuityShot,
  SessionStyleReference,
  SessionFrameBridge,
  SessionSeedInfo,
  SessionSceneProxy,
  SessionPrompt,
  SessionPromptVersionEntry,
} from '@shared/types/session';
import type { ContinuitySession, ContinuityShot, StyleReference, FrameBridge, SeedInfo, SceneProxy } from '@services/continuity/types';
import type {
  SessionCreateRequest,
  SessionRecord,
  SessionUpdateRequest,
  SessionListOptions,
  SessionPromptUpdate,
  SessionHighlightUpdate,
  SessionOutputUpdate,
  SessionVersionsUpdate,
} from './types';
import { SessionStore } from './SessionStore';
import { enforceImmutableKeyframes, enforceImmutableVersions } from './utils/immutableMedia';

export class SessionService {
  private readonly log = logger.child({ service: 'SessionService' });
  constructor(private sessionStore: SessionStore) {}

  async createPromptSession(userId: string, request: SessionCreateRequest): Promise<SessionRecord> {
    const now = new Date();
    const prompt = request.prompt ? { ...request.prompt } : undefined;
    if (prompt) {
      if (!prompt.uuid) {
        prompt.uuid = uuidv4();
      }

      const existingSession = await this.sessionStore.findByPromptUuid(userId, prompt.uuid);
      if (existingSession) {
        this.log.debug('Updating existing prompt session by prompt UUID', {
          userId,
          sessionId: existingSession.id,
          promptUuid: prompt.uuid,
        });
        return this.updateSession(existingSession.id, {
          ...(request.name !== undefined ? { name: request.name } : {}),
          prompt,
        });
      }
    }

    const session: SessionRecord = {
      id: this.generateSessionId(),
      userId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ...(request.name !== undefined ? { name: request.name } : {}),
      ...(prompt ? { prompt } : {}),
      ...(prompt?.uuid ? { promptUuid: prompt.uuid } : {}),
      hasContinuity: false,
    };

    await this.sessionStore.save(session);
    return session;
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    return this.sessionStore.get(sessionId);
  }

  async getSessionByPromptUuid(userId: string, promptUuid: string): Promise<SessionRecord | null> {
    return this.sessionStore.findByPromptUuid(userId, promptUuid);
  }

  async listSessions(userId: string, options: SessionListOptions = {}): Promise<SessionRecord[]> {
    const sessions = await this.sessionStore.findByUser(userId, options.limit);
    const includePrompt = options.includePrompt ?? true;
    const includeContinuity = options.includeContinuity ?? true;

    const promptOnlyView = includePrompt && !includeContinuity;
    if (promptOnlyView) {
      return sessions.filter((session) => Boolean(session.prompt));
    }

    const continuityOnlyView = includeContinuity && !includePrompt;
    if (continuityOnlyView) {
      return sessions.filter((session) => Boolean(session.continuity));
    }

    return sessions;
  }

  async updateSession(sessionId: string, updates: SessionUpdateRequest): Promise<SessionRecord> {
    const current = await this.sessionStore.get(sessionId);
    if (!current) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    let mergedPrompt = updates.prompt
      ? {
          ...(current.prompt ?? { input: '', output: '' }),
          ...updates.prompt,
        }
      : current.prompt;

    if (updates.prompt && mergedPrompt) {
      if (updates.prompt.keyframes !== undefined) {
        const enforcedKeyframes = enforceImmutableKeyframes(
          current.prompt?.keyframes ?? null,
          mergedPrompt.keyframes ?? null
        );
        if (enforcedKeyframes.warnings.length) {
          this.log.warn('Preserved immutable keyframe references during session update', {
            sessionId,
            warningCount: enforcedKeyframes.warnings.length,
          });
        }
        mergedPrompt = {
          ...mergedPrompt,
          keyframes: enforcedKeyframes.keyframes ?? null,
        };
      }
      if (updates.prompt.versions !== undefined) {
        const enforcedVersions = enforceImmutableVersions(
          current.prompt?.versions ?? null,
          mergedPrompt.versions ?? null
        );
        if (enforcedVersions.warnings.length) {
          this.log.warn('Preserved immutable media references during session update', {
            sessionId,
            warningCount: enforcedVersions.warnings.length,
          });
        }
        const nextVersions = enforcedVersions.versions ?? undefined;
        mergedPrompt = {
          ...mergedPrompt,
          ...(nextVersions !== undefined ? { versions: nextVersions } : {}),
        };
      }
    }

    const next: SessionRecord = {
      ...current,
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.status ? { status: updates.status } : {}),
      ...(mergedPrompt ? { prompt: mergedPrompt } : {}),
      ...(mergedPrompt?.uuid ? { promptUuid: mergedPrompt.uuid } : {}),
      updatedAt: new Date(),
    };

    await this.sessionStore.save(next);
    return next;
  }

  async updatePrompt(sessionId: string, updates: SessionPromptUpdate): Promise<SessionRecord> {
    const promptUpdates: Partial<SessionPrompt> = {
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.input !== undefined ? { input: updates.input } : {}),
      ...(updates.output !== undefined ? { output: updates.output } : {}),
      ...(updates.targetModel !== undefined ? { targetModel: updates.targetModel } : {}),
      ...(updates.generationParams !== undefined ? { generationParams: updates.generationParams } : {}),
      ...(updates.keyframes !== undefined ? { keyframes: updates.keyframes } : {}),
      ...(updates.mode !== undefined ? { mode: updates.mode } : {}),
    };
    return this.updateSession(sessionId, { prompt: promptUpdates });
  }

  async updateHighlights(sessionId: string, updates: SessionHighlightUpdate): Promise<SessionRecord> {
    const current = await this.sessionStore.get(sessionId);
    if (!current) throw new Error(`Session not found: ${sessionId}`);
    const prompt = current.prompt ?? { input: '', output: '' };
    const nextVersions = Array.isArray(prompt.versions) ? [...prompt.versions] : [];
    if (updates.versionEntry) {
      const timestamp = updates.versionEntry.timestamp ?? new Date().toISOString();
      const basePromptText =
        (typeof prompt.output === 'string' && prompt.output.trim().length > 0
          ? prompt.output
          : prompt.input) || '';
      const nextEntry: SessionPromptVersionEntry = {
        versionId: `highlight_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        signature: 'highlight-update',
        prompt: basePromptText,
        timestamp,
      };
      nextVersions.push({
        ...nextEntry,
      });
    }
    const next = {
      ...current,
      prompt: {
        ...prompt,
        ...(updates.highlightCache !== undefined ? { highlightCache: updates.highlightCache } : {}),
        ...(updates.versionEntry ? { versions: nextVersions } : {}),
      },
      updatedAt: new Date(),
    };
    await this.sessionStore.save(next);
    return next;
  }

  async updateOutput(sessionId: string, updates: SessionOutputUpdate): Promise<SessionRecord> {
    const promptUpdates: Partial<SessionPrompt> = {
      ...(updates.output !== undefined ? { output: updates.output } : {}),
    };
    return this.updateSession(sessionId, { prompt: promptUpdates });
  }

  async updateVersions(sessionId: string, updates: SessionVersionsUpdate): Promise<SessionRecord> {
    const current = await this.sessionStore.get(sessionId);
    if (!current) throw new Error(`Session not found: ${sessionId}`);
    const prompt = current.prompt ?? { input: '', output: '' };
    let nextVersions = updates.versions;
    if (updates.versions !== undefined) {
      const enforced = enforceImmutableVersions(prompt.versions ?? null, updates.versions ?? null);
      nextVersions = enforced.versions ?? undefined;
      if (enforced.warnings.length) {
        this.log.warn('Preserved immutable media references during session version update', {
          sessionId,
          warningCount: enforced.warnings.length,
        });
      }
    }
    const next = {
      ...current,
      prompt: {
        ...prompt,
        ...(nextVersions !== undefined ? { versions: nextVersions } : {}),
      },
      updatedAt: new Date(),
    };
    await this.sessionStore.save(next);
    return next;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sessionStore.delete(sessionId);
  }

  toDto(session: SessionRecord): SessionDto {
    return {
      id: session.id,
      userId: session.userId,
      ...(session.name ? { name: session.name } : {}),
      ...(session.description ? { description: session.description } : {}),
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      ...(session.prompt ? { prompt: session.prompt } : {}),
      ...(session.continuity ? { continuity: this.mapContinuity(session.continuity) } : {}),
    };
  }

  private mapContinuity(session: ContinuitySession): SessionContinuity {
    return {
      shots: session.shots.map((shot) => this.mapShot(shot)),
      primaryStyleReference: session.primaryStyleReference
        ? this.mapStyleReference(session.primaryStyleReference)
        : null,
      sceneProxy: session.sceneProxy ? this.mapSceneProxy(session.sceneProxy) : null,
      settings: session.defaultSettings,
    };
  }

  private mapShot(shot: ContinuityShot): SessionContinuityShot {
    const mappedCamera = shot.camera
      ? {
          ...(shot.camera.yaw !== undefined ? { yaw: shot.camera.yaw } : {}),
          ...(shot.camera.pitch !== undefined ? { pitch: shot.camera.pitch } : {}),
          ...(shot.camera.roll !== undefined ? { roll: shot.camera.roll } : {}),
          ...(shot.camera.dolly !== undefined ? { dolly: shot.camera.dolly } : {}),
        }
      : null;

    return {
      id: shot.id,
      sessionId: shot.sessionId,
      sequenceIndex: shot.sequenceIndex,
      userPrompt: shot.userPrompt,
      continuityMode: shot.continuityMode,
      styleStrength: shot.styleStrength,
      styleReferenceId: shot.styleReferenceId,
      modelId: shot.modelId,
      status: shot.status,
      createdAt: shot.createdAt.toISOString(),
      ...(shot.generationMode ? { generationMode: shot.generationMode } : {}),
      ...(shot.generatedAt ? { generatedAt: shot.generatedAt.toISOString() } : {}),
      ...(shot.characterAssetId ? { characterAssetId: shot.characterAssetId } : {}),
      ...(shot.faceStrength !== undefined ? { faceStrength: shot.faceStrength } : {}),
      ...(mappedCamera && Object.keys(mappedCamera).length > 0 ? { camera: mappedCamera } : {}),
      ...(shot.seedInfo ? { seedInfo: this.mapSeedInfo(shot.seedInfo) } : {}),
      ...(shot.inheritedSeed !== undefined ? { inheritedSeed: shot.inheritedSeed } : {}),
      ...(shot.videoAssetId ? { videoAssetId: shot.videoAssetId } : {}),
      ...(shot.previewAssetId ? { previewAssetId: shot.previewAssetId } : {}),
      ...(shot.generatedKeyframeUrl ? { generatedKeyframeUrl: shot.generatedKeyframeUrl } : {}),
      ...(shot.styleTransferApplied !== undefined
        ? { styleTransferApplied: shot.styleTransferApplied }
        : {}),
      ...(shot.styleDegraded !== undefined ? { styleDegraded: shot.styleDegraded } : {}),
      ...(shot.styleDegradedReason ? { styleDegradedReason: shot.styleDegradedReason } : {}),
      ...(shot.sceneProxyRenderUrl ? { sceneProxyRenderUrl: shot.sceneProxyRenderUrl } : {}),
      ...(shot.continuityMechanismUsed ? { continuityMechanismUsed: shot.continuityMechanismUsed } : {}),
      ...(shot.styleScore !== undefined ? { styleScore: shot.styleScore } : {}),
      ...(shot.identityScore !== undefined ? { identityScore: shot.identityScore } : {}),
      ...(shot.qualityScore !== undefined ? { qualityScore: shot.qualityScore } : {}),
      ...(shot.retryCount !== undefined ? { retryCount: shot.retryCount } : {}),
      ...(shot.error ? { error: shot.error } : {}),
      ...(shot.versions !== undefined ? { versions: shot.versions } : {}),
      ...(shot.frameBridge ? { frameBridge: this.mapFrameBridge(shot.frameBridge) } : {}),
      ...(shot.styleReference ? { styleReference: this.mapStyleReference(shot.styleReference) } : {}),
    };
  }

  private mapStyleReference(ref: StyleReference): SessionStyleReference {
    return {
      ...ref,
      extractedAt: ref.extractedAt?.toISOString(),
    };
  }

  private mapFrameBridge(frame: FrameBridge): SessionFrameBridge {
    return {
      ...frame,
      extractedAt: frame.extractedAt.toISOString(),
    };
  }

  private mapSeedInfo(seed: SeedInfo): SessionSeedInfo {
    return {
      ...seed,
      extractedAt: seed.extractedAt.toISOString(),
    };
  }

  private mapSceneProxy(proxy: SceneProxy): SessionSceneProxy {
    return {
      ...proxy,
      createdAt: proxy.createdAt?.toISOString(),
    };
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
