import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './components/Layout/AppLayout';
import { AuthGate } from './components/Layout/AuthGate';
import { NotificationSocketProvider } from './contexts/NotificationSocketContext';
import { BillingCanceledPage } from './pages/BillingCanceledPage';
import { BillingPage } from './pages/BillingPage';
import { BillingSuccessPage } from './pages/BillingSuccessPage';
import { ContactPage } from './pages/ContactPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { MethodsPage } from './pages/MethodsPage';
import { NotesPage } from './pages/NotesPage';
import { NotificationPreferencesPage } from './pages/NotificationPreferencesPage';
import { OauthCallbackPage } from './pages/OauthCallbackPage';
import { PricingPage } from './pages/PricingPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SessionsPage } from './pages/SessionsPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';

export function App(): ReactElement {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/auth/callback" element={<OauthCallbackPage />} />
      <Route path="/email/verify" element={<VerifyEmailPage />} />
      <Route path="/password/forgot" element={<ForgotPasswordPage />} />
      <Route path="/password/reset" element={<ResetPasswordPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/billing/success" element={<BillingSuccessPage />} />
      <Route path="/billing/canceled" element={<BillingCanceledPage />} />
      <Route element={<AuthGate />}>
        <Route
          element={
            <NotificationSocketProvider>
              <AppLayout />
            </NotificationSocketProvider>
          }
        >
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings/methods" element={<MethodsPage />} />
          <Route path="/settings/sessions" element={<SessionsPage />} />
          <Route path="/settings/billing" element={<BillingPage />} />
          <Route path="/settings/notifications" element={<NotificationPreferencesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/notes" replace />} />
    </Routes>
  );
}
