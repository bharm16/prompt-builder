import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ErrorBoundary, FeatureErrorBoundary } from './components/ErrorBoundary/';
import PromptOptimizerContainer from './features/prompt-optimizer/PromptOptimizerContainer';
import SharedPrompt from './components/SharedPrompt';
import { ToastProvider } from './components/Toast';
import { TopNavbar } from './components/navigation/TopNavbar';
import { HomePage } from './pages/HomePage';
import { ProductsPage } from './pages/ProductsPage';
import { PricingPage } from './pages/PricingPage';
import { DocsPage } from './pages/DocsPage';
import { SignInPage } from './pages/SignInPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';

function App(): React.ReactElement {
  return (
    <ErrorBoundary
      title="Application Error"
      message="The application encountered an unexpected error. Please refresh the page to continue."
    >
      <ToastProvider>
        <Router>
          <div className="min-h-full h-full flex flex-col bg-geist-background">
            <TopNavbar />
            <div className="flex-1 min-h-0">
              <Routes>
                {/* Marketing / company navigation */}
                <Route path="/home" element={<HomePage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/docs" element={<DocsPage />} />
                <Route path="/signin" element={<SignInPage />} />
                <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />

                {/* App routes */}
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
            </div>
          </div>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;

