import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AdminGate } from './components/Layout/AdminGate';
import { AdminLayout } from './components/Layout/AdminLayout';
import { ADMIN_HOME_ROUTE } from './constants/admin-home-route.constants';
import { NotificationSocketProvider } from './contexts/NotificationSocketContext'; // <module:notification>
import { ActivitiesPage } from './pages/ActivitiesPage';
import { InboxPage } from './pages/InboxPage'; // <module:contact-us>
import { LoginPage } from './pages/LoginPage';
import { NotificationHistoryPage } from './pages/NotificationHistoryPage'; // <module:notification>
import { PlansPage } from './pages/PlansPage'; // <module:payment>
import { StatisticsPage } from './pages/StatisticsPage'; // <module:statistic>
import { TransactionsPage } from './pages/TransactionsPage'; // <module:payment>
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
            {/* <module:statistic> */}
            <Route path="/dashboard" element={<StatisticsPage />} />
            {/* </module:statistic> */}
            <Route path="/users" element={<UsersPage />} />
            {/* <module:payment> */}
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            {/* </module:payment> */}
            <Route path="/activities" element={<ActivitiesPage />} />
            {/* <module:contact-us> */}
            <Route path="/inbox" element={<InboxPage />} />
            {/* </module:contact-us> */}
            {/* <module:notification> */}
            <Route path="/notifications" element={<NotificationHistoryPage />} />
            {/* </module:notification> */}
          </Route>
          {/* <module:notification> */}
        </Route>
        {/* </module:notification> */}
      </Route>
      <Route path="*" element={<Navigate to={ADMIN_HOME_ROUTE} replace />} />
    </Routes>
  );
}
