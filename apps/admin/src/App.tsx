import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AdminGate } from './components/Layout/AdminGate';
import { AdminLayout } from './components/Layout/AdminLayout';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { LoginPage } from './pages/LoginPage';
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
          <Route path="/activities" element={<ActivitiesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
