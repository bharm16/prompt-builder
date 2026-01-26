/**
 * Convergence API Layer
 *
 * Centralized API layer for all convergence operations.
 * Provides methods for session management, dimension selection, camera motion,
 * subject motion, and finalization.
 *
 * Requirements:
 * - 10.1: Provide methods for all convergence operations
 * - 10.2: Throw errors with response messages on non-OK responses
 * - 10.3: Use JSON content type for all requests
 * - 10.4: Match backend contract for request/response types
 * - 10.5: Support request cancellation via AbortController
 */

import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';
import { API_CONFIG } from '@/config/api.config';
import type {
  StartSessionRequest,
  StartSessionResponse,
  SelectOptionRequest,
  SelectOptionResponse,
  RegenerateRequest,
  RegenerateResponse,
  GenerateCameraMotionRequest,
  GenerateCameraMotionResponse,
  SelectCameraMotionRequest,
  GenerateSubjectMotionRequest,
  GenerateSubjectMotionResponse,
  FinalizeSessionResponse,
  ConvergenceSession,
  ConvergenceApiError,
  ConvergenceErrorCode,
  DimensionType,
} from '../types';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Custom error class for convergence API errors.
 * Parses backend error responses and provides structured error information.
 */
export class ConvergenceError extends Error {
  public readonly code: ConvergenceErrorCode;
  public readonly details: Record<string, unknown> | undefined;

  constructor(code: ConvergenceErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ConvergenceError';
    this.code = code;
    this.details = details;
  }

  /**
   * Create a ConvergenceError from an API error response
   */
  static fromApiError(error: ConvergenceApiError): ConvergenceError {
    return new ConvergenceError(error.code, error.message, error.details);
  }
}

// ============================================================================
// API Configuration
// ============================================================================

const CONVERGENCE_API_BASE = `${API_CONFIG.baseURL}/convergence`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build request headers with authentication and content type
 */
async function buildHeaders(): Promise<Record<string, string>> {
  const authHeaders = await buildFirebaseAuthHeaders();
  return {
    'Content-Type': 'application/json',
    ...authHeaders,
  };
}

/**
 * Parse error response and throw appropriate ConvergenceError
 */
async function handleErrorResponse(response: Response): Promise<never> {
  let errorData: ConvergenceApiError | null = null;

  try {
    const data = await response.json();
    // Check if response matches ConvergenceApiError structure
    if (data && typeof data.code === 'string' && typeof data.message === 'string') {
      errorData = data as ConvergenceApiError;
    } else if (data && typeof data.error === 'string') {
      // Handle generic error format
      errorData = {
        code: 'SESSION_NOT_FOUND' as ConvergenceErrorCode, // Default code
        message: data.error,
      };
    }
  } catch {
    // JSON parsing failed, use status text
  }

  if (errorData) {
    throw ConvergenceError.fromApiError(errorData);
  }

  // Fallback error based on HTTP status
  const statusCodeMap: Record<number, ConvergenceErrorCode> = {
    401: 'UNAUTHORIZED',
    403: 'UNAUTHORIZED',
    404: 'SESSION_NOT_FOUND',
    409: 'ACTIVE_SESSION_EXISTS',
    402: 'INSUFFICIENT_CREDITS',
  };

  const code = statusCodeMap[response.status] || 'SESSION_NOT_FOUND';
  throw new ConvergenceError(code, `Request failed with status ${response.status}: ${response.statusText}`);
}

/**
 * Make an authenticated fetch request with error handling
 */
async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {},
  signal?: AbortSignal
): Promise<T> {
  const headers = await buildHeaders();

  const response = await fetch(`${CONVERGENCE_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    await handleErrorResponse(response);
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// API Methods
// ============================================================================

/**
 * Start a new convergence session with the given intent.
 *
 * @param intent - The user's creative intent/description
 * @param aspectRatio - Optional aspect ratio for generated images
 * @param signal - Optional AbortSignal for request cancellation
 * @returns StartSessionResponse with session ID, direction images, and options
 * @throws ConvergenceError if session creation fails or user already has active session
 *
 * Requirement 10.5: Supports request cancellation via AbortController
 */
export async function startSession(
  intent: string,
  aspectRatio?: string,
  signal?: AbortSignal
): Promise<StartSessionResponse> {
  const body: StartSessionRequest = { intent };
  if (aspectRatio) {
    body.aspectRatio = aspectRatio;
  }

  return fetchWithAuth<StartSessionResponse>(
    '/start',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    signal
  );
}

/**
 * Select an option for a dimension (direction or visual dimension).
 *
 * @param sessionId - The current session ID
 * @param dimension - The dimension being selected ('direction' or DimensionType)
 * @param optionId - The ID of the selected option
 * @param signal - Optional AbortSignal for request cancellation
 * @returns SelectOptionResponse with next dimension images and updated state
 * @throws ConvergenceError if session not found or selection fails
 *
 * Requirement 10.5: Supports request cancellation via AbortController
 */
export async function selectOption(
  sessionId: string,
  dimension: DimensionType | 'direction',
  optionId: string,
  signal?: AbortSignal
): Promise<SelectOptionResponse> {
  const body: SelectOptionRequest = {
    sessionId,
    dimension,
    optionId,
  };

  return fetchWithAuth<SelectOptionResponse>(
    '/select',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    signal
  );
}

/**
 * Regenerate options for the current dimension.
 *
 * @param sessionId - The current session ID
 * @param dimension - The dimension to regenerate options for
 * @param signal - Optional AbortSignal for request cancellation
 * @returns RegenerateResponse with new images and remaining regeneration count
 * @throws ConvergenceError if regeneration limit exceeded or session not found
 *
 * Requirement 10.5: Supports request cancellation via AbortController
 */
export async function regenerate(
  sessionId: string,
  dimension: DimensionType | 'direction',
  signal?: AbortSignal
): Promise<RegenerateResponse> {
  const body: RegenerateRequest = {
    sessionId,
    dimension,
  };

  return fetchWithAuth<RegenerateResponse>(
    '/regenerate',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    signal
  );
}

/**
 * Generate camera motion depth map and get available camera paths.
 *
 * @param sessionId - The current session ID
 * @param signal - Optional AbortSignal for request cancellation
 * @returns GenerateCameraMotionResponse with depth map URL and camera paths
 *          If depth estimation fails, returns fallbackMode=true with null depthMapUrl
 * @throws ConvergenceError if session not found
 *
 * Requirement 10.5: Supports request cancellation via AbortController
 */
export async function generateCameraMotion(
  sessionId: string,
  signal?: AbortSignal
): Promise<GenerateCameraMotionResponse> {
  const body: GenerateCameraMotionRequest = { sessionId };

  return fetchWithAuth<GenerateCameraMotionResponse>(
    '/camera-motion',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    signal
  );
}

/**
 * Select a camera motion for the session.
 *
 * @param sessionId - The current session ID
 * @param cameraMotionId - The ID of the selected camera motion
 * @returns void on success
 * @throws ConvergenceError if session not found
 */
export async function selectCameraMotion(
  sessionId: string,
  cameraMotionId: string
): Promise<void> {
  const body: SelectCameraMotionRequest = {
    sessionId,
    cameraMotionId,
  };

  await fetchWithAuth<void>(
    '/camera-motion/select',
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}

/**
 * Generate a subject motion preview video.
 *
 * @param sessionId - The current session ID
 * @param subjectMotion - Description of how the subject moves
 * @param signal - Optional AbortSignal for request cancellation
 * @returns GenerateSubjectMotionResponse with video URL and prompt
 * @throws ConvergenceError if video generation fails or session not found
 *
 * Requirement 10.5: Supports request cancellation via AbortController
 */
export async function generateSubjectMotion(
  sessionId: string,
  subjectMotion: string,
  signal?: AbortSignal
): Promise<GenerateSubjectMotionResponse> {
  const body: GenerateSubjectMotionRequest = {
    sessionId,
    subjectMotion,
  };

  return fetchWithAuth<GenerateSubjectMotionResponse>(
    '/subject-motion',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    signal
  );
}

/**
 * Finalize the convergence session.
 *
 * @param sessionId - The current session ID
 * @returns FinalizeSessionResponse with final prompt, locked dimensions, and costs
 * @throws ConvergenceError if session incomplete or not found
 */
export async function finalizeSession(
  sessionId: string
): Promise<FinalizeSessionResponse> {
  return fetchWithAuth<FinalizeSessionResponse>(
    '/finalize',
    {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }
  );
}

/**
 * Get the active session for the current user (for resume flow).
 *
 * @returns ConvergenceSession if an active session exists, null otherwise
 *
 * Requirement 1.6: Support session resume flow
 */
export async function getActiveSession(): Promise<ConvergenceSession | null> {
  try {
    const response = await fetchWithAuth<{ session: ConvergenceSession | null }>(
      '/session/active',
      { method: 'GET' }
    );
    return response.session;
  } catch (error) {
    // If no active session found, return null instead of throwing
    if (error instanceof ConvergenceError && error.code === 'SESSION_NOT_FOUND') {
      return null;
    }
    throw error;
  }
}

/**
 * Get a specific session by ID.
 *
 * @param sessionId - The session ID to retrieve
 * @returns ConvergenceSession if found
 * @throws ConvergenceError if session not found
 */
export async function getSession(sessionId: string): Promise<ConvergenceSession> {
  return fetchWithAuth<ConvergenceSession>(
    `/session/${sessionId}`,
    { method: 'GET' }
  );
}

// ============================================================================
// Exported API Object
// ============================================================================

/**
 * Convergence API object with all methods.
 * Provides a centralized interface for all convergence operations.
 *
 * Requirement 10.1: Provides methods for startSession, selectOption,
 * generateCameraMotion, selectCameraMotion, generateSubjectMotion,
 * regenerate, and finalize
 */
export const convergenceApi = {
  startSession,
  selectOption,
  regenerate,
  generateCameraMotion,
  selectCameraMotion,
  generateSubjectMotion,
  finalizeSession,
  getActiveSession,
  getSession,
};

export default convergenceApi;
