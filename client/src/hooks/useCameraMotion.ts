/**
 * useCameraMotion Hook
 */

import { useCallback, useReducer } from 'react';
import type { CameraPath } from '@/features/convergence/types';
import { estimateDepth } from '@/api/motionApi';
import { logger } from '@/services/LoggingService';
import { sanitizeError } from '@/utils/logging';
import { safeUrlHost } from '@/utils/url';

const log = logger.child('useCameraMotion');
const OPERATION = 'estimateDepth';

interface State {
  isEstimatingDepth: boolean;
  error: string | null;
  depthMapUrl: string | null;
  cameraPaths: CameraPath[];
  fallbackMode: boolean;
  hasEstimated: boolean;
  selectedCameraMotion: CameraPath | null;
  subjectMotion: string;
}

const initialState: State = {
  isEstimatingDepth: false,
  error: null,
  depthMapUrl: null,
  cameraPaths: [],
  fallbackMode: false,
  hasEstimated: false,
  selectedCameraMotion: null,
  subjectMotion: '',
};

type Action =
  | { type: 'ESTIMATE_START' }
  | {
      type: 'ESTIMATE_SUCCESS';
      depthMapUrl: string | null;
      cameraPaths: CameraPath[];
      fallbackMode: boolean;
    }
  | { type: 'ESTIMATE_ERROR'; error: string }
  | { type: 'SELECT'; cameraPath: CameraPath }
  | { type: 'CLEAR' }
  | { type: 'SET_SUBJECT_MOTION'; motion: string }
  | { type: 'RESET' };

interface UseCameraMotionActions {
  estimateDepth: (imageUrl: string) => Promise<void>;
  selectCameraMotion: (cameraPath: CameraPath) => void;
  clearSelection: () => void;
  setSubjectMotion: (motion: string) => void;
  reset: () => void;
}

interface UseCameraMotionResult {
  state: State;
  actions: UseCameraMotionActions;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ESTIMATE_START':
      return { ...state, isEstimatingDepth: true, error: null };
    case 'ESTIMATE_SUCCESS':
      return {
        ...state,
        isEstimatingDepth: false,
        depthMapUrl: action.depthMapUrl,
        cameraPaths: action.cameraPaths,
        fallbackMode: action.fallbackMode,
        hasEstimated: true,
        error: null,
      };
    case 'ESTIMATE_ERROR':
      return {
        ...state,
        isEstimatingDepth: false,
        error: action.error,
        fallbackMode: true,
        hasEstimated: true,
      };
    case 'SELECT':
      return { ...state, selectedCameraMotion: action.cameraPath };
    case 'CLEAR':
      return { ...state, selectedCameraMotion: null };
    case 'SET_SUBJECT_MOTION':
      return { ...state, subjectMotion: action.motion };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function useCameraMotion(): UseCameraMotionResult {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleEstimateDepth = useCallback(async (imageUrl: string) => {
    const trimmedUrl = imageUrl.trim();
    const depthRequestId = `depth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const imageUrlHost = safeUrlHost(trimmedUrl);

    log.info('Depth estimation requested from hook', {
      operation: OPERATION,
      depthRequestId,
      imageUrlHost,
      imageUrlLength: trimmedUrl.length,
      hasEstimated: state.hasEstimated,
      isEstimatingDepth: state.isEstimatingDepth,
    });

    dispatch({ type: 'ESTIMATE_START' });
    try {
      const result = await estimateDepth(trimmedUrl);
      const durationMs = Math.round(
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
      );

      log.info('Depth estimation succeeded in hook', {
        operation: OPERATION,
        depthRequestId,
        durationMs,
        imageUrlHost,
        fallbackMode: result.fallbackMode,
        cameraPathsCount: result.cameraPaths.length,
        depthMapUrlHost: safeUrlHost(result.depthMapUrl),
      });

      dispatch({
        type: 'ESTIMATE_SUCCESS',
        depthMapUrl: result.depthMapUrl,
        cameraPaths: result.cameraPaths,
        fallbackMode: result.fallbackMode,
      });
    } catch (error) {
      const durationMs = Math.round(
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
      );
      const info = sanitizeError(error);
      const errObj = error instanceof Error ? error : new Error(info.message);

      log.error('Depth estimation failed in hook', errObj, {
        operation: OPERATION,
        depthRequestId,
        durationMs,
        imageUrlHost,
        errorName: info.name,
      });

      dispatch({
        type: 'ESTIMATE_ERROR',
        error: errObj.message,
      });
    }
  }, [state.hasEstimated, state.isEstimatingDepth]);

  return {
    state,
    actions: {
      estimateDepth: handleEstimateDepth,
      selectCameraMotion: useCallback(
        (cameraPath: CameraPath) => {
          log.info('Camera motion selected in hook', {
            cameraMotionId: cameraPath.id,
            cameraMotionLabel: cameraPath.label,
            duration: cameraPath.duration,
          });
          dispatch({ type: 'SELECT', cameraPath });
        },
        []
      ),
      clearSelection: useCallback(() => {
        log.debug('Camera motion selection cleared in hook');
        dispatch({ type: 'CLEAR' });
      }, []),
      setSubjectMotion: useCallback(
        (motion: string) => {
          log.debug('Subject motion updated in hook', {
            subjectMotionLength: motion.trim().length,
          });
          dispatch({ type: 'SET_SUBJECT_MOTION', motion });
        },
        []
      ),
      reset: useCallback(() => {
        log.debug('Camera motion hook state reset');
        dispatch({ type: 'RESET' });
      }, []),
    },
  };
}
