import { auth } from '@/config/firebase';

const FIREBASE_TOKEN_HEADER = 'X-Firebase-Token';

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
    return {};
  }

  return {
    [FIREBASE_TOKEN_HEADER]: token,
  };
}
