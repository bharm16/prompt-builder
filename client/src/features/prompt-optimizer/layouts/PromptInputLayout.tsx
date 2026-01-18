import React from 'react';
import { PromptInputSection } from '../components/PromptInputSection';

/**
 * PromptInputLayout - Input View Layout
 * 
 * Main content layout for the input view with:
 * - Centered Input Section
 * - Privacy Policy Footer
 * 
 * App shell (history sidebar + top bar) lives in PromptOptimizerWorkspace.
 */
interface PromptInputLayoutProps {
  aiNames: readonly string[];
  onOptimize: () => void;
  onShowBrainstorm: () => void;
}

export const PromptInputLayout = ({
  aiNames,
  onOptimize,
  onShowBrainstorm,
}: PromptInputLayoutProps): React.ReactElement => {
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto" id="main-content">
      <div className="flex flex-1 items-center justify-center px-6 py-9 sm:px-8 sm:py-10">
        <PromptInputSection
          aiNames={aiNames}
          onOptimize={onOptimize}
          onShowBrainstorm={onShowBrainstorm}
        />
      </div>

      {/* Privacy Policy Footer */}
      <footer className="py-2 text-center">
        <a
          href="/privacy-policy"
          className="text-body-sm text-faint transition-colors hover:text-muted"
        >
          Privacy Policy
        </a>
      </footer>
    </main>
  );
};




