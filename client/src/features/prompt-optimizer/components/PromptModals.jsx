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
import WizardVideoBuilder from '../../../components/wizard/WizardVideoBuilder';
import { usePromptState } from '../context/PromptStateContext';

export const PromptModals = ({ onImprovementComplete, onConceptComplete, onSkipBrainstorm }) => {
  const {
    showSettings,
    setShowSettings,
    showShortcuts,
    setShowShortcuts,
    showImprover,
    setShowImprover,
    showBrainstorm,
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

      {/* Creative Brainstorm - Full Page Wizard UI */}
      {showBrainstorm && (
        <div
          className="fixed inset-0 z-[100] bg-gray-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wizard-title"
        >
          <button
            onClick={onSkipBrainstorm}
            className="fixed right-6 top-6 z-[110] rounded-lg p-2 text-gray-500 hover:text-gray-700 hover:bg-white hover:shadow-md transition-all duration-200"
            aria-label="Close wizard"
            title="Close (Esc)"
          >
            <X className="h-6 w-6" />
          </button>
          <WizardVideoBuilder
            onConceptComplete={onConceptComplete}
            initialConcept={promptOptimizer.inputPrompt}
          />
        </div>
      )}

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
