import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AdminGate } from './components/Layout/AdminGate';
import { AdminLayout } from './components/Layout/AdminLayout';
import { NotificationSocketProvider } from './contexts/NotificationSocketContext'; // <module:notification>
import { ActivitiesPage } from './pages/ActivitiesPage';
import { InboxPage } from './pages/InboxPage';
import { LoginPage } from './pages/LoginPage';
import { NotificationHistoryPage } from './pages/NotificationHistoryPage'; // <module:notification>
import { PlansPage } from './pages/PlansPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { UsersPage } from './pages/UsersPage';

export function App(): ReactElement {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AdminGate />}>
        {/* <module:notification> */}
        <Route element={<NotificationSocketProvider />}>
          {/* </module:notification> */}
          <Route element={<AdminLayout />}>
            <Route path="/dashboard" element={<StatisticsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            {/* <module:notification> */}
            <Route path="/notifications" element={<NotificationHistoryPage />} />
            {/* </module:notification> */}
          </Route>
          {/* <module:notification> */}
        </Route>
        {/* </module:notification> */}
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
