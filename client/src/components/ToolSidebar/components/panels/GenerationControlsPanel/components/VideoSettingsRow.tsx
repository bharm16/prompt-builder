import React from 'react';
import { Settings2 } from '@promptstudio/system/components/ui';

interface VideoSettingsRowProps {
  aspectRatio: string;
  duration: number;
  aspectRatioOptions: string[];
  durationOptions: number[];
  onAspectRatioChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  isAspectRatioDisabled?: boolean;
  isDurationDisabled?: boolean;
}

export function VideoSettingsRow({
  aspectRatio,
  duration,
  aspectRatioOptions,
  durationOptions,
  onAspectRatioChange,
  onDurationChange,
  isAspectRatioDisabled,
  isDurationDisabled,
}: VideoSettingsRowProps): React.ReactElement {
  return (
    <div className="h-[52px] px-4 py-3 flex items-center justify-between">
      <div className="flex gap-1" />

      <div className="flex gap-1">
        <button
          type="button"
          className="w-[37px] h-7 px-2 rounded-md bg-[#1E1F25] border border-[#29292D] text-[#A1AFC5] text-sm"
          disabled
        >
          1
        </button>
        <select
          className="h-7 px-2 rounded-md bg-[#1E1F25] border border-[#29292D] text-[#A1AFC5] text-sm"
          value={aspectRatio}
          onChange={(event) => onAspectRatioChange(event.target.value)}
          disabled={isAspectRatioDisabled}
          aria-label="Aspect ratio"
        >
          {aspectRatioOptions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          className="h-7 px-2 rounded-md bg-[#1E1F25] border border-[#29292D] text-[#A1AFC5] text-sm"
          value={duration}
          onChange={(event) => onDurationChange(Number(event.target.value))}
          disabled={isDurationDisabled}
          aria-label="Duration"
        >
          {durationOptions.map((value) => (
            <option key={value} value={value}>
              {value}s
            </option>
          ))}
        </select>
        <button
          type="button"
          className="w-7 h-7 rounded-md bg-[#1E1F25] border border-[#29292D] flex items-center justify-center text-[#A1AFC5]"
          aria-label="Advanced settings"
          disabled
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
