import { auth } from '@/config/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const FIREBASE_TOKEN_HEADER = 'X-Firebase-Token';
const DEV_FALLBACK_API_KEY = 'dev-key-12345';
const AUTH_READY_TIMEOUT_MS = 3000;

let authReadyPromise: Promise<void> | null = null;

const waitForAuthReady = async (): Promise<void> => {
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      const timeoutId = setTimeout(resolve, AUTH_READY_TIMEOUT_MS);
      const unsubscribe = onAuthStateChanged(
        auth,
        () => {
          clearTimeout(timeoutId);
          resolve();
          unsubscribe();
        },
        () => {
          clearTimeout(timeoutId);
          resolve();
          unsubscribe();
        }
      );
    });
  }

  await authReadyPromise;
};

export async function getFirebaseToken(): Promise<string | null> {
  await waitForAuthReady();
  const user = auth.currentUser;
  if (!user) {
    return null;
  }

  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export async function buildFirebaseAuthHeaders(): Promise<Record<string, string>> {
  await waitForAuthReady();
  const user = auth.currentUser;
  if (!user) {
    if ((import.meta as { env?: { MODE?: string } }).env?.MODE !== 'production') {
      return {
        'X-API-Key': DEV_FALLBACK_API_KEY,
      };
    }
    return {};
  }

  try {
    const token = await user.getIdToken();
    if (!token) {
      return {};
    }
    return {
      [FIREBASE_TOKEN_HEADER]: token,
    };
  } catch {
    return {};
  }
}
