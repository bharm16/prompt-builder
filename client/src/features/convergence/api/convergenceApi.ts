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

import type { ZodType } from 'zod';
import { API_CONFIG } from '@/config/api.config';
import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';
import type {
  AbandonSessionRequest,
  AbandonSessionResponse,
  ConvergenceApiError,
  ConvergenceErrorCode,
  ConvergenceSession,
  DimensionType,
  FinalizeSessionResponse,
  GenerateCameraMotionRequest,
  GenerateCameraMotionResponse,
  GenerateFinalFrameRequest,
  GenerateFinalFrameResponse,
  GenerateSubjectMotionRequest,
  GenerateSubjectMotionResponse,
  RegenerateFinalFrameRequest,
  RegenerateRequest,
  RegenerateResponse,
  SetStartingPointRequest,
  SetStartingPointResponse,
  SelectCameraMotionRequest,
  SelectOptionRequest,
  SelectOptionResponse,
  StartSessionRequest,
  StartSessionResponse,
  UploadImageResponse,
} from '../types';
import {
  AbandonSessionResponseSchema,
  ActiveSessionResponseSchema,
  FinalizeSessionResponseSchema,
  GenerateCameraMotionResponseSchema,
  GenerateFinalFrameResponseSchema,
  GenerateSubjectMotionResponseSchema,
  RegenerateResponseSchema,
  SetStartingPointResponseSchema,
  SelectCameraMotionResponseSchema,
  SelectOptionResponseSchema,
  StartSessionResponseSchema,
  UploadImageResponseSchema,
  parseConvergenceApiError,
} from './schemas';

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
const CONVERGENCE_MEDIA_BASE = `${API_CONFIG.baseURL}/convergence/media`;
const STATUS_CODE_TO_ERROR: Record<number, ConvergenceErrorCode> = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHORIZED',
  402: 'INSUFFICIENT_CREDITS',
  403: 'UNAUTHORIZED',
  404: 'SESSION_NOT_FOUND',
  409: 'ACTIVE_SESSION_EXISTS',
  410: 'SESSION_EXPIRED',
  429: 'REGENERATION_LIMIT_EXCEEDED',
};
const DEFAULT_ERROR_CODE: ConvergenceErrorCode = 'SESSION_NOT_FOUND';

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
    const data: unknown = await response.json();
    errorData = parseConvergenceApiError(data);
  } catch {
    // JSON parsing failed, use status text
  }

  if (errorData) {
    throw ConvergenceError.fromApiError(errorData);
  }

  // Fallback error based on HTTP status
  const code = STATUS_CODE_TO_ERROR[response.status] || DEFAULT_ERROR_CODE;
  throw new ConvergenceError(code, `Request failed with status ${response.status}: ${response.statusText}`);
}

/**
 * Make an authenticated fetch request with error handling
 */
async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {},
  schema: ZodType<T>,
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

  const data: unknown = await response.json();
  return schema.parse(data);
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
    StartSessionResponseSchema,
    signal
  );
}

/**
 * Set the starting point mode for a convergence session.
 */
export async function setStartingPoint(
  request: SetStartingPointRequest,
  signal?: AbortSignal
): Promise<SetStartingPointResponse> {
  return fetchWithAuth<SetStartingPointResponse>(
    '/starting-point',
    {
      method: 'POST',
      body: JSON.stringify(request),
    },
    SetStartingPointResponseSchema,
    signal
  );
}

/**
 * Generate the HQ final frame after convergence selections.
 */
export async function generateFinalFrame(
  request: GenerateFinalFrameRequest,
  signal?: AbortSignal
): Promise<GenerateFinalFrameResponse> {
  return fetchWithAuth<GenerateFinalFrameResponse>(
    '/final-frame/generate',
    {
      method: 'POST',
      body: JSON.stringify(request),
    },
    GenerateFinalFrameResponseSchema,
    signal
  );
}

/**
 * Regenerate the HQ final frame.
 */
export async function regenerateFinalFrame(
  request: RegenerateFinalFrameRequest,
  signal?: AbortSignal
): Promise<GenerateFinalFrameResponse> {
  return fetchWithAuth<GenerateFinalFrameResponse>(
    '/final-frame/regenerate',
    {
      method: 'POST',
      body: JSON.stringify(request),
    },
    GenerateFinalFrameResponseSchema,
    signal
  );
}

/**
 * Upload an image for the convergence flow.
 */
export async function uploadImage(file: File, signal?: AbortSignal): Promise<UploadImageResponse> {
  const headers = await buildFirebaseAuthHeaders();
  const body = new FormData();
  body.append('image', file);

  const response = await fetch(`${CONVERGENCE_MEDIA_BASE}/upload-image`, {
    method: 'POST',
    headers,
    body,
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    await handleErrorResponse(response);
  }

  const data: unknown = await response.json();
  return UploadImageResponseSchema.parse(data);
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
    SelectOptionResponseSchema,
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
    RegenerateResponseSchema,
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
    GenerateCameraMotionResponseSchema,
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

  await fetchWithAuth(
    '/camera-motion/select',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    SelectCameraMotionResponseSchema
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
    GenerateSubjectMotionResponseSchema,
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
    },
    FinalizeSessionResponseSchema
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
    const response = await fetchWithAuth(
      '/session/active',
      { method: 'GET' },
      ActiveSessionResponseSchema
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
  const response = await fetchWithAuth<{ session: ConvergenceSession | null }>(
    `/session/${sessionId}`,
    { method: 'GET' },
    ActiveSessionResponseSchema
  );

  if (!response.session) {
    throw new ConvergenceError('SESSION_NOT_FOUND', 'Session not found');
  }

  return response.session;
}

/**
 * Abandon an existing session.
 *
 * Allows users to explicitly abandon their active session so they can start fresh.
 * Optionally cleans up associated images from storage.
 *
 * @param sessionId - The session ID to abandon
 * @param deleteImages - Whether to delete associated images from storage (default: false)
 * @returns AbandonSessionResponse confirming abandonment
 * @throws ConvergenceError if session not found or unauthorized
 */
export async function abandonSession(
  sessionId: string,
  deleteImages: boolean = false
): Promise<AbandonSessionResponse> {
  const body: AbandonSessionRequest = {
    sessionId,
    deleteImages,
  };

  return fetchWithAuth<AbandonSessionResponse>(
    '/session/abandon',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    AbandonSessionResponseSchema
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
  setStartingPoint,
  selectOption,
  regenerate,
  generateFinalFrame,
  regenerateFinalFrame,
  generateCameraMotion,
  selectCameraMotion,
  generateSubjectMotion,
  finalizeSession,
  getActiveSession,
  getSession,
  abandonSession,
  uploadImage,
};

export default convergenceApi;
