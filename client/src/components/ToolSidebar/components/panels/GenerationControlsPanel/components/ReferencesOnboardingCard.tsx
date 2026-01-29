import React from 'react';
import { Folder, Upload } from '@promptstudio/system/components/ui';

interface ReferencesOnboardingCardProps {
  onUpload: () => void;
  isUploadDisabled: boolean;
}

export function ReferencesOnboardingCard({
  onUpload,
  isUploadDisabled,
}: ReferencesOnboardingCardProps): React.ReactElement {
  return (
    <div className="relative flex flex-col rounded-md overflow-hidden">
      <div className="flex flex-col items-center justify-center gap-6 px-4 pb-4 bg-[#1B1E23] rounded-md text-center min-h-[310px]">
        <div className="relative w-[280px] h-[120px] flex items-center justify-center">
          <img
            className="absolute w-[160px] h-[90px] rounded-sm shadow-[0_4px_8px_rgba(0,0,0,0.3)] overflow-clip top-[15px] left-[60px] translate-y-2"
            src="https://d3phaj0sisr2ct.cloudfront.net/app/gen4/ref-onboarding-center.jpeg"
            width="160"
            height="90"
            alt=""
          />
          <img
            className="absolute w-[71px] h-[40px] rounded-sm shadow-[0_4px_8px_rgba(0,0,0,0.3)] overflow-clip top-10 left-1/2 -translate-x-24 translate-y-5"
            src="https://d3phaj0sisr2ct.cloudfront.net/app/gen4/ref-onboarding-left.jpeg"
            width="71"
            height="40"
            alt=""
          />
          <img
            className="absolute w-[71px] h-[40px] rounded-sm shadow-[0_4px_8px_rgba(0,0,0,0.3)] overflow-clip top-10 left-1/2 translate-x-[84px] -translate-y-7"
            src="https://d3phaj0sisr2ct.cloudfront.net/app/gen4/ref-onboarding-right.jpeg"
            width="71"
            height="40"
            alt=""
          />
        </div>

        <div className="flex flex-col items-center w-[336px]">
          <div>
            <h2 className="text-base font-semibold text-white leading-6 text-center mb-0">
              Create consistent scenes with References
            </h2>
            <p className="text-sm font-normal text-[#A0AEC0] leading-5 text-center mt-0">
              Use 1-3 character or location images to build your scene. Place characters in new settings or generate new angles.
              <br />
              <a
                className="font-medium underline cursor-pointer text-[#A0AEC0]"
                href="https://help.runwayml.com/hc/en-us/articles/40042718905875"
                target="_blank"
                rel="noopener noreferrer"
              >
                Learn more
              </a>
              .
            </p>
          </div>

          <div className="flex justify-center gap-2 pt-4">
            <button
              type="button"
              className="flex items-center justify-center gap-2 h-8 px-3 bg-transparent border border-[#2C3037] rounded-md text-[#A1AFC5] text-sm font-semibold tracking-[0.14px] leading-5 cursor-pointer overflow-hidden hover:bg-[#1B1E23]"
            >
              <Folder className="w-3.5 h-3.5" />
              Assets
            </button>
            <button
              type="button"
              onClick={onUpload}
              disabled={isUploadDisabled}
              className="flex items-center justify-center gap-2 h-8 px-3 bg-white rounded-md text-black text-sm font-semibold tracking-[0.14px] leading-5 cursor-pointer overflow-hidden hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
