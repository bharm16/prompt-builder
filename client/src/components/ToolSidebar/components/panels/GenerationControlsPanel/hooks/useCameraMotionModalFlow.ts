import { useCallback, useEffect, useState } from 'react';
import { logger } from '@/services/LoggingService';
import type { CameraPath } from '@/features/convergence/types';
import type { KeyframeTile } from '@components/ToolSidebar/types';

const log = logger.child('GenerationControlsPanel');

interface UseCameraMotionModalFlowOptions {
  showMotionControls: boolean;
  hasPrimaryKeyframe: boolean;
  keyframes: KeyframeTile[];
  primaryKeyframeUrlHost: string | null;
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
  hasPrimaryKeyframe,
  keyframes,
  primaryKeyframeUrlHost,
  cameraMotion,
  onSelectCameraMotion,
}: UseCameraMotionModalFlowOptions): UseCameraMotionModalFlowResult {
  const [showCameraMotionModal, setShowCameraMotionModal] = useState(false);

  useEffect(() => {
    if (keyframes[0]) return;
    if (!showCameraMotionModal) return;
    log.info('Closing camera motion modal because primary keyframe is missing', {
      keyframesCount: keyframes.length,
    });
    setShowCameraMotionModal(false);
  }, [keyframes, showCameraMotionModal]);

  const handleCameraMotionButtonClick = useCallback(() => {
    if (!hasPrimaryKeyframe) {
      log.warn('Camera motion modal requested without a primary keyframe', {
        showMotionControls,
        keyframesCount: keyframes.length,
      });
      return;
    }

    log.info('Opening camera motion modal from generation controls panel', {
      keyframesCount: keyframes.length,
      primaryKeyframeUrlHost,
      currentCameraMotionId: cameraMotion?.id ?? null,
    });
    setShowCameraMotionModal(true);
  }, [
    hasPrimaryKeyframe,
    showMotionControls,
    keyframes.length,
    primaryKeyframeUrlHost,
    cameraMotion?.id,
  ]);

  const handleCloseCameraMotionModal = useCallback(() => {
    log.info('Camera motion modal closed from generation controls panel', {
      primaryKeyframeUrlHost,
      currentCameraMotionId: cameraMotion?.id ?? null,
    });
    setShowCameraMotionModal(false);
  }, [cameraMotion?.id, primaryKeyframeUrlHost]);

  const handleSelectCameraMotion = useCallback(
    (path: CameraPath) => {
      log.info('Camera motion selected from modal in generation controls panel', {
        cameraMotionId: path.id,
        cameraMotionLabel: path.label,
        primaryKeyframeUrlHost,
      });
      onSelectCameraMotion(path);
      setShowCameraMotionModal(false);
    },
    [onSelectCameraMotion, primaryKeyframeUrlHost]
  );

  return {
    showCameraMotionModal,
    handleCameraMotionButtonClick,
    handleCloseCameraMotionModal,
    handleSelectCameraMotion,
  };
}
