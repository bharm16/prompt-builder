import React from 'react';
import { getAuthRepository } from '@repositories/index';
import type { User } from './types';

export type UseAuthUserOptions = {
  onChange?: (user: User | null) => void;
  onInit?: () => void;
  onCleanup?: () => void;
};

export function useAuthUser(options: UseAuthUserOptions = {}): User | null {
  const [user, setUser] = React.useState<User | null>(null);
  const onChangeRef = React.useRef<UseAuthUserOptions['onChange']>(options.onChange);
  const onInitRef = React.useRef<UseAuthUserOptions['onInit']>(options.onInit);
  const onCleanupRef = React.useRef<UseAuthUserOptions['onCleanup']>(options.onCleanup);

  React.useEffect(() => {
    onChangeRef.current = options.onChange;
    onInitRef.current = options.onInit;
    onCleanupRef.current = options.onCleanup;
  }, [options.onChange, options.onInit, options.onCleanup]);

  React.useEffect(() => {
    onInitRef.current?.();
    const unsubscribe = getAuthRepository().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      onChangeRef.current?.(currentUser);
    });
    return () => {
      onCleanupRef.current?.();
      unsubscribe();
    };
  }, []);

  return user;
}
