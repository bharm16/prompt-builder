import React from 'react';
import { cn } from '@utils/cn';
import type { CameraPath } from '@/features/convergence/types';

interface CameraMotionSelectorProps {
  hasPrimaryKeyframe: boolean;
  cameraMotion: CameraPath | null;
  onOpen: () => void;
}

export function CameraMotionSelector({
  hasPrimaryKeyframe,
  cameraMotion,
  onOpen,
}: CameraMotionSelectorProps): React.ReactElement {
  return (
    <div className="px-3 pt-3 space-y-3">
      <div>
        <label className="block text-xs font-medium text-tool-text-placeholder mb-1.5">
          Camera Motion
        </label>
        <button
          type="button"
          onClick={onOpen}
          disabled={!hasPrimaryKeyframe}
          aria-disabled={!hasPrimaryKeyframe}
          className={cn(
            'w-full px-3 py-2 rounded-lg text-sm text-left transition-colors',
            'border',
            hasPrimaryKeyframe
              ? 'bg-surface-1 hover:bg-tool-nav-active cursor-pointer'
              : 'bg-tool-surface-card text-tool-text-dim cursor-not-allowed opacity-80',
            hasPrimaryKeyframe && (cameraMotion ? 'border-accent-runway/50' : 'border-tool-border-dark'),
            !hasPrimaryKeyframe && 'border-tool-border-dark'
          )}
        >
          {cameraMotion ? (
            <span className="flex items-center gap-2">
              <span className="text-accent-runway">✓</span>
              <span className="text-white">{cameraMotion.label}</span>
            </span>
          ) : (
            <span className="text-tool-text-placeholder">Set camera motion...</span>
          )}
        </button>
        {!hasPrimaryKeyframe && (
          <p className="mt-1 text-xs text-tool-text-placeholder/80">
            Upload a keyframe to enable camera motion.
          </p>
        )}
      </div>
    </div>
  );
}
