import { createContext, type ReactElement, useContext } from 'react';
import { Outlet } from 'react-router';
import { useNotificationSocket } from '../hooks/notifications/useNotificationSocket';
import type { UseNotificationSocketResultInterface } from '../interfaces/use-notification-socket-result.interface';

const NotificationSocketContext = createContext<UseNotificationSocketResultInterface | null>(null);

// One socket per tab: mounted once around the guarded admin shell
// (AdminLayout) so the bell, the dropdown, and the history page read the
// same live state instead of each opening their own connection.
//
// A pathless layout route rather than a `children` wrapper: it renders
// <Outlet /> so App.tsx can nest it as a plain <Route>, which is what lets the
// whole module be fenced out of App.tsx by deleting two self-contained lines
// (see docs/removal/notification.md) instead of unwrapping JSX by hand.
export function NotificationSocketProvider(): ReactElement {
  const value: UseNotificationSocketResultInterface = useNotificationSocket();

  return (
    <NotificationSocketContext.Provider value={value}>
      <Outlet />
    </NotificationSocketContext.Provider>
  );
}

export function useNotificationSocketContext(): UseNotificationSocketResultInterface {
  const context: UseNotificationSocketResultInterface | null =
    useContext(NotificationSocketContext);

  if (!context) {
    throw new Error(
      'useNotificationSocketContext must be used within a NotificationSocketProvider',
    );
  }

  return context;
}
