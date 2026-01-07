import { buildFirebaseAuthHeaders } from './firebaseAuth';

interface BuiltRequest {
  url: string;
  init: RequestInit;
}

export function createFirebaseTokenInterceptor(): (request: BuiltRequest) => Promise<BuiltRequest> {
  return async (request: BuiltRequest): Promise<BuiltRequest> => {
    const headers = new Headers(request.init.headers);
    const authHeaders = await buildFirebaseAuthHeaders();
    Object.entries(authHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

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
