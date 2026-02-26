import React from 'react';
import { cn } from '@/utils/cn';

interface ComparisonPreviewProps {
  label: string;
  imageUrl?: string;
  videoUrl?: string;
  className?: string;
}

export function ComparisonPreview({
  label,
  imageUrl,
  videoUrl,
  className,
}: ComparisonPreviewProps): React.ReactElement {
  return (
    <div className={cn('rounded-md border border-[#2A2B31] bg-[#181A1F] p-2', className)}>
      <div className="text-[11px] text-[#A1AFC5]">{label}</div>
      <div className="mt-2 flex items-center justify-center rounded-md bg-[#111218] text-[10px] text-[#6D778B]">
        {videoUrl ? (
          <video className="h-24 w-full rounded-md object-cover" src={videoUrl} muted />
        ) : imageUrl ? (
          <img className="h-24 w-full rounded-md object-cover" src={imageUrl} alt={label} />
        ) : (
          <div className="h-24 w-full flex items-center justify-center">No preview</div>
        )}
      </div>
    </div>
  );
}
