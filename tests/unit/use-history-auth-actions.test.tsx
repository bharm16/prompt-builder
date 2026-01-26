import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useHistoryAuthActions } from '@features/history/hooks/useHistoryAuthActions';
import { getAuthRepository } from '@repositories/index';

vi.mock('@repositories/index', () => ({
  getAuthRepository: vi.fn(),
}));

type AuthRepository = Pick<
  ReturnType<typeof getAuthRepository>,
  'signInWithGoogle' | 'signOut'
>;

type DebugLogger = {
  logAction: MockedFunction<(action: string, payload?: unknown) => void>;
  startTimer: MockedFunction<(operationId: string) => void>;
  endTimer: MockedFunction<(operationId: string, description?: string) => void>;
  logError: MockedFunction<(message: string, error?: Error) => void>;
};

type ToastApi = {
  success: MockedFunction<(message: string, duration?: number) => void>;
  error: MockedFunction<(message: string, duration?: number) => void>;
  warning: MockedFunction<(message: string, duration?: number) => void>;
};

const mockGetAuthRepository = vi.mocked(getAuthRepository) as MockedFunction<() => AuthRepository>;

const createAuthRepository = (): AuthRepository => ({
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
});

const createDebugLogger = (): DebugLogger => ({
  logAction: vi.fn(),
  startTimer: vi.fn(),
  endTimer: vi.fn(),
  logError: vi.fn(),
});

const createToast = (): ToastApi => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
});

describe('useHistoryAuthActions', () => {
  let authRepository: AuthRepository;
  let debug: DebugLogger;
  let toast: ToastApi;

  beforeEach(() => {
    vi.clearAllMocks();
    authRepository = createAuthRepository();
    debug = createDebugLogger();
    toast = createToast();
    mockGetAuthRepository.mockReturnValue(authRepository);
  });

  describe('error handling', () => {
    it('surfaces sign-in failures with a toast message', async () => {
      authRepository.signInWithGoogle.mockRejectedValue(new Error('Network down'));

      const { result } = renderHook(() => useHistoryAuthActions(debug, toast));

      await act(async () => {
        await result.current.handleSignIn();
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to sign in. Please try again.');
      expect(debug.logError).toHaveBeenCalledWith('Sign in failed', expect.any(Error));
      expect(debug.endTimer).toHaveBeenCalledWith('signIn');
    });

    it('reports sign-out failures and avoids the completion action', async () => {
      authRepository.signOut.mockRejectedValue(new Error('Denied'));

      const { result } = renderHook(() => useHistoryAuthActions(debug, toast));

      await act(async () => {
        await result.current.handleSignOut();
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to sign out');
      expect(debug.logError).toHaveBeenCalledWith('Sign out failed', expect.any(Error));
      expect(debug.logAction.mock.calls.map((call) => call[0])).not.toContain('signOutComplete');
    });
  });

  describe('edge cases', () => {
    it('falls back to a generic name when displayName is missing', async () => {
      authRepository.signInWithGoogle.mockResolvedValue({ displayName: null });

      const { result } = renderHook(() => useHistoryAuthActions(debug, toast));

      await act(async () => {
        await result.current.handleSignIn();
      });

      expect(toast.success).toHaveBeenCalledWith('Welcome, User!');
      expect(debug.endTimer).toHaveBeenCalledWith('signIn', 'Sign in successful');
    });
  });

  describe('core behavior', () => {
    it('logs sign-out completion and shows a success toast', async () => {
      authRepository.signOut.mockResolvedValue(undefined);

      const { result } = renderHook(() => useHistoryAuthActions(debug, toast));

      await act(async () => {
        await result.current.handleSignOut();
      });

      expect(debug.logAction).toHaveBeenCalledWith('signOutComplete');
      expect(toast.success).toHaveBeenCalledWith('Signed out successfully');
    });
  });
});
