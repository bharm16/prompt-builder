import React from 'react';
import { PromptResultsSection } from '../components/PromptResultsSection';

/**
 * PromptResultsLayout - Results/Canvas View Layout
 * 
 * Main content layout for the results/canvas view (PromptCanvas via PromptResultsSection).
 *
 * App shell (history sidebar + top bar) lives in PromptOptimizerWorkspace.
 */
export const PromptResultsLayout = (): React.ReactElement => {
  return (
    <main
      id="main-content"
      className="relative flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden bg-app transition-colors duration-300"
    >
      <PromptResultsSection />
    </main>
  );
};
