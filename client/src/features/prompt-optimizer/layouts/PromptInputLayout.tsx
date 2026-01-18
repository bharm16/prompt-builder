import React from 'react';
import { PromptInputSection } from '../components/PromptInputSection';
import { PromptSidebar } from '../components/PromptSidebar';
import type { User } from '../context/types';

/**
 * PromptInputLayout - Input View Layout
 * 
 * Self-contained layout for the input view with:
 * - History Sidebar (left column)
 * - Centered Input Section
 * - Privacy Policy Footer
 * 
 * Completely isolated from PromptResultsLayout to prevent CSS/state conflicts
 */
interface PromptInputLayoutProps {
  user: User | null;
  aiNames: readonly string[];
  onOptimize: () => void;
  onShowBrainstorm: () => void;
}

export const PromptInputLayout = ({
  user,
  aiNames,
  onOptimize,
  onShowBrainstorm,
}: PromptInputLayoutProps): React.ReactElement => {
  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* History Sidebar */}
      <PromptSidebar user={user} />

      {/* Main Content - Centered Input */}
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
    </div>
  );
};









