import React, { useEffect, useState } from 'react';
import type { SidebarUploadedImage } from '@components/ToolSidebar/types';
import type { ModelRecommendation } from '@/features/model-intelligence/types';
import { useCreditBalance } from '@/contexts/CreditBalanceContext';
import { ModelCornerSelector } from './ModelCornerSelector';
import { CanvasSettingsRow } from './CanvasSettingsRow';

interface NewSessionViewProps {
  editorRef: React.RefObject<HTMLDivElement>;
  onInput: (event: React.FormEvent<HTMLDivElement>) => void;
  prompt: string;
  renderModelId: string;
  renderModelOptions: Array<{ id: string; label: string }>;
  recommendedModelId?: string | undefined;
  efficientModelId?: string | undefined;
  modelRecommendation?: ModelRecommendation | null | undefined;
  onModelChange: (modelId: string) => void;
  onOpenMotion: () => void;
  onStartFrameUpload?: ((file: File) => void | Promise<void>) | undefined;
  onUploadSidebarImage?: ((file: File) => Promise<SidebarUploadedImage | null>) | undefined;
  onEnhance?: () => void;
}

export function NewSessionView({
  editorRef,
  onInput,
  prompt,
  renderModelId,
  renderModelOptions,
  recommendedModelId,
  efficientModelId,
  modelRecommendation,
  onModelChange,
  onOpenMotion,
  onStartFrameUpload,
  onUploadSidebarImage,
  onEnhance,
}: NewSessionViewProps): React.ReactElement {
  const [isFocused, setIsFocused] = useState(false);
  const { balance } = useCreditBalance();

  useEffect(() => {
    editorRef.current?.focus();
  }, [editorRef]);

  return (
    <div className="flex flex-1 flex-col">
      {/* Top spacer — pushes prompt container to ~38% from top */}
      <div style={{ flex: 1.3 }} />

      <div className="flex flex-col items-center px-6">
        {/* Video wordmark */}
        <div className="mb-8 flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="16" rx="3" stroke="#555B6E" strokeWidth="1.5" />
            <path d="M10 9.5L15.5 12.5L10 15.5V9.5Z" fill="#555B6E" />
          </svg>
          <span className="text-xl font-semibold tracking-[-0.02em] text-[#555B6E]">
            Video
          </span>
        </div>

        {/* Prompt container */}
        <div className="w-full max-w-[640px]">
          <div
            className="rounded-2xl bg-[#15161B] transition-shadow"
            style={{
              boxShadow: isFocused
                ? '0 0 0 1px rgba(108,92,231,0.12), 0 8px 32px rgba(0,0,0,0.4)'
                : '0 4px 24px rgba(0,0,0,0.25)',
            }}
            onClick={() => {
              editorRef.current?.focus();
            }}
          >
            {/* Prompt input */}
            <div className="relative px-5 pb-3 pt-5">
              {!prompt && (
                <div className="pointer-events-none absolute left-5 top-5 text-[15px] leading-[1.7] text-[#4B5063]">
                  Describe a video and click generate...
                </div>
              )}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-label="Video prompt"
                aria-multiline="true"
                className="min-h-[56px] max-h-[180px] overflow-y-auto text-[15px] leading-[1.7] text-[#E2E6EF] caret-[#6C5CE7] outline-none [&:empty]:min-h-[56px]"
                onInput={onInput}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
            </div>

            {/* Settings row */}
            <div className="border-t border-[rgba(255,255,255,0.04)] px-3.5 pb-3 pt-2.5">
              <CanvasSettingsRow
                prompt={prompt}
                renderModelId={renderModelId}
                {...(recommendedModelId ? { recommendedModelId } : {})}
                {...(modelRecommendation?.promptId
                  ? { recommendationPromptId: modelRecommendation.promptId }
                  : {})}
                onOpenMotion={onOpenMotion}
                {...(onStartFrameUpload ? { onStartFrameUpload } : {})}
                {...(onUploadSidebarImage ? { onUploadSidebarImage } : {})}
                {...(onEnhance ? { onEnhance } : {})}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom spacer */}
      <div style={{ flex: 2 }} />

      {/* Bottom bar: model selector + credits */}
      <div className="flex flex-shrink-0 items-center justify-between px-5 pb-4">
        <ModelCornerSelector
          renderModelOptions={renderModelOptions}
          renderModelId={renderModelId}
          modelRecommendation={modelRecommendation}
          recommendedModelId={recommendedModelId}
          efficientModelId={efficientModelId}
          onModelChange={onModelChange}
          className="relative"
        />

        <div className="flex items-center gap-1.5">
          <span className="h-[6px] w-[6px] rounded-full bg-[#34D399]" />
          <span className="text-[11px] font-medium text-[#555B6E]">
            {typeof balance === 'number' ? `${balance} cr` : '— cr'}
          </span>
        </div>
      </div>
    </div>
  );
}
