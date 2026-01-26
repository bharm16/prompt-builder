import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AppShell } from '@components/navigation/AppShell';
import { ErrorBoundary, FeatureErrorBoundary } from './components/ErrorBoundary/';
import SharedPrompt from './components/SharedPrompt';
import { ToastProvider } from './components/Toast';
import { AppShellProvider } from './contexts/AppShellContext';
import { MainWorkspace } from './components/layout/MainWorkspace';
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
import { AssetsPage } from './pages/AssetsPage';

function MarketingShell(): React.ReactElement {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function AppRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route element={<MarketingShell />}>
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
        <Route
          path="/share/:uuid"
          element={
            <FeatureErrorBoundary featureName="Shared Prompt">
              <SharedPrompt />
            </FeatureErrorBoundary>
          }
        />
      </Route>

      {/* App routes */}
      <Route
        path="/"
        element={
          <FeatureErrorBoundary featureName="Main Workspace">
            <MainWorkspace />
          </FeatureErrorBoundary>
        }
      />
      <Route
        path="/assets"
        element={
          <FeatureErrorBoundary featureName="Asset Library">
            <AssetsPage />
          </FeatureErrorBoundary>
        }
      />
      <Route
        path="/consistent"
        element={<Navigate to="/" replace />}
      />
      <Route
        path="/prompt/:uuid"
        element={
          <FeatureErrorBoundary featureName="Main Workspace">
            <MainWorkspace />
          </FeatureErrorBoundary>
        }
      />
    </Routes>
  );
}

function App(): React.ReactElement {
  return (
    <ErrorBoundary
      title="Application Error"
      message="The application encountered an unexpected error. Please refresh the page to continue."
    >
      <ToastProvider>
        <AppShellProvider>
          <Router>
            <AppRoutes />
          </Router>
        </AppShellProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
