import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AppLayout } from './components/Layout/AppLayout';
import { AuthGate } from './components/Layout/AuthGate';
import { APP_HOME_ROUTE } from './constants/app-home-route.constants';
import { NotificationSocketProvider } from './contexts/NotificationSocketContext'; // <module:notification>
import { BillingCanceledPage } from './pages/BillingCanceledPage'; // <module:payment>
import { BillingPage } from './pages/BillingPage'; // <module:payment>
import { BillingSuccessPage } from './pages/BillingSuccessPage'; // <module:payment>
import { ContactPage } from './pages/ContactPage'; // <module:contact-us>
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { MethodsPage } from './pages/MethodsPage';
import { NotesPage } from './pages/NotesPage'; // <module:note>
import { NotificationPreferencesPage } from './pages/NotificationPreferencesPage'; // <module:notification>
import { OauthCallbackPage } from './pages/OauthCallbackPage';
import { PricingPage } from './pages/PricingPage'; // <module:payment>
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
      {/* <module:contact-us> */}
      <Route path="/contact" element={<ContactPage />} />
      {/* </module:contact-us> */}
      {/* <module:payment> */}
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/billing/success" element={<BillingSuccessPage />} />
      <Route path="/billing/canceled" element={<BillingCanceledPage />} />
      {/* </module:payment> */}
      <Route element={<AuthGate />}>
        {/* <module:notification> */}
        <Route element={<NotificationSocketProvider />}>
          {/* </module:notification> */}
          <Route element={<AppLayout />}>
            {/* <module:note> */}
            <Route path="/notes" element={<NotesPage />} />
            {/* </module:note> */}
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings/methods" element={<MethodsPage />} />
            <Route path="/settings/sessions" element={<SessionsPage />} />
            {/* <module:payment> */}
            <Route path="/settings/billing" element={<BillingPage />} />
            {/* </module:payment> */}
            {/* <module:notification> */}
            <Route path="/settings/notifications" element={<NotificationPreferencesPage />} />
            {/* </module:notification> */}
          </Route>
          {/* <module:notification> */}
        </Route>
        {/* </module:notification> */}
      </Route>
      <Route path="*" element={<Navigate to={APP_HOME_ROUTE} replace />} />
    </Routes>
  );
}
