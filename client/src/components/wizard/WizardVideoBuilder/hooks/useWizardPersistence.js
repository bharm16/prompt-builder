/**
 * useWizardPersistence Hook
 * 
 * Handles localStorage operations for saving and restoring wizard state.
 */

import { useEffect, useCallback, useRef } from 'react';
import { STORAGE_KEY, MAX_STORAGE_AGE, AUTO_SAVE_DELAY } from '../config/constants';

/**
 * useWizardPersistence Hook
 * 
 * @param {Object} formData - Current form data
 * @param {number} currentStep - Current step index
 * @param {number} currentMobileFieldIndex - Current mobile field index
 * @param {Function} onRestore - Callback when data is restored
 * @param {Function} onSave - Optional callback when data is auto-saved
 */
export function useWizardPersistence({
  formData,
  currentStep,
  currentMobileFieldIndex,
  onRestore,
  onSave = null,
}) {
  const autoSaveTimer = useRef(null);
  const lastSavedData = useRef(null);
  const onSaveRef = useRef(onSave);

  // Keep onSave ref up to date
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  /**
   * Save to localStorage
   */
  const saveToLocalStorage = useCallback(() => {
    try {
      const saveData = {
        formData,
        currentStep,
        currentMobileFieldIndex,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
      lastSavedData.current = formData;
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }, [formData, currentStep, currentMobileFieldIndex]);

  /**
   * Restore from localStorage
   */
  const restoreFromLocalStorage = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;

      const data = JSON.parse(saved);
      const age = Date.now() - data.timestamp;

      if (age > MAX_STORAGE_AGE) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Failed to restore from localStorage:', error);
      return null;
    }
  }, []);

  /**
   * Clear localStorage
   */
  const clearLocalStorage = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }, []);

  /**
   * Restore from localStorage on mount
   */
  useEffect(() => {
    const restored = restoreFromLocalStorage();
    if (restored && onRestore) {
      // Prompt user to continue
      const shouldContinue = window.confirm(
        'We found a saved draft from your previous session. Would you like to continue where you left off?'
      );
      
      if (shouldContinue) {
        onRestore(restored);
      } else {
        clearLocalStorage();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  /**
   * Auto-save effect with optimized change detection
   */
  useEffect(() => {
    // Clear existing timer
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    // Schedule auto-save (debounced)
    autoSaveTimer.current = setTimeout(() => {
      // Only save if data has actually changed
      if (formData !== lastSavedData.current) {
        saveToLocalStorage();
        if (onSaveRef.current) {
          onSaveRef.current(formData);
        }
        lastSavedData.current = formData;
      }
    }, AUTO_SAVE_DELAY);

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [formData, saveToLocalStorage]);

  return {
    saveToLocalStorage,
    restoreFromLocalStorage,
    clearLocalStorage,
  };
}

