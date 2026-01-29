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
        <label className="block text-xs font-medium text-[#7C839C] mb-1.5">
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
              ? 'bg-[#1B1E23] hover:bg-[#1E1F25] cursor-pointer'
              : 'bg-[#16171B] text-[#5B6070] cursor-not-allowed opacity-80',
            hasPrimaryKeyframe && (cameraMotion ? 'border-[#2C22FA]/50' : 'border-[#29292D]'),
            !hasPrimaryKeyframe && 'border-[#29292D]'
          )}
        >
          {cameraMotion ? (
            <span className="flex items-center gap-2">
              <span className="text-[#2C22FA]">✓</span>
              <span className="text-white">{cameraMotion.label}</span>
            </span>
          ) : (
            <span className="text-[#7C839C]">Set camera motion...</span>
          )}
        </button>
        {!hasPrimaryKeyframe && (
          <p className="mt-1 text-xs text-[#7C839C]/80">
            Upload a keyframe to enable camera motion.
          </p>
        )}
      </div>
    </div>
  );
}
