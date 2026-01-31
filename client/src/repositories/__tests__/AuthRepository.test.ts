/**
 * Unit tests for AuthRepository
 *
 * Tests MockAuthRepository (testable without Firebase) and AuthRepositoryError.
 */

import { describe, expect, it, vi } from 'vitest';
import { AuthRepositoryError, MockAuthRepository } from '../AuthRepository';

// ---------------------------------------------------------------------------
// AuthRepositoryError
// ---------------------------------------------------------------------------
describe('AuthRepositoryError', () => {
  it('sets name to AuthRepositoryError', () => {
    const error = new AuthRepositoryError('test', null);
    expect(error.name).toBe('AuthRepositoryError');
  });

  it('stores the original error', () => {
    const original = new Error('firebase error');
    const error = new AuthRepositoryError('wrapper', original);
    expect(error.originalError).toBe(original);
  });

  it('extracts code from original error when present', () => {
    const original = { code: 'auth/user-not-found', message: 'not found' };
    const error = new AuthRepositoryError('wrapper', original);
    expect(error.code).toBe('auth/user-not-found');
  });

  it('does not set code when original error has no code property', () => {
    const error = new AuthRepositoryError('wrapper', new Error('plain'));
    expect(error.code).toBeUndefined();
  });

  it('does not set code when original error code is not a string', () => {
    const error = new AuthRepositoryError('wrapper', { code: 123, message: 'x' });
    expect(error.code).toBeUndefined();
  });

  it('does not set code when original error is null', () => {
    const error = new AuthRepositoryError('wrapper', null);
    expect(error.code).toBeUndefined();
  });

  it('sets message correctly', () => {
    const error = new AuthRepositoryError('Custom message', null);
    expect(error.message).toBe('Custom message');
  });

  it('is an instance of Error', () => {
    const error = new AuthRepositoryError('test', null);
    expect(error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// MockAuthRepository
// ---------------------------------------------------------------------------
describe('MockAuthRepository', () => {
  describe('signInWithGoogle', () => {
    it('returns a user with mock data', async () => {
      const repo = new MockAuthRepository();
      const user = await repo.signInWithGoogle();
      expect(user.uid).toBe('mock-user-id');
      expect(user.email).toBe('test@example.com');
      expect(user.emailVerified).toBe(true);
    });

    it('sets current user after sign in', async () => {
      const repo = new MockAuthRepository();
      await repo.signInWithGoogle();
      expect(repo.getCurrentUser()).not.toBeNull();
    });
  });

  describe('signInWithEmail', () => {
    it('uses provided email in returned user', async () => {
      const repo = new MockAuthRepository();
      const user = await repo.signInWithEmail('custom@test.com', 'pass');
      expect(user.email).toBe('custom@test.com');
    });
  });

  describe('signUpWithEmail', () => {
    it('uses provided email and displayName', async () => {
      const repo = new MockAuthRepository();
      const user = await repo.signUpWithEmail('new@test.com', 'pass', 'Jane');
      expect(user.email).toBe('new@test.com');
      expect(user.displayName).toBe('Jane');
    });

    it('sets emailVerified to false for new signups', async () => {
      const repo = new MockAuthRepository();
      const user = await repo.signUpWithEmail('new@test.com', 'pass');
      expect(user.emailVerified).toBe(false);
    });

    it('defaults displayName to Test User when not provided', async () => {
      const repo = new MockAuthRepository();
      const user = await repo.signUpWithEmail('new@test.com', 'pass');
      expect(user.displayName).toBe('Test User');
    });
  });

  describe('signOut', () => {
    it('clears current user', async () => {
      const repo = new MockAuthRepository();
      await repo.signInWithGoogle();
      expect(repo.getCurrentUser()).not.toBeNull();
      await repo.signOut();
      expect(repo.getCurrentUser()).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('returns null before any sign in', () => {
      const repo = new MockAuthRepository();
      expect(repo.getCurrentUser()).toBeNull();
    });
  });

  describe('onAuthStateChanged', () => {
    it('immediately invokes callback with current state', () => {
      const repo = new MockAuthRepository();
      const callback = vi.fn();
      repo.onAuthStateChanged(callback);
      expect(callback).toHaveBeenCalledWith(null);
    });

    it('notifies on sign in', async () => {
      const repo = new MockAuthRepository();
      const callback = vi.fn();
      repo.onAuthStateChanged(callback);
      await repo.signInWithGoogle();
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback.mock.calls[1][0]).not.toBeNull();
    });

    it('notifies on sign out', async () => {
      const repo = new MockAuthRepository();
      const callback = vi.fn();
      await repo.signInWithGoogle();
      repo.onAuthStateChanged(callback);
      await repo.signOut();
      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback.mock.calls[1][0]).toBeNull();
    });

    it('returns unsubscribe function that stops notifications', async () => {
      const repo = new MockAuthRepository();
      const callback = vi.fn();
      const unsubscribe = repo.onAuthStateChanged(callback);
      unsubscribe();
      await repo.signInWithGoogle();
      // Only the initial call should have happened
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('supports multiple subscribers', async () => {
      const repo = new MockAuthRepository();
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      repo.onAuthStateChanged(cb1);
      repo.onAuthStateChanged(cb2);
      await repo.signInWithGoogle();
      expect(cb1).toHaveBeenCalledTimes(2);
      expect(cb2).toHaveBeenCalledTimes(2);
    });
  });

  describe('verifyEmailWithCode', () => {
    it('sets emailVerified to true on current user', async () => {
      const repo = new MockAuthRepository();
      await repo.signUpWithEmail('test@test.com', 'pass');
      expect(repo.getCurrentUser()?.emailVerified).toBe(false);
      await repo.verifyEmailWithCode('oob-code');
      expect(repo.getCurrentUser()?.emailVerified).toBe(true);
    });

    it('does not throw when no user is signed in', async () => {
      const repo = new MockAuthRepository();
      await expect(repo.verifyEmailWithCode('code')).resolves.toBeUndefined();
    });
  });

  describe('validatePasswordResetCode', () => {
    it('returns current user email when signed in', async () => {
      const repo = new MockAuthRepository();
      await repo.signInWithEmail('user@test.com', 'pass');
      const email = await repo.validatePasswordResetCode('code');
      expect(email).toBe('user@test.com');
    });

    it('returns fallback email when not signed in', async () => {
      const repo = new MockAuthRepository();
      const email = await repo.validatePasswordResetCode('code');
      expect(email).toBe('test@example.com');
    });
  });

  describe('refreshCurrentUser', () => {
    it('returns current user when signed in', async () => {
      const repo = new MockAuthRepository();
      await repo.signInWithGoogle();
      const user = await repo.refreshCurrentUser();
      expect(user).not.toBeNull();
      expect(user?.uid).toBe('mock-user-id');
    });

    it('returns null when not signed in', async () => {
      const repo = new MockAuthRepository();
      const user = await repo.refreshCurrentUser();
      expect(user).toBeNull();
    });
  });
});
