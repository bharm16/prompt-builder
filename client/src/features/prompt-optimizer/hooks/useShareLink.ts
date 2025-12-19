import { useState } from 'react';
import { useToast } from '@components/Toast';
import type { Toast } from '@hooks/types';

/**
 * Custom hook for generating and sharing links with toast feedback
 */
export function useShareLink(): {
  shared: boolean;
  share: (promptUuid: string) => void;
} {
  const [shared, setShared] = useState(false);
  const toast = useToast() as Toast;

  const share = (promptUuid: string): void => {
    if (!promptUuid) {
      toast.error('Save the prompt first to generate a share link');
      return;
    }

    const shareUrl = `${window.location.origin}/share/${promptUuid}`;
    navigator.clipboard.writeText(shareUrl);
    setShared(true);
    toast.success('Share link copied to clipboard!');
    setTimeout(() => setShared(false), 2000);
  };

  return { shared, share };
}

