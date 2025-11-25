import { useState } from 'react';
import { useToast } from '@components/Toast';
import type { Toast } from '@hooks/types';

/**
 * Custom hook for clipboard operations with toast feedback
 */
export function useClipboard(): {
  copied: boolean;
  copy: (text: string) => void;
} {
  const [copied, setCopied] = useState(false);
  const toast = useToast() as Toast;

  const copy = (text: string): void => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return { copied, copy };
}

