import React from 'react';
import Settings, { useSettings } from '@components/Settings';
import KeyboardShortcuts from '@components/KeyboardShortcuts';
import { Dialog, DialogContent } from '@promptstudio/system/components/ui/dialog';
import PromptImprovementForm from '@/PromptImprovementForm';
import { usePromptState } from '../context/PromptStateContext';
import type { PromptModalsProps } from '../types';
import type { FormData } from '@/PromptImprovementForm';

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
      <Dialog open={showImprover} onOpenChange={setShowImprover}>
        <DialogContent className="max-w-3xl po-surface po-surface--grad">
          <PromptImprovementForm
            initialPrompt={promptOptimizer.inputPrompt}
            onComplete={handleImprovementComplete}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
