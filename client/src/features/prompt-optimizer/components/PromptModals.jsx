/**
 * PromptModals - Modal Management
 *
 * Handles all modals (Settings, Shortcuts, Improver, Brainstorm)
 * Extracted from PromptOptimizerContainer for better separation of concerns
 */

import React from 'react';
import { X } from 'lucide-react';
import Settings, { useSettings } from '../../../components/Settings';
import KeyboardShortcuts from '../../../components/KeyboardShortcuts';
import PromptImprovementForm from '../../../PromptImprovementForm';
import { usePromptState } from '../context/PromptStateContext';

export const PromptModals = ({ onImprovementComplete, onConceptComplete }) => {
  const {
    showSettings,
    setShowSettings,
    showShortcuts,
    setShowShortcuts,
    showImprover,
    setShowImprover,
    promptOptimizer,
    promptHistory,
  } = usePromptState();

  const { settings, updateSetting, resetSettings } = useSettings();

  return (
    <>
      {/* Settings Modal */}
      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        updateSetting={updateSetting}
        resetSettings={resetSettings}
        onClearAllData={promptHistory.clearHistory}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcuts
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />

      {/* Improvement Form Modal */}
      {showImprover && (
        <div className="modal-backdrop" onClick={() => setShowImprover(false)}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="improvement-title"
          >
            <div className="my-8 w-full max-w-3xl">
              <button
                onClick={() => setShowImprover(false)}
                className="mb-4 btn-ghost text-white hover:text-neutral-200"
                aria-label="Close improvement form"
              >
                <X className="h-5 w-5" />
                <span>Close</span>
              </button>
              <PromptImprovementForm
                initialPrompt={promptOptimizer.inputPrompt}
                onComplete={onImprovementComplete}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
