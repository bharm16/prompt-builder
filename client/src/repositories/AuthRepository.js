/**
 * AuthRepository - Data Access Layer for Authentication
 *
 * Abstracts all authentication-related operations
 * This allows us to:
 * - Swap auth providers (Firebase, Auth0, etc.) without changing business logic
 * - Mock authentication for testing
 * - Centralize auth logic
 */

import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
} from 'firebase/auth';

/**
 * Repository for managing authentication
 */
export class AuthRepository {
  constructor(auth, sentryIntegration = null) {
    this.auth = auth;
    this.sentry = sentryIntegration;
    this.googleProvider = new GoogleAuthProvider();
  }

  /**
   * Sign in with Google
   * @returns {Promise<Object>} User object
   */
  async signInWithGoogle() {
    try {
      const result = await signInWithPopup(this.auth, this.googleProvider);

      // Update Sentry user context if integration is provided
      if (this.sentry) {
        this.sentry.setUser(result.user);
        this.sentry.addBreadcrumb('auth', 'User signed in with Google', {
          userId: result.user.uid,
        });
      }

      return this._mapFirebaseUser(result.user);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw new AuthRepositoryError('Failed to sign in with Google', error);
    }
  }

  /**
   * Sign out the current user
   * @returns {Promise<void>}
   */
  async signOut() {
    try {
      await signOut(this.auth);

      // Clear Sentry user context if integration is provided
      if (this.sentry) {
        this.sentry.setUser(null);
        this.sentry.addBreadcrumb('auth', 'User signed out');
      }
    } catch (error) {
      console.error('Error signing out:', error);
      throw new AuthRepositoryError('Failed to sign out', error);
    }
  }

  /**
   * Get the current authenticated user
   * @returns {Object|null} Current user or null
   */
  getCurrentUser() {
    const user = this.auth.currentUser;
    return user ? this._mapFirebaseUser(user) : null;
  }

  /**
   * Listen to auth state changes
   * @param {Function} callback - Callback to invoke on auth state change
   * @returns {Function} Unsubscribe function
   */
  onAuthStateChanged(callback) {
    return firebaseOnAuthStateChanged(this.auth, (firebaseUser) => {
      const mappedUser = firebaseUser ? this._mapFirebaseUser(firebaseUser) : null;

      // Update Sentry user context if integration is provided
      if (this.sentry) {
        this.sentry.setUser(mappedUser);
      }

      callback(mappedUser);
    });
  }

  /**
   * Map Firebase user to application user object
   * @private
   */
  _mapFirebaseUser(firebaseUser) {
    if (!firebaseUser) return null;

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      emailVerified: firebaseUser.emailVerified,
      isAnonymous: firebaseUser.isAnonymous,
    };
  }
}

/**
 * Custom error class for auth repository errors
 */
export class AuthRepositoryError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'AuthRepositoryError';
    this.originalError = originalError;
  }
}

/**
 * Mock auth repository for testing
 */
export class MockAuthRepository {
  constructor() {
    this.currentUser = null;
    this.authStateCallbacks = [];
  }

  async signInWithGoogle() {
    this.currentUser = {
      uid: 'mock-user-id',
      email: 'test@example.com',
      displayName: 'Test User',
      photoURL: null,
      emailVerified: true,
      isAnonymous: false,
    };

    this._notifyAuthStateChange();
    return this.currentUser;
  }

  async signOut() {
    this.currentUser = null;
    this._notifyAuthStateChange();
  }

  getCurrentUser() {
    return this.currentUser;
  }

  onAuthStateChanged(callback) {
    this.authStateCallbacks.push(callback);

    // Immediately invoke with current state
    callback(this.currentUser);

    // Return unsubscribe function
    return () => {
      const index = this.authStateCallbacks.indexOf(callback);
      if (index > -1) {
        this.authStateCallbacks.splice(index, 1);
      }
    };
  }

  _notifyAuthStateChange() {
    this.authStateCallbacks.forEach(callback => callback(this.currentUser));
  }
}
