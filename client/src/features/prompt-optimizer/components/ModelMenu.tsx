import { memo } from 'react';
import { AI_MODEL_IDS, AI_MODEL_URLS, AI_MODEL_LABELS, type AIModelId } from './constants';
import runwayLogoSvg from '@/assets/logos/ai-models/runway.svg?raw';
import lumaLogoSvg from '@/assets/logos/ai-models/luma.svg?raw';
import soraLogoSvg from '@/assets/logos/ai-models/sora.svg?raw';
import veoLogoSvg from '@/assets/logos/ai-models/veo.svg?raw';
import klingLogoSvg from '@/assets/logos/ai-models/kling.svg?raw';
import wanLogoSvg from '@/assets/logos/ai-models/wan.svg?raw';

interface ModelMenuProps {
  promptText: string;
  onCopy: () => void;
  onClose: () => void;
}

type ModelMenuItemStyle = {
  bgClass: string;
  borderClass: string;
  textClass: string;
  interactionClass: string;
};

const MODEL_MENU_STYLES: Record<AIModelId, ModelMenuItemStyle> = {
  'runway-gen45': {
    // Runway theme color (from runwayml.com meta theme-color)
    bgClass: 'bg-[#0C0C0C]',
    borderClass: 'border-white/15',
    textClass: 'text-white',
    interactionClass: 'hover:brightness-110 active:brightness-125',
  },
  'luma-ray3': {
    // Luma primary accent found in lumalabs.ai CSS bundle
    bgClass: 'bg-[#1AA30D]',
    borderClass: 'border-white/15',
    textClass: 'text-white',
    interactionClass: 'hover:brightness-110 active:brightness-125',
  },
  'sora-2': {
    // OpenAI brand color (Simple Icons canonical hex)
    bgClass: 'bg-[#412991]',
    borderClass: 'border-white/15',
    textClass: 'text-white',
    interactionClass: 'hover:brightness-110 active:brightness-125',
  },
  'veo-4': {
    // DeepMind brand color (Simple Icons canonical hex)
    bgClass: 'bg-[#4285F4]',
    borderClass: 'border-white/15',
    textClass: 'text-white',
    interactionClass: 'hover:brightness-105 active:brightness-110',
  },
  'kling-26': {
    // Kuaishou brand color (Simple Icons canonical hex)
    bgClass: 'bg-[#FF4906]',
    borderClass: 'border-white/15',
    textClass: 'text-white',
    interactionClass: 'hover:brightness-105 active:brightness-110',
  },
  'wan-2.2': {
    // Alibaba Cloud brand color (Simple Icons canonical hex)
    bgClass: 'bg-[#FF6A00]',
    borderClass: 'border-white/15',
    textClass: 'text-white',
    interactionClass: 'hover:brightness-105 active:brightness-110',
  },
} as const;

const MODEL_LOGO_SVGS: Record<AIModelId, string> = {
  'runway-gen45': runwayLogoSvg,
  'luma-ray3': lumaLogoSvg,
  'sora-2': soraLogoSvg,
  'veo-4': veoLogoSvg,
  'kling-26': klingLogoSvg,
  'wan-2.2': wanLogoSvg,
} as const;

function enhanceInlineSvg(svg: string, className: string): string {
  // Ensure the root <svg> is sized via Tailwind and colorable via currentColor.
  // Also mark the SVG as decorative since the parent button has an aria-label.
  return svg.replace(/<svg\b([^>]*)>/i, (_m, attrs) => {
    const hasClass = /\bclass="/i.test(attrs);
    const nextAttrs = attrs
      .replace(/\s(width|height)="[^"]*"/gi, '')
      .replace(/\sfill="none"/gi, ' fill="currentColor"')
      .replace(/\sfill="#[0-9a-fA-F]{3,8}"/g, ' fill="currentColor"')
      .replace(/\sfill="black"/gi, ' fill="currentColor"');

    if (hasClass) {
      return `<svg${nextAttrs.replace(/\bclass="([^"]*)"/i, (_cm, existing) => ` class="${existing} ${className}"`)} aria-hidden="true" focusable="false">`;
    }
    return `<svg${nextAttrs} class="${className}" aria-hidden="true" focusable="false">`;
  });
}

function ModelLogo({ modelId }: { modelId: AIModelId }): React.ReactElement {
  const svg = MODEL_LOGO_SVGS[modelId];
  const enhanced = enhanceInlineSvg(svg, 'h-4 w-4');
  return (
    <span
      className="inline-flex items-center justify-center h-4 w-4 flex-shrink-0 text-white"
      aria-hidden="true"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: enhanced }}
    />
  );
}

/**
 * ModelMenu Component
 * 
 * Displays a dropdown menu with options to copy prompt and open in different video models.
 * Each option copies the prompt to clipboard and opens the respective video model's website.
 */
export const ModelMenu = memo<ModelMenuProps>(({ promptText, onCopy, onClose }): React.ReactElement => {
  const handleModelClick = (modelId: AIModelId): void => {
    // Copy prompt to clipboard
    navigator.clipboard.writeText(promptText).catch((error) => {
      console.error('Failed to copy prompt:', error);
    });
    
    // Notify parent component that copy occurred
    onCopy();
    
    // Open video model in new tab
    const url = AI_MODEL_URLS[modelId];
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    
    // Close menu
    onClose();
  };

  return (
    <div className="absolute bottom-full right-0 mb-geist-2 w-40 bg-geist-background border border-geist-accents-2 rounded-geist-lg shadow-geist-medium p-geist-1 z-30 flex flex-col gap-geist-1">
      {AI_MODEL_IDS.map((modelId) => {
        const label = AI_MODEL_LABELS[modelId];
        const displayLabel = `Open ${label}`;
        const style = MODEL_MENU_STYLES[modelId];
        
        return (
          <button
            key={modelId}
            type="button"
            onClick={() => handleModelClick(modelId)}
            className={`w-full flex items-center gap-geist-2 px-geist-3 py-geist-2 text-label-12 font-medium rounded-geist border transition-[filter] ${style.bgClass} ${style.borderClass} ${style.textClass} ${style.interactionClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-geist-accents-4 focus-visible:ring-offset-2 focus-visible:ring-offset-geist-background`}
            aria-label={`Copy and open in ${label}`}
          >
            <ModelLogo modelId={modelId} />
            <span className="truncate">{displayLabel}</span>
          </button>
        );
      })}
    </div>
  );
});

ModelMenu.displayName = 'ModelMenu';
