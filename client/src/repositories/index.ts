/**
 * Repository Provider
 *
 * Central place to create and access repository instances
 * Implements the Service Locator pattern for repositories
 */

import { auth, db } from '../config/firebase';
import { setSentryUser, addSentryBreadcrumb } from '../config/sentry';
import { AuthRepository } from './AuthRepository';
import { PromptRepository, LocalStoragePromptRepository } from './PromptRepository';
import type { SentryIntegration } from './AuthRepository';

// Sentry integration adapter
const sentryAdapter: SentryIntegration = {
  setUser: setSentryUser,
  addBreadcrumb: addSentryBreadcrumb,
};

// Singleton instances
let authRepository: AuthRepository | null = null;
let promptRepository: PromptRepository | null = null;
let localPromptRepository: LocalStoragePromptRepository | null = null;

/**
 * Get the auth repository instance
 */
export function getAuthRepository(): AuthRepository {
  if (!authRepository) {
    authRepository = new AuthRepository(auth, sentryAdapter);
  }
  return authRepository;
}

/**
 * Get the prompt repository instance (Firestore)
 */
export function getPromptRepository(): PromptRepository {
  if (!promptRepository) {
    promptRepository = new PromptRepository(db);
  }
  return promptRepository;
}

/**
 * Get the local prompt repository instance (localStorage)
 */
export function getLocalPromptRepository(): LocalStoragePromptRepository {
  if (!localPromptRepository) {
    localPromptRepository = new LocalStoragePromptRepository();
  }
  return localPromptRepository;
}

/**
 * Get appropriate prompt repository based on auth state
 */
export function getPromptRepositoryForUser(isAuthenticated: boolean): PromptRepository | LocalStoragePromptRepository {
  return isAuthenticated ? getPromptRepository() : getLocalPromptRepository();
}

/**
 * Reset all repository instances (useful for testing)
 */
export function resetRepositories(): void {
  authRepository = null;
  promptRepository = null;
  localPromptRepository = null;
}

