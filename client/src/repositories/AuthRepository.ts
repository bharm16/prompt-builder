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
  type Auth,
  type User as FirebaseUser,
} from 'firebase/auth';
import type { User } from '../hooks/types';

export interface SentryIntegration {
  setUser: (user: User | null) => void;
  addBreadcrumb: (category: string, message: string, data?: Record<string, unknown>) => void;
}

/**
 * Repository for managing authentication
 */
export class AuthRepository {
  private auth: Auth;
  private sentry: SentryIntegration | null;
  private googleProvider: GoogleAuthProvider;

  constructor(auth: Auth, sentryIntegration: SentryIntegration | null = null) {
    this.auth = auth;
    this.sentry = sentryIntegration;
    this.googleProvider = new GoogleAuthProvider();
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle(): Promise<User> {
    try {
      const result = await signInWithPopup(this.auth, this.googleProvider);

      // Update Sentry user context if integration is provided
      if (this.sentry) {
        const mappedUser = this._mapFirebaseUser(result.user);
        this.sentry.setUser(mappedUser);
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
   */
  async signOut(): Promise<void> {
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
   */
  getCurrentUser(): User | null {
    const user = this.auth.currentUser;
    return user ? this._mapFirebaseUser(user) : null;
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChanged(callback: (user: User | null) => void): () => void {
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
  private _mapFirebaseUser(firebaseUser: FirebaseUser): User {
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || undefined,
      displayName: firebaseUser.displayName || undefined,
      photoURL: firebaseUser.photoURL || undefined,
      emailVerified: firebaseUser.emailVerified,
      isAnonymous: firebaseUser.isAnonymous,
    };
  }
}

/**
 * Custom error class for auth repository errors
 */
export class AuthRepositoryError extends Error {
  originalError: unknown;

  constructor(message: string, originalError: unknown) {
    super(message);
    this.name = 'AuthRepositoryError';
    this.originalError = originalError;
  }
}

/**
 * Mock auth repository for testing
 */
export class MockAuthRepository {
  private currentUser: User | null = null;
  private authStateCallbacks: Array<(user: User | null) => void> = [];

  async signInWithGoogle(): Promise<User> {
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

  async signOut(): Promise<void> {
    this.currentUser = null;
    this._notifyAuthStateChange();
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  onAuthStateChanged(callback: (user: User | null) => void): () => void {
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

  private _notifyAuthStateChange(): void {
    this.authStateCallbacks.forEach(callback => callback(this.currentUser));
  }
}

