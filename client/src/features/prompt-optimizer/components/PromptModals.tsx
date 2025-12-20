import React from 'react';
import { X } from 'lucide-react';
import Settings, { useSettings } from '@components/Settings';
import KeyboardShortcuts from '@components/KeyboardShortcuts';
import { Button } from '@components/Button';
import PromptImprovementForm from '../../../PromptImprovementForm';
import { usePromptState } from '../context/PromptStateContext';
import type { PromptModalsProps } from '../types';
import type { FormData } from '../../../PromptImprovementForm';

/**
 * PromptModals - Modal Management
 *
 * Handles all modals (Settings, Shortcuts, Improver, Brainstorm)
 * Extracted from PromptOptimizerContainer for better separation of concerns
 */
export const PromptModals = ({
  onImprovementComplete,
  onConceptComplete: _onConceptComplete,
  onSkipBrainstorm: _onSkipBrainstorm,
}: PromptModalsProps): React.ReactElement => {
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
  const handleImprovementComplete =
    onImprovementComplete ??
    ((_: string, __: FormData): void => {});

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
              <Button
                onClick={() => setShowImprover(false)}
                variant="ghost"
                prefix={<X className="h-5 w-5" />}
                className="mb-4 text-white hover:text-neutral-200"
                aria-label="Close improvement form"
              >
                Close
              </Button>
              <PromptImprovementForm
                initialPrompt={promptOptimizer.inputPrompt}
                onComplete={handleImprovementComplete}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
