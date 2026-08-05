import { createContext, type ReactElement, type ReactNode, useContext } from 'react';
import { useNotificationSocket } from '../hooks/notifications/useNotificationSocket';
import type { UseNotificationSocketResultInterface } from '../interfaces/use-notification-socket-result.interface';

const NotificationSocketContext = createContext<UseNotificationSocketResultInterface | null>(null);

interface NotificationSocketProviderPropsInterface {
  readonly children: ReactNode;
}

// One socket per tab: mounted once around the guarded admin shell
// (AdminLayout) so the bell, the dropdown, and the history page read the
// same live state instead of each opening their own connection.
export function NotificationSocketProvider({
  children,
}: NotificationSocketProviderPropsInterface): ReactElement {
  const value: UseNotificationSocketResultInterface = useNotificationSocket();

  return (
    <NotificationSocketContext.Provider value={value}>
      {children}
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
