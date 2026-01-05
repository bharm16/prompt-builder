import React from 'react';
import { getAuthRepository } from '@repositories/index';
import { Button } from '@components/Button';
import { useToast } from '@components/Toast';
import type { User } from '@hooks/types';
import { MarketingPage } from './MarketingPage';

export function SignInPage(): React.ReactElement {
  const toast = useToast();
  const [user, setUser] = React.useState<User | null>(null);

  React.useEffect(() => {
    const unsubscribe = getAuthRepository().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async (): Promise<void> => {
    try {
      const signedInUser = await getAuthRepository().signInWithGoogle();
      const displayName =
        typeof signedInUser.displayName === 'string' ? signedInUser.displayName : 'User';
      toast.success(`Welcome, ${displayName}!`);
    } catch {
      toast.error('Failed to sign in. Please try again.');
    }
  };

  const handleSignOut = async (): Promise<void> => {
    try {
      await getAuthRepository().signOut();
      toast.success('Signed out successfully');
    } catch {
      toast.error('Failed to sign out');
    }
  };

  return (
    <MarketingPage
      title={user ? 'Account' : 'Sign In'}
      subtitle={
        user
          ? `Signed in as ${typeof user.email === 'string' ? user.email : 'your account'}`
          : 'Sign in to sync history across devices.'
      }
    >
      <div className="mt-8 card p-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-geist-foreground font-medium">
            {user
              ? typeof user.displayName === 'string'
                ? user.displayName
                : 'Signed in'
              : 'Continue with Google'}
          </p>
          <p className="mt-1 text-sm text-geist-accents-6 truncate">
            {user ? (typeof user.email === 'string' ? user.email : '') : 'OAuth via Firebase Auth'}
          </p>
        </div>

        {!user ? (
          <Button variant="primary" onClick={handleSignIn} className="bg-orange-500 hover:bg-orange-600">
            Sign in
          </Button>
        ) : (
          <Button variant="ghost" onClick={handleSignOut}>
            Sign out
          </Button>
        )}
      </div>
    </MarketingPage>
  );
}


