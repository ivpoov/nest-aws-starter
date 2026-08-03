import type { ReactElement } from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../../stores/auth.store';

export function AuthGate(): ReactElement {
  const accessToken: string | null = useAuthStore((state) => state.accessToken);

  if (!accessToken) return <Navigate to="/login" replace />;

  return <Outlet />;
}
