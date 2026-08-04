import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AdminGate } from './components/Layout/AdminGate';
import { AdminLayout } from './components/Layout/AdminLayout';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { InboxPage } from './pages/InboxPage';
import { LoginPage } from './pages/LoginPage';
import { PlansPage } from './pages/PlansPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { UsersPage } from './pages/UsersPage';

export function App(): ReactElement {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AdminGate />}>
        <Route element={<AdminLayout />}>
          <Route path="/dashboard" element={<StatisticsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/activities" element={<ActivitiesPage />} />
          <Route path="/inbox" element={<InboxPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
