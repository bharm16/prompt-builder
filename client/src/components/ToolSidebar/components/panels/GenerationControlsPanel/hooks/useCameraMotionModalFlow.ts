import { useCallback, useEffect, useState } from 'react';
import { logger } from '@/services/LoggingService';
import type { CameraPath } from '@/features/convergence/types';
import type { KeyframeTile } from '@components/ToolSidebar/types';

const log = logger.child('GenerationControlsPanel');

interface UseCameraMotionModalFlowOptions {
  showMotionControls: boolean;
  hasStartFrame: boolean;
  keyframesCount: number;
  startFrame: KeyframeTile | null;
  startFrameUrlHost: string | null;
  cameraMotion: CameraPath | null;
  onSelectCameraMotion: (path: CameraPath) => void;
}

interface UseCameraMotionModalFlowResult {
  showCameraMotionModal: boolean;
  handleCameraMotionButtonClick: () => void;
  handleCloseCameraMotionModal: () => void;
  handleSelectCameraMotion: (path: CameraPath) => void;
}

export function useCameraMotionModalFlow({
  showMotionControls,
  hasStartFrame,
  keyframesCount,
  startFrame,
  startFrameUrlHost,
  cameraMotion,
  onSelectCameraMotion,
}: UseCameraMotionModalFlowOptions): UseCameraMotionModalFlowResult {
  const [showCameraMotionModal, setShowCameraMotionModal] = useState(false);

  useEffect(() => {
    if (startFrame) return;
    if (!showCameraMotionModal) return;
    log.info('Closing camera motion modal because start frame is missing', {
      keyframesCount,
    });
    setShowCameraMotionModal(false);
  }, [keyframesCount, showCameraMotionModal, startFrame]);

  const handleCameraMotionButtonClick = useCallback(() => {
    if (!hasStartFrame) {
      log.warn('Camera motion modal requested without a start frame', {
        showMotionControls,
        keyframesCount,
      });
      return;
    }

    log.info('Opening camera motion modal from generation controls panel', {
      keyframesCount,
      startFrameUrlHost,
      currentCameraMotionId: cameraMotion?.id ?? null,
    });
    setShowCameraMotionModal(true);
  }, [
    hasStartFrame,
    showMotionControls,
    keyframesCount,
    startFrameUrlHost,
    cameraMotion?.id,
  ]);

  const handleCloseCameraMotionModal = useCallback(() => {
    log.info('Camera motion modal closed from generation controls panel', {
      startFrameUrlHost,
      currentCameraMotionId: cameraMotion?.id ?? null,
    });
    setShowCameraMotionModal(false);
  }, [cameraMotion?.id, startFrameUrlHost]);

  const handleSelectCameraMotion = useCallback(
    (path: CameraPath) => {
      log.info('Camera motion selected from modal in generation controls panel', {
        cameraMotionId: path.id,
        cameraMotionLabel: path.label,
        startFrameUrlHost,
      });
      onSelectCameraMotion(path);
      setShowCameraMotionModal(false);
    },
    [onSelectCameraMotion, startFrameUrlHost]
  );

  return {
    showCameraMotionModal,
    handleCameraMotionButtonClick,
    handleCloseCameraMotionModal,
    handleSelectCameraMotion,
  };
}
