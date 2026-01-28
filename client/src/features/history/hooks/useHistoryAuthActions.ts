import { useCallback } from 'react';
import { getAuthRepository } from '@repositories/index';

type DebugLogger = {
  logAction: (action: string, payload?: unknown) => void;
  startTimer: (operationId: string) => void;
  endTimer: (operationId: string, description?: string) => void;
  logError: (message: string, error?: Error) => void;
};

type ToastApi = {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
};

export function useHistoryAuthActions(
  debug: DebugLogger,
  toast: ToastApi
): {
  handleSignIn: () => Promise<void>;
  handleSignOut: () => Promise<void>;
} {
  const handleSignIn = useCallback(async (): Promise<void> => {
    debug.logAction('signIn');
    debug.startTimer('signIn');
    try {
      const authRepository = getAuthRepository();
      const signedInUser = await authRepository.signInWithGoogle();
      const displayName =
        typeof signedInUser.displayName === 'string'
          ? signedInUser.displayName
          : 'User';
      debug.endTimer('signIn', 'Sign in successful');
      toast.success(`Welcome, ${displayName}!`);
    } catch (error) {
      debug.endTimer('signIn');
      debug.logError('Sign in failed', error as Error);
      toast.error('Failed to sign in. Please try again.');
    }
  }, [debug, toast]);

  const handleSignOut = useCallback(async (): Promise<void> => {
    debug.logAction('signOut');
    try {
      const authRepository = getAuthRepository();
      await authRepository.signOut();
      debug.logAction('signOutComplete');
      toast.success('Signed out successfully');
    } catch (error) {
      debug.logError('Sign out failed', error as Error);
      toast.error('Failed to sign out');
    }
  }, [debug, toast]);

  return { handleSignIn, handleSignOut };
}
