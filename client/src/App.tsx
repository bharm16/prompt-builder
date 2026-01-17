import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import { SignUpPage } from './pages/SignUpPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { EmailVerificationPage } from './pages/EmailVerificationPage';
import { PasswordResetPage } from './pages/PasswordResetPage';
import { AccountPage } from './pages/AccountPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsOfServicePage } from './pages/TermsOfServicePage';
import { ContactSupportPage } from './pages/ContactSupportPage';
import { BillingPage } from './pages/BillingPage';
import { BillingInvoicesPage } from './pages/BillingInvoicesPage';
import { HistoryPage } from './pages/HistoryPage';

function AppShell(): React.ReactElement {
  const location = useLocation();
  const isPromptCanvasRoute = location.pathname.startsWith('/prompt/');
  const isAuthRoute = [
    '/signin',
    '/signup',
    '/forgot-password',
    '/email-verification',
    '/reset-password',
    '/account',
    '/login',
    '/register',
    '/settings/billing',
    '/settings/billing/invoices',
  ].includes(location.pathname);

  return (
    <div className="min-h-full h-full flex flex-col bg-app">
      {!isPromptCanvasRoute && !isAuthRoute && <TopNavbar />}
      <div className="flex-1 min-h-0">
        <Routes>
          {/* Marketing / company navigation */}
          <Route path="/home" element={<HomePage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/email-verification" element={<EmailVerificationPage />} />
          <Route path="/reset-password" element={<PasswordResetPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/login" element={<Navigate to="/signin" replace />} />
          <Route path="/register" element={<Navigate to="/signup" replace />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms-of-service" element={<TermsOfServicePage />} />
          <Route path="/contact" element={<ContactSupportPage />} />
          <Route path="/support" element={<Navigate to="/contact" replace />} />
          <Route path="/settings/billing" element={<BillingPage />} />
          <Route path="/settings/billing/invoices" element={<BillingInvoicesPage />} />
          <Route path="/billing" element={<Navigate to="/settings/billing" replace />} />

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
  );
}

function App(): React.ReactElement {
  return (
    <ErrorBoundary
      title="Application Error"
      message="The application encountered an unexpected error. Please refresh the page to continue."
    >
      <ToastProvider>
        <Router>
          <AppShell />
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
