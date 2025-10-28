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

// Sentry integration adapter
const sentryAdapter = {
  setUser: setSentryUser,
  addBreadcrumb: addSentryBreadcrumb,
};

// Singleton instances
let authRepository = null;
let promptRepository = null;
let localPromptRepository = null;

/**
 * Get the auth repository instance
 * @returns {AuthRepository}
 */
export function getAuthRepository() {
  if (!authRepository) {
    authRepository = new AuthRepository(auth, sentryAdapter);
  }
  return authRepository;
}

/**
 * Get the prompt repository instance (Firestore)
 * @returns {PromptRepository}
 */
export function getPromptRepository() {
  if (!promptRepository) {
    promptRepository = new PromptRepository(db);
  }
  return promptRepository;
}

/**
 * Get the local prompt repository instance (localStorage)
 * @returns {LocalStoragePromptRepository}
 */
export function getLocalPromptRepository() {
  if (!localPromptRepository) {
    localPromptRepository = new LocalStoragePromptRepository();
  }
  return localPromptRepository;
}

/**
 * Get appropriate prompt repository based on auth state
 * @param {boolean} isAuthenticated - Whether user is authenticated
 * @returns {PromptRepository|LocalStoragePromptRepository}
 */
export function getPromptRepositoryForUser(isAuthenticated) {
  return isAuthenticated ? getPromptRepository() : getLocalPromptRepository();
}

/**
 * Reset all repository instances (useful for testing)
 */
export function resetRepositories() {
  authRepository = null;
  promptRepository = null;
  localPromptRepository = null;
}
