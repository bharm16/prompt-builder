import { useState } from 'react';
import { useToast } from '../../../components/Toast';

/**
 * Custom hook for generating and sharing links with toast feedback
 * @returns {Object} { shared: boolean, share: function }
 */
export function useShareLink() {
  const [shared, setShared] = useState(false);
  const toast = useToast();

  const share = (promptUuid) => {
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
