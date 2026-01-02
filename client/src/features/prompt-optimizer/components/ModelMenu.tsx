import { memo } from 'react';
import { AI_MODEL_IDS, AI_MODEL_URLS, AI_MODEL_LABELS, type AIModelId } from './constants';

interface ModelMenuProps {
  promptText: string;
  onCopy: () => void;
  onClose: () => void;
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

  const getColorClass = (modelId: AIModelId): string => {
    switch (modelId) {
      case 'runway-gen45':
        return 'text-purple-600';
      case 'luma-ray3':
        return 'text-teal-600';
      case 'sora-2':
        return 'text-green-600';
      case 'veo-4':
        return 'text-blue-600';
      case 'kling-26':
        return 'text-orange-600';
      case 'wan-2.2':
        return 'text-red-500';
      default:
        return 'text-geist-accents-7';
    }
  };

  return (
    <div className="absolute bottom-full right-0 mb-geist-2 w-40 bg-geist-background border border-geist-accents-2 rounded-geist-lg shadow-geist-medium py-geist-1 z-30">
      {AI_MODEL_IDS.map((modelId) => {
        const label = AI_MODEL_LABELS[modelId];
        const colorClass = getColorClass(modelId);
        
        return (
          <button
            key={modelId}
            onClick={() => handleModelClick(modelId)}
            className="w-full flex items-center gap-geist-2 px-geist-3 py-geist-2 text-label-12 hover:bg-geist-accents-1 transition-colors"
          >
            <span className={`${colorClass} font-medium`}>{label}</span>
          </button>
        );
      })}
    </div>
  );
});

ModelMenu.displayName = 'ModelMenu';
