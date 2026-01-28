import { auth } from '@/config/firebase';

const FIREBASE_TOKEN_HEADER = 'X-Firebase-Token';
const DEV_FALLBACK_API_KEY = 'dev-key-12345';

export async function getFirebaseToken(): Promise<string | null> {
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
  const token = await getFirebaseToken();
  if (!token) {
    if ((import.meta as { env?: { MODE?: string } }).env?.MODE !== 'production') {
      return {
        'X-API-Key': DEV_FALLBACK_API_KEY,
      };
    }
    return {};
  }

  return {
    [FIREBASE_TOKEN_HEADER]: token,
  };
}
