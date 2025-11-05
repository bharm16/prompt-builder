/**
 * useKeyboardShortcuts Hook
 * 
 * Handles keyboard shortcuts for the wizard.
 */

import { useEffect } from 'react';

/**
 * useKeyboardShortcuts Hook
 * 
 * @param {Function} onNext - Callback for Enter key
 * @param {Function} onPrevious - Callback for Escape key  
 * @param {boolean} enabled - Whether shortcuts are enabled
 */
export function useKeyboardShortcuts({ onNext, onPrevious, enabled = true }) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      // Enter key (not in textarea)
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !e.shiftKey) {
        e.preventDefault();
        if (onNext) {
          onNext();
        }
      }
      
      // Escape key
      if (e.key === 'Escape') {
        e.preventDefault();
        if (onPrevious) {
          onPrevious();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrevious, enabled]);
}

