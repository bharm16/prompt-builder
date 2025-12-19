import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ErrorBoundary, FeatureErrorBoundary } from './components/ErrorBoundary/';
import PromptOptimizerContainer from './features/prompt-optimizer/PromptOptimizerContainer';
import SharedPrompt from './components/SharedPrompt';
import { ToastProvider } from './components/Toast';

function App(): React.ReactElement {
  return (
    <ErrorBoundary
      title="Application Error"
      message="The application encountered an unexpected error. Please refresh the page to continue."
    >
      <ToastProvider>
        <Router>
          <Routes>
            <Route
              path="/"
              element={
                <FeatureErrorBoundary featureName="Prompt Optimizer">
                  <PromptOptimizerContainer />
                </FeatureErrorBoundary>
              }
            />
            <Route
              path="/prompt/:uuid"
              element={
                <FeatureErrorBoundary featureName="Prompt Optimizer">
                  <PromptOptimizerContainer />
                </FeatureErrorBoundary>
              }
            />
            <Route
              path="/share/:uuid"
              element={
                <FeatureErrorBoundary featureName="Shared Prompt">
                  <SharedPrompt />
                </FeatureErrorBoundary>
              }
            />
          </Routes>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;

