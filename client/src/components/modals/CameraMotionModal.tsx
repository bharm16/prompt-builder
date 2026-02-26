/**
 * CameraMotionModal
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { Loader2, X } from '@promptstudio/system/components/ui';
import { cn } from '@/utils/cn';
import type { CameraPath } from '@/features/convergence/types';
import { CameraMotionPickerWithErrorBoundary } from '@/features/convergence/components/CameraMotionPicker';
import { useCameraMotion } from '@/hooks/useCameraMotion';
import { useResolvedMediaUrl } from '@/hooks/useResolvedMediaUrl';
import { logger } from '@/services/LoggingService';
import { sanitizeError } from '@/utils/logging';
import { safeUrlHost } from '@/utils/url';

const log = logger.child('CameraMotionModal');
const OPERATION = 'cameraMotionModal';

export interface CameraMotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageStoragePath?: string | null;
  imageAssetId?: string | null;
  onSelect: (cameraPath: CameraPath) => void;
  initialSelection?: CameraPath | null;
}

export function CameraMotionModal({
  isOpen,
  onClose,
  imageUrl,
  imageStoragePath = null,
  imageAssetId = null,
  onSelect,
  initialSelection = null,
}: CameraMotionModalProps): React.ReactElement | null {
  const { state, actions } = useCameraMotion();
  const { estimateDepth, reset } = actions;
  const { url: resolvedImageUrl } = useResolvedMediaUrl({
    kind: 'image',
    url: imageUrl,
    storagePath: imageStoragePath,
    assetId: imageAssetId,
    enabled: isOpen,
    preferFresh: true,
  });
  const pickerImageUrl = resolvedImageUrl?.trim() || imageUrl.trim();
  const lastImageUrlRef = useRef<string | null>(null);
  const previousIsOpenRef = useRef(false);
  const hasLoggedEstimateRef = useRef(false);

  useEffect(() => {
    if (isOpen && !previousIsOpenRef.current) {
      log.info('Camera motion modal opened', {
        operation: OPERATION,
        imageUrlHost: safeUrlHost(imageUrl),
        hasInitialSelection: Boolean(initialSelection?.id),
        initialSelectionId: initialSelection?.id ?? null,
      });
    } else if (!isOpen && previousIsOpenRef.current) {
      log.info('Camera motion modal closed', {
        operation: OPERATION,
        imageUrlHost: safeUrlHost(lastImageUrlRef.current),
        hadEstimated: state.hasEstimated,
        fallbackMode: state.fallbackMode,
      });
    }

    previousIsOpenRef.current = isOpen;
  }, [isOpen, imageUrl, initialSelection?.id, state.hasEstimated, state.fallbackMode]);

  useEffect(() => {
    if (!isOpen) {
      const hadOpenContext = previousIsOpenRef.current || Boolean(lastImageUrlRef.current);
      lastImageUrlRef.current = null;
      hasLoggedEstimateRef.current = false;
      if (hadOpenContext) {
        log.debug('Camera motion modal reset on close', {
          operation: OPERATION,
        });
      }
      reset();
      return;
    }

    const trimmedUrl = imageUrl.trim();
    if (!trimmedUrl) {
      log.warn('Camera motion modal opened without a keyframe image', {
        operation: OPERATION,
        imageUrlLength: imageUrl.length,
      });
      return;
    }

    const isNewImage = lastImageUrlRef.current !== trimmedUrl;
    if (isNewImage) {
      const previousHost = safeUrlHost(lastImageUrlRef.current);
      const nextHost = safeUrlHost(trimmedUrl);
      log.info('Camera motion modal detected new image, estimating depth', {
        operation: OPERATION,
        previousImageUrlHost: previousHost,
        nextImageUrlHost: nextHost,
      });
      lastImageUrlRef.current = trimmedUrl;
      reset();
      void estimateDepth(trimmedUrl);
      return;
    }

    if (!state.hasEstimated && !state.isEstimatingDepth) {
      log.debug('Camera motion modal re-triggering depth estimation', {
        operation: OPERATION,
        imageUrlHost: safeUrlHost(trimmedUrl),
      });
      void estimateDepth(trimmedUrl);
    }
  }, [isOpen, imageUrl, state.hasEstimated, state.isEstimatingDepth, estimateDepth, reset]);

  useEffect(() => {
    if (!isOpen) {
      hasLoggedEstimateRef.current = false;
      return;
    }
    if (!state.hasEstimated || hasLoggedEstimateRef.current) {
      return;
    }

    hasLoggedEstimateRef.current = true;
    log.info('Camera motion modal received depth estimation result', {
      operation: OPERATION,
      fallbackMode: state.fallbackMode,
      cameraPathsCount: state.cameraPaths.length,
      depthMapUrlHost: safeUrlHost(state.depthMapUrl),
      pickerImageUrlHost: safeUrlHost(pickerImageUrl),
      error: state.error,
    });
  }, [
    isOpen,
    state.hasEstimated,
    state.fallbackMode,
    state.cameraPaths.length,
    state.depthMapUrl,
    pickerImageUrl,
    state.error,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        log.info('Camera motion modal closed via Escape key', {
          operation: OPERATION,
        });
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSelect = useCallback(
    (cameraMotionId: string) => {
      log.info('Camera motion selection requested from modal', {
        operation: OPERATION,
        cameraMotionId,
        availableCameraPaths: state.cameraPaths.length,
      });
      const selectedPath = state.cameraPaths.find((path) => path.id === cameraMotionId);
      if (!selectedPath) {
        log.warn('Camera motion selection id not found in modal state', {
          operation: OPERATION,
          cameraMotionId,
          availableCameraMotionIds: state.cameraPaths.map((path) => path.id),
        });
        return;
      }
      log.info('Camera motion selected in modal', {
        operation: OPERATION,
        cameraMotionId: selectedPath.id,
        cameraMotionLabel: selectedPath.label,
        fallbackMode: state.fallbackMode,
      });
      onSelect(selectedPath);
      onClose();
    },
    [state.cameraPaths, state.fallbackMode, onClose, onSelect]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => {
          log.info('Camera motion modal closed via backdrop click', {
            operation: OPERATION,
          });
          onClose();
        }}
      />

      <div
        className={cn(
          'relative z-10 w-full max-w-5xl max-h-[90vh] overflow-auto',
          'bg-[#12131A] rounded-xl border border-[#29292D] shadow-2xl mx-4'
        )}
      >
        <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-4 bg-[#12131A] border-b border-[#29292D]">
          <h2 className="text-lg font-semibold text-white">Choose Camera Motion</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#A1AFC5] hover:text-white hover:bg-[#1B1E23]"
            aria-label="Close camera motion modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {state.isEstimatingDepth ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#2C22FA] mb-4" />
              <p className="text-[#A1AFC5]">Analyzing image depth...</p>
            </div>
          ) : (
            <CameraMotionPickerWithErrorBoundary
              cameraPaths={state.cameraPaths}
              imageUrl={pickerImageUrl}
              depthMapUrl={state.depthMapUrl}
              selectedCameraMotion={initialSelection?.id ?? null}
              fallbackMode={state.fallbackMode}
              onSelect={(cameraMotionId) => {
                try {
                  handleSelect(cameraMotionId);
                } catch (error) {
                  const info = sanitizeError(error);
                  const errObj = error instanceof Error ? error : new Error(info.message);
                  log.error('Camera motion selection handler threw in modal', errObj, {
                    operation: OPERATION,
                    cameraMotionId,
                    errorName: info.name,
                  });
                  throw errObj;
                }
              }}
              onBack={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
