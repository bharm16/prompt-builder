/**
 * Types for video concept services
 * Shared type definitions used across video concept modules
 */

/**
 * Video concept element
 */
export interface VideoConceptElement {
  type: string;
  value: string;
  confidence?: number;
  [key: string]: unknown;
}

/**
 * Video concept request
 */
export interface VideoConceptRequest {
  concept: string;
  userId?: string;
  mode?: string;
  [key: string]: unknown;
}

/**
 * Video concept result
 */
export interface VideoConceptResult {
  elements: Record<string, string>;
  concept: string;
  metadata?: {
    format?: string;
    technicalParams?: Record<string, unknown>;
    validationScore?: number;
  };
}

/**
 * User preferences
 */
export interface UserPreferences {
  chosen: string[];
  rejected: string[];
}

/**
 * Storage adapter interface
 */
export interface StorageAdapter {
  get(userId: string, elementType: string): Promise<UserPreferences | null>;
  set(userId: string, elementType: string, preferences: UserPreferences): Promise<void>;
  delete(userId: string, elementType?: string): Promise<void>;
}

/**
 * Template storage adapter interface
 */
export interface TemplateStorageAdapter {
  save(template: VideoTemplate): Promise<void>;
  get(templateId: string): Promise<VideoTemplate | null>;
  getByUser(userId: string): Promise<VideoTemplate[]>;
  getAll(): Promise<VideoTemplate[]>;
}

/**
 * Video template
 */
export interface VideoTemplate {
  id: string;
  name: string;
  elements: Record<string, string>;
  concept: string;
  userId: string;
  createdAt: string;
  usageCount: number;
  updatedAt?: string;
}

/**
 * In-memory storage (minimal interface)
 */
export interface InMemoryStorage extends StorageAdapter {
  deleteAll(userId: string): Promise<void>;
  getAllForUser(userId: string): Promise<Record<string, UserPreferences>>;
}

/**
 * In-memory template storage (minimal interface)
 */
export interface InMemoryTemplateStorage {
  save(template: VideoTemplate): Promise<void>;
  get(templateId: string): Promise<VideoTemplate | null>;
  getByUser(userId: string): Promise<VideoTemplate[]>;
  getAll(): Promise<VideoTemplate[]>;
}

