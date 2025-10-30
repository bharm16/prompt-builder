import { useState } from 'react';
import { useToast } from '../../../components/Toast';

/**
 * Custom hook for clipboard operations with toast feedback
 * @returns {Object} { copied: boolean, copy: function }
 */
export function useClipboard() {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return { copied, copy };
}
