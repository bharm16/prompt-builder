import React from 'react';
import { Check } from '@promptstudio/system/components/ui';
import { cn } from '@/utils/cn';
import type { KeyframeOption } from './hooks/useKeyframeGeneration';
import { FaceMatchIndicator } from './FaceMatchIndicator';

interface KeyframeOptionCardProps {
  keyframe: KeyframeOption;
  isSelected: boolean;
  onSelect: () => void;
}

export function KeyframeOptionCard({
  keyframe,
  isSelected,
  onSelect,
}: KeyframeOptionCardProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative aspect-video overflow-hidden rounded-lg border-2 transition',
        isSelected ? 'border-violet-500 ring-2 ring-violet-500/20' : 'border-transparent hover:border-border'
      )}
    >
      <img src={keyframe.imageUrl} alt="Keyframe option" className="h-full w-full object-cover" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <FaceMatchIndicator score={keyframe.faceMatchScore} />
      </div>
      {isSelected && (
        <div className="absolute right-2 top-2 rounded-full bg-violet-500 p-1 text-white">
          <Check className="h-4 w-4" />
        </div>
      )}
    </button>
  );
}

export default KeyframeOptionCard;
