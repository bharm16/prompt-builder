import { auth } from '@/config/firebase';

interface BuiltRequest {
  url: string;
  init: RequestInit;
}

const FIREBASE_TOKEN_HEADER = 'X-Firebase-Token';

async function getFirebaseToken(): Promise<string | null> {
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

export function createFirebaseTokenInterceptor(): (request: BuiltRequest) => Promise<BuiltRequest> {
  return async (request: BuiltRequest): Promise<BuiltRequest> => {
    const token = await getFirebaseToken();
    if (!token) {
      return request;
    }

    const headers = new Headers(request.init.headers);
    headers.set(FIREBASE_TOKEN_HEADER, token);

    return {
      ...request,
      init: {
        ...request.init,
        headers: Object.fromEntries(headers.entries()),
      },
    };
  };
}

export function setupApiAuth(apiClient: {
  addRequestInterceptor: (
    interceptor: (request: BuiltRequest) => BuiltRequest | Promise<BuiltRequest>
  ) => void;
}): void {
  apiClient.addRequestInterceptor(createFirebaseTokenInterceptor());
}

