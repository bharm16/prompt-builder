import React, { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AppShell } from '@components/navigation/AppShell';
import { ErrorBoundary, FeatureErrorBoundary } from './components/ErrorBoundary/';
import { ToastProvider } from './components/Toast';
import { AppShellProvider, useAppShell, type ActiveTool } from './contexts/AppShellContext';
import { MainWorkspace } from './components/layout/MainWorkspace';
import { LoadingDots } from './components/LoadingDots';
import { GenerationControlsStoreProvider } from './features/prompt-optimizer/context/GenerationControlsStore';

const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));
const ProductsPage = lazy(() => import('./pages/ProductsPage').then((module) => ({ default: module.ProductsPage })));
const PricingPage = lazy(() => import('./pages/PricingPage').then((module) => ({ default: module.PricingPage })));
const DocsPage = lazy(() => import('./pages/DocsPage').then((module) => ({ default: module.DocsPage })));
const SignInPage = lazy(() => import('./pages/SignInPage').then((module) => ({ default: module.SignInPage })));
const SignUpPage = lazy(() => import('./pages/SignUpPage').then((module) => ({ default: module.SignUpPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })));
const EmailVerificationPage = lazy(() => import('./pages/EmailVerificationPage').then((module) => ({ default: module.EmailVerificationPage })));
const PasswordResetPage = lazy(() => import('./pages/PasswordResetPage').then((module) => ({ default: module.PasswordResetPage })));
const AccountPage = lazy(() => import('./pages/AccountPage').then((module) => ({ default: module.AccountPage })));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage').then((module) => ({ default: module.PrivacyPolicyPage })));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage').then((module) => ({ default: module.TermsOfServicePage })));
const ContactSupportPage = lazy(() => import('./pages/ContactSupportPage').then((module) => ({ default: module.ContactSupportPage })));
const BillingPage = lazy(() => import('./pages/BillingPage').then((module) => ({ default: module.BillingPage })));
const BillingInvoicesPage = lazy(() => import('./pages/BillingInvoicesPage').then((module) => ({ default: module.BillingInvoicesPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((module) => ({ default: module.HistoryPage })));
const AssetsPage = lazy(() => import('./pages/AssetsPage').then((module) => ({ default: module.AssetsPage })));
const ContinuityPage = lazy(() => import('./pages/ContinuityPage').then((module) => ({ default: module.ContinuityPage })));
const SharedPrompt = lazy(() => import('./components/SharedPrompt'));

function RouteFallback(): React.ReactElement {
  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <LoadingDots />
    </div>
  );
}

function MarketingShell(): React.ReactElement {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function WorkspaceRoute({ tool }: { tool: ActiveTool }): React.ReactElement {
  const { setActiveTool } = useAppShell();
  const setActiveToolRef = useRef(setActiveTool);
  setActiveToolRef.current = setActiveTool;

  useEffect(() => {
    setActiveToolRef.current(tool, { skipWarning: true });
  }, [tool]);

  return (
    <FeatureErrorBoundary featureName="Main Workspace">
      <MainWorkspace />
    </FeatureErrorBoundary>
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
        element={<WorkspaceRoute tool="studio" />}
      />
      <Route
        path="/create"
        element={<WorkspaceRoute tool="create" />}
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
        path="/continuity"
        element={
          <FeatureErrorBoundary featureName="Continuity Sessions">
            <ContinuityPage />
          </FeatureErrorBoundary>
        }
      />
      <Route
        path="/continuity/:sessionId"
        element={
          <FeatureErrorBoundary featureName="Continuity Session">
            <ContinuityPage />
          </FeatureErrorBoundary>
        }
      />
      <Route
        path="/consistent"
        element={<Navigate to="/" replace />}
      />
      <Route
        path="/prompt/:uuid"
        element={<WorkspaceRoute tool="studio" />}
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
        <GenerationControlsStoreProvider>
          <AppShellProvider>
            <Router>
              <Suspense fallback={<RouteFallback />}>
                <AppRoutes />
              </Suspense>
            </Router>
          </AppShellProvider>
        </GenerationControlsStoreProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
