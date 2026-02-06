import { v4 as uuidv4 } from 'uuid';
import { logger } from '@infrastructure/Logger';
import type { SessionDto, SessionContinuity, SessionContinuityShot, SessionStyleReference, SessionFrameBridge, SessionSeedInfo, SessionSceneProxy } from '@shared/types/session';
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
      name: request.name,
      description: undefined,
      status: 'active',
      createdAt: now,
      updatedAt: now,
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
    if (options.includeContinuity === false) {
      return sessions.filter((session) => !session.continuity);
    }
    if (options.includePrompt === false) {
      return sessions.filter((session) => !session.prompt);
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
        mergedPrompt = {
          ...mergedPrompt,
          versions: enforcedVersions.versions ?? null,
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
    return this.updateSession(sessionId, { prompt: updates });
  }

  async updateHighlights(sessionId: string, updates: SessionHighlightUpdate): Promise<SessionRecord> {
    const current = await this.sessionStore.get(sessionId);
    if (!current) throw new Error(`Session not found: ${sessionId}`);
    const prompt = current.prompt ?? { input: '', output: '' };
    const nextVersions = Array.isArray(prompt.versions) ? [...prompt.versions] : [];
    if (updates.versionEntry) {
      nextVersions.push({
        ...updates.versionEntry,
        timestamp: updates.versionEntry.timestamp ?? new Date().toISOString(),
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
    return this.updateSession(sessionId, { prompt: updates });
  }

  async updateVersions(sessionId: string, updates: SessionVersionsUpdate): Promise<SessionRecord> {
    const current = await this.sessionStore.get(sessionId);
    if (!current) throw new Error(`Session not found: ${sessionId}`);
    const prompt = current.prompt ?? { input: '', output: '' };
    let nextVersions = updates.versions;
    if (updates.versions !== undefined) {
      const enforced = enforceImmutableVersions(prompt.versions ?? null, updates.versions ?? null);
      nextVersions = enforced.versions ?? null;
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
        ...(nextVersions ? { versions: nextVersions } : {}),
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
    return {
      ...shot,
      createdAt: shot.createdAt.toISOString(),
      ...(shot.generatedAt ? { generatedAt: shot.generatedAt.toISOString() } : {}),
      ...(shot.seedInfo ? { seedInfo: this.mapSeedInfo(shot.seedInfo) } : {}),
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
