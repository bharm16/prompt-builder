import type { SessionPrompt, SessionStatus, SessionDto, SessionContinuity } from '@shared/types/session';
import type { ContinuitySession } from '@services/continuity/types';

export interface SessionRecord {
  id: string;
  userId: string;
  name?: string;
  description?: string;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
  prompt?: SessionPrompt;
  continuity?: ContinuitySession;
  promptUuid?: string | null;
  hasContinuity?: boolean;
}

export interface SessionCreateRequest {
  name?: string;
  prompt?: SessionPrompt;
}

export interface SessionUpdateRequest {
  name?: string;
  description?: string;
  status?: SessionStatus;
  prompt?: Partial<SessionPrompt>;
}

export interface SessionListOptions {
  limit?: number;
  includeContinuity?: boolean;
  includePrompt?: boolean;
}

export interface SessionPromptUpdate {
  title?: string | null;
  input?: string;
  output?: string;
  targetModel?: string | null;
  generationParams?: Record<string, unknown> | null;
  keyframes?: SessionPrompt['keyframes'];
  mode?: string;
}

export interface SessionHighlightUpdate {
  highlightCache?: Record<string, unknown> | null;
  versionEntry?: {
    timestamp?: string;
  };
}

export interface SessionOutputUpdate {
  output?: string;
}

export interface SessionVersionsUpdate {
  versions?: SessionPrompt['versions'];
}

export interface SessionDtoResult {
  session: SessionDto;
}

export interface SessionContinuityDtoResult {
  continuity: SessionContinuity;
}
