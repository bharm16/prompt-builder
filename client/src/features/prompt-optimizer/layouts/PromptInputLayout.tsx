import React from 'react';
import { PromptInputSection } from '../components/PromptInputSection';
import { PromptSidebar } from '../components/PromptSidebar';
import type { User } from '../context/types';
import './PromptInputLayout.css';

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
    <div className="prompt-input-layout">
      {/* History Sidebar */}
      <PromptSidebar user={user} />

      {/* Main Content - Centered Input */}
      <main className="prompt-input-layout__main" id="main-content">
        <div className="prompt-input-layout__content">
          <PromptInputSection
            aiNames={aiNames}
            onOptimize={onOptimize}
            onShowBrainstorm={onShowBrainstorm}
          />
        </div>

        {/* Privacy Policy Footer */}
        <footer className="prompt-input-layout__footer">
          <a
            href="/privacy-policy"
            className="prompt-input-layout__footer-link"
          >
            Privacy Policy
          </a>
        </footer>
      </main>
    </div>
  );
};




